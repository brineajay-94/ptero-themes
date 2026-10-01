import React, { forwardRef } from 'react';
import { Form } from 'formik';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
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
    /**
     * Whether to lead with the sign-up call to action. On by default, because
     * registration is the reason a first-time visitor is on this page; the
     * register screen turns it off, since its footer already says "already have
     * an account" and a button to the page you are already on is noise.
     */
    showSignUpCta?: boolean;
};

/**
 * The subuser nudge under the card.
 *
 * On a centred page this sits below the card rather than beside it, which is
 * the same content in a narrower column - the copy is unchanged, only the
 * available width is.
 */
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

/**
 * The sign-up call to action.
 *
 * Registration is the reason a first-time visitor is on this page at all, so it
 * gets the loudest element on the screen rather than a quiet link in a footer -
 * which is what the split layout had to do, because the panel column was only
 * as wide as a login form. On a centred page there is room for it to be a
 * button, and the login form below becomes the secondary path.
 *
 * Rendered only when registration is actually enabled. `registrationEnabled()`
 * is the same check the footer link used, so this cannot link to a route the
 * admin has closed - RegisterContainer redirects to login if it is somehow
 * reached anyway.
 */
const SignUpCta: React.FC = () => (
    <Link className={'pt-auth-signup'} to={'/auth/register'}>
        <FontAwesomeIcon icon={faUserPlus} aria-hidden={'true'} />
        <span>Sign up</span>
    </Link>
);

/**
 * The "or" rule between two ways of signing in.
 *
 * A divider carries no meaning on its own, so it is marked up as presentational
 * and the word is read out: screen readers get "or" between the two options
 * instead of a silent horizontal rule.
 */
const OrDivider = () => (
    <div className={'pt-auth-or'} aria-hidden={'true'}>
        <span className={'pt-auth-or-rule'} />
        <span className={'pt-auth-or-word'}>or</span>
        <span className={'pt-auth-or-rule'} />
    </div>
);

// The Home / Login breadcrumb is NOT rendered here: it is page chrome, pinned to
// the viewport's top-left corner by the stylesheet, so AuthenticationRouter owns
// it.
//
// The layout is a single centred column: the brand lockup sits at the top of the
// page, and the heading, the sign-up call to action and the form stack beneath
// it. There is no second half and no hero - the previous 50/50 split existed to
// give the illustration room, and with it gone a second column would only push
// the form off a laptop screen.
//
// The lockup and the CTA are rendered per-screen rather than baked in, because
// what belongs at the top depends on where you already are: Login leads with
// sign-up, but Register's own footer already says "already have an account", so
// repeating the CTA there would be noise.
export default forwardRef<HTMLFormElement, Props>(
    (
        { title, subtitle, footer, showSubuserHint = false, showSignUpCta = true, ...props },
        ref,
    ) => {
        // Drives both the CTA and the divider. Without registration there is
        // only one way in, so showing "or" above a single form is a lie about
        // the page - and a link to a closed route is worse than no link.
        const cta = showSignUpCta && registrationEnabled();

        return (
            <div className={'pt-auth'}>
                <div className={'pt-auth-lockup'}>
                    <span className={'pt-auth-emblem'}>
                        <img src={logoUrl() || '/themes/pterodactyl/images/logo.svg'} alt={''} />
                    </span>
                    <span className={'pt-auth-lockup-name'}>{brandName()}</span>
                </div>

                <AuthLinks />

                <div className={'pt-auth-column'}>
                    <div className={'pt-auth-heading'}>
                        {title && <h1>{title}</h1>}
                        {subtitle && <p>{subtitle}</p>}
                    </div>

                    {cta && (
                        <>
                            <SignUpCta />
                            <OrDivider />
                        </>
                    )}

                    <div className={'pt-auth-card'}>
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
                </div>
            </div>
        );
    }
);
