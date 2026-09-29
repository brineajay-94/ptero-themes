import * as React from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faShieldAlt, faSignOutAlt, faThLarge } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Avatar from '@/components/Avatar';
import { TopbarLinks } from '@/components/QuickLinks';

export interface NavigationBarProps {
    title: string;
    subtitle?: string;
    onMenu: () => void;
    onLogout: () => void;
}

export default ({ title, subtitle, onMenu, onLogout }: NavigationBarProps) => {
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);
    const [loggingOut, setLoggingOut] = useState(false);

    const triggerLogout = () => {
        setLoggingOut(true);
        onLogout();
    };

    return (
        <header className={'pt-topbar'}>
            <SpinnerOverlay visible={loggingOut} />
            <button type={'button'} className={'pt-burger'} onClick={onMenu} aria-label={'Open navigation menu'}>
                <FontAwesomeIcon icon={faBars} />
            </button>
            <div className={'pt-topbar-title'}>
                {title}
                {subtitle && <small>{subtitle}</small>}
            </div>
            <div className={'pt-topbar-actions'}>
                <SearchContainer />
                <NavLink to={'/'} exact title={'Dashboard'} aria-label={'Dashboard'} activeClassName={'active'}>
                    <FontAwesomeIcon icon={faThLarge} />
                </NavLink>
                <TopbarLinks />
                {rootAdmin && (
                    <a href={'/admin'} title={'Admin'} aria-label={'Admin'} rel={'noreferrer'}>
                        <FontAwesomeIcon icon={faShieldAlt} />
                    </a>
                )}
                <NavLink
                    to={'/account'}
                    className={'pt-avatar-btn'}
                    title={'Account Settings'}
                    aria-label={'Account Settings'}
                    activeClassName={'active'}
                >
                    <span>
                        <Avatar.User />
                    </span>
                </NavLink>
                <button
                    type={'button'}
                    onClick={triggerLogout}
                    title={'Sign Out'}
                    aria-label={'Sign Out'}
                    className={'hidden sm:inline-flex'}
                >
                    <FontAwesomeIcon icon={faSignOutAlt} />
                </button>
            </div>
        </header>
    );
};
