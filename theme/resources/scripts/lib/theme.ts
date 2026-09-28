export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ptero-theme';
const CHANGE_EVENT = 'ptero-theme-change';

export const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

const readStorage = (): Theme | null => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return isTheme(stored) ? stored : null;
    } catch {
        return null;
    }
};

export const getTheme = (): Theme => {
    const attribute = document.documentElement.getAttribute('data-theme');
    if (isTheme(attribute)) {
        return attribute;
    }

    const stored = readStorage();
    if (stored) {
        return stored;
    }

    return 'dark';
};

export const setTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);

    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* storage unavailable - the attribute alone still themes the page */
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#eef2f6' : '#141a20');
    }

    window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }));
};

export const toggleTheme = (): Theme => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
};

export const subscribeTheme = (listener: (theme: Theme) => void): (() => void) => {
    const handler = (event: Event) => {
        const { detail } = event as CustomEvent<Theme>;
        if (isTheme(detail)) {
            listener(detail);
        }
    };

    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
};

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
 * would silently draw nothing. DOM rules should keep using the variables so
 * they re-theme live.
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
