import http from '@/api/http';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';

/**
 * Plugin installation for a server.
 *
 * There is no backend here on purpose. The panel already exposes everything this
 * needs:
 *
 *   POST /api/client/servers/{uuid}/files/pull    daemon downloads a URL for us
 *   GET  /api/client/servers/{uuid}/files/list    read plugins/
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

export const PLUGINS_DIRECTORY = 'plugins';

const MODRINTH_API = 'https://api.modrinth.com/v2';

/**
 * Loaders we accept. Purpur and Paper are Bukkit-flavoured, so a plugin built
 * for any of these runs on the others in practice; asking for all four widens
 * the result set rather than narrowing it.
 */
export const SUPPORTED_LOADERS = ['paper', 'spigot', 'bukkit', 'purpur'];

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
    const url = new URL(`${MODRINTH_API}${path}`);

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

/**
 * Search the plugin catalog. An empty query is rejected rather than sent: a
 * blank Modrinth search returns an arbitrary slice of the whole catalog, which
 * reads as noise rather than as results.
 */
export const searchPlugins = async (query: string, limit = 24) => {
    const trimmed = query.trim();

    if (!trimmed) {
        return { total: 0, hits: [] as ModrinthHit[] };
    }

    const result = await modrinthGet<{ total_hits: number; hits: ModrinthHit[] }>('/search', {
        query: trimmed,
        limit: String(limit),
        facets: JSON.stringify([['project_type:plugin'], ['categories:paper']]),
    });

    return { total: result.total_hits, hits: result.hits };
};

/** Every build of a project that targets a loader we support, newest first. */
export const getPluginVersions = (projectId: string) =>
    modrinthGet<ModrinthVersion[]>(`/project/${projectId}/version`, {
        loaders: JSON.stringify(SUPPORTED_LOADERS),
    });

/**
 * The jar to actually install.
 *
 * A Modrinth version can carry more than one file - signatures and metadata
 * alongside the jar - and `file_type` is not populated consistently enough to
 * filter on, so `primary` is the discriminator. The `.jar` check is a backstop:
 * pulling a signature into plugins/ is harmless but useless, and a non-jar
 * primary would be a surprise worth refusing.
 */
export const primaryJarFor = (version: ModrinthVersion): ModrinthFile | null => {
    const files = version.files || [];
    const isJar = (file: ModrinthFile) => file.filename.toLowerCase().endsWith('.jar');

    return files.find((file) => file.primary && isJar(file)) || files.find(isJar) || null;
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

export interface InstalledPlugin {
    name: string;
    path: string;
    size: number;
    modifiedAt: Date;
}

export const pluginPath = (name: string) => `${PLUGINS_DIRECTORY}/${name}`;

/**
 * The jars sitting in plugins/.
 *
 * Subdirectories are skipped - shaded and library folders are common in there
 * and are not plugins. Files that are not jars are ignored rather than reported,
 * so a server that keeps something else in plugins/ is not mislabelled.
 */
export const listInstalledPlugins = async (uuid: string): Promise<InstalledPlugin[]> => {
    const files: FileObject[] = await loadDirectory(uuid, `/${PLUGINS_DIRECTORY}`);

    return files
        .filter((file) => file.isFile && file.name.toLowerCase().endsWith('.jar'))
        .map((file) => ({
            name: file.name,
            path: pluginPath(file.name),
            size: file.size,
            modifiedAt: file.modifiedAt,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Whether this server has a plugins/ directory at all.
 *
 * This is how the nav item decides a server is a plugin server. The panel does
 * not expose the egg name to the client: ServerController::index never calls
 * parseIncludes(), so `?include=egg` is silently ignored, and both egg_features
 * and docker_image are identical across the Minecraft eggs (every one of them is
 * ["eula","java_version","pid_limit"]). Probing the filesystem is the only
 * signal that actually distinguishes a Paper server from a Vanilla one, and it
 * works on any panel version.
 *
 * An empty directory and a missing one are different answers and both matter:
 * `plugins/` existing but empty means the server is a plugin server with nothing
 * installed yet, which is the common case and must still show the nav item.
 */
export const hasPluginsDirectory = async (uuid: string): Promise<boolean> => {
    try {
        await loadDirectory(uuid, `/${PLUGINS_DIRECTORY}`);
        return true;
    } catch (error) {
        // A missing directory and a permission failure look the same from here.
        // Reporting "not a plugin server" is the safe reading: the worst case is
        // the nav item stays hidden and the user opens Files to create plugins/.
        return false;
    }
};

/**
 * Ask the daemon to download a jar into plugins/.
 *
 * `foreground` makes the pull synchronous on the daemon, so a failure surfaces
 * as a rejected request instead of a silently missing file. `use_header` is
 * deliberately not set: it makes the daemon honour the URL's Content-Disposition
 * filename, which we do not want - we are choosing the name.
 */
export const installPlugin = async (uuid: string, url: string, filename: string) => {
    await http.post(`/api/client/servers/${uuid}/files/pull`, {
        url,
        directory: PLUGINS_DIRECTORY,
        filename,
        foreground: true,
    });
};

export const removePlugin = (uuid: string, name: string) => deleteFiles(uuid, PLUGINS_DIRECTORY, [name]);

