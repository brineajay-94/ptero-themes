<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Container\Container;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Social\SocialAuthService;
use Pterodactyl\Services\Users\UserUpdateService;
use Pterodactyl\Exceptions\Model\DataValidationException;

/**
 * Change the email address on the signed-in account.
 *
 * WHY THIS IS A THEME ENDPOINT RATHER THAN THE PANEL'S
 * ----------------------------------------------------
 * The panel already has this: `PUT /api/client/account/email`, which verifies
 * the current password in `UpdateEmailRequest::authorize()` and then writes
 * through `UserUpdateService`. So the write half below is the panel's own code,
 * not a reimplementation - but the request has to arrive HERE first, for one
 * reason:
 *
 * `routes/api-client.php` is a panel file the theme does not ship, so there is
 * nowhere to hang the rule this feature needs: a session opened with Google or
 * Discord must not be able to change the address. The panel cannot express that
 * rule (it has no concept of a social session), so hiding the button in the UI
 * would be the whole of the enforcement - and hiding a button is not a check.
 * A theme endpoint is the only place a policy the panel has no idea about can be
 * enforced, so the policy is enforced here and the write is handed to the panel.
 *
 * THE RULES, IN THE ORDER THEY ARE CHECKED
 * ---------------------------------------
 *   1. Was this session opened by a provider?  -> refuse, and refuse BEFORE the
 *      password check on purpose: a session that may not make this change should
 *      not be able to use it to test whether a password is correct either.
 *   2. Has this account already changed its address three times today?  The
 *      panel applies exactly this limit on its own endpoint, so the same key is
 *      reused here: a user who has burned it on one path has burned it on both.
 *   3. Is the submitted password this account's current one?  Hashed with the
 *      panel's own `Hasher`, the same call the panel's request makes.
 *   4. Is the new address acceptable?  Read from `User::getRulesForUpdate()`, so
 *      it is the model's own format and uniqueness rules rather than a copy of
 *      them - including the `unique` rule rewritten to ignore this row, which is
 *      the part that is easy to get wrong by hand and produces "already taken"
 *      when you save an address that never changed.
 */
class AccountEmailController extends Controller
{
    /**
     * Seconds the daily change budget lasts. Same value as the panel's own
     * `AccountController::EMAIL_UPDATE_THROTTLE`, and the reason it is repeated
     * rather than read is that constant is private.
     */
    private const EMAIL_UPDATE_THROTTLE = 60 * 60 * 24;

    /**
     * How many changes that budget allows per day.
     */
    private const EMAIL_UPDATE_LIMIT = 3;

