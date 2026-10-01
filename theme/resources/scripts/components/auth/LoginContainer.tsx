import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import login from '@/api/auth/login';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import Reaptcha from 'reaptcha';
import useFlash from '@/plugins/useFlash';
import { brandName } from '@/lib/brand';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';

interface Values {
    username: string;
    password: string;
}

const LoginContainer = ({ history }: RouteComponentProps) => {
    const ref = useRef<Reaptcha>(null);
    const [token, setToken] = useState('');

    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();
    const { enabled: recaptchaEnabled, siteKey } = useStoreState((state) => state.settings.data!.recaptcha);

    // One mount effect for the "you came back here with a message" cases.
    //
    // `clearFlashes()` runs first so the panel's flash queue never carries a
    // stale error in from the previous page, then at most one message is added.
    // The two cases are mutually exclusive in practice - you either just
    // registered or just failed a social sign-in - but the `else if` means that
    // if both were somehow present, the first branch wins and calls
    // `replaceState`, so the second cannot read a URL that has already been
    // rewritten.
    useEffect(() => {
        clearFlashes();

        const params = new URLSearchParams(window.location.search);

        // Registration finished - show a success banner once, then clean the
        // URL so a refresh does not replay it.
        if (params.get('registered') === '1') {
            addFlash({
                type: 'success',
                message: 'Your account has been created - sign in to continue.',
            });
            window.history.replaceState({}, '', '/auth/login');
        } else if (params.get('social_error')) {
            // A failed social sign-in, redirected back from the server-side
            // callback. Plain text, never HTML: the messages are the service's
            // own fixed strings, but nothing here should reach the DOM as
            // markup.
            addFlash({
                type: 'error',
                message: params.get('social_message') || 'Sign-in could not be completed. Please try again.',
            });
            window.history.replaceState({}, '', '/auth/login');
        }
    }, []);

    const onSubmit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();

        // If there is no token in the state yet, request the token and then abort this submit request
        // since it will be re-submitted when the recaptcha data is returned by the component.
        if (recaptchaEnabled && !token) {
            ref.current!.execute().catch((error) => {
                console.error(error);

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });

            return;
        }

        login({ ...values, recaptchaData: token })
            .then((response) => {
                if (response.complete) {
                    // @ts-expect-error this is valid
                    window.location = response.intended || '/';
                    return;
                }

                history.replace('/auth/login/checkpoint', {
                    token: response.confirmationToken,
                });
            })
            .catch((error) => {
                console.error(error);

                setToken('');
                if (ref.current) ref.current.reset();

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ username: '', password: '' }}
            validationSchema={object().shape({
                username: string().required('A username or email must be provided.'),
                password: string().required('Please enter your account password.'),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm }) => (
                <LoginFormContainer
                    title={`Welcome to ${brandName()}`}
                    // Renders nothing when no provider is configured, so a panel
                    // that has never been to Admin -> Social Login looks exactly
                    // as it did before.
                    social={<SocialLoginButtons />}
                >
                    {/* The reference puts ONE small label above the whole row rather
                        * than a label per field, and gives both fields a placeholder
                        * instead. The per-field labels are still rendered - clipped, not
                        * display:none, so they stay in the accessibility tree and a
                        * screen reader still hears which box is which - because a
                        * placeholder is not a label and disappears the moment you type. */}
                    <div className={'pt-auth-section-label'}>Login</div>

                    <div className={'pt-auth-inline'}>
                        <div className={'pt-auth-field'}>
                            <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                <FontAwesomeIcon icon={faUser} />
                            </span>
                            {/* Deliberately "Username or Email", not the reference's
                                "Email address": the panel's login endpoint accepts
                                either, and a narrower label would be wrong for anyone
                                signing in with their username. The placeholder keeps the
                                reference's shorter "Username". */}
                            <Field
                                light
                                type={'text'}
                                label={'Username or Email'}
                                placeholder={'Username'}
                                name={'username'}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className={'pt-auth-field'}>
                            <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                <FontAwesomeIcon icon={faLock} />
                            </span>
                            <Field
                                light
                                type={'password'}
                                label={'Password'}
                                placeholder={'Password'}
                                name={'password'}
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Third item in the row, not a block under it. */}
                        <Button type={'submit'} size={'xlarge'} isLoading={isSubmitting} disabled={isSubmitting}>
                            Log in
                        </Button>
                    </div>

                    <div className={'pt-auth-aside'}>
                        <Link className={'pt-auth-aside-link'} to={'/auth/password'}>
                            Forgot password?
                        </Link>
                    </div>

                    {recaptchaEnabled && (
                        <Reaptcha
                            ref={ref}
                            size={'invisible'}
                            sitekey={siteKey || '_invalid_key'}
                            onVerify={(response) => {
                                setToken(response);
                                submitForm();
                            }}
                            onExpire={() => {
                                setSubmitting(false);
                                setToken('');
                            }}
                        />
                    )}
                </LoginFormContainer>
            )}
        </Formik>
    );
};

export default LoginContainer;
