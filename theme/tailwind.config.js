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
const PALETTE = {
    'gray-50': [237, 234, 248],
    'gray-100': [200, 195, 222],
    'gray-200': [166, 160, 194],
    'gray-300': [147, 141, 175],
    'gray-400': [134, 128, 162],
    'gray-500': [72, 65, 118],
    'gray-600': [57, 51, 95],
    'gray-700': [43, 37, 76],
    'gray-800': [25, 21, 46],
    'gray-900': [18, 15, 30],
    'navy-50': [239, 245, 251],
    'navy-100': [208, 227, 244],
    'navy-200': [166, 204, 236],
    'navy-300': [124, 181, 226],
    'navy-400': [85, 157, 216],
    'navy-500': [55, 140, 211],
    'navy-600': [43, 135, 211],
    'navy-700': [30, 111, 184],
    'navy-800': [35, 30, 64],
    'navy-900': [25, 21, 46],
    'gold-50': [239, 245, 251],
    'gold-100': [208, 227, 244],
    'gold-200': [166, 204, 236],
    'gold-300': [124, 181, 226],
    'gold-400': [85, 157, 216],
    'gold-500': [55, 140, 211],
    'gold-600': [43, 135, 211],
    'gold-700': [30, 111, 184],
    'gold-800': [35, 30, 64],
    'gold-900': [25, 21, 46],
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
    black: [10, 8, 18],
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
