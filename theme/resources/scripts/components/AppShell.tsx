import React, { useEffect, useState } from 'react';
import { useLocation, useRouteMatch } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import NavigationBar from '@/components/NavigationBar';
import routes from '@/routers/routes';
import http from '@/api/http';

export interface AppShellProps {
    mode: 'dashboard' | 'server';
    serverName?: string;
    serverId?: number | string | null;
    children?: React.ReactNode;
}

const normalize = (value: string) => (value === '' || value === '/' ? '/' : value.replace(/\/+$/, ''));

/**
 * Strips the parameter segment off a route definition so `/files/:action(edit|new)`
 * can be matched against the live URL `/files/edit`.
 */
const basePath = (path: string) => normalize(path.replace(/\/:[^(]+(?:\([^)]*\))?/, ''));

const AppShell = ({ mode, serverName, serverId, children }: AppShellProps) => {
    const location = useLocation();
    const match = useRouteMatch<{ id: string }>();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const subPath =
        mode === 'server'
            ? normalize(location.pathname.replace(/^\/server\/[^/]+/, ''))
            : normalize(location.pathname.replace(/^\/account/, ''));

    const isAccount = location.pathname.startsWith('/account');
    const routeSet = mode === 'server' ? routes.server : routes.account;
    const matched = routeSet
        .filter((route) => !!route.name)
        .filter((route) =>
            route.path === '/'
                ? subPath === '/'
                : subPath === basePath(route.path) || subPath.startsWith(`${basePath(route.path)}/`)
        )
        .pop();

    const title = mode === 'server' ? matched?.name || 'Server' : isAccount ? matched?.name || 'Account' : 'Dashboard';

    const subtitle = mode === 'server' ? serverName || 'Loading server' : 'Niraula EduMedia';

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

    const sidebar = (onNavigate?: () => void) => (
        <Sidebar
            mode={mode}
            serverName={serverName}
            serverId={serverId}
            matchUrl={match?.url}
            onNavigate={onNavigate}
            onLogout={onLogout}
        />
    );

    return (
        <div className={'pt-shell'}>
            <aside className={'pt-sidebar'}>{sidebar()}</aside>

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
