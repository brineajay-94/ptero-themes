<?php

namespace Pterodactyl\Services\Social;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Users\UserCreationService;

/**
 * Google and Discord sign-in, implemented directly against each provider's
 * OAuth2 authorization-code flow.
 *
 * WHY NOT SOCIALITE
 * -----------------
 * The panel has no `laravel/socialite` and adding it would mean editing the
 * panel's composer.json and its lockfile. A theme that can only be installed by
 * mutating the host application's dependency tree is a theme that breaks the
 * moment the admin upgrades the panel, so the flow is written out here instead.
 * Everything it uses - `Illuminate\Support\Facades\Http` (guzzle), the session,
 * `Crypt` - already ships with Laravel.
 *
 * THE FLOW
 * --------
 *   1. `redirect()`  - mint a random `state`, park it in the session, 302 the
 *                      browser to the provider's consent screen.
 *   2. `callback()`  - compare the returned `state` to the parked one
 *                      (constant time), swap the `code` for an access token,
 *                      read the profile, resolve an account, sign in.
 *
 * SECURITY NOTES, since this is the part that has to be right
 * -----------------------------------------------------------
 *   - `state` is the CSRF defence. Without it an attacker can feed a victim's
 *     browser a callback URL carrying the attacker's own authorization code
 *     and log that victim in as the attacker. It is generated per attempt with
 *     `Str::random(64)`, stored in the session, compared with `hash_equals`,
 *     and pulled (not read) so a code can never be replayed.
 *
 *   - The provider name is never interpolated into a URL from user input. It is
 *     looked up in the self::PROVIDERS whitelist and an unknown value 404s
 *     before any request is made, so there is no SSRF surface here even though
 *     the token and userinfo URLs are configuration.
 *
 *   - `email_verified` is REQUIRED, not preferred. The linking rule is "match
 *     on verified email", so an unverified address must never reach the lookup -
 *     that is the whole basis for deciding whose account gets opened. Google
 *     sends `email_verified`, Discord sends `verified`; both are read.
 *
 *   - A client secret is a credential, so it is encrypted at rest with the
 *     panel's APP_KEY rather than stored as plain text like every other value
 *     in the settings table. It is never echoed back to a view.
 *
 *   - Accounts with 2FA enabled are REFUSED here rather than signed in. The
 *     panel's checkpoint flow needs a `confirmationToken` minted by
 *     `AuthenticationService`, which only the stock password path produces;
 *     quietly bypassing it would turn social sign-in into a way around a
 *     factor the user deliberately turned on. They are sent to the normal login
 *     form with an explanation instead.
 */
class SocialAuthService
{
    /**
     * The supported providers.
     *
     * This is a whitelist and it is exhaustive on purpose: nothing outside it
     * can be reached, and the client_id/secret for a provider are only ever read
     * through `credentials()` which looks the name up here first.
     *
     * `verify` names the boolean field each provider uses to assert the email
     * address is verified. They are not the same key.
     */
    private const PROVIDERS = [
        'google' => [
            'label' => 'Google',
            'authorize' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'token' => 'https://oauth2.googleapis.com/token',
            'userinfo' => 'https://openidconnect.googleapis.com/v1/userinfo',
            'scopes' => ['openid', 'email', 'profile'],
            // Google's consent screen asks for "see your personal info" without
            // these; the scope request is what makes it show.
            'prompt' => 'select_account',
            'verify' => 'email_verified',
        ],
        'discord' => [
            'label' => 'Discord',
            'authorize' => 'https://discord.com/oauth2/authorize',
            'token' => 'https://discord.com/api/oauth2/token',
            'userinfo' => 'https://discord.com/api/v10/users/@me',
            // `identify` for the account, `email` for the address. Discord will
            // not return an email at all without the second one.
            'scopes' => ['identify', 'email'],
            'verify' => 'verified',
        ],
    ];

    /**
     * How long a parked `state` stays usable, in seconds.
     *
     * Long enough for someone to work through a consent screen and a password
     * manager prompt, short enough that a state left in the session is not a
     * standing token.
     */
    private const STATE_TTL = 900;

    /**
     * Upstream calls to Google and Discord.
     */
    private const HTTP_TIMEOUT = 10;

    public function __construct(
        private SettingsRepositoryInterface $settings,
        private UserCreationService $creationService,
    ) {
    }

    /**
     * The providers that are switched on AND have usable credentials.
     *
     * This is what the login screen renders, so it deliberately does not
     * distinguish "disabled" from "enabled but half-configured": either way
     * there is no button, because a button that cannot complete a flow is worse
     * than no button.
     *
     * @return array<int, string>
     */
    public function enabledProviders(): array
    {
        $usable = [];

        foreach (array_keys(self::PROVIDERS) as $provider) {
            if ($this->isUsable($provider)) {
                $usable[] = $provider;
            }
        }

        return $usable;
    }

