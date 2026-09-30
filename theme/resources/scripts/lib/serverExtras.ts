/**
 * Server routes the theme adds on top of the panel's own `routes.server` table.
 *
 * The panel builds that table from its router config, which the theme does not
 * ship - overriding it would mean replacing a file the panel also uses for the
 * nav and for anything else that enumerates server routes. So the extra route
 * lives here instead, and the three places that need to agree on it read from
 * this one definition:
 *
 *   ServerRouter   renders the component
 *   Sidebar        renders the nav item
 *   AppShell       resolves the page title in the topbar
 *
 * Keeping it in one place is the point. Three separate hardcoded copies of the
 * path is how a nav item ends up pointing at a route that does not exist, or a
 * topbar that says "Server" on a page called Plugins.
 *
 * The permission is `file.read` because the page's first job is listing
 * plugins/. Installing additionally needs `file.create` and removing needs
 * `file.delete`; those are checked at the control, not on the route, so a
 * read-only subuser can still see what is installed.
 */
export interface ThemeServerRoute {
    /** Path segment under /server/:id, without slashes. */
    path: string;
    /** Nav label and topbar title. */
    name: string;
    /** Permission required to open the page at all. */
    permission: string;
    /**
     * Only offer this route when the server can actually use it. Set on Plugins:
     * jar plugins are meaningless on a Vanilla or TeamSpeak server, and the panel
     * gives the client no usable egg signal, so the check is a filesystem probe.
     */
    requiresPluginsDirectory?: boolean;
}

export const THEME_SERVER_ROUTES: ThemeServerRoute[] = [
    {
        path: 'plugins',
        name: 'Plugins',
        permission: 'file.read',
        requiresPluginsDirectory: true,
    },
];
