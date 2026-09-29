import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    IconDefinition,
    faArchive,
    faCalendarAlt,
    faCog,
    faDatabase,
    faFolder,
    faHistory,
    faKey,
    faLock,
    faNetworkWired,
    faServer,
    faSignOutAlt,
    faSlidersH,
    faTerminal,
    faThLarge,
    faUserCircle,
    faUserFriends,
    faShieldAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Can from '@/components/elements/Can';
import Avatar from '@/components/Avatar';
import routes from '@/routers/routes';
import { brandName, logoUrl } from '@/lib/brand';

export interface SidebarProps {
    mode: 'dashboard' | 'server';
    serverName?: string;
    serverId?: number | string | null;
    matchUrl?: string;
    onNavigate?: () => void;
    onLogout?: () => void;
}

const SERVER_ICONS: Record<string, IconDefinition> = {
    Console: faTerminal,
    Files: faFolder,
    Databases: faDatabase,
    Schedules: faCalendarAlt,
    Users: faUserFriends,
    Backups: faArchive,
    Network: faNetworkWired,
    Startup: faSlidersH,
    Settings: faCog,
    Activity: faHistory,
};

const ACCOUNT_ICONS: Record<string, IconDefinition> = {
    Account: faUserCircle,
    'API Credentials': faKey,
    'SSH Keys': faLock,
    Activity: faHistory,
};

const Section: React.FC<{ label: string }> = ({ label }) => <div className={'pt-nav-section'}>{label}</div>;

const Item: React.FC<{
    to: string;
    icon: IconDefinition;
    exact?: boolean;
    onClick?: () => void;
}> = ({ to, icon, exact, onClick, children }) => (
    <NavLink to={to} exact={exact} className={'pt-nav-item'} activeClassName={'active'} onClick={onClick}>
        <span className={'pt-nav-ico'}>
            <FontAwesomeIcon icon={icon} />
        </span>
        <span className={'flex-1 truncate'}>{children}</span>
    </NavLink>
);

const AccountItems: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
    <>
        {routes.account
            .filter((route) => !!route.name)
            .map(({ path, name }) => (
                <Item
                    key={path}
                    to={`/account/${path}`.replace('//', '/')}
                    icon={ACCOUNT_ICONS[name!] || faUserCircle}
                    exact={path === '/'}
                    onClick={onNavigate}
                >
                    {name}
                </Item>
            ))}
    </>
);

export default ({ mode, serverName, serverId, matchUrl, onNavigate, onLogout }: SidebarProps) => {
    const panelName = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const username = useStoreState((state: ApplicationStore) => state.user.data?.username);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin);

    const serverTo = (value: string) => {
        const base = (matchUrl || '').replace(/\/*$/, '');
        return value === '/' ? `${base}/` : `${base}/${value.replace(/^\/+/, '')}`;
    };

    return (
        <>
            <Link to={'/'} className={'pt-brand'} onClick={onNavigate}>
                <span className={'pt-brand-mark'}>
                    {logoUrl() ? <img src={logoUrl()!} alt={''} /> : brandName().charAt(0).toUpperCase()}
                </span>
                <span className={'min-w-0'}>
                    <span className={'pt-brand-name block truncate'}>{brandName()}</span>
                    <span className={'pt-brand-sub'}>Panel</span>
                </span>
            </Link>

            <nav className={'pt-nav'}>
                {mode === 'server' ? (
                    <>
                        <Section label={'Server'} />
                        <Item to={'/'} icon={faThLarge} onClick={onNavigate}>
                            Dashboard
                        </Item>
                        {serverName && (
                            <div className={'pt-nav-item'} style={{ cursor: 'default' }}>
                                <span className={'pt-nav-ico'}>
                                    <FontAwesomeIcon icon={faServer} />
                                </span>
                                <span className={'flex-1 truncate font-semibold text-white'}>{serverName}</span>
                            </div>
                        )}
                        {routes.server
                            .filter((route) => !!route.name)
                            .map((route) =>
                                route.permission ? (
                                    <Can key={route.path} action={route.permission} matchAny>
                                        <Item
                                            to={serverTo(route.path)}
                                            icon={SERVER_ICONS[route.name!] || faTerminal}
                                            exact={route.exact}
                                            onClick={onNavigate}
                                        >
                                            {route.name}
                                        </Item>
                                    </Can>
                                ) : (
                                    <Item
                                        key={route.path}
                                        to={serverTo(route.path)}
                                        icon={SERVER_ICONS[route.name!] || faTerminal}
                                        exact={route.exact}
                                        onClick={onNavigate}
                                    >
                                        {route.name}
                                    </Item>
                                )
                            )}
                        {rootAdmin && serverId !== undefined && serverId !== null && (
                            <a
                                href={`/admin/servers/view/${serverId}`}
                                target={'_blank'}
                                rel={'noreferrer'}
                                className={'pt-nav-item'}
                                onClick={onNavigate}
                            >
                                <span className={'pt-nav-ico'}>
                                    <FontAwesomeIcon icon={faShieldAlt} />
                                </span>
                                <span className={'flex-1 truncate'}>Admin</span>
                            </a>
                        )}
                    </>
                ) : (
                    <>
                        <Section label={'Overview'} />
                        <Item to={'/'} icon={faThLarge} exact onClick={onNavigate}>
                            Dashboard
                        </Item>
                        <Section label={'Account'} />
                        <AccountItems onNavigate={onNavigate} />
                        {rootAdmin && (
                            <a href={'/admin'} className={'pt-nav-item'} onClick={onNavigate}>
                                <span className={'pt-nav-ico'}>
                                    <FontAwesomeIcon icon={faShieldAlt} />
                                </span>
                                <span className={'flex-1 truncate'}>Admin Area</span>
                            </a>
                        )}
                    </>
                )}
            </nav>

            <div className={'pt-sidebar-foot'}>
                <div className={'flex items-center gap-3'}>
                    <span className={'pt-avatar-btn'} style={{ cursor: 'default' }}>
                        <span>
                            <Avatar.User />
                        </span>
                    </span>
                    <span className={'min-w-0 flex-1'}>
                        <strong className={'truncate'}>{username || 'User'}</strong>
                        <span className={'truncate block'}>{panelName}</span>
                    </span>
                    {onLogout && (
                        <button
                            type={'button'}
                            className={'pt-logout-btn'}
                            onClick={onLogout}
                            title={'Sign Out'}
                            aria-label={'Sign Out'}
                        >
                            <FontAwesomeIcon icon={faSignOutAlt} />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};
