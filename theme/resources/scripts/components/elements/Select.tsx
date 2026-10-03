import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * brine-theme: a copy of the panel's `Select`, restated in `--pt-*` tokens.
 *
 * WHY A COPY
 * ----------
 * The stock version is `bg-neutral-600 text-neutral-200` with a hardcoded
 * `#C3D1DF` chevron, i.e. a dark field with light text on a palette where the
 * page is light. It also says nothing at all about `option`, and the option list
 * is drawn by the browser rather than the page - so on a dark field the options
 * could render dark-on-dark even when the closed control looked fine, which is
 * exactly how "every version name is invisible" happens in the egg pickers.
 *
 * So the closed control AND the options are both stated here: a white field with
 * page ink, and options to match. The chevron is drawn with `currentColor`, so it
 * follows the ink instead of being a fixed light glyph that vanishes on a light
 * field.
 */

interface Props {
    hideDropdownArrow?: boolean;
}

const Select = styled.select<Props>`
    ${tw`shadow-none block p-3 pr-8 rounded border w-full text-sm transition-colors duration-150 ease-linear`};

    &,
    &:hover:not(:disabled),
    &:focus {
        ${tw`outline-none`};
    }

    -webkit-appearance: none;
    -moz-appearance: none;
    background-size: 1rem;
    background-repeat: no-repeat;
    background-position-x: calc(100% - 0.75rem);
    background-position-y: center;

    &::-ms-expand {
        display: none;
    }

    background-color: #ffffff;
    border-color: rgb(var(--pt-gray-500));
    color: rgb(var(--pt-gray-100));

    &:hover:not(:disabled) {
        border-color: rgb(var(--pt-gray-400));
    }

    &:focus {
        border-color: rgb(var(--pt-navy-300));
        box-shadow: 0 0 0 3px rgb(var(--pt-navy-300) / 0.22);
    }

    &:disabled {
        background-color: rgb(var(--pt-gray-600) / 0.6);
        color: rgb(var(--pt-gray-400));
    }

    /*
     * The option list. Browsers paint these with the OS palette unless both
     * colours are stated, and an option inherits the FIELD's colours otherwise -
     * which is how a list of version numbers ends up dark text on a dark fill
     * while the control you clicked looks correct.
     */
    option,
    optgroup {
        background-color: #ffffff;
        color: rgb(var(--pt-gray-100));
    }

    ${(props) =>
        !props.hideDropdownArrow &&
        css`
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='%235f6572' d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z'/%3e%3c/svg%3e ");
        `};
`;

export default Select;
