import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * brine-theme: a copy of the panel's `Input`, restated in `--pt-*` tokens.
 *
 * WHY A COPY
 * ----------
 * The stock version spells every colour as a Tailwind utility (`bg-neutral-600`,
 * `text-neutral-200`), so its appearance is decided by whatever `neutral` happens
 * to be. This theme repoints `neutral` at the page ramp, and a field is the one
 * place where a wrong pair does not look wrong, it looks BROKEN: a dark fill with
 * dark ink, i.e. an empty box. That is what every input inside a dialog - add
 * user, create database, backup name, startup variable - was showing.
 *
 * So the field states are written out as tokens instead: a light well, page ink,
 * a hairline, and a focus ring in the accent. `isLight` still exists, because the
 * auth screens and a few call sites ask for it, but it no longer has to invert
 * anything - the field is already the light one.
 */

export interface Props {
    isLight?: boolean;
    hasError?: boolean;
}

const light = css<Props>`
    background-color: #ffffff;
    border-color: rgb(var(--pt-gray-500));
    color: rgb(var(--pt-gray-100));

    &:focus {
        border-color: rgb(var(--pt-navy-300));
    }

    &:disabled {
        background-color: rgb(var(--pt-gray-600) / 0.6);
        border-color: rgb(var(--pt-gray-600));
        color: rgb(var(--pt-gray-400));
    }
`;

const checkboxStyle = css<Props>`
    ${tw`bg-neutral-500 cursor-pointer appearance-none inline-block align-middle select-none flex-shrink-0 w-4 h-4 text-primary-400 border border-neutral-300 rounded-sm`};
    color-adjust: exact;
    background-origin: border-box;
    transition: all 75ms linear, box-shadow 25ms linear;

    &:checked {
        ${tw`border-transparent bg-no-repeat bg-center`};
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e");
        background-color: currentColor;
        background-size: 100% 100%;
    }

    &:focus {
        ${tw`outline-none border-primary-300`};
        box-shadow: 0 0 0 1px rgba(9, 103, 210, 0.25);
    }
`;

const inputStyle = css<Props>`
    // Reset to normal styling.
    resize: none;
    ${tw`appearance-none outline-none w-full min-w-0`};
    ${tw`p-3 border-2 rounded text-sm transition-all duration-150`};
    ${tw`shadow-none focus:ring-0`};

    /* Tokens, not utilities: see the note at the top of the file. */
    background-color: #ffffff;
    border-color: rgb(var(--pt-gray-500));
    color: rgb(var(--pt-gray-100));
    caret-color: rgb(var(--pt-navy-300));

    &:hover:not(:disabled):not(:focus) {
        border-color: rgb(var(--pt-gray-400));
    }

    &::placeholder {
        color: rgb(var(--pt-gray-400));
    }

    & + .input-help {
        ${tw`mt-1 text-xs`};
        ${(props) => (props.hasError ? tw`text-red-500` : 'color: rgb(var(--pt-gray-400));')};
    }

    &:required,
    &:invalid {
        ${tw`shadow-none`};
    }

    &:not(:disabled):not(:read-only):focus {
        ${tw`shadow-md`};
        border-color: rgb(var(--pt-navy-300));
        box-shadow: 0 0 0 3px rgb(var(--pt-navy-300) / 0.22);
    }

    &:disabled {
        background-color: rgb(var(--pt-gray-600) / 0.6);
        color: rgb(var(--pt-gray-400));
    }

    ${(props) => props.isLight && light};
    ${(props) =>
        props.hasError &&
        'border-color: rgb(var(--pt-red-500)); color: rgb(var(--pt-red-500)); &:hover { border-color: rgb(var(--pt-red-500)); }'};
`;

const Input = styled.input<Props>`
    &:not([type='checkbox']):not([type='radio']) {
        ${inputStyle};
    }

    &[type='checkbox'],
    &[type='radio'] {
        ${checkboxStyle};

        &[type='radio'] {
            ${tw`rounded-full`};
        }
    }
`;
const Textarea = styled.textarea<Props>`
    ${inputStyle}
`;

export { Textarea };
export default Input;
