const colors = require('tailwindcss/colors');

// Colour tokens are emitted as `rgb(var(--pt-*))` so the whole panel palette
// can be swapped at runtime by flipping `data-theme` on <html>.
//
// Deliberately NOT the `rgb(var(--pt-*) / <alpha-value>)` form: twin.macro
// inlines the raw config value whenever a colour is resolved in JS (css prop,
// `theme`colors.x.y``, styled-components objects) and would ship a literal
// `<alpha-value>` into the bundle. Tailwind parses the `rgb()` wrapper itself,
// so `/50` opacity modifiers still expand correctly without the placeholder.
const color = (name) => `rgb(var(--pt-${name}))`;

const ramp = (prefix, names) => Object.fromEntries(names.map((n) => [n, color(`${prefix}-${n}`)]));

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const gray = ramp('gray', STEPS);
const navy = ramp('navy', STEPS);
const gold = ramp('gold', STEPS);
const red = ramp('red', STEPS);
const green = ramp('green', STEPS);
const yellow = ramp('yellow', STEPS);

// Accent: `blue` / `primary` are the primary ramp, `cyan` is the accent
// alias. Every stock `text-blue-*`, `bg-primary-600`, `border-cyan-500` and the
// nav underline (`inset 0 -2px cyan.600`) therefore re-brand themselves
// without touching a single component. red/green/yellow keep their stock
// semantics so server status colours still read as status colours.
const blue = navy;
const cyan = gold;

module.exports = {
    content: ['./resources/scripts/**/*.{js,ts,tsx}'],
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
