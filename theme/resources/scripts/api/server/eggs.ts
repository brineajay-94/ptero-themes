import http from '@/api/http';

/**
 * Egg names, keyed by server uuid.
 *
 * A `null` value is a server the caller CAN see and which has no egg - either
 * egg_id is null or it points at an egg row that has since been deleted. An
 * absent key is a server this caller cannot see at all, which happens for an
 * admin who is not root looking at another admin's server with "show all
 * servers" on. The two are kept distinct so the card can tell them apart.
 */
export type ServerEggNames = Record<string, string | null>;

/**
 * GET /auth/servers/eggs - the theme's own endpoint.
 *
 * It exists because the panel's own servers list cannot answer this.
 * `ServerTransformer` returns no egg name and no egg id (`egg_features` is the
 * only egg-derived field, and it is identical across the Minecraft eggs), and
 * the egg relationship is only produced by an explicit `?include=egg`, which
 * `ServerController::index` never asks for. So `server.egg` and
 * `server.eggName` were always undefined on the dashboard, and a card reading
 * them printed "No egg assigned" on every server on the panel.
 *
 * One request per dashboard load rather than one per card: the endpoint returns
 * every server the caller can see, so a user with 40 servers still makes one
 * call.
 *
 * No `sanctum/csrf-cookie` priming, unlike the POST/PUT endpoints beside it -
 * this is a GET, so `VerifyCsrfToken` does not inspect it, and the panel's own
 * client makes plenty of unauthenticated-by-token GETs on the same session.
 */
const getServerEggs = (): Promise<ServerEggNames> =>
    http.get('/auth/servers/eggs').then(({ data }) => (data?.eggs || {}) as ServerEggNames);

export default getServerEggs;