    /**
     * Is this a provider we know about at all?
     */
    public function isKnown(string $provider): bool
    {
        return isset(self::PROVIDERS[$provider]);
    }

    /**
     * Human-readable provider name, for messages.
     */
    public function label(string $provider): string
    {
        return self::PROVIDERS[$provider]['label'] ?? ucfirst($provider);
    }

    /**
     * True when the admin has enabled the provider and supplied a client id and
     * secret for it.
     */
    public function isUsable(string $provider): bool
    {
        if (!$this->isKnown($provider)) {
            return false;
        }

        if ($this->setting('Brine::social_' . $provider . '_enabled') !== '1') {
            return false;
        }

        $credentials = $this->credentials($provider);

        return $credentials['client_id'] !== '' && $credentials['client_secret'] !== '';
    }

    /**
     * Is a client secret stored for this provider?
     *
     * Reads through `decrypt()` rather than testing the raw stored string, so a
     * secret that is present but no longer readable (APP_KEY rotated, value
     * written before encryption existed) is reported as missing. Reporting it as
     * present would tell the admin "leave blank to keep" for a value that cannot
     * be used, which is the one message that would send them looking in the wrong
     * place.
     */
    public function hasSecret(string $provider): bool
    {
        if (!$this->isKnown($provider)) {
            return false;
        }

        return $this->decrypt($this->setting('Brine::social_' . $provider . '_client_secret')) !== '';
    }

    /**
     * The callback URL the admin must register with the provider.
     *
     * Shown on the admin page as a copyable value. It is derived from the app
     * URL rather than hardcoded, so a panel served from a subdirectory or a
     * different hostname produces the URL that actually has to be pasted into
     * the provider console - a mismatch here is the single most common reason a
     * social login appears to be "broken".
     */
    public function callbackUrl(string $provider): string
    {
        return route('auth.social.callback', ['provider' => $provider]);
    }

    /**
     * Begin the flow: park a `state` and send the browser to the provider.
     *
     * @return array{redirect: string}|array{error: string}
     */
    public function redirect(string $provider): array
    {
        if (!$this->isKnown($provider)) {
            return ['error' => 'unknown_provider'];
        }

        if (!$this->isUsable($provider)) {
            // Deliberately a 404 rather than a "not configured" message: from the
            // outside, a provider that is switched off and one that was never
            // set up should be indistinguishable.
            return ['error' => 'not_configured'];
        }

        $state = Str::random(64);

        // Keyed by provider so opening two providers in two tabs does not make
        // the second one invalidate the first.
        session()->put($this->sessionKey($provider), [
            'state' => $state,
            'at' => time(),
        ]);

        return ['redirect' => $this->authorizationUrl($provider, $state)];
    }

    /**
     * Finish the flow and sign the user in.
     *
     * @return array{user: User}|array{error: string, message: string}
     */
    public function callback(Request $request, string $provider): array
    {
        if (!$this->isKnown($provider) || !$this->isUsable($provider)) {
            return ['error' => 'not_configured', 'message' => 'That sign-in method is not available.'];
        }

        // The state is consumed FIRST, before anything else is looked at, so
        // every path out of this method burns it - including the two below,
        // where the provider sent an error instead of a code. Leaving a state
        // parked because someone hit "Cancel" would leave a second usable one
        // sitting in the session for the rest of its TTL.
        if (!$this->consumeState($provider, $request->string('state')->toString())) {
            return [
                'error' => 'bad_state',
                'message' => 'That sign-in link has expired or was already used. Please try again.',
            ];
        }

        // The user may have hit "Cancel" on the consent screen, which comes back
        // as ?error=access_denied with no code at all.
        if ($request->filled('error')) {
            return [
                'error' => 'declined',
                'message' => $request->string('error')->toString() === 'access_denied'
                    ? 'Sign-in was cancelled.'
                    : 'The provider refused the sign-in request.',
            ];
        }

        $code = $request->string('code')->toString();
        if ($code === '') {
            return ['error' => 'missing_code', 'message' => 'The provider did not return a sign-in code.'];
        }

        $credentials = $this->credentials($provider);
        $exchanged = $this->exchangeCode($provider, $credentials, $code);

        if (isset($exchanged['error'])) {
            return ['error' => 'token_failed', 'message' => $exchanged['error']];
        }

        $profile = $this->fetchProfile($provider, $exchanged['token']);

        if ($profile === null) {
            return [
                'error' => 'profile_failed',
                'message' => 'Could not read your ' . $this->label($provider) . ' profile.',
            ];
        }

        return $this->signIn($request, $profile);
    }

