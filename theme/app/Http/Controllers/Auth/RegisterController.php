<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Models\User;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Services\Users\UserCreationService;
use Pterodactyl\Exceptions\Model\DataValidationException;

class RegisterController extends Controller
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
        private UserCreationService $creationService,
    ) {
    }

    /**
     * Render the base authentication view for /auth/register. React takes over
     * from here exactly like it does for the login screen. Registration is a
     * brine-theme feature - when the admin has not enabled it the visitor is
     * simply sent back to the login page.
     */
    public function index(): View|\Illuminate\Http\RedirectResponse
    {
        if (!$this->enabled()) {
            return redirect()->route('auth.login');
        }

        return view('templates/auth.core');
    }

    /**
     * Create the account directly through the panel's own user service - the
     * exact same UserCreationService the Admin -> Users page uses. That hashes
     * the password, assigns a UUID, logs the event and sends the welcome
     * e-mail. No Application API key and no HTTP call to ourselves.
     */
    public function register(Request $request): JsonResponse
    {
        if (!$this->enabled()) {
            abort(404);
        }

        try {
            $data = $request->validate([
                'email' => 'required|email|max:255',
                'first_name' => 'required|string|max:60',
                'last_name' => 'required|string|max:60',
                'username' => 'required|alpha_dash|min:3|max:60',
                'password' => 'required|string|min:8|confirmed',
            ]);
        } catch (ValidationException $exception) {
            return $this->validationResponse($exception->errors());
        }

        try {
            $this->creationService->handle([
                'email' => $data['email'],
                'username' => $data['username'],
                'name_first' => $data['first_name'],
                'name_last' => $data['last_name'],
                'password' => $data['password'],
                'root_admin' => false,
                'language' => $this->language(),
            ]);
        } catch (DataValidationException $exception) {
            // Duplicate e-mail/username, username policy, ... - the model's own
            // messages are user friendly, hand them straight to the form.
            return $this->validationResponse($exception->getMessageBag()->toArray());
        } catch (\Throwable $exception) {
            Log::error('brine-theme: registration failed: ' . $exception->getMessage());

            // The account is committed before the welcome e-mail is sent, so a
            // mail failure must NOT read as "registration failed" - the user
            // would retry and hit "e-mail already taken".
            if (User::query()->where('email', $data['email'])->exists()) {
                return response()->json(['data' => ['registered' => true]]);
            }

            return response()->json([
                'errors' => [[
                    'code' => 'RegistrationFailed',
                    'detail' => 'The account could not be created. Please try again, or contact an administrator.',
                ]],
            ], 500);
        }

        return response()->json(['data' => ['registered' => true]]);
    }

    /**
     * Wrap any set of validation messages into the errors array the panel's
     * httpErrorToHuman() renders.
     */
    private function validationResponse(array $errors): JsonResponse
    {
        return response()->json([
            'errors' => collect($errors)
                ->flatten()
                ->map(fn ($message) => ['code' => 'ValidationFailed', 'detail' => $message])
                ->values()
                ->all(),
        ], 422);
    }

    /**
     * Prefer the panel locale, but only when it is one of the languages the
     * User model accepts - otherwise fall back to English.
     */
    private function language(): string
    {
        $locale = (string) (config('app.locale') ?: 'en');
        $available = array_keys((new User)->getAvailableLanguages());

        return in_array($locale, $available, true) ? $locale : 'en';
    }

    private function enabled(): bool
    {
        return $this->settings->get('Brine::registration_enabled') === '1';
    }
}
