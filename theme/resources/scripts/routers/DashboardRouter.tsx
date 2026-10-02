import React from 'react';
import { Route, Switch } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import AccountOverviewContainer from '@/components/account/AccountOverviewContainer';
import AccountEmailContainer from '@/components/account/AccountEmailContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';
import { normalizeAccountPath, THEME_ACCOUNT_ROUTES } from '@/lib/accountRoutes';

/**
 * The panel's own account routes, minus the ones the theme renders itself.
 *
 * `routes.account` is a panel file the theme does not ship, and it is also what
 * the drawer's navigation reads - so it is NOT overridden wholesale, which
 * would change that list too. Instead the entries the theme provides are
 * filtered OUT of the map below and routed explicitly above it.
 *
 * Filtering rather than relying on route order is deliberate. `<Switch>` takes
 * the first match, so putting these above the map would work today - but the
 * map's own entries resolve to the same URLs, and two routes for one URL is a
 * thing that breaks the moment the order changes. Removing the duplicates
 * leaves exactly one each.
 *
 * Both tables are compared through `normalizeAccountPath()` because they spell
 * the overview differently: the panel uses `/` where the theme uses `''`. A
 * literal comparison therefore missed the panel's own overview entry, which
 * resolved to `/account/` - one URL away from the theme's `/account` and
 * silently shadowed by it, so the panel's component stayed in the bundle for a
 * page it could never render.
 */
const panelAccountRoutes = routes.account.filter(
    ({ path }) => !THEME_ACCOUNT_ROUTES.some((route) => route.path === normalizeAccountPath(path))
);

/**
 * Which component renders each of the theme's own account routes, keyed by the
 * same bare path `THEME_ACCOUNT_ROUTES` uses.
 *
 * A lookup rather than a ternary inside the loop below, because the route table
 * is data that `AppShell` also reads and it must not grow a component import.
 * A path with no entry here renders nothing rather than a broken route - it
 * cannot happen today, and the map is the only place that would have to change.
 */
const THEME_ACCOUNT_COMPONENTS: Record<string, React.ComponentType> = {
    '': AccountOverviewContainer,
    email: AccountEmailContainer,
};

export default () => {
    const location = useLocation();

    return (
        <AppShell mode={'dashboard'}>
            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
                    <Switch location={location}>
                        <Route path={'/'} exact>
                            <DashboardContainer />
                        </Route>

                        {/* The account overview and the change-email page are the theme's own, not
                            the panel's. See the note on panelAccountRoutes above for why they are
                            filtered out of the panel's table instead of simply taking priority over
                            it. */}
                        {THEME_ACCOUNT_ROUTES.map((route) => {
                            const url = route.path === '' ? '/account' : `/account/${route.path}`;
                            const Component = THEME_ACCOUNT_COMPONENTS[route.path];

                            if (!Component) {
                                return null;
                            }

                            return (
                                <Route key={url} path={url} exact>
                                    <Component />
                                </Route>
                            );
                        })}

                        {panelAccountRoutes.map(({ path, component: Component }) => {
                            const segment = normalizeAccountPath(path);

                            return (
                                <Route
                                    key={path}
                                    path={segment === '' ? '/account' : `/account/${segment}`}
                                    exact
                                >
                                    <Component />
                                </Route>
                            );
                        })}
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </AppShell>
    );
};