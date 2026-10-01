import React, { forwardRef } from 'react';
import { Form } from 'formik';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import { brandName, logoUrl, registrationEnabled } from '@/lib/brand';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    /**
     * Nodes rather than strings, so a screen can put an accent-coloured run inside
     * its heading - "Create *your account*" - without this shell knowing what the
     * accent is for.
     */
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    footer?: React.ReactNode;
    /**
     * Whether to lead with the sign-up call to action. On by default, because
     * registration is the reason a first-time visitor is on this page; the
     * register screen turns it off, since its footer already says "already have
     * an account" and a button to the page you are already on is noise.
     */
    showSignUpCta?: boolean;
};

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

// Page chrome, not the form: the Home / Login breadcrumb is pinned to the
// viewport's top-left corner by the stylesheet, so AuthenticationRouter owns it.
// That corner is the top-left of the page as the reference has it - the logo does
// NOT sit there.
//
// The layout is a single flat column, per the reference: an emblem centred above
// the heading, then the sign-up call to action, then the form directly on the
// page. There is no card. The reference's form has no panel behind it, and
// inventing one put a second border between the visitor and the fields they came
// to fill.
//
// The emblem is deliberately just the mark. The brand name used to sit beside it,
// which is right when the name is the only thing identifying the panel - but the
// heading now reads "Welcome to <brand>", so the pair said the same word twice on
// one screen, stacked a few centimetres apart.
//
// The CTA is rendered per-screen rather than baked in, because what belongs at
// the top depends on where you already are: Login leads with sign-up, but
// Register's own footer already says "already have an account", so repeating the
// CTA there would be noise.
export default forwardRef<HTMLFormElement, Props>(
    (
        { title, subtitle, footer, showSignUpCta = true, ...props },
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
                </div>

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

                    <FlashMessageRender css={tw`mb-4`} />
                    <Form {...props} ref={ref}>
                        {props.children}
                    </Form>

                    {/* No card, so no divider rule above this either - it would read
                        as the top edge of a panel that is not there. Register still
                        passes its own footer, which is the one screen that needs the
                        way back; everywhere else the sign-up CTA above already says
                        it, and the default is just the copyright. */}
                    <div className={'pt-auth-footer'}>
                        {footer !== undefined ? (
                            footer
                        ) : (
                            <span>
                                &copy; {new Date().getFullYear()} {brandName()}. All rights reserved.
                            </span>
                        )}
                    </div>
                </div>
            </div>
);
    }
);
