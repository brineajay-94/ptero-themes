import http from '@/api/http';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';

/**
 * Installing jar add-ons: Bukkit-family *plugins* and mod-loader *mods*.
 *
 * Both are the same operation with different parameters - a directory, a Modrinth
 * project type and a set of loaders - so they share this module rather than
 * having two near-identical ones. Which one a server gets is decided by
 * `lib/serverExtras` from the egg, and passed in as a `JarKind`.
 *
 * There is no backend here on purpose. The panel already exposes everything this
 * needs:
 *
 *   POST /api/client/servers/{uuid}/files/pull    daemon downloads a URL for us
 *   GET  /api/client/servers/{uuid}/files/list    read the directory
 *   POST /api/client/servers/{uuid}/files/delete  remove a jar
 *
 * `files/pull` is the important one: it hands the URL to the *daemon*, so the jar
 * never passes through the browser and there is no CORS or memory ceiling. It
 * only requires Permission::ACTION_FILE_CREATE, which every user already has, so
 * this needs no new route, no new permission and no proxy.
 *
 * The catalog is Modrinth, called straight from the browser - api.modrinth.com
 * sends `access-control-allow-origin: *`. Spigot and Hangar do not, and
 * supporting them would mean the panel proxying arbitrary URLs on our behalf,
 * which is an SSRF surface that would need allowlisting. Modrinth alone keeps
 * this frontend-only.
 */

export type JarKind = 'plugins' | 'mods';

export interface JarKindConfig {
    /** Directory on the server the jars live in. */
    directory: string;
    /** Modrinth `project_type`. */
    projectType: string;
    /**
     * Loaders to accept. These are Bukkit-flavoured or mod-loader-flavoured
     * respectively, so a build for one runs on the others in practice; asking for
     * the whole set widens results rather than narrowing them. Every slug here is
     * verified against Modrinth's /tag/loader.
     */
    loaders: string[];
    /** Nav label, page title and page noun. */
    label: string;
    singular: string;
}

export const JAR_KINDS: Record<JarKind, JarKindConfig> = {
    plugins: {
        directory: 'plugins',
        projectType: 'plugin',
        loaders: ['paper', 'spigot', 'bukkit', 'purpur'],
        label: 'Plugins',
        singular: 'plugin',
    },
    mods: {
        directory: 'mods',
        projectType: 'mod',
        loaders: ['forge', 'fabric', 'quilt', 'neoforge'],
        label: 'Mods',
        singular: 'mod',
    },
};

/** Results per page. */
export const PAGE_SIZE = 20;

export interface ModrinthHit {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    downloads: number;
    follows: number;
    date_modified: string;
    latest_version: string;
    license: { id: string; name: string };
    author: string;
    icon_url: string | null;
    project_type: string;
}

export interface ModrinthFile {
    filename: string;
    primary: boolean;
    size: number;
    url: string;
}

export interface ModrinthDependency {
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
    project_id: string | null;
    version_id: string | null;
    file_name: string | null;
}

export interface ModrinthVersion {
    id: string;
    project_id: string;
    name: string;
    version_number: string;
    version_type: 'release' | 'beta' | 'alpha';
    loaders: string[];
    game_versions: string[];
    date_published: string;
    downloads: number;
    files: ModrinthFile[];
    dependencies: ModrinthDependency[];
}

/* ------------------------------------------------------------------ catalog -- */

const modrinthGet = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
    const url = new URL(`https://api.modrinth.com/v2${path}`);

    for (const [key, value] of Object.entries(params || {})) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
        // A project that is not on Modrinth is a 404 and is entirely expected
        // here, so it gets a message the UI can show rather than a raw status.
        throw new Error(
            response.status === 404
                ? 'Not found on Modrinth.'
                : `Modrinth returned ${response.status}. Try again in a moment.`
        );
    }

    return (await response.json()) as T;
};

export interface SearchOptions {
    limit?: number;
    offset?: number;
    /**
     * `relevance` while searching, `downloads` for the default "popular" list. An
     * empty query with `downloads` is what makes Browse show something useful
     * instead of an empty prompt.
     */
    sort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
    /** Minecraft version to restrict to, e.g. `1.21.4`. Empty means no filter. */
    gameVersion?: string;
}

/**
 * Search the catalog for one kind.
 *
 * An empty query is allowed on purpose: combined with `sort=downloads` it is how
 * the Browse tab gets the most-downloaded entries. It used to be rejected here as
 * noise, which is right for a search box and wrong for a default listing - those
 * are two different requests.
 */
export const searchJars = async (kind: JarKind, query: string, options: SearchOptions = {}) => {
    const { limit = PAGE_SIZE, offset = 0, sort, gameVersion } = options;
    const trimmed = query.trim();
    const config = JAR_KINDS[kind];

    const facets: unknown[][] = [
        [`project_type:${config.projectType}`],
        // The Bukkit loaders and the mod loaders share the "paper"/"forge"
        // category naming convention, so anchor on the first loader of each.
        [`categories:${config.loaders[0]}`],
    ];
    if (gameVersion) {
        facets.push([`versions:${gameVersion}`]);
    }

    const params: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
        facets: JSON.stringify(facets),
    };
    if (trimmed) {
        params.query = trimmed;
    }
    if (sort) {
        params.sort = sort;
    }

    const result = await modrinthGet<{ total_hits: number; hits: ModrinthHit[] }>('/search', params);

    return { total: result.total_hits, hits: result.hits };
};

