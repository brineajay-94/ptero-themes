<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Auth;

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
|
| Endpoint: /auth
|
*/

// These routes are defined so that we can continue to reference them programmatically.
// They all route to the same controller function which passes off to React.
Route::get('/login', [Auth\LoginController::class, 'index'])->name('auth.login');
Route::get('/register', [Auth\RegisterController::class, 'index'])->name('auth.register');
Route::get('/password', [Auth\LoginController::class, 'index'])->name('auth.forgot-password');
Route::get('/password/reset/{token}', [Auth\LoginController::class, 'index'])->name('auth.reset');

/*
|--------------------------------------------------------------------------
| Social Sign-in Routes
|--------------------------------------------------------------------------
|
| Endpoint: /auth/social
|
| The two halves of an OAuth2 authorization-code flow. The provider redirects
| the browser here, so these are GETs and neither renders a view.
|
| `where` pins the segment to the two supported providers. The service checks it
| against its own whitelist again before building any URL, so the route
| constraint is defence in depth rather than the only guard.
|
| These are outside the throttle group below. A visitor spends an unknown amount
| of time on the provider's consent screen, and the callback is what they land
| on when they come back - throttling it would count that wait against them and
| hand out lockouts to people who did nothing wrong. Abuse of the endpoint is
| bounded by the redirect being a no-op without a session-parked `state`, so
| there is nothing to brute-force.
|
*/
Route::get('/social/{provider}/redirect', [Auth\SocialAuthController::class, 'redirect'])
    ->where('provider', 'google|discord')
    ->name('auth.social.redirect');
Route::get('/social/{provider}/callback', [Auth\SocialAuthController::class, 'callback'])
    ->where('provider', 'google|discord')
    ->name('auth.social.callback');

// Apply a throttle to authentication action endpoints to slow down manual
// attack spammers.
//
// brine-theme: the stock `recaptcha` middleware is NOT applied here. The panel
// ships Google's public reCAPTCHA keys, so the free quota is shared by every
// Pterodactyl install; once it is exhausted no token can be produced, and the
// middleware would reject every login with HTTP 400 - a lockout, not a captcha.
// AssetComposer reports recaptcha as disabled too, so the React forms no longer
// render the widget. The throttle below is what still guards these endpoints.
//
// To restore the captcha, see the note in
// app/Http/ViewComposers/AssetComposer.php.
//
// @see \Pterodactyl\Providers\RouteServiceProvider
Route::middleware(['throttle:authentication'])->group(function () {
    // Login endpoints.
    Route::post('/login', [Auth\LoginController::class, 'login']);
    Route::post('/login/checkpoint', Auth\LoginCheckpointController::class)->name('auth.login-checkpoint');

    // brine-theme: public registration - creates a user through the
    // Application API using the key saved under Admin -> Registration.
    Route::post('/register', [Auth\RegisterController::class, 'register'])->name('auth.post.register');

    // Forgot password route. A post to this endpoint will trigger an
    // email to be sent containing a reset token.
    Route::post('/password', [Auth\ForgotPasswordController::class, 'sendResetLinkEmail'])->name('auth.post.forgot-password');
});

// Password reset routes. This endpoint is hit after going through
// the forgot password routes to acquire a token (or after an account
// is created).
Route::post('/password/reset', Auth\ResetPasswordController::class)->name('auth.reset-password');

// Remove the guest middleware and apply the authenticated middleware to this endpoint,
// so it cannot be used unless you're already logged in.
Route::post('/logout', [Auth\LoginController::class, 'logout'])
    ->withoutMiddleware('guest')
    ->middleware('auth')
    ->name('auth.logout');

// Catch any other combinations of routes and pass them off to the React component.
Route::fallback([Auth\LoginController::class, 'index']);
