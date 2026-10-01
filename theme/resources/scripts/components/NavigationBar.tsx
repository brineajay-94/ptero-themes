import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faServer, faUserCircle, faShieldAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Avatar from '@/components/Avatar';
import { brandName, logoUrl } from '@/lib/brand';

export interface NavigationBarProps {
    title: string;
    subtitle?: string;
    onMenu: () => void;
    /** POSTs the panel's logout endpoint. Owned by AppShell, which owns http(). */
    onLogout: () => void;
}

/**
 * An icon-over-label navigation item, the shape the reference topbar uses for
 * Servers and Account.
 *
 * Deliberately not the shared `.pt-nav-item` the drawer reuses: that is a single
 * left-to-right row, and stretching it here would leave the label sitting beside
 * the glyph instead of centred under it.
 */
const TopNavItem = ({
    to,
    icon,
    label,
    exact,
}: {
    to: string;
    icon: Parameters<typeof FontAwesomeIcon>[0]['icon'];
    label: string;
    exact?: boolean;
}) => (
    <NavLink to={to} exact={exact} className={'pt-topnav-item'} activeClassName={'active'}>
        <FontAwesomeIcon icon={icon} className={'pt-topnav-icon'} />
        <span className={'pt-topnav-label'}>{label}</span>
    </NavLink>
);

/**
 * The topbar.
 *
 * This replaced a fixed dark sidebar plus a title-only topbar. The reference the
 * theme is following has no sidebar - navigation lives in the topbar as
 * icon-over-label items - so the sidebar is gone and this carries what it used
 * to: the brand lockup, the two destinations there were entries for, the admin
 * shortcut for a root admin, and sign-out.
 *
 * The burger and the drawer are untouched. A phone has no room for four items in
 * a topbar, so the drawer is still how narrow screens reach the full navigation.
 * Removing the sidebar did not mean removing mobile navigation.
 *
 * `title`/`subtitle` moved next to the brand as a quiet line rather than sitting
 * alone in the bar. The reference has no page title at all, but on a server page
 * the name is the only thing telling you which server you are in, so dropping it
 * would lose information the old topbar carried.
 *
 * No quick links here. The bar used to carry a centred cluster of the admin's
 * Home / Discord / Status pills, which needed the grid to stay `1fr auto 1fr` with
 * an empty balancing column so the cluster could sit at 50%. That arrangement put
 * the navigation, the username, the sign-out button and the avatar into one
 * `1fr` track, and on a narrow window the tail was squeezed until the sign-out
 * button was clipped. Two columns - brand and title taking the slack, everything
 * else its own track - gives the tail the room it needs.
 *
 * The links themselves are untouched: Admin -> Site Settings -> Links still
 * configures them, `linkHref()` still reads them, and the auth screens still use
 * Home in their breadcrumb. Only the dashboard topbar stopped rendering them, so
 * they can be switched back on without re-entering anything.
 */
export default ({ title, subtitle, onMenu, onLogout }: NavigationBarProps) => {
    const username = useStoreState((state: ApplicationStore) => state.user.data?.username);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin);

    return (
        <header className={'pt-topbar'}>
            <div className={'pt-topbar-lead'}>
                <button type={'button'} className={'pt-burger'} onClick={onMenu} aria-label={'Open navigation menu'}>
                    <FontAwesomeIcon icon={faBars} />
                </button>
                <Link to={'/'} className={'pt-brand'}>
                    <span className={'pt-brand-mark'}>
                        <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                    </span>
                    <span className={'pt-brand-name'}>{brandName()}</span>
                </Link>
                <span className={'pt-topbar-where'}>
                    <strong>{title}</strong>
                    {subtitle && <small>{subtitle}</small>}
                </span>
            </div>

            <div className={'pt-topbar-tail'}>
                <TopNavItem to={'/'} icon={faServer} label={'Servers'} exact />
                <TopNavItem to={'/account'} icon={faUserCircle} label={'Account'} />

                {rootAdmin && (
                    <a className={'pt-topnav-item'} href={'/admin'}>
                        <FontAwesomeIcon icon={faShieldAlt} className={'pt-topnav-icon'} />
                        <span className={'pt-topnav-label'}>Admin</span>
                    </a>
                )}

                {/* Username with sign-out beneath it, as the reference stacks
                    them. A button, not a link: the panel's logout is a POST.
                    `pt-topbar-account` wraps both so the pair shrinks and drops
                    the username together rather than the sign-out button losing its
                    own width, which is what used to hide it. */}
                <div className={'pt-topbar-account'}>
                    <div className={'pt-topbar-user'}>
                        {username && <span className={'pt-topbar-username'}>{username}</span>}
                        <button type={'button'} className={'pt-logout-btn'} onClick={onLogout}>
                            <FontAwesomeIcon icon={faSignOutAlt} />
                            <span>Logout</span>
                        </button>
                    </div>

                    <span className={'pt-avatar-btn'} style={{ cursor: 'default' }}>
                        <Avatar.User />
                    </span>
                </div>
            </div>
        </header>
    );
};
