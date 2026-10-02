import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { readEmailError, updateEmail } from '@/api/client/account';
import { AccountCard, AccountField, AccountReadonly } from '@/components/account/AccountCard';
import { accountAccess } from '@/lib/brand';
import useFlash from '@/plugins/useFlash';

interface Values {
    newEmail: string;
    newEmailConfirmation: string;
    currentPassword: string;
}

/**
 * The address the page opens on, read from the object the wrapper blade writes.
 *
 * State rather than a read at render: it changes under this component when the
 * save succeeds, and the panel only rewrites `window.PterodactylUser` on a full
 * page load - so the readout has to be told, or it goes on showing the address
 * the account just moved away from.
 *
 * No reload on success either, then. The panel's session guard resolves the user
 * from the database on every request, so there is no cached copy to refresh
 * server-side; the only stale thing was the value in this component.
 */
const readCurrentEmail = (): string => {
    const value = (window as unknown as { PterodactylUser?: { email?: unknown } }).PterodactylUser?.email;

    return typeof value === 'string' ? value : '';
};

/**
 * Change the address on the account: /account/email.
 *
 * THE PASSWORD IS THE POINT
 * -------------------------
 * The form asks for the current password before it will touch the address, and
 * the check is server-side - only something that can hash can answer it, so
 * there is no client-side version of this rule and no way to skip it by editing
 * the form. That is what makes the page safe to offer at all: changing the
 * address on an account is how you take one over, and it is the one account
 * change the panel does not confirm with a second factor.
 *
 * WHY A SOCIAL SESSION GETS NO FORM
 * ---------------------------------
 * An account created through Google or Discord holds a 48-character random
 * password that nobody was ever told - `createFromProfile()` stores one only
 * because the column is NOT NULL. There is nothing the owner could type into a
 * "current password" box, so the form would be a wall: it is replaced by the
 * reason and the way back rather than rendered and then refused.
 *
 * And the endpoint refuses it too, not just this page - see
 * `AccountEmailController`. Rendering a refusal here is a courtesy, not the
 * check.
 *
 * WHY NOT THE PANEL'S OWN SCREEN
 * ------------------------------
 * `/account/email` is not a stock panel route - the panel's `routes.account`
 * table has entries for the overview, API credentials, SSH keys and activity,
 * but none for the address - so there is no stock screen being replaced here.
 * The write still goes through panel code either way: `UserUpdateService`, the
 * model's own validation rules and the panel's `user:account.email-changed`
 * activity log. What the theme adds is the policy above, in front of it.
 */
