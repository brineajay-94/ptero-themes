import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useState } from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import TransitionRouter from '@/TransitionRouter';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import InstallListener from '@/components/server/InstallListener';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { useLocation } from 'react-router';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import PermissionRoute from '@/components/elements/PermissionRoute';
import routes from '@/routers/routes';
import { THEME_SERVER_ROUTES } from '@/lib/serverExtras';
import JarsContainer from '@/components/server/jars/JarsContainer';
import type { JarKind } from '@/api/server/jars';

/**
 * Components for the theme's own server routes, keyed by path segment.
 *
 * Both routes render the same component with a different `kind` - installing a
 * Bukkit plugin and a Forge mod are the same operation with different
 * directory, project type and loaders, so they share an implementation.
 */
const THEME_ROUTE_COMPONENTS: Record<string, React.ComponentType<{ kind: JarKind }>> = {
    plugins: JarsContainer,
    mods: JarsContainer,
};

export default () => {
    const match = useRouteMatch<{ id: string }>();
    const location = useLocation();

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [error, setError] = useState('');

const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    // The rail's server card needs the power state, and it is read HERE rather
    // than in Sidebar because this is the only place guaranteed to be inside
    // ServerContext - AppShell is also mounted on the dashboard and the auth
    // screens, where there is no provider at all.
    const powerState = ServerContext.useStoreState((state) => state.status.value);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const serverId = ServerContext.useStoreState((state) => state.server.data?.internalId);
    const variables = ServerContext.useStoreState((state) => state.server.data?.variables);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);

    const to = (value: string, url = false) => {
        if (value === '/') {
            return url ? match.url : match.path;
        }
        return `${(url ? match.url : match.path).replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;
    };

    useEffect(
        () => () => {
            clearServerState();
        },
        []
    );

    useEffect(() => {
        setError('');

        getServer(match.params.id).catch((error) => {
            console.error(error);
            setError(httpErrorToHuman(error));
        });

        return () => {
            clearServerState();
        };
    }, [match.params.id]);

    return (
        <React.Fragment key={'server-router'}>
            <AppShell
                mode={'server'}
                serverName={name}
                serverStatus={powerState}
                serverId={serverId}
                serverUuid={uuid || undefined}
                serverVariables={variables}
            >
                {!uuid || !id ? (
                    error ? (
                        <ServerError message={error} />
                    ) : (
                        <Spinner centered />
                    )
                ) : (
                    <>
                        <InstallListener />
                        <TransferListener />
                        <WebsocketHandler />
                        {inConflictState &&
                        (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                            <ConflictStateRenderer />
                        ) : (
                            <ErrorBoundary>
                                <TransitionRouter>
                                    <Switch location={location}>
                                        {routes.server.map(({ path, permission, component: Component }) => (
                                            <PermissionRoute key={path} permission={permission} path={to(path)} exact>
                                                <Spinner.Suspense>
                                                    <Component />
                                                </Spinner.Suspense>
                                            </PermissionRoute>
                                        ))}
                                        {/* Theme routes live outside the panel's routes.server
                                            * table (see lib/serverExtras) and are rendered after it,
                                            * so a stock route of the same path would win rather than
                                            * being shadowed by ours. */}
                                        {THEME_SERVER_ROUTES.map(({ path, permission, jarKind }) => {
                                            const Component = THEME_ROUTE_COMPONENTS[path];
                                            if (!Component) {
                                                return null;
                                            }

                                            return (
                                                <PermissionRoute key={path} permission={permission} path={to(path)} exact>
                                                    <Spinner.Suspense>
                                                        <Component kind={jarKind} />
                                                    </Spinner.Suspense>
                                                </PermissionRoute>
                                            );
                                        })}
                                        <Route path={'*'} component={NotFound} />
                                    </Switch>
                                </TransitionRouter>
                            </ErrorBoundary>
                        )}
                    </>
                )}
            </AppShell>
        </React.Fragment>
    );
};
