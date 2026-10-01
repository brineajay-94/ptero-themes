import http from '@/api/http';

/**
 * The account page's one action: change this user's password.
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
