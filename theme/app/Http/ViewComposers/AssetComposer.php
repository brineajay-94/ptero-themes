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
                'enabled' => config('recaptcha.enabled', false),
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
