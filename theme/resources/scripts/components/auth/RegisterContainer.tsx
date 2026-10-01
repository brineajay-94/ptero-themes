import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import register from '@/api/auth/register';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import Reaptcha from 'reaptcha';
import useFlash from '@/plugins/useFlash';
import { brandName, registrationEnabled } from '@/lib/brand';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';

interface Values {
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    passwordConfirmation: string;
}

const RegisterContainer = ({ history }: RouteComponentProps) => {
    const captchaRef = useRef<Reaptcha>(null);
    const [token, setToken] = useState('');

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { enabled: recaptchaEnabled, siteKey } = useStoreState((state) => state.settings.data!.recaptcha);

    useEffect(() => {
        clearFlashes();

        // The page itself is guarded server-side as well - this just keeps the
        // React route honest if the admin turns registration off.
        if (!registrationEnabled()) {
            history.replace('/auth/login');
        }
    }, []);

    const onSubmit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();

        if (recaptchaEnabled && !token) {
            captchaRef.current!.execute().catch((error) => {
                console.error(error);

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });

            return;
        }

        register({
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            username: values.username,
            password: values.password,
            passwordConfirmation: values.passwordConfirmation,
            recaptchaData: token,
        })
            .then(() => {
                // Land on the login screen with a success flash.
                window.location.href = '/auth/login?registered=1';
            })
            .catch((error) => {
                console.error(error);

                setToken('');
                if (captchaRef.current) captchaRef.current.reset();

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    if (!registrationEnabled()) {
        return null;
    }

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{
                email: '',
                firstName: '',
                lastName: '',
                username: '',
                password: '',
                passwordConfirmation: '',
            }}
            validationSchema={object().shape({
                email: string().required('An email address is required.').email('Please enter a valid email address.'),
                firstName: string().required('A first name is required.').max(60, 'Too long.'),
                lastName: string().required('A last name is required.').max(60, 'Too long.'),
                username: string()
                    .required('A username is required.')
                    .min(3, 'Usernames must be at least 3 characters.')
                    .max(60, 'Usernames may not be longer than 60 characters.')
                    .matches(/^[A-Za-z0-9_.-]+$/, 'Use only letters, numbers, dashes, dots and underscores.'),
                password: string()
                    .required('A password is required.')
                    .min(8, 'Passwords must be at least 8 characters.'),
                passwordConfirmation: string()
                    .required('Please confirm your password.')
                    .oneOf([ref('password')], 'The passwords do not match.'),
            })}
        >
            {({ isSubmitting, setSubmitting, submitForm }) => (
                <LoginFormContainer
                    title={
                        <>
                            Create <span className={'pt-auth-heading-accent'}>your account</span>
                        </>
                    }
                    subtitle={`Join ${brandName()} to deploy and manage your servers.`}
                    showSignUpCta={false}
                    // Signing up with a provider creates the account directly, so
                    // the password fields below are not the only way in and the
                    // row belongs here as much as on the login form.
                    social={<SocialLoginButtons />}
                    footer={
                        <>
                            Already have an account? <Link to={'/auth/login'}>Sign in</Link>
                        </>
                    }
                >
                    {/* Every field on this form is `.required()` in the schema below,
                        * so every label carries the asterisk. The span is aria-hidden
                        * because "First name *" is read as "first name asterisk" - the
                        * requirement is already announced by the field's own
                        * invalid/valid state. */}
                    <div className={'pt-auth-stack'}>
                        <div className={'pt-auth-field'}>
                            <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                <FontAwesomeIcon icon={faEnvelope} />
                            </span>
                            <Field
                                light
                                type={'email'}
                                label={
                                    <>
                                        Email <span className={'pt-auth-req'} aria-hidden={'true'}>*</span>
                                    </>
                                }
                                placeholder={'you@example.com'}
                                name={'email'}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className={'pt-auth-pair'}>
                            <div className={'pt-auth-field'}>
                                <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                    <FontAwesomeIcon icon={faUser} />
                                </span>
                                <Field
                                    light
                                    type={'text'}
                                    label={
                                        <>
                                            First name <span className={'pt-auth-req'} aria-hidden={'true'}>*</span>
                                        </>
                                    }
                                    placeholder={'John'}
                                    name={'firstName'}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className={'pt-auth-field'}>
                                <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                    <FontAwesomeIcon icon={faUser} />
                                </span>
                                <Field
                                    light
                                    type={'text'}
                                    label={
                                        <>
                                            Last name <span className={'pt-auth-req'} aria-hidden={'true'}>*</span>
                                        </>
                                    }
                                    placeholder={'Doe'}
                                    name={'lastName'}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className={'pt-auth-field'}>
                            <span className={'pt-auth-field-icon'} aria-hidden={'true'}>
                                <FontAwesomeIcon icon={faUser} />
                            </span>
                            <Field
                                light
                                type={'text'}
                                label={
                                    <>
                                        Username <span className={'pt-auth-req'} aria-hidden={'true'}>*</span>
                                    </>
                                }
                                placeholder={'Choose a username'}
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
                                label={
                                    <>
                                        Password <span className={'pt-auth-req'} aria-hidden={'true'}>*</span>
                                    </>
                                }
                                placeholder={'Create a strong password'}
                                name={'password'}
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
                                label={
                                    <>
                                        Confirm password{' '}
                                        <span className={'pt-auth-req'} aria-hidden={'true'}>
                                            *
                                        </span>
                                    </>
                                }
                                placeholder={'Confirm your password'}
                                name={'passwordConfirmation'}
                                disabled={isSubmitting}
                            />
                        </div>

                        <Button type={'submit'} size={'xlarge'} isLoading={isSubmitting} disabled={isSubmitting}>
                            Create account
                        </Button>
                    </div>

                    {recaptchaEnabled && (
                        <Reaptcha
                            ref={captchaRef}
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

export default RegisterContainer;
