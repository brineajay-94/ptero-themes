import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';

/**
 * brine-theme: a copy of the panel's `TitledGreyBox`, restated in `--pt-*` tokens.
 *
 * WHY A COPY
 * ----------
 * The stock box is a dark card with a `bg-neutral-900` header and a `border-black`
 * rule, which is how it looks in the panel's own palette and is why the subuser
 * dialog's permission groups - CONTROL, FILE, and the rest - came out as dark navy
 * panels with dark grey copy inside a white dialog: a block of the old panel
 * dropped into the middle of the themed one, with the permission names and their
 * descriptions barely legible against it.
 *
 * The shape is kept and only the paint changes, because the shape is good: a
 * header strip that names the group, a body that holds the rows, and a hairline
 * between them. So it is now a card - `--pt-gray-600` header on a `--pt-gray-700`
 * body, page ink, a real hairline - and it sits in the dialog as another card
 * rather than as a second theme.
 *
 * The header also gets a little more room than the stock `p-3`, and the title is
 * `--pt-gray-50` rather than inherited, because a group name is the one line in
 * the block that has to be findable at a glance.
 */

interface Props {
    icon?: IconProp;
    title: string | React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

const TitledGreyBox = ({ icon, title, children, className }: Props) => (
    <div
        className={className}
        css={tw`rounded shadow-md overflow-hidden`}
        style={{
            backgroundColor: 'rgb(var(--pt-gray-700))',
            border: '1px solid rgb(var(--pt-gray-600))',
        }}
    >
        <div
            css={tw`flex items-center gap-2 px-4 py-2.5`}
            style={{
                backgroundColor: 'rgb(var(--pt-gray-600) / 0.55)',
                borderBottom: '1px solid rgb(var(--pt-gray-600))',
            }}
        >
            {typeof title === 'string' ? (
                <>
                    {icon && (
                        <FontAwesomeIcon icon={icon} css={tw`text-xs`} style={{ color: 'rgb(var(--pt-navy-300))' }} />
                    )}
                    <p
                        css={tw`text-xs font-semibold uppercase tracking-wider flex-1`}
                        style={{ color: 'rgb(var(--pt-gray-50))' }}
                    >
                        {title}
                    </p>
                </>
            ) : (
                title
            )}
        </div>
        <div css={tw`p-3`}>{children}</div>
    </div>
);

export default memo(TitledGreyBox, isEqual);
