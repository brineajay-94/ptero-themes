<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Prologue\Alerts\AlertsMessageBag;

class BrandingController extends \Pterodactyl\Http\Controllers\Controller
{
    public function __construct(private AlertsMessageBag $alert)
    {
    }

    /**
     * Render the branding page: upload the hosting logo used for the login
     * emblem and the favicon. Stock /favicons are no longer referenced.
     */
    public function index(): View
    {
        return view('admin.branding', [
            'logo' => $this->logoUrl(),
        ]);
    }

    /**
     * Store the uploaded logo as public/themes/pterodactyl/images/custom-logo.<ext>.
     * Any previous custom logo is replaced, so exactly one file ever exists.
     */
    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => 'required|file|mimes:png,svg,jpg,jpeg,ico|max:4096',
        ]);

        $upload = $request->file('logo');
        $ext = strtolower($upload->getClientOriginalExtension() ?: 'png');
        $directory = public_path('themes/pterodactyl/images');

        if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
            $this->alert->danger('Could not create the theme image directory - check that the web server can write to <code>public/themes/pterodactyl/</code>.')->flash();

            return redirect()->route('admin.branding');
        }

        $this->clearLogo();
        $upload->move($directory, 'custom-logo.' . $ext);

        $this->alert->success('Branding logo saved. It now replaces the login emblem and the panel favicon.')->flash();

        return redirect()->route('admin.branding');
    }

    /**
     * Remove the custom logo and fall back to the theme's default emblem.
     */
    public function destroy(): RedirectResponse
    {
        $this->clearLogo();
        $this->alert->success('Custom logo removed - the default emblem is back.')->flash();

        return redirect()->route('admin.branding');
    }

    private function logoUrl(): ?string
    {
        $logos = glob(public_path('themes/pterodactyl/images/custom-logo.*'));

        return count($logos) ? '/themes/pterodactyl/images/' . basename($logos[0]) : null;
    }

    private function clearLogo(): void
    {
        foreach (glob(public_path('themes/pterodactyl/images/custom-logo.*')) as $file) {
            @unlink($file);
        }
    }
}
