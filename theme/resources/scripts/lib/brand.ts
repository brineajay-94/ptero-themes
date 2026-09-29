interface BrandWindow extends Window {
    SiteConfiguration?: {
        name?: string;
        logo?: string | null;
        registration?: { enabled?: boolean };
        backgrounds?: { auth?: string | null; dashboard?: string | null };
    };
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

/**
 * True when the admin has enabled public registration (Admin -> Registration).
 * AssetComposer puts the switch into window.SiteConfiguration, so the login
 * page can show "Don't have an account? Register here" only when sign-up is
 * actually open - no extra fetch needed.
 */
export const registrationEnabled = (): boolean =>
    (window as BrandWindow).SiteConfiguration?.registration?.enabled === true;

/**
 * Background image for one area of the panel, or null when the admin has not
 * enabled it (Admin -> Site Settings -> Background). AssetComposer resolves the
 * slot server-side - including rejecting anything that is not a plain http(s)
 * image link - so the value here is already safe to drop into a CSS url().
 *
 * The name is used to build the CSS custom properties the stylesheet reads, so
 * a background can be applied without any component knowing the token names.
 */
export const backgroundImage = (area: 'auth' | 'dashboard'): string | null =>
    (window as BrandWindow).SiteConfiguration?.backgrounds?.[area] || null;

/**
 * Build the inline style that points a background layer at the configured
 * image. Returns undefined when the admin has not enabled that slot, so React
 * omits the `style` attribute entirely and the stylesheet keeps its own
 * background untouched.
 *
 * Written as a custom property rather than a `background` shorthand so the
 * stylesheet stays in charge of the layering (image, dim, then the aurora on
 * top) - the component never has to reproduce it.
 */
export const backgroundStyle = (area: 'auth' | 'dashboard'): React.CSSProperties | undefined => {
    const image = backgroundImage(area);

    return image ? ({ [`--pt-bg-${area}-image`]: `url("${image}")` } as React.CSSProperties) : undefined;
};
