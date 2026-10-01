// The panel re-themes itself through the `--pt-*` custom properties declared in
// public/themes/pterodactyl/css/pterodactyl-theme.css, so every Tailwind colour
// is a `rgb(var(--pt-*))` reference and the whole palette can be swapped at
// runtime by flipping `data-theme` on <html>.
//
// Deliberately NOT the `rgb(var(--pt-*) / <alpha-value>)` form: twin.macro
// inlines the raw config value whenever a colour is resolved in JS (css prop,
// `theme`colors.x.y``, styled-components objects) and would ship a literal
// `<alpha-value>` into the bundle. Tailwind parses the `rgb()` wrapper itself,
// so `/50` opacity modifiers still expand correctly without the placeholder -
// but only from Tailwind 3.1 onwards. Older engines cannot compute an alpha
// channel for a colour they cannot parse, and every opacity modifier in the
// panel's own stylesheets (`bg-blue-500/75` in our button module,
// `text-primary-500/50` in the stock input module) dies with:
//
//     The `bg-blue-500/75` class does not exist.
//
// Measured against the engines these panels actually ship: 3.1.0 and 3.4.18
// accept the variable form, 3.0.24 (Tailwind 3.0.x, Pterodactyl 1.12-1.13
// lockfiles) and 2.2.19 (Pterodactyl 1.11.x, Blueprint) do not. Below 3.1 the
// palette is therefore emitted as literal hex - the same values, baked in at
// build time - which every engine can apply an opacity to.
const tailwindVersion = (() => {
    try {
        return require('tailwindcss/package.json').version;
    } catch {
        // Unresolvable (Tailwind 4 hides its package.json behind `exports`).
        // Assume a modern engine: the fallback is the behaviour HEAD shipped.
        return '3.4.0';
    }
})();

const [MAJOR, MINOR] = tailwindVersion.split('.').map((n) => parseInt(n, 10) || 0);
const CSS_VARS = MAJOR > 3 || (MAJOR === 3 && MINOR >= 1);

// Same triples as the `--pt-*` declarations in pterodactyl-theme.css, which is
// what keeps the baked-in Tailwind 2/3.0 builds the same colour as the
// stylesheet. red/green/yellow are stock Tailwind values and are listed so the
// two paths cannot drift apart.
//
// These MUST be edited whenever the default (black) palette changes. Nothing
// enforces the link, and a stale copy is invisible in dev: from 3.1 upwards the
// variables are used and these literals are dead, so a panel on a modern engine
// looks correct while every panel on 3.0.x silently renders the old colours. A
// violet default left here is exactly that failure - the palette moved to black
// and the fallback did not, so stock utilities stayed purple on old panels.
//
// This mirrors the *default* palette only. Below 3.1 the values are baked, so
// `data-pt-theme='amber'` cannot re-skin stock utilities on those engines - the
// theme's own classes still respond, because they read the variables directly.
// Amber is fully interchangeable on 3.1+.
const PALETTE = {
    // Kept byte-for-byte in step with the `--pt-gray-*` block in
    // pterodactyl-theme.css. This copy is the literal fallback Tailwind bakes on
    // versions below 3.1, which cannot apply an opacity modifier to a CSS
    // variable; on 3.1+ the tokens are emitted as rgb(var(--pt-*)) and these
    // numbers are unused. Drift between the two is what makes a rebuild look
    // like the stylesheet "did not apply", so the two blocks are changed
    // together.
    //
    // 50-500 are INK steps, 600-900 are SURFACE steps - see the long comment on
    // the gray block in the stylesheet. The palette is LIGHT now: the roles are
    // unchanged and only the polarity flipped, which is what lets the stock
    // panel's ~200 colour utilities follow without touching a component. The
    // stock panel uses `text-neutral-500` for all of its small muted text, so 500
    // has to be readable on BOTH the page and a card (4.65:1 and 5.13:1).
    'gray-50': [16, 19, 26],
    'gray-100': [34, 38, 46],
    'gray-200': [61, 67, 78],
    'gray-300': [86, 93, 105],
    'gray-400': [95, 101, 114],
    'gray-500': [105, 111, 123],
    'gray-600': [223, 227, 232],
    'gray-700': [255, 255, 255],
    'gray-800': [242, 244, 246],
    'gray-900': [255, 255, 255],
    'navy-50': [252, 252, 253],
    'navy-100': [240, 241, 244],
    'navy-200': [214, 217, 223],
    'navy-300': [41, 119, 203],
    'navy-400': [30, 88, 150],
    'navy-500': [86, 93, 105],
    'navy-600': [240, 241, 244],
    'navy-700': [223, 227, 232],
    'navy-800': [45, 55, 72],
    'navy-900': [36, 44, 58],
    'gold-50': [252, 252, 253],
    'gold-100': [240, 241, 244],
    'gold-200': [214, 217, 223],
    'gold-300': [41, 119, 203],
    'gold-400': [30, 88, 150],
    'gold-500': [86, 93, 105],
    'gold-600': [240, 241, 244],
    'gold-700': [223, 227, 232],
    'gold-800': [45, 55, 72],
    'gold-900': [36, 44, 58],
    'red-50': [254, 242, 242],
    'red-100': [254, 226, 226],
    'red-200': [254, 202, 202],
    'red-300': [252, 165, 165],
    'red-400': [248, 113, 113],
    'red-500': [239, 68, 68],
    'red-600': [220, 38, 38],
    'red-700': [185, 28, 28],
    'red-800': [153, 27, 27],
    'red-900': [127, 29, 29],
    'green-50': [240, 253, 244],
    'green-100': [220, 252, 231],
    'green-200': [187, 247, 208],
    'green-300': [134, 239, 172],
    'green-400': [74, 222, 128],
    'green-500': [34, 197, 94],
    'green-600': [22, 163, 74],
    'green-700': [21, 128, 61],
    'green-800': [22, 101, 52],
    'green-900': [20, 83, 45],
    'yellow-50': [254, 252, 232],
    'yellow-100': [254, 249, 195],
    'yellow-200': [254, 240, 138],
    'yellow-300': [253, 224, 71],
    'yellow-400': [250, 204, 21],
    'yellow-500': [234, 179, 8],
    'yellow-600': [202, 138, 4],
    'yellow-700': [161, 98, 7],
    'yellow-800': [133, 77, 14],
    'yellow-900': [113, 63, 18],
    black: [6, 6, 8],
    white: [255, 255, 255],
};

