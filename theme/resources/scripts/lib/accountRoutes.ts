/**
 * Account routes the theme adds on top of the panel's own `routes.account` table.
 *
 * The same reasoning as `serverExtras.ts`, for the account screens. The panel
 * builds its table from its router config, which the theme does not ship -
 * overriding it would mean replacing a file the panel also uses to decide what
 * the navigation offers. So the theme's own routes live here and the two places
 * that need to agree read from this one definition:
 *
 *   DashboardRouter   renders the component
 *   AppShell          resolves the page title in the topbar
 *
 * `path` is a bare segment with no slashes, which is also what the two
 * consumers compare against: `DashboardRouter` joins it onto `/account/`, and
 * `AppShell` compares it with the sub-path it has already stripped the prefix
 * from. The overview is `''` rather than `/` so it is the same shape as every
 * other entry here - the panel's own table spells it `/`, which is one of the
 * reasons the two cannot simply be concatenated.
 */
export interface ThemeAccountRoute {
    /** Path segment under /account, without slashes. '' is the overview. */
    path: string;
    /** Topbar title. */
    name: string;
}

export const THEME_ACCOUNT_ROUTES: ThemeAccountRoute[] = [
    {
        path: '',
        name: 'Account',
    },
    {
        path: 'email',
        name: 'Email Address',
    },
];

/**
 * A path from either table reduced to the bare segment form above: no leading
 * slash, no trailing slash, and `/` collapsed to the empty string.
 *
 * Both tables are matched through this rather than compared literally, because
 * they do not agree on spelling - the panel's overview is `/`, the theme's is
 * `''` - and a literal comparison misses the overview and leaves two routes
 * rendering one URL.
 */
export const normalizeAccountPath = (path: string): string => path.replace(/^\/+|\/+$/g, '');