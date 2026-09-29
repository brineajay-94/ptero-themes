import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faHome, faSignal } from '@fortawesome/free-solid-svg-icons';
import { linkHref } from '@/lib/brand';

export type QuickLinkSlot = 'home' | 'discord' | 'status';

/**
 * The real Discord mark, inlined as SVG.
 *
 * The panel only ships @fortawesome/free-solid-svg-icons - the Discord glyph
 * lives in free-brands-svg-icons, which is not a dependency here - so pulling
 * it in would mean replacing the panel's package.json and lockfile for one
 * icon. A 24x24 path costs a few hundred bytes and always resolves.
 *
 * Path from the Discord brand icon via Simple Icons (CC0-1.0).
 *
 * It is drawn 4% larger than the FontAwesome glyphs beside it. The brand mark
 * fills far more of its 24x24 box than a FA solid icon does, so at an identical
 * font-size it reads noticeably smaller and thinner next to them.
 */
const DiscordMark: React.FC = () => (
    <svg
        viewBox={'0 0 24 24'}
        width={'1.04em'}
        height={'1.04em'}
        fill={'currentColor'}
        aria-hidden={'true'}
        focusable={'false'}
        style={{ display: 'block' }}
    >
        <path
            d={
                'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'
            }
        />
    </svg>
);

const GLYPHS: Record<QuickLinkSlot, { fa?: IconDefinition; svg?: React.FC }> = {
    home: { fa: faHome },
    discord: { svg: DiscordMark },
    status: { fa: faSignal },
};

const LABELS: Record<QuickLinkSlot, string> = {
    home: 'Home',
    discord: 'Discord',
    status: 'Status',
};

const Glyph: React.FC<{ slot: QuickLinkSlot }> = ({ slot }) => {
    const glyph = GLYPHS[slot];

    return glyph.svg ? <glyph.svg /> : <FontAwesomeIcon icon={glyph.fa!} />;
};

/**
 * The admin's quick links, resolved once. Each entry is null when that link is
 * switched off, which is what makes the toggle in Admin -> Site Settings -> Links
 * hide the button rather than just disabling it.
 */
const resolve = (area: 'auth' | 'bar'): { slot: QuickLinkSlot; href: string }[] => {
    const slots: QuickLinkSlot[] = area === 'auth' ? ['home', 'discord', 'status'] : ['discord', 'status'];

    return slots
        .map((slot) => ({ slot, href: linkHref(slot) }))
        .filter((link): link is { slot: QuickLinkSlot; href: string } => link.href !== null);
};

export const AuthLinks: React.FC = () => {
    const links = resolve('auth');
    if (links.length === 0) return null;

    return (
        <nav className={'pt-links'} aria-label={'Quick links'}>
            {links.map(({ slot, href }) => (
                <a key={slot} className={'pt-link'} href={href} target={'_blank'} rel={'noopener noreferrer'}>
                    <Glyph slot={slot} />
                    <span>{LABELS[slot]}</span>
                </a>
            ))}
        </nav>
    );
};

/**
 * The centred topbar cluster: Home, then whichever of Discord and Status the
 * admin has enabled.
 *
 * Home is a plain link to / rather than one of the toggleable Links - it is the
 * panel's own front door, so it renders whether or not anything is configured.
 */
export const TopbarLinkCluster: React.FC = () => {
    const links = resolve('bar');

    return (
        <nav className={'pt-topbar-links'} aria-label={'Quick links'}>
            <a href={'/'} title={'Home'} aria-label={'Home'}>
                <Glyph slot={'home'} />
            </a>
            {links.map(({ slot, href }) => (
                <a
                    key={slot}
                    className={'pt-topbar-link-' + slot}
                    href={href}
                    title={LABELS[slot]}
                    aria-label={LABELS[slot]}
                    rel={'noopener noreferrer'}
                >
                    <Glyph slot={slot} />
                </a>
            ))}
        </nav>
    );
};
