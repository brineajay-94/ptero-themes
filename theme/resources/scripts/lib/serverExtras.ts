import type { JarKind } from '@/api/server/jars';

/**
 * Server routes the theme adds on top of the panel's own `routes.server` table.
 *
 * The panel builds that table from its router config, which the theme does not
 * ship - overriding it would mean replacing a file the panel also uses for the
 * nav and for anything else that enumerates server routes. So the extra routes
 * live here instead, and the three places that need to agree on them read from
 * this one definition:
 *
 *   ServerRouter   renders the component
 *   Sidebar        renders the nav items
 *   AppShell       resolves the page title in the topbar
 *
 * Keeping it in one place is the point. Three separate hardcoded copies of a
 * path is how a nav item ends up pointing at a route that does not exist, or a
 * topbar that says "Server" on a page called Mods.
 */
export interface ThemeServerRoute {
    /** Path segment under /server/:id, without slashes. */
    path: string;
    /** Nav label and topbar title. */
    name: string;
    /** Permission required to open the page at all. */
    permission: string;
    /** Which jar flavour this page installs, and therefore what gates its nav item. */
    jarKind: JarKind;
}

export const THEME_SERVER_ROUTES: ThemeServerRoute[] = [
    {
        path: 'plugins',
        name: 'Plugins',
        permission: 'file.read',
        jarKind: 'plugins',
    },
    {
        path: 'mods',
        name: 'Mods',
        permission: 'file.read',
        jarKind: 'mods',
    },
];
