import React, { useState } from 'react';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion, faLock } from '@fortawesome/free-solid-svg-icons';
import updatePassword from '@/api/client/account';
import useFlash from '@/plugins/useFlash';

interface Values {
    currentPassword: string;
    newPassword: string;
    passwordConfirmation: string;
}

/**
 * The account page: one form, for changing your password.
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
 * THE MARKUP IS HAND-WRITTEN RATHER THAN BUILT ON THE PANEL'S <Field>/<Input>
 * ----------------------------------------------------------------------
 * The reference puts a glyph INSIDE the input, on a light fill, and the label
 * above it. The panel's Input wraps the <input> in its own div, so the box
 * cannot be made a single flex row containing glyph and field - the glyph would
 * have to be positioned over it with `top: 50%` arithmetic, which is exactly the
 * fragility the auth screens are littered with comments about (see
 * `.pt-auth-field-icon`, which computes its offset from three separate values).
 *
 * Here the glyph is a real flex sibling of the <input> inside one light box, so
 * there is no positioning to get wrong and no label-height constant to keep in
 * step. The label is a real <label> with a `for`, so the association is
 * structural rather than positional.
 */
const AccountOverviewContainer: React.FC = () => {
    const { addFlash, clearAndAddHttpError } = useFlash();

    // The help toggle in the card header. A button rather than a permanent
    // paragraph because the reference hides it behind the "?" affordance, and
    // because the field already carries the length rule - this is the fuller
    // explanation for someone who wants it, not the only place it is stated.
    const [helpOpen, setHelpOpen] = useState(false);

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
                <div className={'pt-acct'}>
                    <form
                        className={'pt-acct-card'}
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitForm();
                        }}
                    >
                        <div className={'pt-acct-head'}>
                            <h1 className={'pt-acct-title'}>Password</h1>
                            <button
                                type={'button'}
                                className={'pt-acct-help-btn'}
                                aria-expanded={helpOpen}
                                aria-controls={'pt-acct-help'}
                                onClick={() => setHelpOpen((open) => !open)}
                            >
                                <FontAwesomeIcon icon={faCircleQuestion} aria-hidden={'true'} />
                                <span className={'sr-only'}>About this form</span>
                            </button>
                        </div>

                        {helpOpen && (
                            <div className={'pt-acct-help'} id={'pt-acct-help'}>
                                <p style={{ margin: 0 }}>
                                    Changing your password does not sign you out anywhere else, and it does not affect
                                    API keys or sub-users. If two-step verification is on, it stays on and is
                                    still asked for at your next sign-in.
                                </p>
                            </div>
                        )}

                        <div className={'pt-acct-body'}>
                            <Field
                                id={'pt-acct-current'}
                                name={'currentPassword'}
                                type={'password'}
                                label={'Current Password'}
                                autoComplete={'current-password'}
                                error={touched.currentPassword && errors.currentPassword ? errors.currentPassword : undefined}
                                disabled={isSubmitting}
                            />

                            <Field
                                id={'pt-acct-new'}
                                name={'newPassword'}
                                type={'password'}
                                label={'New Password'}
                                autoComplete={'new-password'}
                                error={touched.newPassword && errors.newPassword ? errors.newPassword : undefined}
                                disabled={isSubmitting}
                            >
                                <p className={'pt-acct-hint'}>
                                    Your new password should be at least 8 characters in length and unique to this
                                    website.
                                </p>
                            </Field>

                            <Field
                                id={'pt-acct-confirm'}
                                name={'passwordConfirmation'}
                                type={'password'}
                                label={'Confirm New Password'}
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
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </Formik>
    );
};

/**
 * One labelled control: label above, then a light box holding the glyph and the
 * input side by side.
 *
 * The glyph is a flex sibling rather than an overlay, so the box is exactly one
 * row and cannot drift out of the input - see the class docblock above.
 */
const Field: React.FC<{
    id: string;
    name: keyof Values;
    type: string;
    label: string;
    autoComplete: string;
    error?: string;
    disabled: boolean;
    children?: React.ReactNode;
}> = ({ id, name, type, label, autoComplete, error, disabled, children }) => {
    // `touched && errors` is decided by the caller, so this only has to render.
    const invalid = Boolean(error);

    return (
        <div className={`pt-acct-field${invalid ? ' is-invalid' : ''}`}>
            <label className={'pt-acct-label'} htmlFor={id}>
                {label}
            </label>

            <div className={'pt-acct-control'}>
                <span className={'pt-acct-icon'} aria-hidden={'true'}>
                    <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                    id={id}
                    name={name}
                    type={type}
                    className={'pt-acct-input'}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? `${id}-error` : undefined}
                />
            </div>

            {children}

            {invalid && (
                <p className={'pt-acct-error'} id={`${id}-error`} role={'alert'}>
                    {error}
                </p>
            )}
        </div>
    );
};

export default AccountOverviewContainer;
