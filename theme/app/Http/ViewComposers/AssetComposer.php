<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class AssetComposer
{
    /**
     * Quick-link slots offered in Admin -> Site Settings -> Links.
     * Keep in step with SiteSettingsController::LINK_SLOTS.
     */
    private const LINK_SLOTS = ['home', 'discord', 'status'];

    /**
     * Palettes selectable in Admin -> Site Settings -> Theme. Keep in step with
     * SiteSettingsController::THEMES and with the [data-pt-theme='...'] blocks
     * in pterodactyl-theme.css - a slug with no block simply renders as the
     * default, which is why the whitelist here doubles as a safety net.
     */
    private const THEME_VARIANTS = ['default', 'blue', 'black'];

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
            // brine-theme: admin-uploaded hosting logo (Admin -> Site Settings),
            // null until set. A pasted link wins over an uploaded file, matching
            // the backgrounds.
            'logo' => $this->icon(),
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
            // brine-theme: the scrim each background sits under, set in Admin ->
            // Site Settings. `rgb` is the channel triplet the stylesheet feeds to
            // `rgb(var(--pt-bg-overlay-rgb) / var(--pt-bg-overlay-strength))`,
            // matching the --pt-* convention everywhere else.
            'overlay' => [
                'auth' => $this->overlay('auth'),
                'dashboard' => $this->overlay('dashboard'),
            ],
            // brine-theme: the quick links set in Admin -> Site Settings -> Links.
            // Each entry is null when the admin has switched it off, so the
            // components just leave that button out.
            'links' => $this->links(),
            // brine-theme: the palette chosen in Admin -> Site Settings -> Theme.
            // The wrapper puts this on <html> as `data-pt-theme`, and the
            // stylesheet re-points the --pt-* tokens for it. Anything not
            // recognised falls back to the default so a stale settings row can
            // never leave the panel with no palette at all.
            'theme' => [
                'variant' => $this->themeVariant(),
            ],
        ]);
    }

    /**
     * The selected palette slug, or 'default'.
     *
     * Validated against a whitelist here rather than trusted, because the value
     * ends up in an HTML attribute on <html> and a hand-edited settings row
     * could otherwise inject markup. The whitelist is the same list the admin
     * form posts against.
     */
    private function themeVariant(): string
    {
        $variant = $this->settings->get('Brine::theme_variant');

        return is_string($variant) && in_array($variant, self::THEME_VARIANTS, true) ? $variant : 'default';
    }

    /**
     * The site icon: a pasted link if one is set, otherwise the uploaded file,
     * otherwise null so the components fall back to the theme emblem.
     *
     * glob() can return false under open_basedir, so it is normalised before
     * being counted. The link is re-validated here, exactly as the backgrounds
     * are, because it is echoed into an <img src>.
     */
    private function icon(): ?string
    {
        $url = $this->settings->get('Brine::icon_url');
        if (is_string($url)) {
            $url = trim($url);
            if ($url !== '' && self::isSafeImageUrl($url)) {
                return $url;
            }
        }

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
     * The scrim strength for one background slot.
     *
     * The scrim is black on every palette - all of them are dark, so a black
     * wash is what keeps text legible over an admin-supplied photo. This
     * mirrors the --pt-bg-overlay-rgb defaults in the stylesheet. The value is
     * returned as an "R G B" triplet rather than a hex string so the client can
     * drop it straight into `rgb(var(...) / ...)` alongside the palette tokens.
     *
     * @return array{rgb: string, strength: string}
     */
    private function overlay(string $slot): array
    {
        $intensity = $slot === 'auth' ? 78 : 62;

        try {
            $stored = $this->settings->get('Brine::bg_' . $slot . '_overlay_intensity');
            if (is_numeric($stored)) {
                $intensity = max(0, min(100, (int) $stored));
            }
        } catch (\Throwable) {
            // A settings lookup that fails (database down on a page render) must
            // not take the panel's login screen with it; the default is fine.
        }

        return [
            'rgb' => '0 0 0',
            'strength' => number_format($intensity / 100, 2, '.', ''),
        ];
    }

    /**
     * The quick links, keyed by slot, each null when disabled or unset.
     *
     * Only http(s) and site-relative (/...) targets are accepted, because the
     * value becomes an href in rendered markup: a `javascript:` or `data:` URL
     * here would be a stored XSS against every visitor. The admin form
     * validates on save; this re-checks on read for the same reason the
     * background slot does.
     *
     * @return array<string, string|null>
     */
    private function links(): array
    {
        $links = [];

        foreach (self::LINK_SLOTS as $slot) {
            $links[$slot] = null;

            if ($this->settings->get('Brine::link_' . $slot . '_enabled') !== '1') {
                continue;
            }

            $url = $this->settings->get('Brine::link_' . $slot . '_url');
            if (!is_string($url)) {
                continue;
            }

            $url = trim($url);

            // Home is allowed to be enabled with no URL, and then means "the
            // panel root". Resolving that here rather than in the components
            // keeps a disabled link (null) distinguishable from an enabled one
            // with a default, so the admin's switch always means something.
            if ($url === '' && $slot === 'home') {
                $links[$slot] = '/';

                continue;
            }

            if ($url !== '' && ($safe = $this->safeLink($url)) !== null) {
                $links[$slot] = $safe;
            }
        }

        return $links;
    }

    /**
     * Normalise a link target, or null when it is not safe to emit.
     *
     * Site-relative paths stay relative (they survive a panel moving to a
     * subdirectory); anything absolute must be http(s).
     */
    private static function safeLink(string $url): ?string
    {
        if ($url === '') {
            return null;
        }

        if (strpos($url, '/') === 0) {
            // Reject protocol-relative URLs (//evil.com) - they leave the site.
            return strpos($url, '//') === 0 ? null : $url;
        }

        if (!preg_match('#^https?://#i', $url)) {
            return null;
        }

        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && $host !== '' ? $url : null;
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

        return in_array($extension, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'], true);
    }
}
