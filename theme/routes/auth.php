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

/*
|--------------------------------------------------------------------------
| Change Email Address
|--------------------------------------------------------------------------
|
| Endpoint: /auth/account/email
|
| brine-theme: change the address on the signed-in account, with the current
| password required and a session opened with Google or Discord refused.
|
| A WEB route rather than the panel's PUT /api/client/account/email, because the
| rule that a provider session may not make this change is one the panel has no
| way to express - there is nowhere to hang middleware for it, since
| routes/api-client.php is a panel file this theme does not ship. Hiding the
| button would be the whole of the enforcement that way, and hiding a button is
| not a check. The controller verifies the session, the provider and the current
| password, then hands the write to the panel's own UserUpdateService.
|
| `withoutMiddleware('guest')` + `auth` is the pair the logout route above uses,
| for the same reason: this whole file is mounted inside the panel's `guest`
| group, which bounces a signed-in user away before any handler runs.
|
| Deliberately outside the `throttle:authentication` group - that limiter is ten
| requests a minute across every auth action, which is the wrong shape for an
| endpoint that is allowed three calls a DAY. The controller applies the panel's
| own daily email-change budget instead, on the same key, so the two paths share
| one allowance.
*/
Route::put('/account/email', [Auth\AccountEmailController::class, 'update'])
    ->withoutMiddleware('guest')
    ->middleware('auth')
    ->name('auth.account.email');

/*
|--------------------------------------------------------------------------
| Server Egg Names
|--------------------------------------------------------------------------
|
| Endpoint: /auth/servers/eggs
|
| brine-theme: the egg name for every server the caller can see, so the dashboard
| card can label a server by its software.
|
| The panel does not send it. ServerTransformer returns no egg name and no egg
| id, and the egg relationship is only reachable through `?include=egg`, which
| ServerController::index never asks for - so the browser genuinely cannot see
| it, and an earlier version of the card printed "No egg assigned" on every
| server because of it. A family can be guessed from the egg's variable names,
| but Paper, Spigot and Purpur are indistinguishable that way, so the name has
| to come from the server. See ServerEggController.
|
| A GET, so no CSRF priming is needed, and behind the same
| withoutMiddleware('guest') + middleware('auth') pair as the routes above.
*/
Route::get('/servers/eggs', [Auth\ServerEggController::class, 'index'])
    ->withoutMiddleware('guest')
    ->middleware('auth')
    ->name('auth.servers.eggs');

// Catch any other combinations of routes and pass them off to the React component.
Route::fallback([Auth\LoginController::class, 'index']);
