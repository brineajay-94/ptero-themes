<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class AssetComposer
{
    /**
     * AssetComposer constructor.
     */
    public function __construct(
        private AssetHashService $assetHashService,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * Provide access to the asset service in the views.
     */
    public function compose(View $view): void
    {
        $view->with('asset', $this->assetHashService);
        $view->with('siteConfiguration', [
            'name' => config('app.name') ?? 'Pterodactyl',
            'locale' => config('app.locale') ?? 'en',
            'recaptcha' => [
                // brine-theme: reported as disabled so the <Reaptcha> widget
                // never renders on login / register / forgot-password.
                //
                // This is not cosmetic. The panel ships Google's PUBLIC
                // reCAPTCHA keys (config/recaptcha.php: _shipped_*), which are
                // identical in every Pterodactyl install, so the free quota is
                // shared by every user of the panel. Once it is exhausted the
                // widget cannot be solved, the React form never gets a
                // g-recaptcha-response token, and the stock VerifyReCaptcha
                // middleware rejects the submission with HTTP 400 - which locks
                // everyone out of the login form. Reporting false here keeps
                // the React components on their no-token path.
                //
                // To bring the captcha back once you have your own keys from
                // https://www.google.com/recaptcha/admin, set this to
                // `config('recaptcha.enabled', false)`, re-add the
                // `->middleware('recaptcha')` calls in routes/auth.php, and
                // flip Admin -> Settings -> Advanced -> reCAPTCHA to Enabled.
                'enabled' => false,
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
            // brine-theme: admin-uploaded hosting logo (Admin -> Branding), null until set.
            'logo' => self::uploadedLogo(),
            // brine-theme: public registration switch (Admin -> Registration),
            // read by the auth components to show/hide the register link.
            'registration' => [
                'enabled' => $this->settings->get('Brine::registration_enabled') === '1',
            ],
            // brine-theme: background images set in Admin -> Site Settings -> Background.
            // Each slot is null when the switch is off or no image was chosen, so
            // the React components simply skip the background layer.
            'backgrounds' => [
                'auth' => $this->background('auth'),
                'dashboard' => $this->background('dashboard'),
            ],
        ]);
    }

/**
     * glob() can return false (open_basedir / permission errors), which would
     * make count() throw a TypeError on PHP 8 - always normalise it here.
     */
    private static function uploadedLogo(): ?string
    {
        $logos = glob(public_path('themes/pterodactyl/images/custom-logo.*'));

        return is_array($logos) && count($logos) > 0 ? '/themes/pterodactyl/images/' . basename($logos[0]) : null;
    }

    /**
     * Resolve one background slot (Admin -> Site Settings -> Background).
     *
     * Returns null when the slot is switched off or nothing was chosen. A
     * pasted link wins over an uploaded copy, matching what the admin form
     * shows: the link is what the admin most recently saved.
     *
     * The URL is echoed straight into a CSS url() in the React components, so
     * only an absolute http(s) link to an image extension is ever returned.
     * Anything else - a data: URI, a javascript: link, a relative path - is
     * treated as "not set".
     */
    private function background(string $slot): ?string
    {
        if ($this->settings->get('Brine::bg_' . $slot . '_enabled') !== '1') {
            return null;
        }

        $url = $this->settings->get('Brine::bg_' . $slot . '_url');
        if (is_string($url) && self::isSafeImageUrl(trim($url))) {
            return trim($url);
        }

        $files = glob(public_path('themes/pterodactyl/backgrounds/bg-' . $slot . '.*'));

        return is_array($files) && count($files) > 0 ? '/themes/pterodactyl/backgrounds/' . basename($files[0]) : null;
    }

    /**
     * Same allow-list the admin controller enforces on save. Kept in both
     * places on purpose: the controller rejects a bad paste, and this is the
     * second gate that stops a value that predates the theme (or was written
     * straight to the settings table) from reaching the CSS.
     */
    private static function isSafeImageUrl(string $url): bool
    {
        if ($url === '' || !preg_match('#^https?://#i', $url)) {
            return false;
        }

        if (!in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)) {
            return false;
        }

        $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

        return in_array($extension, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], true);
    }
}
