import http from '@/api/http';

export interface RegisterData {
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    passwordConfirmation: string;
    recaptchaData?: string | null;
}

/**
 * POST /auth/register - the server-side controller creates the user through
 * the panel's Application API using the key saved under Admin -> Registration.
 */
export default ({
    email,
    firstName,
    lastName,
    username,
    password,
    passwordConfirmation,
    recaptchaData,
}: RegisterData): Promise<void> =>
    new Promise((resolve, reject) => {
        http.get('/sanctum/csrf-cookie')
            .then(() =>
                http.post('/auth/register', {
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    username,
                    password,
                    password_confirmation: passwordConfirmation,
                    'g-recaptcha-response': recaptchaData,
                })
            )
            .then(() => resolve())
            .catch(reject);
    });
