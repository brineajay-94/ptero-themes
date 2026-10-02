import React from 'react';
import { Link } from 'react-router-dom';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import updatePassword from '@/api/client/account';
import { AccountCard, AccountField } from '@/components/account/AccountCard';
import { accountAccess } from '@/lib/brand';
import useFlash from '@/plugins/useFlash';

interface Values {
    currentPassword: string;
    newPassword: string;
    passwordConfirmation: string;
}

/**
 * The account page: the password form, and the way on to changing the address.
 *
 * WHY IT IS ONLY THIS
 * -------------------
 * Stock Pterodactyl puts four things on `/account` - profile, password, email and
 * two-step verification - as three side-by-side cards. This page keeps the
 * password form and drops the rest, because the brief was to leave only that, and
 * because a lone form stretched across three columns is a worse layout than the
 * same form centred in one card. It is a real page with real routes behind it:
 * `/api/client/account/password` is the panel's own endpoint, which verifies the
 * current password and rehashes through the panel's normal hasher. Nothing about
 * the authentication model has been reimplemented here.
 *
 * The other account screens are untouched and still reachable - the drawer's
 * navigation list is not filtered, and DashboardRouter still renders the panel's
 * own `/account/*` sub-routes. This is the overview page only.
 *
 * THE CHANGE EMAIL BUTTON, AND WHY IT IS NOT ALWAYS THERE
 * ------------------------------------------------------
 * The green button under Update Password opens the change-email page, which asks
 * for the current password before it will touch the address. A session opened
 * with Google or Discord gets a sentence explaining why instead of the button:
 * such an account has no password its owner was ever given - it was stored with
 * a 48-character random one when the provider created it - so the form could
 * only ever end in a refusal. Offering it would be offering a dead end.
 *
 * That is a UI decision, not the enforcement. AssetComposer decides it (see
 * `accountAccess()`) and the endpoint re-checks it, and the password check there
 * is the one that actually holds.
 *
 * THE MARKUP IS THE SHARED ACCOUNT CARD
 * ------------------------------------
 * The card and the fields come from AccountCard.tsx, because the change-email
 * page is a second form built from exactly the same parts. See that file for why
 * the fields are hand-written rather than built on the panel's <Field>/<Input>.
 */
const AccountOverviewContainer: React.FC = () => {
    const { addFlash, clearAndAddHttpError } = useFlash();
    const { canChangeEmail, signedInWith } = accountAccess();

    const onSubmit = (values: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        updatePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            passwordConfirmation: values.passwordConfirmation,
        })
            .then(() => {
                // The new password is now the only way in, so the boxes are
                // cleared rather than left holding values that no longer work.
                resetForm();
                setSubmitting(false);
                addFlash({
                    type: 'success',
                    message: 'Your password has been updated.',
                });
            })
            .catch((error) => {
                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ currentPassword: '', newPassword: '', passwordConfirmation: '' }}
            validationSchema={object().shape({
                currentPassword: string().required('Enter your current password.'),
                newPassword: string()
                    .required('Enter a new password.')
                    .min(8, 'The new password must be at least 8 characters.'),
                passwordConfirmation: string()
                    .required('Repeat the new password.')
                    .oneOf([ref('newPassword')], 'The passwords do not match.'),
            })}
        >
            {({ isSubmitting, errors, touched, submitForm }) => (
                <AccountCard
                    title={'Password'}
                    help={
                        'Changing your password does not sign you out anywhere else, and it does not affect ' +
                        'API keys or sub-users. If two-step verification is on, it stays on and is still asked ' +
                        'for at your next sign-in.'
                    }
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitForm();
                    }}
                >
                    <AccountField
                        id={'pt-acct-current'}
                        name={'currentPassword'}
                        type={'password'}
                        label={'Current Password'}
                        icon={faLock}
                        autoComplete={'current-password'}
                        error={touched.currentPassword && errors.currentPassword ? errors.currentPassword : undefined}
                        disabled={isSubmitting}
                    />

                    <AccountField
                        id={'pt-acct-new'}
                        name={'newPassword'}
                        type={'password'}
                        label={'New Password'}
                        icon={faLock}
                        autoComplete={'new-password'}
                        error={touched.newPassword && errors.newPassword ? errors.newPassword : undefined}
                        disabled={isSubmitting}
                        hint={
                            <p className={'pt-acct-hint'}>
                                Your new password should be at least 8 characters in length and unique to this website.
                            </p>
                        }
                    />

                    <AccountField
                        id={'pt-acct-confirm'}
                        name={'passwordConfirmation'}
                        type={'password'}
                        label={'Confirm New Password'}
                        icon={faLock}
                        autoComplete={'new-password'}
                        error={
                            touched.passwordConfirmation && errors.passwordConfirmation
                                ? errors.passwordConfirmation
                                : undefined
                        }
                        disabled={isSubmitting}
                    />

                    <div className={'pt-acct-actions'}>
                        <button type={'submit'} className={'pt-acct-submit'} disabled={isSubmitting}>
                            <FontAwesomeIcon icon={faLock} aria-hidden={'true'} />
                            <span>{isSubmitting ? 'Updating...' : 'Update Password'}</span>
                        </button>

                        {/*
                         * A Link, not a button with an onClick. It goes somewhere,
                         * and an anchor keeps middle-click, open-in-new-tab and
                         * copy-link working - none of which survive a div. It is
                         * also the only interactive sibling of the submit button
                         * that cannot submit the form by accident: an anchor has
                         * no type, and a stray `type` here would be the kind of
                         * thing that changes what the form does.
                         */}
                        {canChangeEmail ? (
                            <Link to={'/account/email'} className={'pt-acct-submit pt-acct-submit-link'}>
                                <FontAwesomeIcon icon={faEnvelope} aria-hidden={'true'} />
                                <span>Change Email</span>
                            </Link>
                        ) : (
                            <p className={'pt-acct-note'}>
                                {signedInWith
                                    ? `Signed in with ${signedInWith}, so the address on this account cannot be changed here.`
                                    : 'The address on this account cannot be changed from here.'}
                            </p>
                        )}
                    </div>
                </AccountCard>
            )}
        </Formik>
    );
};

export default AccountOverviewContainer;