const hex = (name) => `#${PALETTE[name].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

const color = (name) => (CSS_VARS ? `rgb(var(--pt-${name}))` : hex(name));

const ramp = (prefix) =>
    Object.fromEntries(
        Object.keys(PALETTE)
            .filter((k) => k.startsWith(`${prefix}-`))
            .map((k) => [k.slice(prefix.length + 1), color(k)])
    );

const gray = ramp('gray');
const navy = ramp('navy');
const gold = ramp('gold');
const red = ramp('red');
const green = ramp('green');
const yellow = ramp('yellow');

// Accent: `blue` / `primary` are the primary ramp, `cyan` is the accent
// alias. Every stock `text-blue-*`, `bg-primary-600`, `border-cyan-500` and the
// nav underline (`inset 0 -2px cyan.600`) therefore re-brand themselves
// without touching a single component. red/green/yellow keep their stock
// semantics so server status colours still read as status colours.
const blue = navy;
const cyan = gold;

// Tailwind 3 reads `content`; Tailwind 2 (Pterodactyl 1.11.x, Blueprint) reads
// `purge` and only generates what it finds there, so without `mode: 'jit'` it
// prunes every utility the panel's stylesheets reference. Blade templates are
// scanned alongside the React tree so the server-rendered markup keeps its
// classes too.
const CONTENT = ['./resources/views/**/*.blade.php', './resources/scripts/**/*.{js,ts,tsx}'];

// Tailwind 2 whitelists variants per core plugin; without this a JIT build on a
// 1.11.x panel drops every `:hover`/`:focus` colour the button module applies.
const LEGACY_VARIANTS = {
    extend: {
        backgroundColor: ['hover', 'focus', 'active', 'disabled'],
        textColor: ['hover', 'focus', 'active', 'disabled'],
        borderColor: ['hover', 'focus', 'active', 'disabled'],
        backgroundOpacity: ['hover', 'focus', 'active', 'disabled'],
        textOpacity: ['hover', 'focus', 'active', 'disabled'],
        borderOpacity: ['hover', 'focus', 'active', 'disabled'],
        boxShadow: ['hover', 'focus', 'active'],
        cursor: ['hover', 'focus', 'active', 'disabled'],
        opacity: ['hover', 'focus', 'active', 'disabled'],
    },
};

module.exports = {
    ...(MAJOR >= 3 ? { content: CONTENT } : { mode: 'jit', purge: CONTENT, variants: LEGACY_VARIANTS }),
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    'sans-serif',
                ],
                header: [
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    'sans-serif',
                ],
            },
            colors: {
                black: color('black'),
                white: color('white'),
                // "primary" and "neutral" are deprecated, prefer the use of "blue" and "gray"
                // in new code.
                primary: blue,
                gray: gray,
                neutral: gray,
                navy: navy,
                gold: gold,
                blue: blue,
                red: red,
                green: green,
                yellow: yellow,
                cyan: cyan,
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: (theme) => ({
                default: theme('colors.neutral.400', 'currentColor'),
            }),
        },
    },
    plugins: [
        require('@tailwindcss/line-clamp'),
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ],
};
