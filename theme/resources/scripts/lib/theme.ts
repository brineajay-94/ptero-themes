const parseChannels = (value: string): [number, number, number] | null => {
    const cleaned = value
        .trim()
        .replace(/^rgba?\(/i, '')
        .replace(/\)$/, '');

    const channels = cleaned
        .split('/')[0]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(Number);

    return channels.length === 3 && channels.every((n) => !Number.isNaN(n))
        ? [channels[0], channels[1], channels[2]]
        : null;
};

/**
 * Resolve a `--pt-*` token to a literal `rgb()`/`rgba()` string.
 *
 * Only for sinks that never see CSS (canvas, Chart.js, WebGL): the 2D context
 * ignores `var(...)` entirely, so passing the raw Tailwind colour through
 * would silently draw nothing. DOM rules should keep using the variables.
 *
 * The panel is dark-only now, so there is no theme state to store or toggle.
 */
export const ptColor = (token: string, fallback: string, alpha?: number): string => {
    try {
        const channels = parseChannels(getComputedStyle(document.documentElement).getPropertyValue(`--pt-${token}`));
        if (!channels) {
            return fallback;
        }

        const [r, g, b] = channels;
        return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
        return fallback;
    }
};
