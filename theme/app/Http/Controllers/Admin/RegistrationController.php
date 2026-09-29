<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
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
     * Render the registration settings page: the switch that turns public
     * sign-up (/auth/register) on or off.
     */
    public function index(): View
    {
        return view('admin.registration', [
            'enabled' => $this->settings->get('Brine::registration_enabled') === '1',
        ]);
    }

    /**
     * Save the enable switch. Accounts are created directly by the panel's
     * own user service, so there is nothing else to configure here.
     */
    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'enabled' => 'nullable|boolean',
        ]);

        $enabled = $request->boolean('enabled');
        $this->settings->set('Brine::registration_enabled', $enabled ? '1' : '0');

        // Clean up the Application API key older versions stored here - the
        // direct user service replaced the API call and needs no key.
        $this->settings->forget('Brine::registration_api_key');

        $this->alert->success($enabled ? 'Public registration is now enabled.' : 'Public registration has been disabled.')->flash();

        return redirect()->route('admin.registration');
    }
}