    /**
     * Resolve a verified profile to a panel account and open a session for it.
     *
     * @param  array{id: string, email: string, email_verified: bool, name: string, username: string}  $profile
     * @return array{user: User}|array{error: string, message: string}
     */
    private function signIn(Request $request, array $profile): array
    {
        $user = User::query()->where('email', $profile['email'])->first();

        if ($user === null) {
            $created = $this->createFromProfile($profile);

            if (isset($created['error'])) {
                return ['error' => 'creation_failed', 'message' => $created['error']];
            }

            $user = $created['user'];
        }

        // 2FA is the reason this can fail after the account is known. See the
        // class docblock: signing in anyway would be a way around a factor the
        // user turned on themselves.
        if ($this->hasTwoFactor($user)) {
            return [
                'error' => 'two_factor',
                'message' => 'This account has two-factor authentication enabled. Sign in with your password to continue.',
            ];
        }

        // `auth()->login` is the panel's own guard, so the session cookie, the
        // `auth.session` middleware and the CSRF token all behave exactly as
        // they do after a stock password login.
        //
        // The session id is regenerated first. That is what prevents session
        // fixation: the browser has been carrying one pre-auth session cookie
        // through the entire round trip to the provider, so the id it holds
        // afterwards is one an attacker could have known. Logging out first
        // clears any user already on this session - otherwise walking up to a
        // logged-in browser and completing the flow would switch accounts
        // without a password.
        //
        // The `true` is "remember me", matching a stock login, so a social user
        // is not silently signed out on the next browser restart.
        auth()->logout();
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        auth()->login($user, true);

        return ['user' => $user];
    }

    /**
     * Create a panel account for a profile that has no matching email.
     *
     * `{user}` or `{error}`, for the same reason as `exchangeCode()`: the
     * success case is an object and the failure case is a string, so neither can
     * be mistaken for the other.
     *
     * @return array{user: User}|array{error: string}
     */
    private function createFromProfile(array $profile): array
    {
        // The admin's registration switch governs this too. A panel that has
        // turned registration off to stop sign-up spam has not decided that
        // social sign-up is exempt, so an unknown address is refused rather than
        // quietly enrolled. Existing users are unaffected - they are matched
        // above and never reach this method.
        if ($this->setting('Brine::registration_enabled') !== '1') {
            return ['error' => 'Registration is closed on this panel. Ask an administrator to create your account.'];
        }

        $username = $this->uniqueUsername($profile);
        [$first, $last] = $this->splitName($profile);

        try {
            $this->creationService->handle([
                'email' => $profile['email'],
                'username' => $username,
                'name_first' => $first,
                'name_last' => $last,
                // Social users have no password. A long random one is stored
                // rather than left null so the column's NOT NULL and the
                // password-confirmation rules stay satisfied; nobody knows it, so
                // it cannot be used to sign in. The account is effectively
                // password-locked to the provider, which is the intent.
                'password' => Str::random(48),
                'root_admin' => false,
                'language' => $this->language(),
            ]);
        } catch (\Throwable $exception) {
            Log::error('brine-theme: social account creation failed: ' . $exception->getMessage());

            return ['error' => 'Your account could not be created. Please contact an administrator.'];
        }

        $user = User::query()->where('email', $profile['email'])->first();

        if ($user === null) {
            return ['error' => 'Your account could not be created. Please contact an administrator.'];
        }

        return ['user' => $user];
    }

    /**
     * Build the provider's consent-screen URL.
     */
    private function authorizationUrl(string $provider, string $state): string
    {
        $config = self::PROVIDERS[$provider];
        $credentials = $this->credentials($provider);

        $query = [
            'client_id' => $credentials['client_id'],
            'redirect_uri' => $this->callbackUrl($provider),
            'response_type' => 'code',
            'scope' => implode(' ', $config['scopes']),
            'state' => $state,
        ];

        if (isset($config['prompt'])) {
            $query['prompt'] = $config['prompt'];
        }

        return $config['authorize'] . '?' . http_build_query($query);
    }

