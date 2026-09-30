<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

/**
 * Site Settings - the one admin page for the theme's own branding.
 *
 * Two tabs, both server-rendered so they need no JavaScript to switch:
 *   General - the site name and the icon (favicon + logo), then one
 *             independent block per background - auth and dashboard - each
 *             with its own on/off switch, uploaded file or pasted image URL,
 *             black scrim intensity, and its own Save button.
 *   Links   - the Home / Discord / Status quick links.
 *
 * Backgrounds are saved one slot at a time, through /background/{slot}, because
 * a single endpoint reading both slots would read the other slot's absent
 * fields as "switched off" and silently turn it off.
 *
 * Uploads land in public/themes/pterodactyl/images/ (or backgrounds/) with a
 * fixed name per slot, so re-uploading replaces the old file instead of
 * littering the folder.
 */
class SiteSettingsController extends \Pterodactyl\Http\Controllers\Controller
{
    /**
     * Image types accepted for the icon. SVG is included because the theme
     * emblem is SVG and it stays crisp at every favicon size.
     */
    private const ICON_TYPES = ['png', 'svg', 'jpg', 'jpeg', 'ico', 'gif', 'webp'];

    /**
     * Backgrounds may also be SVG/GIF/WEBP on request - hosting providers
     * commonly use animated GIF or WEBP hero art.
     */
    private const BACKGROUND_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

    private const ICON_MAX_KB = 4096;
    private const BACKGROUND_MAX_KB = 8192;

    /**
     * Default scrim strength per slot, as a percentage. The auth screens get
     * the heavier one because their text is the smallest on the panel; 0 would
     * be a completely unlegible raw photo and 100 a solid colour.
     */
    private const OVERLAY_DEFAULT = ['auth' => 78, 'dashboard' => 62];

    /**
     * Slot names, each with its own fixed filename and the CSS hook it drives.
     */
    private const SLOTS = ['auth', 'dashboard'];

    /**
     * Quick links shown on the auth screens and in the dashboard topbar.
     */
    public const LINK_SLOTS = [
        'home' => ['label' => 'Home', 'help' => 'Usually the panel home page. Leave empty to send people to /'],
        'discord' => ['label' => 'Discord', 'help' => 'Your community invite link, e.g. https://discord.gg/example'],
        'status' => ['label' => 'Status', 'help' => 'A status or uptime page, e.g. https://status.example.com'],
    ];

    /**
     * Palettes offered in the Theme tab. All dark - see the "theme variants"
     * note in pterodactyl-theme.css for why a light palette is not a variant
     * but a second theme.
     *
     * `swatch` is only ever drawn as inline styles on the admin's preview
     * cards; the panel itself is never re-skinned from here. The real switch is
     * the [data-pt-theme='<slug>'] block in pterodactyl-theme.css, and the
     * wrapper puts the slug on <html>, so adding a palette means adding a CSS
     * block and one row here - nothing else.
     *
     * Keep the slugs in step with AssetComposer::THEME_VARIANTS, which is the
     * whitelist that stops a hand-edited settings row reaching the HTML
     * attribute.
     *
     * Dropping a slug here is the whole removal: the validation rule and the
     * admin cards both read this array, and themeVariant() below falls back to
     * 'default' for a stale stored value.
     */
    public const THEMES = [
        'default' => [
            'label' => 'Default (violet)',
            'blurb' => 'The shipped look: deep violet page, indigo surfaces, blue accent, frosted glass.',
            'dark' => true,
            'swatch' => ['#19152e', '#2b254c', '#39335f', '#2b87d3', '#7c5cf6'],
        ],
        'black' => [
            'label' => 'Black',
            'blurb' => 'Monochrome surfaces on true black. The accent stays blue so links still read as links.',
            'dark' => true,
            'swatch' => ['#0b0b0d', '#141417', '#1c1c20', '#2b87d3', '#5a5a64'],
        ],
        'amber' => [
            'label' => 'Black & amber (flat)',
            'blurb' => 'Near-black surfaces with a single warm gold for buttons, links and headings. Flat and rounded - no gradients, no glow.',
            'dark' => true,
            'swatch' => ['#0c0c0c', '#202020', '#1c1c1c', '#d9a441', '#e6c36a'],
        ],
    ];

    public function __construct(
        private SettingsRepositoryInterface $settings,
        private AlertsMessageBag $alert,
    ) {
    }

