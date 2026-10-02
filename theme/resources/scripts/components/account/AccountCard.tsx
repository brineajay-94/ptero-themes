import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

/**
 * The two pieces the account screens share: the dark chrome card they live in,
 * and the labelled control inside it.
 *
 * ICONS ARE THE FA5 NAMES, AND THAT IS NOT A MATTER OF TASTE
 * ----------------------------------------------------------
 * The panel pins @fortawesome/free-solid-svg-icons to ^5.15.1 and
 * @fortawesome/react-fontawesome to ^0.1.11 - the FontAwesome 5 line, with one
 * copy on disk. A FA6 name is not merely renamed there, it does not exist, and
 * the import fails at BUILD time: `export 'faCircleQuestion' was not found in
 * '@fortawesome/free-solid-svg-icons'`. The whole bundle fails, so every page in
 * the panel goes down over a question mark on the account card.
 *
 * This file originally imported `faCircleQuestion`, which is FA6. Nothing caught
 * it: it typechecked against a scratch project with FA6 typings installed, and
 * the panel was never built. The names to use are the FA5 ones -
 * `faQuestionCircle`, `faSyncAlt`, `faCog` - and `faCircleQuestion`,
 * `faArrowsRotate` and `faGears` must not appear in the theme payload at all.
 *
 * THEY ARE SHARED RATHER THAN DUPLICATED PER CONTAINER
 * ---------------------------------------------------
 * The change-email page is a second form built from the same parts - the same
 * card, the same light box holding a glyph and the input side by side, the same
 * real <label for>. Two containers each carrying their own copy is how the two
 * pages end up a shade apart while both claim to be the reference's account
 * screen, and how a fix to the field lands on one of them.
 *
 * WHY THE FIELD IS HAND-WRITTEN AND NOT THE PANEL'S <Field>/<Input>
 * ----------------------------------------------------------------
 * The reference puts a glyph INSIDE the input, on a light fill, and the label
 * above it. The panel's Input wraps the <input> in its own div, so the box cannot
 * be made a single flex row containing glyph and field - the glyph would have to
 * be positioned over it with `top: 50%` arithmetic, which is exactly the
 * fragility the auth screens are littered with comments about (see
 * `.pt-auth-field-icon`, which computes its offset from three separate values).
 *
 * Here the glyph is a real flex sibling of the <input> inside one light box, so
 * there is no positioning to get wrong and no label-height constant to keep in
 * step. The label is a real <label> with a `for`, so the association is
 * structural rather than positional.
 */

/** The FontAwesomeIcon `icon` prop's own type, without importing fontawesome-svg-core. */
type IconProp = React.ComponentProps<typeof FontAwesomeIcon>['icon'];

/**
 * One dark chrome card with a header, an optional help panel behind a "?" and a
 * body holding the fields.
 *
 * The help is a button rather than a permanent paragraph because the reference
 * hides it behind that affordance, and because each field already carries its
 * own hint - this is the fuller explanation for someone who wants it, not the
 * only place it is stated. It is a real button with `aria-expanded` so the panel
 * is reachable by keyboard and its state is announced.
 */
export const AccountCard: React.FC<{
    title: string;
    help: string;
    /** Wired to the <form>; the caller prevents the default and submits Formik. */
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    children: React.ReactNode;
}> = ({ title, help, onSubmit, children }) => {
    const [helpOpen, setHelpOpen] = useState(false);

    return (
        <div className={'pt-acct'}>
            <form className={'pt-acct-card'} onSubmit={onSubmit}>
                <div className={'pt-acct-head'}>
                    <h1 className={'pt-acct-title'}>{title}</h1>
                    <button
                        type={'button'}
                        className={'pt-acct-help-btn'}
                        aria-expanded={helpOpen}
                        aria-controls={'pt-acct-help'}
                        onClick={() => setHelpOpen((open) => !open)}
                    >
                        <FontAwesomeIcon icon={faQuestionCircle} aria-hidden={'true'} />
                        <span className={'sr-only'}>About this form</span>
                    </button>
                </div>

                {helpOpen && (
                    <div className={'pt-acct-help'} id={'pt-acct-help'}>
                        <p style={{ margin: 0 }}>{help}</p>
                    </div>
                )}

                <div className={'pt-acct-body'}>{children}</div>
            </form>
        </div>
    );
};

/**
 * One labelled control: label above, then a light box holding the glyph and the
 * input side by side.
 *
 * The glyph is a flex sibling rather than an overlay, so the box is exactly one
 * row and cannot drift out of the input - see the docblock above.
 *
 * `error` is decided by the caller (`touched && errors`), so this only renders.
 */
export const AccountField: React.FC<{
    id: string;
    name: string;
    type: string;
    label: string;
    icon: IconProp;
    autoComplete?: string;
    error?: string;
    disabled: boolean;
    /** Optional note under the box, before any error. */
    hint?: React.ReactNode;
}> = ({ id, name, type, label, icon, autoComplete, error, disabled, hint }) => {
    const invalid = Boolean(error);

    return (
        <div className={`pt-acct-field${invalid ? ' is-invalid' : ''}`}>
            <label className={'pt-acct-label'} htmlFor={id}>
                {label}
            </label>

            <div className={'pt-acct-control'}>
                <span className={'pt-acct-icon'} aria-hidden={'true'}>
                    <FontAwesomeIcon icon={icon} />
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

            {hint}

            {invalid && (
                <p className={'pt-acct-error'} id={`${id}-error`} role={'alert'}>
                    {error}
                </p>
            )}
        </div>
    );
};

/**
 * A value the user can read but not edit - the address the account has now,
 * shown above the fields on the change-email page so the change is legible
 * before it is made.
 *
 * Not a disabled <input>: a disabled field is skipped by tab order and by some
 * screen readers announce nothing useful, and this one is a label and a value,
 * not a form control. The value is still rendered as text, so selecting and
 * copying it works.
 */
export const AccountReadonly: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className={'pt-acct-field'}>
        <span className={'pt-acct-label'}>{label}</span>
        <p className={'pt-acct-current'}>{value}</p>
    </div>
);