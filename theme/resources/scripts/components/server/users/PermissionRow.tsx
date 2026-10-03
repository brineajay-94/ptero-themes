import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Checkbox from '@/components/elements/Checkbox';
import React from 'react';
import { useStoreState } from 'easy-peasy';
import Label from '@/components/elements/Label';

/**
 * brine-theme: a copy of the panel's `PermissionRow`, with the hover restated.
 *
 * The stock hover was `border-neutral-500 bg-neutral-800`, written for a dark row
 * on a dark box. With the box now a card, that pair is two steps in one
 * direction at best and invisible at worst - the hover state a permission row
 * needs most, because it is the only thing telling you which of twenty similarly
 * named rows you are about to tick.
 *
 * So the hover is a tint of the page's own mid grey with a hairline in the
 * accent, and the disabled state loses the opacity wash in favour of an explicit
 * muted ink - a faded label is still readable, whereas a faded label on a tinted
 * hover is not.
 */
const Container = styled.label`
    ${tw`flex items-center border border-transparent rounded md:p-2 transition-colors duration-75`};
    text-transform: none;

    &:not(.disabled) {
        ${tw`cursor-pointer`};

        &:hover {
            background-color: rgb(var(--pt-gray-500) / 0.18);
            border-color: rgb(var(--pt-navy-300) / 0.5);
        }
    }

    &:not(:first-of-type) {
        ${tw`mt-4 sm:mt-2`};
    }

    &.disabled {
        ${tw`cursor-not-allowed`};
        color: rgb(var(--pt-gray-400));

        & input[type='checkbox']:not(:checked) {
            ${tw`border-0`};
        }
    }
`;

interface Props {
    permission: string;
    disabled: boolean;
}

const PermissionRow = ({ permission, disabled }: Props) => {
    const [key, pkey] = permission.split('.', 2);
    const permissions = useStoreState((state) => state.permissions.data);

    return (
        <Container htmlFor={`permission_${permission}`} className={disabled ? 'disabled' : undefined}>
            <div css={tw`p-2`}>
                <Checkbox
                    id={`permission_${permission}`}
                    name={'permissions'}
                    value={permission}
                    css={tw`w-5 h-5 mr-2`}
                    disabled={disabled}
                />
            </div>
            <div css={tw`flex-1`}>
                <Label as={'p'} css={tw`font-medium`}>
                    {pkey}
                </Label>
                {permissions[key].keys[pkey].length > 0 && (
                    <p css={tw`text-xs mt-1`} style={{ color: 'rgb(var(--pt-gray-400))' }}>
                        {permissions[key].keys[pkey]}
                    </p>
                )}
            </div>
        </Container>
    );
};

export default PermissionRow;
