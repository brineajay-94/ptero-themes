import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    IconDefinition,
    faArchive,
    faCalendarAlt,
    faChevronRight,
    faCloud,
    faCog,
    faDatabase,
    faFolder,
    faHistory,
    faKey,
    faLock,
    faNetworkWired,
    faPuzzlePiece,
    faCubes,
    faServer,
    faSignOutAlt,
    faSlidersH,
    faTerminal,
    faThLarge,
    faUserCircle,
    faUserFriends,
    faShieldAlt,
    faEnvelope,
} from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import type { ServerEggVariable } from '@/api/server/types';
import Can from '@/components/elements/Can';
import Avatar from '@/components/Avatar';
import routes from '@/routers/routes';
import { brandName, logoUrl, accountAccess, themeCredit } from '@/lib/brand';
import { THEME_SERVER_ROUTES } from '@/lib/serverExtras';
import { normalizeAccountPath, THEME_ACCOUNT_ROUTES } from '@/lib/accountRoutes';
import { candidateJarKinds } from '@/lib/serverFamily';
import { hasJarDirectory, type JarKind } from '@/api/server/jars';

/**
 * How the sidebar is being used.
 *
 * `drawer` is the mobile one: brand block on top, account/admin navigation for
 * the dashboard, and the avatar + sign-out footer. `rail` is the fixed desktop
 * column on a server page, which is shaped differently - a card naming the server
 * at the top, no brand block (the topbar directly above carries the logo) and no
 * avatar footer (the topbar carries the avatar and sign-out there too). What the
 * rail does carry at the bottom is the credit line, which has nowhere else to go.
 *
 * Two variants rather than two components on purpose: the NAVIGATION is one
 * list and must stay one list, or the rail and the drawer drift into offering
 * different destinations. Only the frame around it changes.
 */
export type SidebarVariant = 'drawer' | 'rail';

export interface SidebarProps {
    mode: 'dashboard' | 'server';
    /** Which frame to render around the navigation. Defaults to the drawer. */
    variant?: SidebarVariant;
    /**
     * Only set in server mode, and only read in the RAIL variant - for the card
     * that names the current server.
     *
     * Props rather than ServerContext hooks, and that is a correction rather than
     * a style choice: AppShell renders this component for the mobile drawer on
     * every page, while App.tsx mounts `ServerContext.Provider` only around
     * /server/:id. A hook here throws on / and /account, and the panel's
     * ErrorBoundary replaces the whole dashboard with "An error was encountered by
     * the application while rendering this view". ServerRouter reads these and
     * passes them down; it is the only place guaranteed to be inside the context.
     */
    serverName?: string;
    /** The panel's power state string - 'running', 'offline', 'starting', ... */
    serverStatus?: string | null;
    serverId?: number | string | null;
    /**
     * Only set in server mode. Used to decide which jar flavours this server can
     * actually take - see lib/serverFamily for why this is a combination of an
     * egg fingerprint and a filesystem probe rather than a name check.
     */
    serverUuid?: string;
    /**
     * Only set in server mode. The egg's user-visible variables, passed down
     * because the Sidebar renders in dashboard mode too, where there is no
     * ServerContext to read them from.
     */
    serverVariables?: ServerEggVariable[];
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
    'Email Address': faEnvelope,
};

const Section: React.FC<{ label: string }> = ({ label }) => <div className={'pt-nav-section'}>{label}</div>;

/**
 * The rail's word for the panel's power states.
 *
 * The panel sends 'running' and 'offline' and, while a transition is in flight,
 * 'starting' or 'stopping'. Those are state names, not sentences - "running" in a
 * card reads like a label on a switch, not like the state of a server - so the
 * two settled states are renamed and the two transitional ones are left as
 * themselves, because "Starting" is exactly what is happening.
 *
 * Anything unrecognised, including the null the store holds until the socket's
 * first push, renders as Offline rather than as a blank card.
 */
const railStatusLabel = (status?: string | null): string => {
    if (status === 'running') return 'Online';
    if (status === 'starting') return 'Starting';
    if (status === 'stopping') return 'Stopping';

    return 'Offline';
};

