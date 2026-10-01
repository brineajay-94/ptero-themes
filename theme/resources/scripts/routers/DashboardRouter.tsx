import React from 'react';
import { Route, Switch } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import AccountOverviewContainer from '@/components/account/AccountOverviewContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';

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

                        {/* The account overview is the theme's own, not the panel's.
                            The panel's `routes.account` list is a panel file the theme
                            does not ship - it is also what the drawer's navigation reads,
                            so overriding it wholesale would change that list too. Instead
                            the empty-path entry (the overview) is filtered OUT of the map
                            below and routed here explicitly.

                            That filter rather than relying on route order is deliberate.
                            `<Switch>` takes the first match, so putting this above the map
                            would work today - but the map's overview entry resolves to
                            `/account` as well, and two routes for one URL is a thing that
                            breaks the moment the order changes. Removing the duplicate
                            means there is exactly one. */}
                        <Route path={'/account'} exact>
                            <AccountOverviewContainer />
                        </Route>

                        {routes.account
                            .filter(({ path }) => path !== '')
                            .map(({ path, component: Component }) => (
                                <Route key={path} path={`/account/${path}`.replace('//', '/')} exact>
                                    <Component />
                                </Route>
                            ))}
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </AppShell>
    );
};