const AccountEmailContainer: React.FC = () => {
    const { addFlash, clearAndAddHttpError } = useFlash();
    const { canChangeEmail, signedInWith } = accountAccess();
    const [currentEmail, setCurrentEmail] = useState<string>(readCurrentEmail);

    // Messages the endpoint sends back for the field it is about. Held in state
    // rather than merged into Formik's errors because they are not validation:
    // Formik drops its errors on the next keystroke, and "that is not your
    // current password" has to stay put until the field itself is changed.
    const [serverError, setServerError] = useState<{ message: string; field: string | null } | null>(null);

    const onSubmit = (values: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        setServerError(null);

        updateEmail({
            currentPassword: values.currentPassword,
            newEmail: values.newEmail,
            newEmailConfirmation: values.newEmailConfirmation,
        })
            .then(() => {
                setCurrentEmail(values.newEmail);
                resetForm();
                setSubmitting(false);
                addFlash({
                    type: 'success',
                    message: 'Your email address has been changed.',
                });
            })
            .catch((error) => {
                setSubmitting(false);

                const { message, field } = readEmailError(error);
                setServerError({ message, field });

                // No field named means the refusal is not about one input - the
                // daily limit, a failed write, or a provider session that came
                // back through "remember me". Those are for the flash, which is
                // the panel's own place for a message with nowhere better to go.
                if (!field) {
                    clearAndAddHttpError({ error });
                }
            });
    };

    if (!canChangeEmail) {
        return (
            <div className={'pt-acct'}>
                <div className={'pt-acct-card'}>
                    <div className={'pt-acct-head'}>
                        <h1 className={'pt-acct-title'}>Email Address</h1>
                    </div>

                    <div className={'pt-acct-body'}>
                        <p className={'pt-acct-note'}>
                            {signedInWith
                                ? `This browser is signed in with ${signedInWith}. An account signed in that way has no password to confirm here, so the address cannot be changed from this screen - sign in with your password and it can be.`
                                : 'The address on this account cannot be changed from here. Sign in with your password to change it.'}
                        </p>

                        <div className={'pt-acct-actions'}>
                            <Link to={'/account'} className={'pt-acct-submit pt-acct-submit-link'}>
                                <span>Back to Account</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ newEmail: '', newEmailConfirmation: '', currentPassword: '' }}
            validationSchema={object().shape({
                newEmail: string()
                    .required('Enter the new address.')
                    .email('That does not look like an email address.'),
                newEmailConfirmation: string()
                    .required('Repeat the new address.')
                    .oneOf([ref('newEmail')], 'The addresses do not match.'),
                currentPassword: string().required('Enter your current password to confirm the change.'),
            })}
        >
            {({ isSubmitting, errors, touched, submitForm }) => (
                <AccountCard
                    title={'Email Address'}
                    help={
                        'Your current password is asked for before the address is changed, because the address on ' +
                        'this account is how you sign in and where anything the panel sends reaches you. Password ' +
                        'resets, API keys and sub-users are unaffected. The address can be changed three times a ' +
                        "day - that limit is the panel's own, and it is there so nobody can find out which " +
                        'addresses already have accounts by cycling through them.'
                    }
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitForm();
                    }}
                >
                    <AccountReadonly label={'Current Email'} value={currentEmail} />

                    <AccountField
                        id={'pt-acct-new-email'}
                        name={'newEmail'}
                        type={'email'}
                        label={'New Email'}
                        icon={faEnvelope}
                        autoComplete={'email'}
                        error={
                            (touched.newEmail && errors.newEmail ? errors.newEmail : undefined) ??
                            (serverError?.field === 'newEmail' ? serverError.message : undefined)
                        }
                        disabled={isSubmitting}
                    />

                    <AccountField
                        id={'pt-acct-new-email-confirm'}
                        name={'newEmailConfirmation'}
                        type={'email'}
                        label={'Confirm New Email'}
                        icon={faEnvelope}
                        autoComplete={'email'}
                        error={
                            touched.newEmailConfirmation && errors.newEmailConfirmation
                                ? errors.newEmailConfirmation
                                : undefined
                        }
                        disabled={isSubmitting}
                    />

                    {/*
                     * The password box sits last, on purpose: it is what gates
                     * the change, and a page that asks for it before showing what
                     * the address is going to become reads like a payment page.
                     */}
                    <AccountField
                        id={'pt-acct-email-password'}
                        name={'currentPassword'}
                        type={'password'}
                        label={'Current Password'}
                        icon={faLock}
                        autoComplete={'current-password'}
                        error={
                            (touched.currentPassword && errors.currentPassword ? errors.currentPassword : undefined) ??
                            (serverError?.field === 'currentPassword' ? serverError.message : undefined)
                        }
                        disabled={isSubmitting}
                    />

                    <div className={'pt-acct-actions'}>
                        <button type={'submit'} className={'pt-acct-submit'} disabled={isSubmitting}>
                            <FontAwesomeIcon icon={faEnvelope} aria-hidden={'true'} />
                            <span>{isSubmitting ? 'Saving...' : 'Update Email'}</span>
                        </button>
                    </div>
                </AccountCard>
            )}
        </Formik>
    );
};

export default AccountEmailContainer;