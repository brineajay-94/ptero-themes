<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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
     *
     * Every failure path flashes a readable message instead of throwing, so a
     * denied write never shows up as a white 500 page.
     */
    public function update(Request $request): RedirectResponse
    {
        try {
            $request->validate([
                'logo' => 'required|file|mimes:png,svg,jpg,jpeg,ico|max:4096',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->alert->danger('Upload rejected: ' . implode(' ', $e->errors()['logo'] ?? ['bad file']))->flash();

            return redirect()->route('admin.branding');
        }

        $upload = $request->file('logo');
        if (!$upload->isValid()) {
            $this->alert->danger('The upload did not complete - check PHP <code>upload_max_filesize</code> / <code>post_max_size</code>.')->flash();

            return redirect()->route('admin.branding');
        }

        $ext = strtolower($upload->getClientOriginalExtension() ?: 'png');
        if (!in_array($ext, ['png', 'svg', 'jpg', 'jpeg', 'ico'], true)) {
            $ext = 'png';
        }

        $directory = public_path('themes/pterodactyl/images');

        if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
            $this->alert->danger('Could not create <code>public/themes/pterodactyl/images/</code> - give the web server write access to <code>public/themes/</code> and retry.')->flash();

            return redirect()->route('admin.branding');
        }

        if (!is_writable($directory)) {
            $this->alert->danger(sprintf(
                'The folder <code>%s</code> is not writable by PHP. Run on the server:<br><code>chown -R www-data:www-data %s &amp;&amp; chmod -R 775 %s</code> (use your panel user instead of <code>www-data</code> if that is what runs PHP), then retry.',
                $directory,
                dirname($directory),
                dirname($directory)
            ))->flash();

            return redirect()->route('admin.branding');
        }

        $this->clearLogo();

        try {
            $upload->move($directory, 'custom-logo.' . $ext);
        } catch (\Throwable $e) {
            Log::error('brine-theme: branding logo upload failed: ' . $e->getMessage());
            $this->alert->danger('Saving the logo failed: ' . $e->getMessage())->flash();

            return redirect()->route('admin.branding');
        }

        if (!$this->logoUrl()) {
            $this->alert->danger('The file did not land in <code>public/themes/pterodactyl/images/</code> - check permissions on <code>public/themes/</code>.')->flash();

            return redirect()->route('admin.branding');
        }

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

        return is_array($logos) && count($logos) > 0 ? '/themes/pterodactyl/images/' . basename($logos[0]) : null;
    }

    private function clearLogo(): void
    {
        foreach ((array) glob(public_path('themes/pterodactyl/images/custom-logo.*')) as $file) {
            @unlink($file);
        }
    }
}