const railStatusKind = (status?: string | null): string => {
    if (status === 'running') return 'online';
    if (status === 'starting' || status === 'stopping') return 'busy';

    return 'offline';
};

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

/**
 * The account navigation: the panel's own entries, then the theme's.
 *
 * The panel's table is used as-is - it is a panel file the theme does not ship,
 * and it is the same list DashboardRouter filters - and the theme's own routes
 * are appended rather than merged into it. Both are compared through
 * `normalizeAccountPath()`, because the panel spells the overview `/` where the
 * theme spells it `''`, and a literal comparison would list Account twice.
 *
 * The theme entry is rendered only for a session that is allowed to use it: on
 * a Google or Discord sign-in the change-email page shows the reason instead of
 * the form, and a nav item that leads to a refusal is worse than no nav item.
 */
const AccountItems: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const { canChangeEmail } = accountAccess();

    const panelItems = routes.account
        .filter((route) => !!route.name)
        .filter((route) => !THEME_ACCOUNT_ROUTES.some((entry) => entry.path === normalizeAccountPath(route.path)))
        .map(({ path, name }) => ({ path: normalizeAccountPath(path), name: name! }));

    const themeItems = THEME_ACCOUNT_ROUTES.filter((route) => route.path !== '' && canChangeEmail).map((route) => ({
        path: route.path,
        name: route.name,
    }));

    return (
        <>
            {[...panelItems, ...themeItems].map(({ path, name }) => (
                <Item
                    key={path === '' ? 'overview' : path}
                    to={path === '' ? '/account' : `/account/${path}`}
                    icon={ACCOUNT_ICONS[name] || faUserCircle}
                    exact={path === ''}
                    onClick={onNavigate}
                >
                    {name}
                </Item>
            ))}
        </>
    );
};