    public function __construct(
        private UserUpdateService $updateService,
        private SocialAuthService $social,
    ) {
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        // The route carries the panel's `auth` middleware, so there is always a
        // user here. Stated rather than assumed because every line below reads
        // off $user, and one that cannot happen turning into a fatal on a theme
        // running inside someone else's panel is a bad trade for a null check.
        if ($user === null) {
            return $this->refused('Unauthenticated', 'You are not signed in.', null, 401);
        }

        // 1. How this session was opened. See the class docblock for why this is
        //    first: it must not be a password oracle for a session that is not
        //    allowed to make the change anyway.
        $provider = SocialAuthService::sessionProvider();

        if ($provider !== null) {
            return $this->refused(
                'Forbidden',
                'This browser is signed in with ' . $this->social->label($provider)
                    . '. Sign in with your password to change the address on this account.',
                null,
                403
            );
        }

        // 2. The daily budget, shared with the panel's own endpoint.
        $key = 'user:update-email:' . $user->uuid;

        if (RateLimiter::tooManyAttempts($key, self::EMAIL_UPDATE_LIMIT)) {
            return $this->refused(
                'TooManyRequests',
                'You have changed your email address too many times today. Please try again later.',
                null,
                429
            );
        }

        // 3. The current password. `check()` returns false rather than throwing
        //    for an unreadable hash, which is the answer we want: a social-created
        //    account holds a 48-character random password nobody was told, and
        //    this is where that turns into a refusal instead of an exception.
        $hasher = Container::getInstance()->make(Hasher::class);

        if (!$hasher->check((string) $request->input('password'), (string) $user->password)) {
            return $this->refused(
                'ValidationFailed',
                'That is not your current password.',
                'password'
            );
        }

        // 4. The new address, against the model's own rules. Caught rather than
        //    left to bubble: `validate()` throws a ValidationException whose body
        //    is Laravel's shape, which `httpErrorToHuman()` cannot read (it wants
        //    the panel's `errors[0].detail`), so an uncaught one would arrive at
        //    the form as a bare "Request failed with status code 422".
        try {
            $validated = $request->validate([
                'email' => User::getRulesForUpdate($user)['email'] ?? ['required', 'email', 'max:191'],
            ]);
        } catch (ValidationException $exception) {
            return $this->refused('ValidationFailed', $this->firstMessage($exception->errors()), 'email');
        }

        $email = (string) $validated['email'];

        // Captured before the write: `UserUpdateService::handle()` calls
        // `refresh()`, which re-syncs the model's original attributes, so reading
        // the "before" value afterwards would produce the new address twice.
        $original = (string) $user->email;

        // An address that differs only by case is the same row: the panel's
        // columns collate case-insensitively, so writing it would be a no-op that
        // still charged the user's daily budget.
        if (mb_strtolower($email) === mb_strtolower($original)) {
            return new JsonResponse([], Response::HTTP_NO_CONTENT);
        }

        try {
            $this->updateService->handle($user, ['email' => $email]);
        } catch (DataValidationException $exception) {
            // The model validates itself on save as well as against rule 4 above,
            // and wraps the failure in DataValidationException rather than letting
            // the ValidationException through - so this is the catch that actually
            // fires. Both read the same rule array, so reaching it means the row
            // changed under us: another request took the address first. Still a
            // field error, not a 500.
            return $this->refused('ValidationFailed', $this->firstMessage($exception->getMessageBag()->toArray()), 'email');
        } catch (\Throwable) {
            return $this->refused(
                'UpdateFailed',
                'The address could not be changed. Please try again, or contact an administrator.',
                null,
                500
            );
        }

        RateLimiter::hit($key, self::EMAIL_UPDATE_THROTTLE);

        // The panel's own endpoint logs this too, so an admin auditing the
        // account sees the same entry whichever path was used. `subject()` is set
        // here rather than by the panel's `AccountSubject` middleware, which does
        // not run on the web group; the actor is picked up from the guard.
        //
        // Failure to log must not undo a change that already committed, and
        // `ActivityLogService::log()` swallows its own exceptions outside debug
        // mode, so this cannot turn a success into a 500.
        Activity::event('user:account.email-changed')
            ->subject($user)
            ->property(['old' => $original, 'new' => $email])
            ->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * The first message out of a validation error bag, with a fallback.
     *
     * The fallback is not decoration: Laravel allows a rule set to pass with no
     * messages, and a null handed to `refused()` would be a TypeError on a `string`
     * parameter - turning a field error into a 500, which is the opposite of what
     * this class is for.
     */
    private function firstMessage(array $messages): string
    {
        $message = collect($messages)->flatten()->filter()->first();

        return is_string($message) && $message !== '' ? $message : 'That email address cannot be used.';
    }

    /**
     * A refusal in the panel's own error shape.
     *
     * `httpErrorToHuman()` reads `errors[0].detail`, and a form that wants to put
     * the message under a specific input reads `errors[0].meta.field` - a key the
     * theme defines, carrying the wire field name the form maps back to its own.
     * Passing null for the field means "nothing in particular", and the form
     * falls back to the flash.
     */
    private function refused(string $code, string $detail, ?string $field = null, int $status = 422): JsonResponse
    {
        $error = ['code' => $code, 'detail' => $detail];

        if ($field !== null) {
            $error['meta'] = ['field' => $field];
        }

        return response()->json(['errors' => [$error]], $status);
    }
}