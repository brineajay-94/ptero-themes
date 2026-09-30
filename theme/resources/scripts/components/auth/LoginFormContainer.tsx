import React, { forwardRef } from 'react';
import { Form } from 'formik';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import { brandName, logoUrl, registrationEnabled } from '@/lib/brand';
import { AuthLinks } from '@/components/QuickLinks';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
    /**
     * The "manage a friend's server" nudge under the card. Only meaningful on
     * the screens where someone is trying to get *into* the panel, so
     * Forgot/Reset/Checkpoint leave it off.
     */
    showSubuserHint?: boolean;
};

/*
 * The hero copy is the theme's own marketing line, not the panel's, so it is
 * fixed rather than read from settings. The one panel-specific value on this
 * screen - the site name - is the lockup beside the logo, not the headline.
 */
const HERO_LINES = ['Your world,', 'always within reach'];
const HERO_SUB = 'Build, customize and manage your server from one place';

const SubuserHint = () => (
    <div className={'pt-subuser-hint'}>
        <span className={'pt-subuser-hint-icon'} aria-hidden={'true'}>
            <FontAwesomeIcon icon={faUsers} />
        </span>
        <span>
            <strong>Want to manage a friend&rsquo;s server?</strong>
            <span>Ask the owner to invite your email from their Subscribers page</span>
        </span>
    </div>
);

// The Home / Login breadcrumb is NOT rendered here: it is page chrome, pinned to
// the viewport's top-left corner by the stylesheet, so AuthenticationRouter owns
// it and this component only carries the quick links that sit above the card.
//
// The layout is a 50/50 split: the hero on the left carries the admin's
// "Login & register" background image plus the marketing line, the panel on the
// right carries the brand lockup, the card and the hint. Both halves are
// siblings rather than nested, because the vertical rule between them is a
// border on the panel and the hero has to be free to bleed to the viewport edge.
export default forwardRef<HTMLFormElement, Props>(
    ({ title, subtitle, footer, showSubuserHint = false, ...props }, ref) => (
        <div className={'pt-auth'}>
            <section className={'pt-auth-hero'}>
                <div className={'pt-auth-hero-copy'}>
                    <h2 className={'pt-auth-hero-title'}>
                        {HERO_LINES.map((line) => (
                            <span key={line}>{line}</span>
                        ))}
                    </h2>
                    <p className={'pt-auth-hero-sub'}>{HERO_SUB}</p>
                </div>
            </section>

            <section className={'pt-auth-panel'}>
                <div className={'pt-auth-lockup'}>
                    <span className={'pt-auth-emblem'}>
                        <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                    </span>
                    <span className={'pt-auth-lockup-name'}>{brandName()}</span>
                </div>

                <AuthLinks />

                <div className={'pt-auth-card'}>
                    <div className={'pt-auth-head'}>
                        {title && <h1>{title}</h1>}
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <div className={'pt-auth-body'}>
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
                                New to the panel? <Link to={'/auth/register'}>Create an account</Link>
                            </span>
                        ) : (
                            <span>
                                &copy; {new Date().getFullYear()} {brandName()}. All rights reserved.
                            </span>
                        )}
                    </div>
                </div>

                {showSubuserHint && <SubuserHint />}
            </section>
        </div>
    )
);
