import React, { Suspense } from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import ErrorBoundary from '@/components/elements/ErrorBoundary';

export type SpinnerSize = 'small' | 'base' | 'large';

interface Props {
    size?: SpinnerSize;
    centered?: boolean;
    isBlue?: boolean;
}

interface Spinner extends React.FC<Props> {
    Size: Record<'SMALL' | 'BASE' | 'LARGE', SpinnerSize>;
    Suspense: React.FC<Props>;
}

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

/*
 * brine-theme: replaces the stock Spinner.
 *
 * Two defects in the stock version, both visible on every page load:
 *
 * 1. Square. The stock ring is `border-radius: 50%` on a plain div, and this
 *    theme resets corners globally with `* { border-radius: 0 !important; }`
 *    (pterodactyl-theme.css) to keep its dense surfaces flat. The spinner was
 *    not in the opt-back-in list, so the ring rendered as a square box. The
 *    `!important` below is required - without it the universal reset wins
 *    again, because `*` and a class selector both carry `!important` but
 *    the class has to be the one that outranks it.
 *
 * 2. Far too big. `size={'large'}` was hardcoded at every page-level call site
 *    (ServerRouter, DashboardContainer, FileManagerContainer) and mapped to
 *    `w-16 h-16` with a 6px border - a 64px ring, plus `m-20` of dead margin
 *    when centered. The table below caps every step at 22px, so a caller still
 *    asking for "large" gets a small ring; the prop keeps its meaning for type
 *    compatibility with stock call sites.
 *
 * Sizes are plain CSS values rather than twin.macro utilities because the table
 * is a lookup, and `tw` yields a TwStyle object rather than the string a Record
 * value would need.
 */
const SIZE_MAP: Record<SpinnerSize, { box: string; width: string; pad: string }> = {
    small: { box: '14px', width: '2px', pad: '12px' },
    base: { box: '18px', width: '2px', pad: '16px' },
    large: { box: '22px', width: '3px', pad: '20px' },
};

// noinspection CssOverwrittenProperties
const SpinnerComponent = styled.div<Props>`
    width: ${(props) => SIZE_MAP[props.size ?? 'base'].box};
    height: ${(props) => SIZE_MAP[props.size ?? 'base'].box};
    border-width: ${(props) => SIZE_MAP[props.size ?? 'base'].width};
    border-style: solid;
    border-radius: 50% !important;
    animation: ${spin} 0.8s cubic-bezier(0.55, 0.25, 0.25, 0.7) infinite;

    border-color: ${(props) =>
        !props.isBlue ? 'rgb(var(--pt-gold-500, 55, 140, 211) / 0.22)' : 'hsla(212, 92%, 43%, 0.2)'};
    border-top-color: ${(props) => (!props.isBlue ? 'rgb(var(--pt-gold-500, 55, 140, 211))' : 'hsl(212, 92%, 43%)')};
`;

const Spinner: Spinner = ({ centered, size = 'base', ...props }) => {
    const ring = <SpinnerComponent className={'pt-spinner'} size={size} {...props} />;

    if (!centered) return ring;

    return (
        <div css={tw`flex justify-center items-center`} style={{ padding: SIZE_MAP[size].pad }}>
            {ring}
        </div>
    );
};
Spinner.displayName = 'Spinner';

Spinner.Size = {
    SMALL: 'small',
    BASE: 'base',
    LARGE: 'large',
};

// Stock defaults this to LARGE; 'base' is the compact equivalent now that
// every step in the table is small.
Spinner.Suspense = ({ children, centered = true, size = Spinner.Size.BASE, ...props }) => (
    <Suspense fallback={<Spinner centered={centered} size={size} {...props} />}>
        <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
);
Spinner.Suspense.displayName = 'Spinner.Suspense';

export default Spinner;
