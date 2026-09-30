import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faExclamationTriangle,
    faPuzzlePiece,
    faSearch,
    faTrash,
    faArrowLeft,
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import { useStoreActions } from '@/state/hooks';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import Can from '@/components/elements/Can';
import { Button } from '@/components/elements/button';
import { httpErrorToHuman } from '@/api/http';
import {
    formatBytes,
    formatCount,
    getJarVersions,
    InstalledJar,
    JAR_KINDS,
    JarKind,
    installJar,
    listInstalledJars,
    ModrinthHit,
    ModrinthVersion,
    PAGE_SIZE,
    primaryJarFor,
    readMinecraftVersion,
    removeJar,
    searchJars,
} from '@/api/server/jars';
import style from './style.module.css';

type Tab = 'installed' | 'browse';

/** Debounce for the search box. Long enough to not fire per keystroke, short
 *  enough to still feel live. */
const SEARCH_DEBOUNCE = 300;

/** Builds kept in a version picker. */
const VERSION_LIMIT = 25;

interface ProjectState {
    versions: ModrinthVersion[];
    selected: string | null;
    loading: boolean;
    failed: boolean;
    /** Set when a version filter was applied and matched nothing. */
    emptyForVersion: boolean;
    /** Ignore the version filter and load every build instead. */
    ignoreVersion: boolean;
}

const emptyProject = (): ProjectState => ({
    versions: [],
    selected: null,
    loading: false,
    failed: false,
    emptyForVersion: false,
    ignoreVersion: false,
});

export interface JarsContainerProps {
    /** Which flavour this route installs. */
    kind: JarKind;
}

