import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Solid only: the panel does not ship @fortawesome/free-brands-svg-icons, so
// there is no Discord glyph to reach for. faComments stands in for it.
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faComments, faHome, faSignal } from '@fortawesome/free-solid-svg-icons';
import { linkHref } from '@/lib/brand';

export type QuickLinkSlot = 'home' | 'discord' | 'status';

const ICONS: Record<QuickLinkSlot, IconDefinition> = {
    home: faHome,
    discord: faComments,
    status: faSignal,
};

const LABELS: Record<QuickLinkSlot, string> = {
    home: 'Home',
    discord: 'Discord',
    status: 'Status',
};

/**
 * The admin's quick links, resolved once. Each entry is null when that link is
 * switched off, which is what makes the toggle in Admin -> Site Settings -> Links
 * hide the button rather than just disabling it.
 *
 * `auth` shows every enabled link as a labelled button above the login card;
 * `bar` shows only the ones that make sense in the dashboard topbar, and Home is
 * deliberately left out there - the user is already on the home page, so a Home
 * button next to the dashboard link would be noise.
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
                    <FontAwesomeIcon icon={ICONS[slot]} />
                    <span>{LABELS[slot]}</span>
                </a>
            ))}
        </nav>
    );
};

export const TopbarLinks: React.FC = () => {
    const links = resolve('bar');
    if (links.length === 0) return null;

    return (
        <>
            {links.map(({ slot, href }) => (
                <a key={slot} href={href} title={LABELS[slot]} aria-label={LABELS[slot]} rel={'noopener noreferrer'}>
                    <FontAwesomeIcon icon={ICONS[slot]} />
                </a>
            ))}
        </>
    );
};