/**
 * Builds of a project, newest first, restricted to a Minecraft version when one
 * is known.
 *
 * Modrinth's server-side `game_versions` filter is re-applied on the way back
 * in: a build's own `game_versions` array is the authority on what it actually
 * supports, and trusting the filter alone risks returning a build whose array
 * does not contain the version that was asked for.
 */
export const getJarVersions = async (kind: JarKind, projectId: string, gameVersion?: string) => {
    const params: Record<string, string> = { loaders: JSON.stringify(JAR_KINDS[kind].loaders) };
    if (gameVersion) {
        params.game_versions = JSON.stringify([gameVersion]);
    }

    const versions = await modrinthGet<ModrinthVersion[]>(`/project/${projectId}/version`, params);

    if (!gameVersion) {
        return versions;
    }

    return versions.filter((version) => (version.game_versions || []).includes(gameVersion));
};

/**
 * The jar to actually install.
 *
 * A Modrinth version can carry more than one file - signatures and metadata
 * alongside the jar - and `file_type` is not populated consistently enough to
 * filter on, so `primary` is the discriminator. The `.jar` check is a backstop:
 * pulling a signature into the directory is harmless but useless, and a non-jar
 * primary would be a surprise worth refusing.
 */
export const primaryJarFor = (version: ModrinthVersion): ModrinthFile | null => {
    const files = version.files || [];
    const isJar = (file: ModrinthFile) => file.filename.toLowerCase().endsWith('.jar');

    return files.find((file) => file.primary && isJar(file)) || files.find(isJar) || null;
};

/**
 * The Minecraft version this server runs, read from its egg variables.
 *
 * Both families name it differently - Paper uses MINECRAFT_VERSION, Forge uses
 * MC_VERSION - and both mark the variable `user_viewable`, so it arrives in the
 * client payload with no daemon round trip. `serverValue` wins over
 * `defaultValue`.
 *
 * The default is the literal string `latest`, which is a sentinel rather than a
 * version. That is reported as **unknown** and no filter is applied, with the
 * reason shown and an input to set one by hand: guessing would silently hide
 * compatible add-ons, which is worse than showing all of them.
 */
export const readMinecraftVersion = (
    variables: { envVariable: string; serverValue: string | null; defaultValue: string | null }[] = []
): string => {
    // Order matters only in that the Bukkit name is checked first; an egg using
    // both (some Fabric eggs do) is still a Minecraft version either way.
    const names = ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION', 'BUNGEE_VERSION'];

    for (const name of names) {
        const variable = variables.find((entry) => entry.envVariable === name);
        const value = (variable?.serverValue || variable?.defaultValue || '').trim();

        if (value && value.toLowerCase() !== 'latest') {
            return value;
        }
    }

    return '';
};

export const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) {
        return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }

    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

export const formatCount = (value: number): string => {
    if (!value || value < 0) {
        return '0';
    }
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}m`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
    }

    return String(value);
};

/* --------------------------------------------------------------- panel side -- */

export interface InstalledJar {
    name: string;
    path: string;
    size: number;
    modifiedAt: Date;
}

export const jarPath = (kind: JarKind, name: string) => `${JAR_KINDS[kind].directory}/${name}`;

/**
 * The jars sitting in the kind's directory.
 *
 * Subdirectories are skipped - shaded and library folders are common in there
 * and are not add-ons. Files that are not jars are ignored rather than reported,
 * so a server that keeps something else in there is not mislabelled.
 */
export const listInstalledJars = async (kind: JarKind, uuid: string): Promise<InstalledJar[]> => {
    const files: FileObject[] = await loadDirectory(uuid, `/${JAR_KINDS[kind].directory}`);

    return files
        .filter((file) => file.isFile && file.name.toLowerCase().endsWith('.jar'))
        .map((file) => ({
            name: file.name,
            path: jarPath(kind, file.name),
            size: file.size,
            modifiedAt: file.modifiedAt,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Whether a directory exists on this server.
 *
 * This is how the nav decides a server can take jars at all. The panel does not
 * expose the egg name to the client, so the filesystem is the ground truth for
 * "can I install a jar here" - a Paper server has `plugins/`, a Forge or Fabric
 * server has `mods/`, and a Vanilla or TeamSpeak server has neither.
 *
 * An empty directory and a missing one are different answers and both matter:
 * `plugins/` existing but empty means the server is a plugin server with nothing
 * installed yet, which is the common case and must still show the nav item.
 */
export const hasJarDirectory = async (kind: JarKind, uuid: string): Promise<boolean> => {
    try {
        await loadDirectory(uuid, `/${JAR_KINDS[kind].directory}`);
        return true;
    } catch (error) {
        // A missing directory and a permission failure look the same from here.
        // Reporting "not this kind" is the safe reading: the worst case is the
        // nav item stays hidden and the user opens Files to create it.
        return false;
    }
};

/**
 * Ask the daemon to download a jar into the kind's directory.
 *
 * `foreground` makes the pull synchronous on the daemon, so a failure surfaces
 * as a rejected request instead of a silently missing file. `use_header` is
 * deliberately not set: it makes the daemon honour the URL's
 * Content-Disposition filename, which we do not want - we are choosing the name.
 */
export const installJar = async (kind: JarKind, uuid: string, url: string, filename: string) => {
    await http.post(`/api/client/servers/${uuid}/files/pull`, {
        url,
        directory: JAR_KINDS[kind].directory,
        filename,
        foreground: true,
    });
};

export const removeJar = (kind: JarKind, uuid: string, name: string) =>
    deleteFiles(uuid, JAR_KINDS[kind].directory, [name]);
