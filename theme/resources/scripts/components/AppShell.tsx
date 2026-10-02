import React, { useEffect, useState } from 'react';
import { useLocation, useRouteMatch } from 'react-router-dom';
import Sidebar, { type SidebarVariant } from '@/components/Sidebar';
import NavigationBar from '@/components/NavigationBar';
import routes from '@/routers/routes';
import http from '@/api/http';
import { backgroundStyle, brandName } from '@/lib/brand';
import { THEME_SERVER_ROUTES } from '@/lib/serverExtras';
import { normalizeAccountPath, THEME_ACCOUNT_ROUTES } from '@/lib/accountRoutes';
import type { ServerEggVariable } from '@/api/server/types';

export interface AppShellProps {
    mode: 'dashboard' | 'server';
    serverName?: string;
    /**
     * The server's short identifier and power state, forwarded to the rail's
     * header.
     *
     * Both are read in ServerRouter and passed down rather than read here,
     * because this component is ALSO mounted by DashboardRouter and
     * AuthenticationRouter, where there is no ServerContext to read. See the
     * note on SidebarProps, which is where that mistake actually landed.
     */
    serverIdentifier?: string;
    serverStatus?: string | null;
    serverId?: number | string | null;
    /**
     * Passed down so the sidebar can decide whether to offer the Plugins item.
     * It is a prop rather than a ServerContext read because AppShell also renders
     * in dashboard mode, where there is no server context to read from.
     */
    serverUuid?: string;
    /** The egg's user-visible variables, used to pick the jar nav items. */
    serverVariables?: ServerEggVariable[];
    children?: React.ReactNode;
}

const normalize = (value: string) => (value === '' || value === '/' ? '/' : value.replace(/\/+$/, ''));

/**
 * Strips the parameter segment off a route definition so `/files/:action(edit|new)`
 * can be matched against the live URL `/files/edit`.
 */
const basePath = (path: string) => normalize(path.replace(/\/:[^(]+(?:\([^)]*\))?/, ''));

const AppShell = ({
    mode,
    serverName,
    serverIdentifier,
    serverStatus,
    serverId,
    serverUuid,
    serverVariables,
    children,
}: AppShellProps) => {
    const location = useLocation();
    const match = useRouteMatch<{ id: string }>();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const subPath =
        mode === 'server'
            ? normalize(location.pathname.replace(/^\/server\/[^/]+/, ''))
            : normalize(location.pathname.replace(/^\/account/, ''));

    const isAccount = location.pathname.startsWith('/account');
    // The desktop rail is a server-page thing only. See the note at its render.
    const rail = mode === 'server';
    const routeSet = mode === 'server' ? routes.server : routes.account;
    const matched = routeSet
        .filter((route) => !!route.name)
        .filter((route) =>
            route.path === '/'
                ? subPath === '/'
                : subPath === basePath(route.path) || subPath.startsWith(`${basePath(route.path)}/`)
        )
        .pop();

    const title =
        mode === 'server'
            ? matched?.name ||
              // The theme's own routes are not in routes.server, so without this
              // the topbar would fall back to "Server" on the Plugins page.
              THEME_SERVER_ROUTES.find((route) => subPath === `/${route.path}`)?.name ||
              'Server'
            : isAccount
            ? matched?.name ||
              // Same reason for the account pages: /account/email is the theme's,
              // so it is not in routes.account and the fallback below would
              // title it "Account". Compared through the same normaliser the
              // router uses, because the two tables spell the overview
              // differently (`/` against '').
              THEME_ACCOUNT_ROUTES.find((route) => route.path === normalizeAccountPath(subPath))?.name ||
              'Account'
            : 'Dashboard';

    const subtitle = mode === 'server' ? serverName || 'Loading server' : brandName();

    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDrawerOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [drawerOpen]);

    const onLogout = () => {
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error this is valid
            window.location = '/';
        });
    };

    const sidebar = (onNavigate?: () => void, sidebarVariant?: SidebarVariant) => (
        <Sidebar
            mode={mode}
            variant={sidebarVariant}
            serverName={serverName}
            serverIdentifier={serverIdentifier}
            serverStatus={serverStatus}
            serverId={serverId}
            serverUuid={serverUuid}
            serverVariables={serverVariables}
            matchUrl={match?.url}
            onNavigate={onNavigate}
            onLogout={onLogout}
        />
    );

    return (
        <div className={`pt-shell${rail ? ' has-rail' : ''}`} style={backgroundStyle('dashboard')}>
            {/*
             * No desktop sidebar on the dashboard or account pages. The reference
             * layout is a topbar-only shell there and the navigation that lived in
             * the sidebar moved into the topbar as icon-over-label items (see
             * NavigationBar). The drawer below still renders the same Sidebar
             * component, so a phone keeps the full navigation either way.
             *
             * ON SERVER PAGES IT IS BACK, and the rail only shows from lg up. That
             * is a deliberate exception: a server page is a workbench with ten
             * destinations in it (Console, Files, Database, Backups, Settings and
             * the rest), and cramming those into two topbar icons hides them. It is
             * rendered here rather than in ServerRouter so that `mode` stays the
             * one thing that decides the shell, and so the drawer and the rail
             * cannot disagree about what a server page looks like.
             *
             * The rail is always in the DOM and hidden with CSS below lg, so a
             * resize across the breakpoint does not have to mount a component -
             * and it is aria-hidden there, because the drawer is the real
             * navigation at those widths and two navigations for one page is how
             * a screen reader reads the same list twice.
             */}
            {rail && (
                <aside className={'pt-rail'} aria-hidden={'true'}>
                    {sidebar(undefined, 'rail')}
                </aside>
            )}

            <div className={'pt-shell-body'}>
                <NavigationBar
                    title={title}
                    subtitle={subtitle}
                    onMenu={() => setDrawerOpen(true)}
                    onLogout={onLogout}
                />
                <main className={'pt-shell-main'}>{children}</main>
            </div>

            <div className={`pt-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen}>
                <div className={'pt-drawer-scrim'} onClick={() => setDrawerOpen(false)} />
                <aside className={'pt-drawer-panel'} role={'dialog'} aria-label={'Navigation'}>
                    <button
                        type={'button'}
                        className={'pt-drawer-close'}
                        onClick={() => setDrawerOpen(false)}
                        aria-label={'Close navigation menu'}
                    >
                        &times;
                    </button>
                    {sidebar(() => setDrawerOpen(false))}
                </aside>
            </div>
        </div>
    );
};

export default AppShell;
