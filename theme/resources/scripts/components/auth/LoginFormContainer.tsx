import React, { forwardRef } from 'react';
import { Form } from 'formik';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import { brandName, logoUrl } from '@/lib/brand';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
    subtitle?: string;
};

export default forwardRef<HTMLFormElement, Props>(({ title, subtitle, ...props }, ref) => (
    <div className={'pt-auth'}>
        <div className={'pt-auth-bar'}>
            <a className={'pt-auth-bar-brand'} href={'https://pterodactyl.io'} target={'_blank'} rel={'noreferrer'}>
                <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                <span>{brandName()}</span>
            </a>
            <nav className={'pt-auth-bar-links'}>
                <a href={'https://pterodactyl.io/docs'} target={'_blank'} rel={'noreferrer'}>
                    Help
                </a>
                <a href={'https://status.pterodactyl.io'} target={'_blank'} rel={'noreferrer'}>
                    Status
                </a>
            </nav>
        </div>
        <div className={'pt-auth-main'}>
            <div className={'pt-auth-card'}>
                <div className={'pt-auth-top'}>
                    <span className={'pt-auth-emblem'}>
                        <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                    </span>
                    <h1>{title || brandName()}</h1>
                </div>
                <div className={'pt-auth-body'}>
                    {subtitle && <p className={'pt-auth-subtitle'}>{subtitle}</p>}
                    <FlashMessageRender css={tw`mb-4`} />
                    <Form {...props} ref={ref}>
                        {props.children}
                    </Form>
                </div>
                <div className={'pt-auth-footer'}>
                    &copy; {new Date().getFullYear()} {brandName()}. All rights reserved.
                </div>
            </div>
        </div>
    </div>
));
