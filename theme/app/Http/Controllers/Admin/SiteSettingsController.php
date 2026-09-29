<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

/**
 * Site Settings - the one admin page for the theme's own branding.
 *
 * Two tabs:
 *   General    - site name and the icon (favicon + logo)
 *   Background - a background image for the auth screens and one for the
 *                dashboard, each with its own on/off switch and either an
 *                uploaded file or a pasted image URL.
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
    private const OVERLAY_DEFAULT_COLOUR = '#000000';

    /**
     * Slot names, each with its own fixed filename and the CSS hook it drives.
     */
    private const SLOTS = ['auth', 'dashboard'];

    public function __construct(
        private SettingsRepositoryInterface $settings,
        private AlertsMessageBag $alert,
    ) {
    }

    public function index(): View
    {
        return view('admin.site-settings', [
            'name' => $this->siteName(),
            'icon' => $this->iconUrl(),
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
     * Save the General tab.
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
        ]);

        $name = trim((string) $request->input('name'));
        if ($name === '') {
            $this->alert->danger('The site name cannot be empty.')->flash();

            return redirect()->route('admin.site-settings');
        }

        $this->settings->set('settings::app:name', $name);

        if ($request->boolean('remove_icon')) {
            $this->deleteFile($this->iconFile());
            $this->alert->success('Site name saved and the custom icon was removed.')->flash();

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
     * Save the Background tab. Each slot independently takes an on/off switch,
     * an uploaded file, or a pasted URL - the URL wins when both are supplied.
     */
    public function updateBackground(Request $request): RedirectResponse
    {
        $rules = [
            'auth_enabled' => 'nullable|boolean',
            'auth_url' => 'nullable|string|max:2048',
            'auth_file' => 'nullable|file|mimes:' . implode(',', self::BACKGROUND_TYPES) . '|max:' . self::BACKGROUND_MAX_KB,
            'dashboard_enabled' => 'nullable|boolean',
            'dashboard_url' => 'nullable|string|max:2048',
            'dashboard_file' => 'nullable|file|mimes:' . implode(',', self::BACKGROUND_TYPES) . '|max:' . self::BACKGROUND_MAX_KB,
        ];
        foreach (self::SLOTS as $slot) {
            $rules[$slot . '_overlay_intensity'] = 'nullable|integer|min:0|max:100';
            $rules[$slot . '_overlay_colour'] = 'nullable|string|max:32';
        }

        $request->validate($rules);

        $messages = [];

        foreach (self::SLOTS as $slot) {
            $saved = $this->saveSlot($slot, (string) $request->input($slot . '_url', ''), $request->file($slot . '_file'));
            if ($saved !== null) {
                $messages[] = $saved;
            }

            $overlayProblem = $this->saveOverlay($slot, $request);
            if ($overlayProblem !== null) {
                $messages[] = $overlayProblem;
            }
        }

        $this->settings->set('Brine::bg_auth_enabled', $request->boolean('auth_enabled') ? '1' : '0');
        $this->settings->set('Brine::bg_dashboard_enabled', $request->boolean('dashboard_enabled') ? '1' : '0');

        if ($messages === []) {
            $this->alert->success('Backgrounds and overlays saved.')->flash();
        } else {
            $this->alert->danger(implode(' ', $messages))->flash();
        }

        return redirect()->route('admin.site-settings');
    }

    /**
     * Store the scrim colour and strength for one slot.
     *
     * The colour is normalised to lowercase #rrggbb here rather than trusted,
     * because it is interpolated into a CSS custom property and then into a
     * colour function - anything that is not a hex triplet would either break
     * the stylesheet or inject a second declaration.
     */
    private function saveOverlay(string $slot, Request $request): ?string
    {
        $intensity = $request->input($slot . '_overlay_intensity');
        if ($intensity !== null && $intensity !== '') {
            $this->settings->set('Brine::bg_' . $slot . '_overlay_intensity', (string) max(0, min(100, (int) $intensity)));
        }

        $colour = trim((string) $request->input($slot . '_overlay_colour', ''));
        if ($colour === '') {
            return null;
        }

        $normalised = $this->normaliseHex($colour);
        if ($normalised === null) {
            return sprintf('The %s overlay colour was rejected - use a hex value like #000000 or #1b1436.', $slot);
        }

        $this->settings->set('Brine::bg_' . $slot . '_overlay_colour', $normalised);

        return null;
    }

    /**
     * Accept #rgb / #rrggbb with or without the leading hash; return lowercase
     * #rrggbb, or null for anything else.
     */
    private function normaliseHex(string $value): ?string
    {
        $hex = ltrim(trim($value), '#');

        if (strlen($hex) === 3 && ctype_xdigit($hex)) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
            return null;
        }

        return '#' . strtolower($hex);
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

    private function iconUrl(): ?string
    {
        $file = $this->iconFile();

        return $file === null ? null : '/themes/pterodactyl/images/' . $file;
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
     * The scrim settings for one slot, with defaults filled in.
     *
     * @return array{colour: string, intensity: int}
     */
    private function overlay(string $slot): array
    {
        $colour = $this->settings->get('Brine::bg_' . $slot . '_overlay_colour');
        $intensity = $this->settings->get('Brine::bg_' . $slot . '_overlay_intensity');

        return [
            'colour' => is_string($colour) && $this->normaliseHex($colour) !== null
                ? $this->normaliseHex($colour)
                : self::OVERLAY_DEFAULT_COLOUR,
            'intensity' => is_numeric($intensity)
                ? max(0, min(100, (int) $intensity))
                : self::OVERLAY_DEFAULT[$slot],
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