export default ({
    mode,
    variant = 'drawer',
    serverName,
    serverStatus,
    serverId,
    serverUuid,
    serverVariables,
    matchUrl,
    onNavigate,
    onLogout,
}: SidebarProps) => {
    const panelName = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const username = useStoreState((state: ApplicationStore) => state.user.data?.username);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin);

    // Which jar flavours this server can take. The panel does not expose the egg
    // name, so this is an egg fingerprint (free, from the variables that are
    // user_viewable) narrowed by probing the directories it does not rule out.
    // A Paper server has plugins/, a Forge or Fabric server has mods/, a Vanilla
    // or TeamSpeak server has neither.
    //
    // The nav renders immediately and items appear when the answer lands, so
    // nothing blocks on it.
    const [jarKinds, setJarKinds] = useState<JarKind[]>([]);

    useEffect(() => {
        if (mode !== 'server' || !serverUuid) {
            setJarKinds([]);
            return;
        }

        let active = true;
        const candidates = candidateJarKinds(serverVariables || []);

        Promise.all(candidates.map((kind) => hasJarDirectory(kind, serverUuid)))
            .then((found) => {
                if (active) {
                    setJarKinds(candidates.filter((_, index) => found[index]));
                }
            })
            // A probe failure already resolves false per kind, so reaching here
            // means something unexpected - hide the items rather than guess.
            .catch(() => {
                if (active) {
                    setJarKinds([]);
                }
            });

        return () => {
            active = false;
        };
    }, [mode, serverUuid, serverVariables]);

    const serverTo = (value: string) => {
        const base = (matchUrl || '').replace(/\/*$/, '');
        return value === '/' ? `${base}/` : `${base}/${value.replace(/^\/+/, '')}`;
    };

    return (
        <>
            {/*
             * The brand block, drawer only. The rail's topbar directly above
             * already carries the logo, so printing it here as well would stack
             * the same mark twice a scroll-position apart.
             */}
            {variant === 'drawer' && (
                <Link to={'/'} className={'pt-brand'} onClick={onNavigate}>
                    <span className={'pt-brand-mark'}>
                        {logoUrl() ? <img src={logoUrl()!} alt={''} /> : brandName().charAt(0).toUpperCase()}
                    </span>
                    <span className={'min-w-0'}>
                        <span className={'pt-brand-name block truncate'}>{brandName()}</span>
                        <span className={'pt-brand-sub'}>Panel</span>
                    </span>
                </Link>
            )}

            {/* The rail's server card: which server this column belongs to. A wide
                column of ten links with nothing naming the server is the failure
                mode when a user has several open - the tab title is the only other
                thing naming it.

                The chevron is decorative and the whole card is not a link: on every
                server page the rail already has a Dashboard entry one row below
                pointing at the same place, and a second control to the same
                destination is the kind of thing that gets clicked, does nothing
                visible, and reads as broken. `aria-hidden` keeps it out of the
                accessibility tree for the same reason. */}
            {variant === 'rail' && (
                <div className={'pt-rail-idcard'}>
                    <span className={'pt-rail-idicon'} aria-hidden={'true'}>
                        <FontAwesomeIcon icon={faServer} />
                    </span>
                    <span className={'pt-rail-idtext'}>
                        <span className={'pt-rail-idname truncate'}>{serverName || 'Server'}</span>
                        <span className={`pt-rail-idstate is-${railStatusKind(serverStatus)}`}>
                            <span className={'pt-rail-iddot'} aria-hidden={'true'} />
                            {railStatusLabel(serverStatus)}
                        </span>
                    </span>
                    <FontAwesomeIcon icon={faChevronRight} className={'pt-rail-idchevron'} aria-hidden={'true'} />
                </div>
            )}

            <nav className={'pt-nav'}>
                {mode === 'server' ? (
                    <>
                        <Section label={'Server'} />
                        {/*
                         * `exact` is load-bearing and was missing. `NavLink` matches
                         * when the current path STARTS WITH `to`, and `to` here is
                         * `/` - which every path on the panel starts with. So this
                         * item read as the active one on Files, Console, Databases,
                         * every page, and lit up alongside whichever entry actually
                         * matched - two highlighted rows at once, on every server
                         * page, which is what it looked like.
                         */}
                        <Item to={'/'} icon={faThLarge} exact onClick={onNavigate}>
                            Dashboard
                        </Item>
                        {/* There used to be a non-clickable row here showing the current
                            server's name. It was a third copy of the same fact - the topbar
                            subtitle and the console hero both name the server already - and
                            as a nav row it looked like a broken link. */}
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
                        {THEME_SERVER_ROUTES.filter((route) => jarKinds.includes(route.jarKind)).map((route) => (
                            <Can key={route.path} action={route.permission} matchAny>
                                <Item
                                    to={serverTo(route.path)}
                                    icon={route.jarKind === 'mods' ? faCubes : faPuzzlePiece}
                                    onClick={onNavigate}
                                >
                                    {route.name}
                                </Item>
                            </Can>
                        ))}
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

            {/* The rail has no avatar footer: the topbar directly above it already carries
                the avatar and sign-out, and the reference shows them there rather
                than twice. The credit line is what the rail does carry at the
                bottom - it is attribution, not a control, and it belongs on the
                frame rather than in the navigation. */}
            {variant === 'drawer' ? (
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
            ) : (
                <div className={'pt-rail-foot'}>
                    <span className={'pt-rail-footicon'} aria-hidden={'true'}>
                        <FontAwesomeIcon icon={faCloud} />
                    </span>
                    <span className={'min-w-0'}>
                        <span className={'pt-rail-footline truncate'}>Powered by {brandName()}</span>
                        {/* Attribution, so it is a link out rather than dead text -
                            a reader who wants to know who built this should be able
                            to say so in one click. Both the name and the link come
                            from themeCredit(), the same source the page footer
                            reads, so the two credits cannot name different people. */}
                        <a
                            className={'pt-rail-footline is-dim truncate'}
                            href={themeCredit().url}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                        >
                            Design by {themeCredit().name}
                        </a>
                    </span>
                </div>
            )}
        </>
    );
};
