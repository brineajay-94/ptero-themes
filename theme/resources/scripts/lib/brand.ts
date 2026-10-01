interface BrandWindow extends Window {
    SiteConfiguration?: {
        name?: string;
        logo?: string | null;
        registration?: { enabled?: boolean };
        backgrounds?: { auth?: string | null; dashboard?: string | null };
        overlay?: {
            auth?: { rgb?: string; strength?: string };
            dashboard?: { rgb?: string; strength?: string };
        };
        links?: { home?: string | null; discord?: string | null; status?: string | null };
        social?: { providers?: { id: string; label: string }[] };
    };
}

export interface SocialProvider {
    id: string;
    label: string;
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
 * The quick links configured in Admin -> Site Settings -> Links.
 *
 * AssetComposer has already dropped any that are switched off, and re-checked
 * that each target is http(s) or a single-slash path - these values become
 * hrefs, so a `javascript:` URL would be a stored XSS against every visitor.
 * A link with no value is simply not rendered.
 */
export const quickLinks = (): { home?: string; discord?: string; status?: string } => {
    const links = (window as BrandWindow).SiteConfiguration?.links || {};

    return {
        ...(links.home ? { home: links.home } : {}),
        ...(links.discord ? { discord: links.discord } : {}),
        ...(links.status ? { status: links.status } : {}),
    };
};

/**
 * A quick link's href, or null when the admin has that slot switched off (or
 * saved a target AssetComposer rejected). Callers skip the button on null - that
 * is what makes the admin's per-link toggle actually hide something.
 */
export const linkHref = (slot: 'home' | 'discord' | 'status'): string | null => quickLinks()[slot] || null;

/**
 * The social sign-in providers the admin has switched on, as configured in
 * Admin -> Social Login.
 *
 * AssetComposer already filters these down to the providers that are both
 * enabled and have a complete credential pair, so an empty array means "no
 * usable providers" and the caller should render nothing at all. It exposes only
 * the id and label - the client secret never leaves the server, and neither does
 * the client id.
 *
 * Defaults to an empty array rather than trusting the shape, because this reads
 * a global written by a Blade view: a panel that has an older wrapper, or a
 * cached page from before this feature, simply has no `social` key.
 */
export const socialProviders = (): SocialProvider[] => {
    const providers = (window as BrandWindow).SiteConfiguration?.social?.providers;

    if (!Array.isArray(providers)) {
        return [];
    }

    return providers.filter(
        (provider): provider is SocialProvider => typeof provider?.id === 'string' && typeof provider?.label === 'string'
    );
};

/**
 * Where a provider's sign-in flow starts.
 *
 * A plain path rather than a React route: the provider redirects the browser
 * somewhere a SPA router cannot follow, so this leaves the client entirely.
 */
export const socialRedirectUrl = (provider: string): string => `/auth/social/${encodeURIComponent(provider)}/redirect`;

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
    if (!image) return undefined;

    // The overlay ships in SiteConfiguration as a validated triplet plus a 0-1
    // strength (AssetComposer normalises it), so this needs no further checks.
    const overlay = (window as BrandWindow).SiteConfiguration?.overlay?.[area];

    return {
        [`--pt-bg-${area}-image`]: `url("${image}")`,
        ...(area === 'auth'
            ? {
                  '--pt-bg-overlay-rgb-auth': overlay?.rgb,
                  '--pt-bg-overlay-strength-auth': overlay?.strength,
              }
            : {
                  '--pt-bg-overlay-rgb': overlay?.rgb,
                  '--pt-bg-overlay-strength': overlay?.strength,
              }),
    } as React.CSSProperties;
};