    /**
     * Swap the authorization code for an access token.
     *
     * The return shape is `{token}` or `{error}`, never a bare nullable string.
     * An access token is itself a string, so a `?string` return could not
     * distinguish "here is your token" from "here is an error message" - the
     * caller testing `is_string()` would treat every success as a failure.
     *
     * @param  array{client_id: string, client_secret: string}  $credentials
     * @return array{token: string}|array{error: string}
     */
    private function exchangeCode(string $provider, array $credentials, string $code): array
    {
        $config = self::PROVIDERS[$provider];

        try {
            $response = Http::asForm()
                ->timeout(self::HTTP_TIMEOUT)
                ->post($config['token'], [
                    'client_id' => $credentials['client_id'],
                    'client_secret' => $credentials['client_secret'],
                    'code' => $code,
                    // Must be byte-identical to the one sent on the way out or
                    // the provider rejects the exchange.
                    'redirect_uri' => $this->callbackUrl($provider),
                    'grant_type' => 'authorization_code',
                ]);
        } catch (ConnectionException $exception) {
            Log::warning('brine-theme: could not reach ' . $config['label'] . ' token endpoint: ' . $exception->getMessage());

            return ['error' => 'Could not reach ' . $this->label($provider) . '. Please try again.'];
        }

        if (!$response->successful()) {
            // Log the provider's own error, never the client secret. The most
            // common cause by far is a redirect_uri that does not match the one
            // registered in the provider console.
            Log::warning('brine-theme: ' . $config['label'] . ' refused the code exchange: ' . $response->body());

            return ['error' => $this->label($provider) . ' refused the sign-in. Check the callback URL registered with them.'];
        }

        $token = $response->json('access_token');

        if (!is_string($token) || $token === '') {
            return ['error' => $this->label($provider) . ' did not return a usable token.'];
        }

        return ['token' => $token];
    }

    /**
     * Read the profile for an access token and normalise it.
     *
     * Returns null unless the address is present AND the provider says it is
     * verified. That second condition is load-bearing - see the class docblock.
     *
     * @return array{id: string, email: string, email_verified: bool, name: string, username: string}|null
     */
    private function fetchProfile(string $provider, string $accessToken): ?array
    {
        $config = self::PROVIDERS[$provider];

        try {
            $response = Http::withToken($accessToken)
                ->timeout(self::HTTP_TIMEOUT)
                ->acceptJson()
                ->get($config['userinfo']);
        } catch (ConnectionException $exception) {
            Log::warning('brine-theme: could not reach ' . $config['label'] . ' userinfo: ' . $exception->getMessage());

            return null;
        }

        if (!$response->successful()) {
            Log::warning('brine-theme: ' . $config['label'] . ' userinfo returned ' . $response->status());

            return null;
        }

        $email = $response->json('email');
        if (!is_string($email) || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }

        // Discord sends `verified`, Google sends `email_verified`, and the type
        // has been a bool in both APIs but a string in some error payloads -
        // accept either rather than failing a real user over the shape.
        $verified = $response->json($config['verify']);
        $isVerified = $verified === true || $verified === 'true' || $verified === 1 || $verified === '1';

        if (!$isVerified) {
            Log::notice('brine-theme: refused a ' . $config['label'] . ' sign-in for an unverified address.');

            return null;
        }

        $subject = $response->json('sub', $response->json('id'));
        $name = $response->json('name', $response->json('global_name'));
        $username = $response->json('preferred_username', $response->json('username'));

        return [
            'id' => is_string($subject) ? $subject : '',
            'email' => strtolower($email),
            'email_verified' => true,
            'name' => is_string($name) ? trim($name) : '',
            'username' => is_string($username) ? $username : '',
        ];
    }

    /**
     * Validate the callback's `state` against the one parked at the start of the
     * flow, consuming it either way.
     *
     * `pull` is the important part: a state is good for exactly one callback, so
     * a replayed URL finds nothing to match against.
     */
    private function consumeState(string $provider, string $received): bool
    {
        $key = $this->sessionKey($provider);
        $parked = session()->pull($key);

        if (!is_array($parked) || !isset($parked['state'], $parked['at'])) {
            return false;
        }

        if ((time() - (int) $parked['at']) > self::STATE_TTL) {
            return false;
        }

        // Constant time so the comparison does not leak the state one byte at a
        // time. Returns false for a length mismatch, which is fine: length is
        // not the secret.
        return $received !== '' && hash_equals((string) $parked['state'], $received);
    }

    private function sessionKey(string $provider): string
    {
        return 'brine_social_state.' . $provider;
    }

    /**
     * The provider's client id and decrypted client secret.
     *
     * @return array{client_id: string, client_secret: string}
     */
    private function credentials(string $provider): array
    {
        $clientId = $this->setting('Brine::social_' . $provider . '_client_id');
        $secret = $this->decrypt($this->setting('Brine::social_' . $provider . '_client_secret'));

        return [
            'client_id' => trim($clientId),
            'client_secret' => trim($secret),
        ];
    }

