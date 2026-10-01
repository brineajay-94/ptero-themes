<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Pterodactyl\Http\Controllers\Controller;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Services\Social\SocialAuthService;

/**
 * Admin -> Social Login: the client id and secret for each provider, and the
 * per-provider switch.
 *
 * The credentials are OAuth2 *client* credentials for an application the admin
 * owns in the Google Cloud Console or the Discord developer portal. They are
 * not the panel's own secrets and nothing about them is derivable, which is why
 * they are form fields rather than something inferred from settings.
 *
 * The secret is encrypted on the way into the settings table
 * (`SocialAuthService::encryptSecret`) and is never rendered back into the form.
 * The input is left blank with a placeholder instead: an admin editing one
 * provider's id should not have to re-type a secret they cannot read, and a
 * blank submission means "leave it alone".
 */
class SocialAuthController extends Controller
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
        private SocialAuthService $social,
        private AlertsMessageBag $alert,
    ) {
    }

    /**
     * Render the page.
     *
     * What is passed to the view is deliberately narrow: whether each provider
     * is switched on, whether a client id is present, whether a secret is
     * present, and the callback URL to paste into the provider console. The
     * client id is shown (it is not a secret) because an admin needs to confirm
     * they are editing the right application; the secret is reduced to a yes/no.
     */
    public function index(): View
    {
        $providers = [];

        foreach (['google', 'discord'] as $provider) {
            $providers[$provider] = [
                'label' => $this->social->label($provider),
                'enabled' => $this->stored('Brine::social_' . $provider . '_enabled') === '1',
                'client_id' => $this->stored('Brine::social_' . $provider . '_client_id'),
                // Whether a secret is present, read through the service so a value
                // that is stored but no longer decryptable (APP_KEY rotated) is
                // reported as missing rather than as configured.
                'has_secret' => $this->social->hasSecret($provider),
                'usable' => $this->social->isUsable($provider),
                'callback' => $this->social->callbackUrl($provider),
                'scopes' => $provider === 'google'
                    ? 'openid email profile'
                    : 'identify email',
            ];
        }

        return view('admin.social-auth', [
            'providers' => $providers,
            'registration_enabled' => $this->stored('Brine::registration_enabled') === '1',
        ]);
    }

    /**
     * Read one Brine:: setting as a trimmed string, or '' when it is unset.
     *
     * The `''` default is required, not defensive decoration. Pterodactyl's
     * `SettingsRepositoryInterface::get()` declares the default as a REQUIRED
     * parameter on current versions
     * (`get(string $key, mixed $default): mixed`), so a single-argument call
     * is an ArgumentCountError there, and older ones that do default it can
     * still surface a not-found rather than a null. Every key read on this page
     * is one that does not exist until an admin saves for the first time, so a
     * read that has to be answered for a missing key is the normal case here,
     * not the exception. The catch is the same belt-and-braces as in
     * `SocialAuthService::setting()`: this page must render on a panel that has
     * never been configured.
     */
    private function stored(string $key): string
    {
        try {
            $value = $this->settings->get($key, '');

            return is_string($value) ? trim($value) : '';
        } catch (\Throwable) {
            return '';
        }
    }

    /**
     * Save the credentials and switches.
     *
     * Validation is per-provider and conditional: only the providers actually
     * posted are validated, because a single form carries all of them and
     * Google being half-filled must not stop Discord from being saved.
     *
     * A provider cannot be left switched on without both halves of a credential
     * pair. Enabling it is allowed - an admin often configures the console side
     * first - but the page then shows it as not yet usable and no button is
     * rendered on the login screen, so a half-configured provider is visible as
     * a problem rather than as a button that fails.
     */
    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'google.enabled' => 'nullable|boolean',
            'google.client_id' => 'nullable|string|max:255',
            'google.client_secret' => 'nullable|string|max:512',
            'discord.enabled' => 'nullable|boolean',
            'discord.client_id' => 'nullable|string|max:255',
            'discord.client_secret' => 'nullable|string|max:512',
        ]);

        $messages = [];

        // Caught, logged, and reported - rather than allowed to become a 500.
        //
        // An uncaught throw here is the least informative failure this page can
        // produce: the browser says "Server Error", the admin cannot tell whether
        // the save happened, and the cause is buried in a log nobody thinks to
        // read. The exception class and message go on the page, because that is
        // the difference between a bug report someone can act on and one they
        // cannot.
        //
        // Logged at error WITH the trace, since the message alone rarely places a
        // framework-level failure.
        try {
            foreach (['google', 'discord'] as $provider) {
                $this->settings->set('Brine::social_' . $provider . '_enabled', $request->boolean($provider . '.enabled') ? '1' : '0');

                // Read the values off the REQUEST, not off $validated.
                //
                // `$request->validate()` does not return the keys it was given:
                // Laravel's validated() walks its own rule keys and re-inserts each
                // value with Arr::set(), so a rule written `google.client_id` comes
                // back as $validated['google']['client_id'] - nested. Reading the
                // dotted key off that array always missed, so neither the client id
                // nor the secret was ever written. The switch saved, because that
                // line reads $request directly, which is why the symptom was
                // "Discord: ON, NOT READY" rather than a hard failure.
                //
                // `input()` takes the same dotted path the form field names use and
                // the same accessor `boolean()` above relies on, so the two cannot
                // drift. validate() above still gates the value as a string within
                // its length limit before it is stored.
                $clientId = $request->input($provider . '.client_id');
                if (is_string($clientId) && trim($clientId) !== '') {
                    $this->settings->set('Brine::social_' . $provider . '_client_id', trim($clientId));
                }

                // A blank secret means "unchanged", not "erase it" - the admin
                // cannot read the stored value back, so erasing needs its own
                // action.
                $secret = $request->input($provider . '.client_secret');
                if (is_string($secret) && trim($secret) !== '') {
                    $this->settings->set(
                        'Brine::social_' . $provider . '_client_secret',
                        $this->social->encryptSecret(trim($secret))
                    );
                }

                $messages[] = $this->social->label($provider) . ': ' . ($this->social->isUsable($provider)
                    ? 'ready'
                    : ($request->boolean($provider . '.enabled')
                        ? 'enabled but incomplete'
                        : 'off'));
            }
        } catch (\Throwable $exception) {
            Log::error('brine-theme: social login save failed: ' . $exception->getMessage(), [
                'exception' => get_class($exception),
                'where' => $exception->getFile() . ':' . $exception->getLine(),
                'trace' => array_slice(explode("\n", $exception->getTraceAsString()), 0, 12),
            ]);

            $this->alert->danger(
                'Could not save: ' . Str::afterLast(get_class($exception), '\\') . ' - ' . $exception->getMessage()
                    . ' (full detail in storage/logs/laravel.log)'
            )->flash();

            return redirect()->route('admin.social-auth');
        }

        $this->alert->success('Social login settings saved - ' . implode(', ', $messages) . '.')->flash();

        return redirect()->route('admin.social-auth');
    }

    /**
     * Forget one provider's client secret.
     *
     * Separate from the save form because "blank means unchanged" makes erasing
     * unreachable otherwise, and an admin rotating an application needs to be
     * able to drop the old secret explicitly.
     */
    public function clearSecret(Request $request, string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, ['google', 'discord'], true), 404);

        $this->settings->forget('Brine::social_' . $provider . '_client_secret');

        $this->alert->success($this->social->label($provider) . ' client secret removed.')->flash();

        return redirect()->route('admin.social-auth');
    }
}
