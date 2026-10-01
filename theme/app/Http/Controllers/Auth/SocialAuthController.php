<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Social\SocialAuthService;

/**
 * The two ends of a social sign-in: sending the browser to the provider, and
 * handling where it comes back to.
 *
 * Both actions are GET and neither renders a view. The whole flow is server
 * side redirects - the browser leaves the panel, comes back to the callback, and
 * is forwarded to the dashboard or back to the login form with an explanation.
 * That is deliberate: an OAuth callback cannot be a SPA route, because the
 * provider redirects the browser to a fixed URL registered in advance and the
 * React router has no say in it.
 */
class SocialAuthController extends Controller
{
    public function __construct(
        private SocialAuthService $social,
    ) {
    }

    /**
     * Start the flow.
     *
     * The `provider` segment is constrained to the two supported names by the
     * route's `where`, and the service checks it against its own whitelist
     * again before doing anything, so an unknown name cannot reach a URL
     * builder.
     */
    public function redirect(string $provider): RedirectResponse
    {
        $result = $this->social->redirect($provider);

        if (isset($result['error'])) {
            // 404 rather than a redirect with a message: a provider that is
            // switched off and one that was never configured should be
            // indistinguishable from outside.
            abort(404);
        }

        return redirect()->away($result['redirect']);
    }

    /**
     * Handle the provider's response and sign the user in.
     */
    public function callback(Request $request, string $provider): RedirectResponse
    {
        $result = $this->social->callback($request, $provider);

        if (isset($result['user'])) {
            return redirect()->route('index');
        }

        // Back to the login form carrying a machine-readable reason in the query
        // string.
        //
        // A query parameter, not a session flash, on purpose. The panel's flash
        // system only understands a fixed set of types (`success`/`warning`/
        // `error`) and serialises them through its own transformer, so an
        // invented type would be dropped or choke that endpoint. The query string
        // is also the mechanism this theme already uses for `?registered=1`
        // after registration, so it is a known-good path.
        //
        // The message is URL-encoded into the query and read back as text. It is
        // never written into the DOM as HTML.
        return redirect()->route('auth.login', [
            'social_error' => $result['error'],
            'social_message' => $result['message'],
        ]);
    }
}
