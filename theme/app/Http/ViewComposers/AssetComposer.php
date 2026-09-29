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
        ]);
    }

    /**
     * glob() can return false (open_basedir / permission errors), which would
     * make count() throw a TypeError on PHP 8 - always normalise it here.
     */
    private static function uploadedLogo(): ?string
    {
        $logos = glob(public_path('themes/pterodactyl/images/custom-logo.*'));

        return is_array($logos) && count($logos) > 0
            ? '/themes/pterodactyl/images/' . basename($logos[0])
            : null;
    }
}
