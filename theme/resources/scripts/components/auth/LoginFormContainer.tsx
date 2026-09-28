import React, { forwardRef } from 'react';
import { Form } from 'formik';
import { Link } from 'react-router-dom';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import { brandName, logoUrl, registrationEnabled } from '@/lib/brand';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
};

export default forwardRef<HTMLFormElement, Props>(({ title, subtitle, footer, ...props }, ref) => (
    <div className={'pt-auth'}>
        <div className={'pt-auth-card'}>
            <div className={'pt-auth-top'}>
                <span className={'pt-auth-emblem'}>
                    <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                </span>
                <h1>{brandName()}</h1>
            </div>
            <div className={'pt-auth-body'}>
                {title && <h2>{title}</h2>}
                {subtitle && <p className={'pt-auth-subtitle'}>{subtitle}</p>}
                <FlashMessageRender css={tw`mb-4`} />
                <Form {...props} ref={ref}>
                    {props.children}
                </Form>
            </div>
            <div className={'pt-auth-footer'}>
                {footer !== undefined ? (
                    footer
                ) : registrationEnabled() ? (
                    <span>
                        Don&rsquo;t have an account? <Link to={'/auth/register'}>Register here</Link>
                    </span>
                ) : (
                    <span>
                        &copy; {new Date().getFullYear()} {brandName()}. All rights reserved.
                    </span>
                )}
            </div>
        </div>
    </div>
));
