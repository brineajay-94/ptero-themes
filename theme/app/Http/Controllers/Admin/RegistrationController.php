<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Http\Controllers\Controller;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class RegistrationController extends Controller
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
        private AlertsMessageBag $alert,
    ) {
    }

    /**
     * Render the registration settings page: the enable switch and the
     * Application API key that POST /auth/register uses to create users.
     */
    public function index(): View
    {
        $key = trim((string) $this->settings->get('Brine::registration_api_key', ''));

        return view('admin.registration', [
            'enabled' => $this->settings->get('Brine::registration_enabled') === '1',
            'keySaved' => $key !== '',
            'keyHint' => $this->maskKey($key),
        ]);
    }

    /**
     * Save the enable switch and (optionally) a new Application API key.
     * An empty key field keeps the currently stored key.
     */
    public function update(Request $request): RedirectResponse
    {
        try {
            $request->validate([
                'api_key' => 'nullable|string|max:500',
            ]);
        } catch (ValidationException $exception) {
            $this->alert->danger('Could not save: ' . implode(' ', $exception->errors()['api_key'] ?? ['bad input']))->flash();

            return redirect()->route('admin.registration');
        }

        $this->settings->set('Brine::registration_enabled', $request->boolean('enabled') ? '1' : '0');

        $key = trim((string) $request->input('api_key', ''));
        if ($key !== '') {
            $key = (string) preg_replace('/^Bearer\s+/i', '', $key);
            $this->settings->set('Brine::registration_api_key', $key);
        }

        $enabled = $this->settings->get('Brine::registration_enabled') === '1';
        if ($enabled && $this->apiKey() === '') {
            $this->alert->warning('Registration is ON, but no Application API key is saved - new users will see an error until you paste one.')->flash();
        } else {
            $this->alert->success('Registration settings saved.')->flash();
        }

        return redirect()->route('admin.registration');
    }

    /**
     * Remove the stored Application API key (registration stays as configured).
     */
    public function destroy(): RedirectResponse
    {
        $this->settings->set('Brine::registration_api_key', '');

        $this->alert->success('Application API key removed - registration will not work until a new key is saved.')->flash();

        return redirect()->route('admin.registration');
    }

    private function apiKey(): string
    {
        $key = trim((string) $this->settings->get('Brine::registration_api_key', ''));

        return (string) preg_replace('/^Bearer\s+/i', '', $key);
    }

    /**
     * Never echo the full key back into the page - only the last 4 chars.
     */
    private function maskKey(string $key): string
    {
        if ($key === '') {
            return '';
        }

        return str_repeat('*', max(strlen($key) - 4, 0)) . substr($key, -4);
    }
}
