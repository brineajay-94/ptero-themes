import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { TopbarHome, TopbarLinks } from '@/components/QuickLinks';

export interface NavigationBarProps {
    title: string;
    subtitle?: string;
    onMenu: () => void;
}

/**
 * The topbar is deliberately sparse: burger, title, then the Home button and
 * whatever quick links the admin has enabled.
 *
 * Search, the admin shortcut, the account avatar, sign-out and the old
 * dashboard shortcut used to live here as well. They are all still reachable -
 * Account and Admin Area are sidebar entries, sign-out is the button at the
 * bottom of the sidebar, and the dashboard is what Home opens - but sign-out was
 * the one that got hidden on small screens, so it is worth knowing the sidebar
 * (and the mobile drawer) is the only place it now appears.
 *
 * Search is the exception: it had no other home, so removing it removes the
 * panel's server search entirely.
 */
export default ({ title, subtitle, onMenu }: NavigationBarProps) => (
    <header className={'pt-topbar'}>
        <button type={'button'} className={'pt-burger'} onClick={onMenu} aria-label={'Open navigation menu'}>
            <FontAwesomeIcon icon={faBars} />
        </button>
        <div className={'pt-topbar-title'}>
            {title}
            {subtitle && <small>{subtitle}</small>}
        </div>
        <div className={'pt-topbar-actions'}>
            <TopbarHome />
            <TopbarLinks />
        </div>
    </header>
);