    public function index(): View
    {
        $links = [];
        foreach (array_keys(self::LINK_SLOTS) as $slot) {
            $links[$slot] = [
                'enabled' => $this->bool('Brine::link_' . $slot . '_enabled'),
                'url' => (string) $this->settings->get('Brine::link_' . $slot . '_url', ''),
            ];
        }

        return view('admin.site-settings', [
            'tab' => $this->tab(),
            'link_slots' => self::LINK_SLOTS,
            'name' => $this->siteName(),
            'icon' => $this->iconUrl(),
            'icon_url' => (string) $this->settings->get('Brine::icon_url', ''),
            'links' => $links,
            'themes' => self::THEMES,
            'theme' => $this->themeVariant(),
            'backgrounds' => [
                'auth' => [
                    'enabled' => $this->bool('Brine::bg_auth_enabled'),
                    'image' => $this->backgroundImage('auth'),
                    'overlay' => $this->overlay('auth'),
                ],
                'dashboard' => [
                    'enabled' => $this->bool('Brine::bg_dashboard_enabled'),
                    'image' => $this->backgroundImage('dashboard'),
                    'overlay' => $this->overlay('dashboard'),
                ],
            ],
        ]);
    }

    /**
     * Which tab to show. Whitelisted rather than passed through, so a hand-typed
     * ?tab= cannot reach the template as an arbitrary string.
     */
    private function tab(): string
    {
        $tab = request('tab');

        return in_array($tab, ['general', 'links', 'theme'], true) ? $tab : 'general';
    }

    /**
     * The saved palette slug, or 'default'.
     */
    private function themeVariant(): string
    {
        $variant = $this->settings->get('Brine::theme_variant');

        return is_string($variant) && array_key_exists($variant, self::THEMES) ? $variant : 'default';
    }

