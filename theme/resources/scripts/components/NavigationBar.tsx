import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { TopbarLinkCluster } from '@/components/QuickLinks';

export interface NavigationBarProps {
    title: string;
    subtitle?: string;
    onMenu: () => void;
}

/**
 * The topbar is a three-column grid: burger + title on the left, the quick-link
 * cluster in the middle, and an empty balancing column on the right.
 *
 * `1fr auto 1fr` rather than absolutely positioning the cluster at 50% - the two
 * outer columns are equal, so the centre cell is genuinely centred at any width,
 * and the title truncates inside its own column instead of sliding underneath
 * the icons on a narrow screen.
 *
 * Search, the admin shortcut, the account avatar, sign-out and the old
 * dashboard shortcut used to live here too. Account and Admin Area are sidebar
 * entries, sign-out is the button at the bottom of the sidebar, and the
 * dashboard is what Home opens. Search is the exception: it had no other home,
 * so removing it removes the panel's server search entirely.
 */
export default ({ title, subtitle, onMenu }: NavigationBarProps) => (
    <header className={'pt-topbar'}>
        <div className={'pt-topbar-lead'}>
            <button type={'button'} className={'pt-burger'} onClick={onMenu} aria-label={'Open navigation menu'}>
                <FontAwesomeIcon icon={faBars} />
            </button>
            <div className={'pt-topbar-title'}>
                {title}
                {subtitle && <small>{subtitle}</small>}
            </div>
        </div>

        <TopbarLinkCluster />

        <div className={'pt-topbar-tail'} aria-hidden={'true'} />
    </header>
);
