<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Server;

/**
 * The egg NAME for every server the caller can see.
 *
 * WHY THIS EXISTS AT ALL
 * ---------------------
 * The dashboard card used to print "No egg assigned" on every server, because
 * the panel does not send the egg name to the browser. `ServerTransformer`
 * returns neither a name nor an id - `egg_features` is the only egg-derived field
 * on it - and the egg is reachable only through `includeEgg()`, which needs
 * `?include=egg`, and `ServerController::index` never calls `parseIncludes()`, so
 * that include is silently ignored and the relationship never arrives.
 *
 * The theme can guess a FAMILY from the egg's variable names (see
 * lib/serverFamily.ts), and it does, but Paper, Spigot and Purpur all carry
 * MINECRAFT_VERSION and BUILD_NUMBER: the guess cannot name the egg. So it is read
 * here instead, once per dashboard load, for the caller's own servers.
 *
 * WHY IT LIVES UNDER Auth
 * -----------------------
 * The panel loads route files by name: routes/base.php, routes/admin.php,
 * routes/auth.php, routes/api-client.php. The theme ships two of them, and only
 * for the pages it adds - admin.php (mounted behind AdminAuthenticate) and
 * auth.php (the registration and social routes). admin.php cannot carry an
 * endpoint a normal user may call, and auth.php is the one web route file that
 * can: the route strips the `guest` middleware this file is mounted under and
 * adds `auth`, exactly as the logout route and /auth/account/email do.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It returns nothing about a server the caller cannot open. The list comes from
 * the panel's own `accessibleServers()` relation - the same one behind the
 * server switcher - so owner, subuser and admin access all resolve through the
 * panel's rules rather than a hand-written join.
 *
 * A root admin gets every server, and that is the panel's own gate rather than a
 * loosening of one: Admin -> Servers already lists each server with its egg, so
 * this reveals nothing new, and without it the dashboard's "show all servers"
 * switch would leave every other admin's card falling back to a guess.
 *
 * A server with no egg - egg_id null, or pointing at a row that has since been
 * deleted - comes back as an explicit null rather than being omitted, so the
 * client can tell "this server really has no egg" from "no idea about this
 * server" and choose its fallback accordingly. An absent key means the server is
 * not visible to this caller.
 *
 * The response is the plain `{eggs: {uuid: name|null}}` shape rather than the
 * panel's fractal one. This is the theme's own route read by the theme's own
 * client, so there is no consumer that expects the panel's envelope, and wrapping
 * it would add a transform the panel never applies.
 */
class ServerEggController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // The route carries `auth`, so there is always a user. Stated rather than
        // assumed because every line below reads off $user, and a fatal on a
        // theme running inside someone else's panel is a bad trade for three
        // lines.
        if ($user === null) {
            return response()->json([
                'errors' => [['code' => 'Unauthenticated', 'detail' => 'You are not signed in.']],
            ], 401);
        }

        $servers = $user->root_admin
            ? Server::query()->with('egg')->get()
            : $user->accessibleServers()->with('egg')->get();

        $eggs = [];
        foreach ($servers as $server) {
            $eggs[$server->uuid] = $server->egg?->name;
        }

        return response()->json(['eggs' => $eggs]);
    }
}