    /**
     * Save the Theme tab: which palette the user area is rendered with.
     *
     * The stored value is the only thing this changes - the palettes themselves
     * live in pterodactyl-theme.css, so switching one is instant on the next
     * request and needs no rebuild, no asset flush and no cache clear.
     */
    public function updateTheme(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['required', 'string', Rule::in(array_keys(self::THEMES))],
        ]);

        $variant = (string) $validated['theme'];

        // 'default' clears the row rather than storing it, so an install that is
        // later reset to the shipped look behaves exactly like a fresh one.
        if ($variant === 'default') {
            $this->settings->forget('Brine::theme_variant');
            $this->alert->success('Theme reset to the default violet palette.')->flash();
        } else {
            $this->settings->set('Brine::theme_variant', $variant);
            $this->alert->success('Theme saved: ' . self::THEMES[$variant]['label'] . '.')->flash();
        }

        return redirect()->route('admin.site-settings', ['tab' => 'theme']);
    }

    /**
     * Save the Links tab: one URL and one on/off switch per quick link.
     *
     * Switching a link off also clears its URL, so re-enabling it later does
     * not silently resurrect a stale target that was edited months ago.
     */
    public function updateLinks(Request $request): RedirectResponse
    {
        $rules = [];
        foreach (array_keys(self::LINK_SLOTS) as $slot) {
            $rules[$slot . '_enabled'] = 'nullable|boolean';
            $rules[$slot . '_url'] = 'nullable|string|max:2048';
        }
        $request->validate($rules);

        $errors = [];

        foreach (array_keys(self::LINK_SLOTS) as $slot) {
            $enabled = $request->boolean($slot . '_enabled');
            $url = trim((string) $request->input($slot . '_url', ''));

            if (!$enabled) {
                $this->settings->set('Brine::link_' . $slot . '_enabled', '0');
                $this->settings->set('Brine::link_' . $slot . '_url', '');

                continue;
            }

            // Home is allowed to stay empty: it then points at the panel root.
            if ($url === '' && $slot !== 'home') {
                $errors[] = sprintf('The %s link needs a URL, or turn it off.', self::LINK_SLOTS[$slot]['label']);

                continue;
            }

            if ($url !== '' && $this->safeLink($url) === null) {
                $errors[] = sprintf(
                    'The %s link was rejected - use a full https:// address or a path starting with a single slash.',
                    self::LINK_SLOTS[$slot]['label']
                );

                continue;
            }

            $this->settings->set('Brine::link_' . $slot . '_enabled', '1');
            $this->settings->set('Brine::link_' . $slot . '_url', $url);
        }

        if ($errors === []) {
            $this->alert->success('Links saved.')->flash();
        } else {
            $this->alert->danger(implode(' ', $errors))->flash();
        }

        return redirect()->route('admin.site-settings', ['tab' => 'links']);
    }

    /**
     * Normalise a link target, or null when unsafe.
     *
     * These become hrefs in rendered markup, so a `javascript:` or `data:` value
     * would be a stored XSS against every visitor. Protocol-relative URLs are
     * rejected too - "//evil.com" looks relative but leaves the site.
     */
    private function safeLink(string $url): ?string
    {
        if ($url === '') {
            return null;
        }

        if (strpos($url, '/') === 0) {
            return strpos($url, '//') === 0 ? null : $url;
        }

        if (!preg_match('#^https?://#i', $url)) {
            return null;
        }

        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && $host !== '' ? $url : null;
    }

    /**
     * Save the General tab: the site name, plus the icon as either an uploaded
     * file or a pasted link.
     *
     * The icon is optional on submit: clearing the file field and checking
     * "remove" is how an admin goes back to the stock emblem, so an empty
     * upload must not be an error.
     */
    public function updateGeneral(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:191',
            'icon' => 'nullable|file|mimes:' . implode(',', self::ICON_TYPES) . '|max:' . self::ICON_MAX_KB,
            'icon_url' => 'nullable|string|max:2048',
        ]);

        $name = trim((string) $request->input('name'));
        if ($name === '') {
            $this->alert->danger('The site name cannot be empty.')->flash();

            return redirect()->route('admin.site-settings');
        }

        $this->settings->set('settings::app:name', $name);

        if ($request->boolean('remove_icon')) {
            $this->clearIcon();
            $this->alert->success('Site name saved and the custom icon was removed.')->flash();

            return redirect()->route('admin.site-settings');
        }

        // A pasted link wins over an upload, matching the backgrounds, and
        // drops any file that was uploaded previously.
        $iconUrl = trim((string) $request->input('icon_url', ''));
        if ($iconUrl !== '') {
            if ($this->safeImageUrl($iconUrl) === null) {
                $this->alert->danger('The icon link was rejected - use a direct https:// link to a .png, .jpg, .jpeg, .gif, .webp or .svg file.')->flash();

                return redirect()->route('admin.site-settings');
            }

            $this->settings->set('Brine::icon_url', $iconUrl);
            $this->deleteFile($this->iconFile());

            $this->alert->success('Site name and icon link saved.')->flash();

            return redirect()->route('admin.site-settings');
        }

        $upload = $request->file('icon');
        if ($upload === null) {
            $this->alert->success('Site name saved.')->flash();

            return redirect()->route('admin.site-settings');
        }

        $directory = $this->imageDirectory();
        if (($problem = $this->ensureWritable($directory)) !== null) {
            $this->alert->danger($problem)->flash();

            return redirect()->route('admin.site-settings');
        }

        $this->deleteFile($this->iconFile());
        $this->settings->forget('Brine::icon_url');

        try {
            $upload->move($directory, 'custom-logo.' . $this->safeExtension($upload, self::ICON_TYPES));
        } catch (\Throwable $e) {
            Log::error('brine-theme: site icon upload failed: ' . $e->getMessage());
            $this->alert->danger('Saving the icon failed: ' . $e->getMessage())->flash();

            return redirect()->route('admin.site-settings');
        }

        if ($this->iconUrl() === null) {
            $this->alert->danger('The icon did not land in <code>public/themes/pterodactyl/images/</code> - check permissions on <code>public/themes</code>.')->flash();

            return redirect()->route('admin.site-settings');
        }

        $this->alert->success('Site settings saved - the icon is now the favicon and the login emblem.')->flash();

        return redirect()->route('admin.site-settings');
    }

    /**
     * Save ONE background slot.
     *
     * Scoped per slot on purpose: the page has a separate form and Save button
     * for the auth screens and for the dashboard, and a single endpoint that
     * read both would treat the absent fields of the other slot as "switched
     * off" - so saving one background would silently switch the other one off.
     */
    public function updateBackground(string $slot, Request $request): RedirectResponse
    {
        if (!in_array($slot, self::SLOTS, true)) {
            abort(404);
        }

        $request->validate([
            $slot . '_enabled' => 'nullable|boolean',
            $slot . '_url' => 'nullable|string|max:2048',
            $slot . '_file' => 'nullable|file|mimes:' . implode(',', self::BACKGROUND_TYPES) . '|max:' . self::BACKGROUND_MAX_KB,
            $slot . '_overlay_intensity' => 'nullable|integer|min:0|max:100',
        ]);

        $messages = [];

        $saved = $this->saveSlot($slot, (string) $request->input($slot . '_url', ''), $request->file($slot . '_file'));
        if ($saved !== null) {
            $messages[] = $saved;
        }

        $this->saveOverlay($slot, $request);

        $this->settings->set('Brine::bg_' . $slot . '_enabled', $request->boolean($slot . '_enabled') ? '1' : '0');

        if ($messages === []) {
            $this->alert->success(($slot === 'auth' ? 'Login & register' : 'Dashboard') . ' background saved.')->flash();
        } else {
            $this->alert->danger(implode(' ', $messages))->flash();
        }

        return redirect()->route('admin.site-settings');
    }

    /**
     * Store the scrim strength for one slot.
     *
     * The colour is fixed at black - the admin asked for the picker to go, and
     * black is the only scrim that reliably keeps dark text legible over an
     * arbitrary photo. AssetComposer therefore never reads a colour at all, so
     * a row written straight into the settings table cannot reach the CSS.
     */
    private function saveOverlay(string $slot, Request $request): void
    {
        $intensity = $request->input($slot . '_overlay_intensity');
        if ($intensity !== null && $intensity !== '') {
            $this->settings->set('Brine::bg_' . $slot . '_overlay_intensity', (string) max(0, min(100, (int) $intensity)));
        }

        // Any colour left over from the removed picker is cleared so it cannot
        // linger and surprise the admin later.
        $this->settings->forget('Brine::bg_' . $slot . '_overlay_colour');
    }

    /**
     * Clear a slot's stored image (upload and URL) and switch it off.
     */
    public function clearBackground(string $slot): RedirectResponse
    {
        if (!in_array($slot, self::SLOTS, true)) {
            abort(404);
        }

        $this->deleteFile($this->backgroundFile($slot));
        $this->settings->forget('Brine::bg_' . $slot . '_url');
        $this->settings->set('Brine::bg_' . $slot . '_enabled', '0');
        // The overlay only matters while an image is showing, so reset it to the
        // shipped default rather than leaving a stale value behind.
        $this->settings->forget('Brine::bg_' . $slot . '_overlay_intensity');
        $this->settings->forget('Brine::bg_' . $slot . '_overlay_colour');

        $this->alert->success(ucfirst($slot) . ' background cleared.')->flash();

        return redirect()->route('admin.site-settings');
    }

    // ------------------------------------------------------------------ slots --

    /**
     * Resolve one slot's image from the request. Returns an error message, or
     * null on success. A pasted URL takes priority over an upload, so an admin
     * who pastes a link does not also have to clear the file field.
     */
    private function saveSlot(string $slot, string $url, ?\Illuminate\Http\UploadedFile $file): ?string
    {
        $url = trim($url);

        if ($url !== '') {
            if (!$this->isSafeImageUrl($url)) {
                return sprintf(
                    'The %s image link was rejected - use a direct http(s) link to a .png, .jpg, .jpeg, .gif, .webp or .svg file.',
                    $slot
                );
            }

            $this->settings->set('Brine::bg_' . $slot . '_url', $url);
            // An uploaded copy would otherwise linger behind the URL and come
            // back if the URL field is ever cleared.
            $this->deleteFile($this->backgroundFile($slot));

            return null;
        }

        if ($file === null) {
            return null;
        }

        $directory = $this->backgroundDirectory();
        if (($problem = $this->ensureWritable($directory)) !== null) {
            return $problem;
        }

        $this->settings->forget('Brine::bg_' . $slot . '_url');
        $this->deleteFile($this->backgroundFile($slot));

        try {
            $file->move($directory, 'bg-' . $slot . '.' . $this->safeExtension($file, self::BACKGROUND_TYPES));
        } catch (\Throwable $e) {
            Log::error('brine-theme: ' . $slot . ' background upload failed: ' . $e->getMessage());

            return sprintf('Saving the %s background failed: %s', $slot, $e->getMessage());
        }

        if ($this->backgroundImage($slot) === null) {
            return sprintf('The %s background did not land in <code>public/themes/pterodactyl/backgrounds/</code> - check permissions on <code>public/themes</code>.', $slot);
        }

        return null;
    }

    // -------------------------------------------------------------- accessors --

    private function siteName(): string
    {
        $name = $this->settings->get('settings::app:name', config('app.name', 'Pterodactyl'));

        return is_string($name) && trim($name) !== '' ? $name : (string) config('app.name', 'Pterodactyl');
    }

    private function iconFile(): ?string
    {
        return $this->firstFile($this->imageDirectory(), 'custom-logo.*');
    }

    /**
     * The icon to actually use: a pasted link if one is set, otherwise the
     * uploaded file, otherwise null (the theme emblem).
     */
    private function iconUrl(): ?string
    {
        $url = $this->settings->get('Brine::icon_url');
        if (is_string($url) && ($safe = $this->safeImageUrl(trim($url))) !== null) {
            return $safe;
        }

        $file = $this->iconFile();

        return $file === null ? null : '/themes/pterodactyl/images/' . $file;
    }

    /** Drop both the pasted link and the uploaded file. */
    private function clearIcon(): void
    {
        $this->deleteFile($this->iconFile());
        $this->settings->forget('Brine::icon_url');
    }

    /**
     * Validate a direct image link: absolute http(s) with an image extension.
     * The value is echoed into an <img src>, so anything else - a data: URI, a
     * relative path, a script URL - is refused rather than rendered.
     */
    private function safeImageUrl(string $url): ?string
    {
        if ($url === '' || !preg_match('#^https?://#i', $url)) {
            return null;
        }

        if (!in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)) {
            return null;
        }

        $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        $allowed = array_values(array_unique(array_merge(self::BACKGROUND_TYPES, self::ICON_TYPES)));

        return in_array($extension, $allowed, true) ? $url : null;
    }

    private function backgroundFile(string $slot): ?string
    {
        return $this->firstFile($this->backgroundDirectory(), 'bg-' . $slot . '.*');
    }

    private function backgroundImage(string $slot): ?string
    {
        $url = $this->settings->get('Brine::bg_' . $slot . '_url');
        if (is_string($url) && trim($url) !== '') {
            return trim($url);
        }

        $file = $this->backgroundFile($slot);

        return $file === null ? null : '/themes/pterodactyl/backgrounds/' . $file;
    }

    private function bool(string $key): bool
    {
        return $this->settings->get($key) === '1';
    }

    /**
     * The scrim strength for one slot, with the default filled in.
     */
    private function overlay(string $slot): array
    {
        $intensity = $this->settings->get('Brine::bg_' . $slot . '_overlay_intensity');

        return [
            // Always black: the colour picker was removed, and black is the only
            // scrim that reliably keeps dark text legible over any photo.
            'colour' => '#000000',
            'intensity' => is_numeric($intensity) ? max(0, min(100, (int) $intensity)) : self::OVERLAY_DEFAULT[$slot],
        ];
    }

    // ---------------------------------------------------------------- helpers --

    private function imageDirectory(): string
    {
        return public_path('themes/pterodactyl/images');
    }

    private function backgroundDirectory(): string
    {
        return public_path('themes/pterodactyl/backgrounds');
    }

    /**
     * glob() can return false under open_basedir, so normalise before counting.
     */
    private function firstFile(string $directory, string $pattern): ?string
    {
        $found = glob($directory . '/' . $pattern);
        if (!is_array($found) || count($found) === 0) {
            return null;
        }

        return basename($found[0]);
    }

    private function deleteFile(?string $name): void
    {
        if ($name === null) {
            return;
        }

        foreach ([$this->imageDirectory(), $this->backgroundDirectory()] as $directory) {
            @unlink($directory . '/' . $name);
        }
    }

    /**
     * Create the directory if needed and confirm PHP can write to it, so the
     * failure is a readable flash message instead of a 500.
     */
    private function ensureWritable(string $directory): ?string
    {
        if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
            return sprintf('Could not create <code>%s</code> - give the web server write access to <code>public/themes/</code> and retry.', $directory);
        }

        if (!is_writable($directory)) {
            return sprintf(
                'The folder <code>%s</code> is not writable by PHP. Run on the server:<br><code>chown -R www-data:www-data %s &amp;&amp; chmod -R 775 %s</code> (use your panel user instead of <code>www-data</code> if that is what runs PHP), then retry.',
                $directory,
                dirname($directory),
                dirname($directory)
            );
        }

        return null;
    }

    /**
     * The uploaded extension, lowercased and checked against the allow-list.
     * Anything unexpected becomes png so a hostile name can never decide the
     * stored extension.
     */
    private function safeExtension(\Illuminate\Http\UploadedFile $upload, array $allowed): string
    {
        $ext = strtolower($upload->getClientOriginalExtension());

        return in_array($ext, $allowed, true) ? $ext : ($allowed[0] === 'png' ? 'png' : $allowed[0]);
    }

    /**
     * Only accept an absolute http(s) URL. Rejecting everything else (data:
     * URIs, javascript:, relative paths) means a bad paste cannot inject
     * markup into the blade output, which is echoed raw into a CSS url().
     */
    private function isSafeImageUrl(string $url): bool
    {
        if (!preg_match('#^https?://#i', $url)) {
            return false;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

        return in_array($extension, self::BACKGROUND_TYPES, true);
    }
}