    /**
     * Encrypt a client secret for storage.
     *
     * The settings table is plain text, and a client secret is a live
     * credential for the admin's Google/Discord application - anyone with
     * database read access (a backup, a replica) could otherwise mint tokens as
     * this panel. `Crypt` uses the panel's APP_KEY, so the value is only
     * readable by this installation.
     */
    public function encryptSecret(string $plain): string
    {
        if ($plain === '') {
            return '';
        }

        try {
            return Crypt::encryptString($plain);
        } catch (\Throwable $exception) {
            // A missing or changed APP_KEY must not lose the admin's work. Log
            // it loudly: this value will not be readable next time.
            Log::error('brine-theme: could not encrypt a social client secret - check APP_KEY. ' . $exception->getMessage());

            return $plain;
        }
    }

    /**
     * Decrypt a stored client secret, tolerating a value that was stored before
     * encryption existed or while APP_KEY was broken.
     */
    private function decrypt(string $stored): string
    {
        if ($stored === '') {
            return '';
        }

        try {
            return Crypt::decryptString($stored);
        } catch (\Throwable) {
            // Not encrypted - treat it as plain text.
            return $stored;
        }
    }

    /**
     * Read one Brine:: setting as a trimmed string, or '' when it is unset.
     *
     * The `''` default is load-bearing: Pterodactyl's SettingsRepository throws
     * NoSuchSettingException for a key that has never been written unless a
     * default is supplied, and `?? ''` cannot catch that because it is an
     * exception rather than a null. `isUsable()` runs on every page render via
     * AssetComposer, so an unguarded read here would take down the panel's login
     * screen on any install that had never saved these settings.
     */
    private function setting(string $key): string
    {
        try {
            $value = $this->settings->get($key, '');
        } catch (\Throwable) {
            return '';
        }

        return is_string($value) ? trim($value) : '';
    }

    /**
     * A username derived from the profile that satisfies the panel's
     * alpha_dash 3-60 rule and is not already taken.
     *
     * Pterodactyl stores usernames in one global namespace, so the provider's
     * name cannot be used verbatim - two people can have the same Discord tag.
     * A numeric suffix is appended until it is free.
     */
    private function uniqueUsername(array $profile): string
    {
        $candidates = [$profile['username'], $profile['name']];

        // The local part of the address is the last resort, and a better one than
        // a random string - it is at least recognisable to the person logging in.
        if (str_contains($profile['email'], '@')) {
            $candidates[] = Str::before($profile['email'], '@');
        }

        $base = '';
        foreach ($candidates as $candidate) {
            $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', $candidate) ?? '';
            if (mb_strlen($clean) >= 3) {
                $base = mb_substr($clean, 0, 45);

                break;
            }
        }

        if ($base === '') {
            $base = 'user' . Str::lower(Str::random(8));
        }

        $username = $base;
        $suffix = 1;

        while (User::query()->where('username', $username)->exists()) {
            $username = $base . $suffix;
            $suffix++;

            // Hard stop, so a pathological run of taken names cannot spin.
            if ($suffix > 50) {
                $username = $base . Str::lower(Str::random(8));

                break;
            }
        }

        return $username;
    }

    /**
     * Split a display name into the two fields the panel requires.
     *
     * Both are NOT NULL, and providers do not guarantee a name at all, so
     * anything unparseable falls back to the username rather than an empty
     * string, which the model would reject.
     *
     * @return array{0: string, 1: string}
     */
    private function splitName(array $profile): array
    {
        $name = trim($profile['name']);
        $fallback = $profile['username'] !== '' ? $profile['username'] : Str::before($profile['email'], '@');

        if ($name === '') {
            return [mb_substr($fallback, 0, 60), 'User'];
        }

        $parts = preg_split('/\s+/', $name, 2) ?: [];
        $first = trim($parts[0] ?? '');
        $last = trim($parts[1] ?? '');

        return [
            mb_substr($first !== '' ? $first : $fallback, 0, 60),
            mb_substr($last !== '' ? $last : 'User', 0, 60),
        ];
    }

    /**
     * Does this account have 2FA turned on?
     *
     * Checked against the schema rather than assumed: `use_totp` is a column
     * this panel does not necessarily have, and asking for a missing one throws.
     */
    private function hasTwoFactor(User $user): bool
    {
        try {
            return (bool) $user->use_totp;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Prefer the panel locale, but only when the User model accepts it.
     */
    private function language(): string
    {
        $locale = (string) (config('app.locale') ?: 'en');
        $available = array_keys((new User)->getAvailableLanguages());

        return in_array($locale, $available, true) ? $locale : 'en';
    }
}
