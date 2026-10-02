import http from '@/api/http';

/**
 * The account page's two actions: change this user's password, and change the
 * address on the account.
 *
 * POST /api/client/account/password is the panel's own client endpoint, so the
 * password is verified against the current one and hashed with the panel's
 * normal hasher on the way in - no custom auth code and no new route.
 *
 * It is a CLIENT route rather than a web one, so it is behind the sanctum
 * session guard rather than the web CSRF token, and the panel's shared `http`
 * instance already carries the session cookie and the X-XSRF header. That is why
 * this does not need the `sanctum/csrf-cookie` priming that api/auth/register.ts
 * does: that endpoint is a web route and the priming is what makes its token
 * exist. Going through `http` rather than fetch keeps the panel's error shape, so
 * the form can report a field-level message from the response.
 */
export interface PasswordData {
    currentPassword: string;
    newPassword: string;
    passwordConfirmation: string;
}

export default ({ currentPassword, newPassword, passwordConfirmation }: PasswordData): Promise<void> =>
    new Promise((resolve, reject) => {
        http.post('/api/client/account/password', {
            current_password: currentPassword,
            password: newPassword,
            password_confirmation: passwordConfirmation,
        })
            .then(() => resolve())
            .catch(reject);
    });

/**
 * The change-email form's three values.
 *
 * `currentPassword` is checked against the account on the server. It is not a
 * field the form can validate - only something that can hash - which is exactly
 * why the endpoint behind it is the panel's hasher and not a client-side rule.
 */
export interface EmailData {
    currentPassword: string;
    newEmail: string;
    newEmailConfirmation: string;
}

/**
 * The field on the change-email form a refusal is about, or null when the
 * refusal is not about one field.
 *
 * The endpoint answers in the panel's error shape - `errors[0].detail` is what
 * `httpErrorToHuman()` reads - and carries the wire field name in
 * `errors[0].meta.field` so the message lands under the right input instead of
 * only in a toast. A key the theme defines; the panel itself does not use it,
 * which is why anything unrecognised falls back to null.
 */
export type EmailErrorField = 'currentPassword' | 'newEmail';

export interface EmailError {
    message: string;
    field: EmailErrorField | null;
}

/** Wire field name -> form field name. Only the two the endpoint reports. */
const FIELD_BY_WIRE_NAME: Record<string, EmailErrorField> = {
    password: 'currentPassword',
    email: 'newEmail',
};

/**
 * Turn a rejected change-email request into something a form can render.
 *
 * `httpErrorToHuman()` is the fallback rather than the first choice: it reads
 * `errors[0].detail` and is right for every refusal the endpoint produces, but
 * it has no idea which input the message belongs to, and a wrong password
 * reported in a toast with an empty form under it is the worst of both.
 */
export const readEmailError = (error: any): EmailError => {
    const first = error?.response?.data?.errors?.[0];
    const wireName = typeof first?.meta?.field === 'string' ? first.meta.field : undefined;

    return {
        message: typeof first?.detail === 'string' ? first.detail : (error?.message ?? 'The change could not be saved.'),
        field: wireName ? FIELD_BY_WIRE_NAME[wireName] ?? null : null,
    };
};

/**
 * PUT /auth/account/email - the theme's own endpoint, not the panel's
 * `/api/client/account/email`.
 *
 * The panel has an endpoint for this and it is the one that does the writing,
 * but the rule that a session opened with Google or Discord may not change the
 * address has nowhere to live on the panel's route (routes/api-client.php is a
 * file this theme does not ship, so no middleware can be attached). Hiding the
 * button would be the whole of the enforcement, so the request is gated first and
 * handed to the panel's UserUpdateService server-side.
 *
 * The wire names are the endpoint's, not the panel's client API: it reads the
 * current password from `password` and the new address from `email`. Those are
 * NOT the names the panel's own email endpoint uses for the same two things - it
 * reads `current_password` for the password - and sending the wrong one is a
 * 403 with a message about a password that was never supplied.
 *
 * `sanctum/csrf-cookie` is primed first because this is a WEB route, so it sits
 * behind the panel's VerifyCsrfToken rather than behind the sanctum session guard
 * the password change uses. api/auth/register.ts primes for the same reason.
 */
export const updateEmail = ({ currentPassword, newEmail }: EmailData): Promise<void> =>
    new Promise((resolve, reject) => {
        http.get('/sanctum/csrf-cookie')
            .then(() =>
                http.put('/auth/account/email', {
                    password: currentPassword,
                    email: newEmail,
                })
            )
            .then(() => resolve())
            .catch(reject);
    });