<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
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
            $clientId = (string) ($this->settings->get('Brine::social_' . $provider . '_client_id') ?? '');
            $hasSecret = trim((string) ($this->settings->get('Brine::social_' . $provider . '_client_secret') ?? '')) !== '';

            $providers[$provider] = [
                'label' => $this->social->label($provider),
                'enabled' => $this->settings->get('Brine::social_' . $provider . '_enabled') === '1',
                'client_id' => $clientId,
                'has_secret' => $hasSecret,
                // Read back through the service, so a secret that is present but
                // no longer decryptable (APP_KEY rotated) is reported as
                // unusable rather than as configured.
                'usable' => $this->social->isUsable($provider),
                'callback' => $this->social->callbackUrl($provider),
                'scopes' => $provider === 'google'
                    ? 'openid email profile'
                    : 'identify email',
            ];
        }

        return view('admin.social-auth', [
            'providers' => $providers,
            'registration_enabled' => $this->settings->get('Brine::registration_enabled') === '1',
        ]);
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
        $validated = $request->validate([
            'google.enabled' => 'nullable|boolean',
            'google.client_id' => 'nullable|string|max:255',
            'google.client_secret' => 'nullable|string|max:512',
            'discord.enabled' => 'nullable|boolean',
            'discord.client_id' => 'nullable|string|max:255',
            'discord.client_secret' => 'nullable|string|max:512',
        ]);

        $messages = [];

        foreach (['google', 'discord'] as $provider) {
            $this->settings->set('Brine::social_' . $provider . '_enabled', $request->boolean($provider . '.enabled') ? '1' : '0');

            $clientId = $validated[$provider . '.client_id'] ?? null;
            if (is_string($clientId) && trim($clientId) !== '') {
                $this->settings->set('Brine::social_' . $provider . '_client_id', trim($clientId));
            }

            // A blank secret field means "unchanged", not "erase it". Erasing is
            // done with the explicit clear button below, because this is the one
            // field the admin cannot see the current value of.
            $secret = $validated[$provider . '.client_secret'] ?? null;
            if (is_string($secret) && trim($secret) !== '') {
                $this->settings->set(
                    'Brine::social_' . $provider . '_client_secret',
                    $this->social->encryptSecret(trim($secret))
                );
            }

            $status = $this->social->isUsable($provider);
            $messages[] = $this->social->label($provider) . ': ' . ($status
                ? '<span class="label label-success">READY</span>'
                : ($request->boolean($provider . '.enabled')
                    ? '<span class="label label-warning">NEEDS CLIENT ID AND SECRET</span>'
                    : '<span class="label label-default">DISABLED</span>'));
        }

        $this->alert->success('Social login settings saved. ' . implode(' &nbsp;|&nbsp; ', $messages))->flash();

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