export default ({ kind }: JarsContainerProps) => {
    const config = JAR_KINDS[kind];
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const variables = ServerContext.useStoreState((state) => state.server.data!.variables);
    const addFlash = useStoreActions((actions) => actions.flashes.addFlash);

    // The server's own Minecraft version, which is what a compatible build is
    // picked against. Overridable below, because a server on the egg default of
    // "latest" reports nothing useful and the user still knows their version.
    const serverVersion = useMemo(() => readMinecraftVersion(variables), [variables]);
    const [gameVersion, setGameVersion] = useState(serverVersion);
    const [versionDraft, setVersionDraft] = useState(serverVersion);
    useEffect(() => setGameVersion(serverVersion), [serverVersion]);

    const [tab, setTab] = useState<Tab>('installed');
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [results, setResults] = useState<{ total: number; hits: ModrinthHit[] } | null>(null);

    const [installed, setInstalled] = useState<InstalledJar[] | null>(null);
    const [installedError, setInstalledError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [projects, setProjects] = useState<Record<string, ProjectState>>({});

    const refreshInstalled = useCallback(async () => {
        try {
            setInstalledError(null);
            setInstalled(await listInstalledJars(kind, uuid));
        } catch (error) {
            setInstalled(null);
            setInstalledError(httpErrorToHuman(error));
        }
    }, [kind, uuid]);

    useEffect(() => {
        refreshInstalled();
    }, [refreshInstalled]);

    // Debounce the search box, and drop back to page 1 on the keystroke rather
    // than after the debounce, so changing the query never briefly shows page 3
    // of the new results.
    const onQueryChange = (value: string) => {
        setQuery(value);
        setPage(1);
    };

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [query]);

    // One fetch for (tab, query, page, version). The `active` flag drops
    // out-of-order responses, which a per-keystroke search makes routine: a slow
    // request for "ess" must not overwrite the results for "essentials".
    useEffect(() => {
        if (tab !== 'browse') {
            return;
        }

        let active = true;
        const trimmed = debouncedQuery.trim();

        setLoading(true);
        setSearchError(null);

        searchJars(kind, trimmed, {
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            sort: trimmed ? 'relevance' : 'downloads',
            gameVersion: gameVersion || undefined,
        })
            .then((next) => {
                if (active) {
                    setResults(next);
                    setLoading(false);
                }
            })
            .catch((error) => {
                if (active) {
                    setResults(null);
                    setSearchError(error instanceof Error ? error.message : 'Search failed.');
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [tab, debouncedQuery, page, gameVersion]);

    const setProject = (id: string, patch: Partial<ProjectState>) =>
        setProjects((current) => ({ ...current, [id]: { ...(current[id] || emptyProject()), ...patch } }));

    const loadVersions = useCallback(
        async (hit: ModrinthHit, ignoreVersion = false) => {
            const state = projects[hit.project_id];
            if (!ignoreVersion && state?.versions.length) {
                return;
            }

            const filter = ignoreVersion ? undefined : gameVersion || undefined;

            setProject(hit.project_id, { loading: true, failed: false, ignoreVersion });

            try {
                const versions = (await getJarVersions(kind, hit.project_id, filter)).slice(0, VERSION_LIMIT);
                setProject(hit.project_id, {
                    versions,
                    // Newest first from the API, so index 0 is the pick. It is the
                    // newest build that also matches the version filter, which is
                    // the "compatible version" we want by default.
                    selected: versions[0]?.id || null,
                    loading: false,
                    emptyForVersion: !!filter && versions.length === 0,
                });
            } catch {
                setProject(hit.project_id, { loading: false, failed: true });
            }
        },
        // projects is read for its cache check. Including it would refetch on
        // every render because setProject rewrites the object.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [gameVersion]
    );

    const onInstall = async (hit: ModrinthHit) => {
        const state = projects[hit.project_id];
        const version = state?.versions.find((entry) => entry.id === state.selected);

        if (!version) {
            return;
        }

        const jar = primaryJarFor(version);
        if (!jar) {
            addFlash({
                type: 'error',
                key: kind,
                title: 'No jar',
                message: `${hit.title} ${version.version_number} has no downloadable jar.`,
            });
            return;
        }

        setBusy((current) => ({ ...current, [hit.project_id]: true }));

        try {
            await installJar(kind, uuid, jar.url, jar.filename);
            addFlash({
                type: 'success',
                key: kind,
                title: 'Installed',
                message: `${jar.filename} added to ${config.directory}/. Restart the server to load it.`,
            });
            await refreshInstalled();
        } catch (error) {
            addFlash({ type: 'error', key: kind, title: 'Install failed', message: httpErrorToHuman(error) });
        } finally {
            setBusy((current) => ({ ...current, [hit.project_id]: false }));
        }
    };

    const onRemove = async (jar: InstalledJar) => {
        setBusy((current) => ({ ...current, [jar.name]: true }));

        try {
            await removeJar(kind, uuid, jar.name);
            addFlash({
                type: 'success',
                key: kind,
                title: 'Removed',
                message: `${jar.name} deleted. Restart the server to apply.`,
            });
            await refreshInstalled();
        } catch (error) {
            addFlash({ type: 'error', key: kind, title: 'Remove failed', message: httpErrorToHuman(error) });
        } finally {
            setBusy((current) => ({ ...current, [jar.name]: false }));
        }
    };

    const installedNames = useMemo(
        () => new Set((installed || []).map((jar) => jar.name.toLowerCase())),
        [installed]
    );

    const totalPages = results ? Math.max(1, Math.ceil(results.total / PAGE_SIZE)) : 1;
    const isBrowsing = tab === 'browse';
    const trimmedQuery = debouncedQuery.trim();

    const renderProject = (hit: ModrinthHit) => {
        const state = projects[hit.project_id] || emptyProject();
        const version = state.versions.find((entry) => entry.id === state.selected);
        const jar = version ? primaryJarFor(version) : null;
        const required = (version?.dependencies || []).filter((dep) => dep.dependency_type === 'required');
        const working = busy[hit.project_id] || false;

        // Only an exact filename match counts as installed. Modrinth filenames
        // carry the version, so a newer build of the same plugin will not match
        // and stays installable - which is what someone trying to upgrade wants.
        const alreadyOnDisk = jar ? installedNames.has(jar.filename.toLowerCase()) : false;

        return (
            <div key={hit.project_id} className={style.project}>
                <div className={style.projectHead}>
                    <span className={style.projectIcon}>
                        {hit.icon_url ? <img src={hit.icon_url} alt={''} /> : <FontAwesomeIcon icon={faPuzzlePiece} />}
                    </span>
                    <span className={'min-w-0 flex-1'}>
                        <span className={`${style.projectTitle} block truncate`}>{hit.title}</span>
                        <span className={style.projectAuthor}>
                            by {hit.author} · {hit.license.name}
                        </span>
                    </span>
                </div>

                <p className={style.description}>{hit.description || 'No description provided.'}</p>

                <div className={`${style.meta} mb-2`}>
                    <span>
                        <strong>{formatCount(hit.downloads)}</strong> downloads
                    </span>
                    <span>
                        latest <strong>{hit.latest_version}</strong>
                    </span>
                </div>

                {state.emptyForVersion && (
                    <div className={`${style.notice} ${style['notice--warn']} mb-2`}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>
                            No build for {gameVersion}.{' '}
                            <button type={'button'} className={style.linkish} onClick={() => loadVersions(hit, true)}>
                                Show all versions
                            </button>
                        </span>
                    </div>
                )}

                {required.length > 0 && (
                    <div className={`${style.notice} ${style['notice--warn']} mb-2`}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>
                            Needs {required.length} required {required.length === 1 ? 'dependency' : 'dependencies'}.
                            Install{' '}
                            {required
                                .map((dep) => (dep.project_id ? `@${dep.project_id}` : 'a library jar'))
                                .join(', ')}{' '}
                            too or this plugin will fail to load.
                        </span>
                    </div>
                )}

                <div className={style.projectFoot}>
                    {state.loading ? (
                        <Spinner size={'small'} />
                    ) : state.failed ? (
                        <Button type={'button'} onClick={() => loadVersions(hit, state.ignoreVersion)}>
                            Retry
                        </Button>
                    ) : state.versions.length ? (
                        <>
                            <select
                                className={style.select}
                                value={state.selected || ''}
                                onChange={(event) =>
                                    setProject(hit.project_id, { selected: event.currentTarget.value })
                                }
                                aria-label={`Version for ${hit.title}`}
                            >
                                {state.versions.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.version_number}
                                        {entry.version_type !== 'release' ? ` (${entry.version_type})` : ''}
                                        {entry.id === state.selected && jar ? ` · ${formatBytes(jar.size)}` : ''}
                                    </option>
                                ))}
                            </select>

                            {gameVersion && !state.ignoreVersion && (
                                <span className={style.badge} title={`Builds for ${gameVersion}`}>
                                    {gameVersion}
                                </span>
                            )}

                            <Can action={'file.create'}>
                                <Button
                                    type={'button'}
                                    onClick={() => onInstall(hit)}
                                    disabled={!jar || working || alreadyOnDisk}
                                >
                                    {working ? 'Installing…' : alreadyOnDisk ? 'Installed' : 'Install'}
                                </Button>
                            </Can>
                        </>
                    ) : (
                        <Button type={'button'} onClick={() => loadVersions(hit)}>
                            Show versions
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <ServerContentBlock title={config.label} showFlashKey={kind}>
            {installedError ? (
                <div className={`${style.notice} ${style['notice--warn']}`}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>
                        Could not read <code>{config.directory}/</code>: {installedError}. If this server does not
                        use {config.singular}s, that directory will not exist.
                    </span>
                </div>
            ) : (
                <>
                    <div className={style.tabs}>
                        <button
                            type={'button'}
                            className={`${style.tab} ${tab === 'installed' ? style['tab--active'] : ''}`}
                            onClick={() => setTab('installed')}
                        >
                            Installed
                            {installed && <span className={style.tabCount}>{installed.length}</span>}
                        </button>
                        <button
                            type={'button'}
                            className={`${style.tab} ${tab === 'browse' ? style['tab--active'] : ''}`}
                            onClick={() => setTab('browse')}
                        >
                            Browse
                        </button>
                    </div>

                    {tab === 'installed' ? (
                        installed === null ? (
                            <Spinner centered />
                        ) : installed.length === 0 ? (
                            <div className={style.empty}>
                                No {config.singular}s installed yet. Create a <code>{config.directory}/</code> folder in the
                                file manager, or use Browse to add one.
                            </div>
                        ) : (
                            <div className={style.installed}>
                                {installed.map((jar) => (
                                    <div key={jar.name} className={style.installedRow}>
                                        <FontAwesomeIcon icon={faPuzzlePiece} className={'text-gray-400'} />
                                        <span className={style.installedName}>{jar.name}</span>
                                        <span className={style.installedMeta}>{formatBytes(jar.size)}</span>
                                        <Can action={'file.delete'}>
                                            <Button.Danger
                                                type={'button'}
                                                onClick={() => onRemove(jar)}
                                                disabled={busy[jar.name]}
                                                title={`Remove ${jar.name}`}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </Button.Danger>
                                        </Can>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <>
                            <div className={style.toolbar}>
                                <div className={style.searchWrap}>
                                    <FontAwesomeIcon icon={faSearch} className={style.searchIcon} />
                                    <input
                                        className={style.search}
                                        value={query}
                                        onChange={(event) => onQueryChange(event.currentTarget.value)}
                                        placeholder={`Search Modrinth for a ${config.singular}…`}
                                        aria-label={`Search ${config.label}`}
                                        autoComplete={'off'}
                                        spellCheck={false}
                                    />
                                    {loading && <Spinner size={'small'} />}
                                </div>
                            </div>

                            <div className={style.filterBar}>
                                {gameVersion ? (
                                    <span className={style.badge} title={'Filtered to this Minecraft version'}>
                                        Minecraft {gameVersion}
                                    </span>
                                ) : (
                                    <span className={style.filterNote}>
                                        {serverVersion
                                            ? 'No Minecraft version set - showing every version.'
                                            : 'This server reports no Minecraft version - showing every version.'}
                                    </span>
                                )}

                                <form
                                    className={style.versionForm}
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        setPage(1);
                                        setGameVersion(versionDraft.trim());
                                        setProjects({});
                                    }}
                                >
                                    <input
                                        className={style.versionInput}
                                        value={versionDraft}
                                        onChange={(event) => setVersionDraft(event.currentTarget.value)}
                                        placeholder={'1.21.4'}
                                        aria-label={'Minecraft version'}
                                        size={8}
                                    />
                                    <Button type={'submit'} size={Button.Sizes.Small}>
                                        Apply
                                    </Button>
                                    {gameVersion && (
                                        <Button
                                            type={'button'}
                                            size={Button.Sizes.Small}
                                            onClick={() => {
                                                setVersionDraft('');
                                                setGameVersion('');
                                                setProjects({});
                                                setPage(1);
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </form>
                            </div>

                            {searchError && (
                                <div className={`${style.notice} ${style['notice--warn']}`}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    <span>{searchError}</span>
                                </div>
                            )}

                            {results && results.hits.length === 0 && !loading && (
                                <div className={style.empty}>
                                    {trimmedQuery
                                        ? `Nothing matched “${trimmedQuery}”.`
                                        : `No ${config.singular}s found.`}
                                </div>
                            )}

                            {results && results.hits.length > 0 && (
                                <>
                                    <div className={`${style.meta} mb-3`}>
                                        <span>
                                            <strong>{formatCount(results.total)}</strong>{' '}
                                            {results.total === 1 ? config.singular : `${config.singular}s`}
                                            {trimmedQuery ? ` for “${trimmedQuery}”` : ' - most downloaded'}
                                        </span>
                                    </div>

                                    <div className={style.results}>{results.hits.map(renderProject)}</div>

                                    {totalPages > 1 && (
                                        <div className={style.pagination}>
                                            <Button
                                                type={'button'}
                                                size={Button.Sizes.Small}
                                                disabled={page <= 1 || loading}
                                                onClick={() => setPage((value) => Math.max(1, value - 1))}
                                            >
                                                <FontAwesomeIcon icon={faArrowLeft} />
                                                <span className={'ml-2'}>Previous</span>
                                            </Button>

                                            <span className={style.pageInfo}>
                                                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                                            </span>

                                            <Button
                                                type={'button'}
                                                size={Button.Sizes.Small}
                                                disabled={page >= totalPages || loading}
                                                onClick={() => setPage((value) => value + 1)}
                                            >
                                                <span className={'mr-2'}>Next</span>
                                                <FontAwesomeIcon icon={faArrowRight} />
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </ServerContentBlock>
    );
};
