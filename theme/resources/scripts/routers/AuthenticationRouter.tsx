import React from 'react';
import { Route, Switch, useRouteMatch, Link } from 'react-router-dom';
import LoginContainer from '@/components/auth/LoginContainer';
import RegisterContainer from '@/components/auth/RegisterContainer';
import ForgotPasswordContainer from '@/components/auth/ForgotPasswordContainer';
import ResetPasswordContainer from '@/components/auth/ResetPasswordContainer';
import LoginCheckpointContainer from '@/components/auth/LoginCheckpointContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useHistory, useLocation } from 'react-router';
import { backgroundStyle } from '@/lib/brand';

export default () => {
    const history = useHistory();
    const location = useLocation();
    const { path } = useRouteMatch();

    // Page chrome, so it lives on the page wrapper rather than inside the
    // centred auth column: the stylesheet pins it to the viewport's top-left
    // corner. Reading it off the location keeps the label right for every auth
    // screen, and for the ones that only exist when registration is enabled.
    const isRegister = location.pathname.includes('/register');
    const isForgot = location.pathname.includes('/password');
    const isReset = location.pathname.includes('/reset');
    // Anything else on /auth is the sign-in screen itself.
    const current = isRegister ? 'Register' : isForgot ? 'Forgot password' : isReset ? 'Reset password' : 'Login';

    return (
        <div className={'pt-auth-page'} style={backgroundStyle('auth')}>
            <nav className={'pt-crumbs'} aria-label={'Breadcrumb'}>
                <Link to={'/'} className={'pt-crumb'}>
                    Home
                </Link>
                <span className={'pt-crumb-sep'} aria-hidden={'true'}>
                    /
                </span>
                <span className={'pt-crumb is-current'}>{current}</span>
            </nav>
            <Switch location={location}>
                <Route path={`${path}/login`} component={LoginContainer} exact />
                <Route path={`${path}/register`} component={RegisterContainer} exact />
                <Route path={`${path}/login/checkpoint`} component={LoginCheckpointContainer} />
                <Route path={`${path}/password`} component={ForgotPasswordContainer} exact />
                <Route path={`${path}/password/reset/:token`} component={ResetPasswordContainer} />
                <Route path={`${path}/checkpoint`} />
                <Route path={'*'}>
                    <NotFound onBack={() => history.push('/auth/login')} />
                </Route>
            </Switch>
        </div>
    );
};
