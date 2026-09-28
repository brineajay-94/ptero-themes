interface BrandWindow extends Window {
    SiteConfiguration?: { name?: string; logo?: string | null };
}

/**
 * The site name configured for the panel itself (`config('app.name')`, the
 * value Pterodactyl exposes to every view as `SiteConfiguration.name`).
 *
 * wrapper.blade.php writes it to `window` before the bundle runs, so any
 * component - including the auth forms rendered outside the store tree - can
 * call this directly. Nothing in the theme hardcodes a brand.
 */
export const brandName = (): string => {
    const name = (window as BrandWindow).SiteConfiguration?.name;
    return name && name.trim().length > 0 ? name : 'Pterodactyl';
};

/**
 * URL of the admin-uploaded hosting logo (Admin -> Branding), or null when no
 * custom logo has been uploaded yet - callers fall back to the theme emblem.
 */
export const logoUrl = (): string | null => (window as BrandWindow).SiteConfiguration?.logo || null;
