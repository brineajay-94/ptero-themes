import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import register from '@/api/auth/register';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Reaptcha from 'reaptcha';
import useFlash from '@/plugins/useFlash';
import { brandName, registrationEnabled } from '@/lib/brand';

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
                    title={'Create your account'}
                    subtitle={`Join ${brandName()} to deploy and manage your servers.`}
                    footer={
                        <>
                            Already have an account? <Link to={'/auth/login'}>Sign in</Link>
                        </>
                    }
                >
                    <Field light type={'email'} label={'Email'} name={'email'} disabled={isSubmitting} />
                    <div css={tw`mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                        <Field light type={'text'} label={'First name'} name={'firstName'} disabled={isSubmitting} />
                        <Field light type={'text'} label={'Last name'} name={'lastName'} disabled={isSubmitting} />
                    </div>
                    <div css={tw`mt-4`}>
                        <Field light type={'text'} label={'Username'} name={'username'} disabled={isSubmitting} />
                    </div>
                    <div css={tw`mt-4`}>
                        <Field light type={'password'} label={'Password'} name={'password'} disabled={isSubmitting} />
                    </div>
                    <div css={tw`mt-4`}>
                        <Field
                            light
                            type={'password'}
                            label={'Confirm password'}
                            name={'passwordConfirmation'}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div css={tw`mt-5`}>
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
