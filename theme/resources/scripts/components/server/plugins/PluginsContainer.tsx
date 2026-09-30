import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxOpen,
    faExclamationTriangle,
    faPuzzlePiece,
    faSearch,
    faTrash,
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
    getPluginVersions,
    InstalledPlugin,
    installPlugin,
    listInstalledPlugins,
    ModrinthHit,
    ModrinthVersion,
    primaryJarFor,
    removePlugin,
    searchPlugins,
} from '@/api/server/plugins';
import style from './style.module.css';

type Tab = 'installed' | 'browse';

/** Versions per project kept in the picker, newest first. */
const VERSION_LIMIT = 25;

interface ProjectState {
    versions: ModrinthVersion[];
    /** Version id currently chosen in the picker, or null while still loading. */
    selected: string | null;
    loading: boolean;
    failed: boolean;
}

const emptyProject = (): ProjectState => ({ versions: [], selected: null, loading: false, failed: false });

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const addFlash = useStoreActions((actions) => actions.flashes.addFlash);
    const history = useHistory();

    const [tab, setTab] = useState<Tab>('installed');
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [results, setResults] = useState<{ total: number; hits: ModrinthHit[] } | null>(null);

    const [installed, setInstalled] = useState<InstalledPlugin[] | null>(null);
    const [installedError, setInstalledError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Record<string, boolean>>({});

    const [projects, setProjects] = useState<Record<string, ProjectState>>({});

    const refreshInstalled = useCallback(async () => {
        try {
            setInstalledError(null);
            setInstalled(await listInstalledPlugins(uuid));
        } catch (error) {
            setInstalled(null);
            setInstalledError(httpErrorToHuman(error));
        }
    }, [uuid]);

    useEffect(() => {
        refreshInstalled();
    }, [refreshInstalled]);

    const setProject = (id: string, patch: Partial<ProjectState>) =>
        setProjects((current) => ({ ...current, [id]: { ...(current[id] || emptyProject()), ...patch } }));

    const loadVersions = useCallback(
        async (hit: ModrinthHit) => {
            if (projects[hit.project_id]?.versions.length) {
                return;
            }

            setProject(hit.project_id, { loading: true, failed: false });

            try {
                const versions = (await getPluginVersions(hit.project_id)).slice(0, VERSION_LIMIT);
                setProject(hit.project_id, {
                    versions,
                    selected: versions[0]?.id || null,
                    loading: false,
                });
            } catch (error) {
                setProject(hit.project_id, { loading: false, failed: true });
                addFlash({
                    type: 'error',
                    key: 'plugins',
                    title: error instanceof Error ? error.message : 'Could not load versions',
                    message: `Could not load versions for ${hit.title}.`,
                });
            }
        },
        // projects is read for its cache check; including it would refetch on
        // every keystroke because setProject rewrites the object.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [uuid]
    );

    const onSearch = async (event: React.FormEvent) => {
        event.preventDefault();

        const trimmed = query.trim();
        if (!trimmed) {
            return;
        }

        setSearching(true);
        setSearchError(null);

        try {
            setResults(await searchPlugins(trimmed));
        } catch (error) {
            setResults(null);
            setSearchError(error instanceof Error ? error.message : 'Search failed.');
        } finally {
            setSearching(false);
        }
    };

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
                key: 'plugins',
                title: 'No jar',
                message: `${hit.title} ${version.version_number} has no downloadable jar.`,
            });
            return;
        }

        setBusy((current) => ({ ...current, [hit.project_id]: true }));

        try {
            await installPlugin(uuid, jar.url, jar.filename);
            addFlash({
                type: 'success',
                key: 'plugins',
                title: 'Installed',
                message: `${jar.filename} added to plugins/. Restart the server to load it.`,
            });
            await refreshInstalled();
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'plugins',
                title: 'Install failed',
                message: httpErrorToHuman(error),
            });
        } finally {
            setBusy((current) => ({ ...current, [hit.project_id]: false }));
        }
    };

    const onRemove = async (plugin: InstalledPlugin) => {
        setBusy((current) => ({ ...current, [plugin.name]: true }));

        try {
            await removePlugin(uuid, plugin.name);
            addFlash({
                type: 'success',
                key: 'plugins',
                title: 'Removed',
                message: `${plugin.name} deleted. Restart the server to apply.`,
            });
            await refreshInstalled();
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'plugins',
                title: 'Remove failed',
                message: httpErrorToHuman(error),
            });
        } finally {
            setBusy((current) => ({ ...current, [plugin.name]: false }));
        }
    };

    const installedNames = useMemo(
        () => new Set((installed || []).map((plugin) => plugin.name.toLowerCase())),
        [installed]
    );

    const renderProject = (hit: ModrinthHit) => {
        const state = projects[hit.project_id] || emptyProject();
        const version = state.versions.find((entry) => entry.id === state.selected);
        const jar = version ? primaryJarFor(version) : null;
        const required = (version?.dependencies || []).filter((dep) => dep.dependency_type === 'required');
        const working = busy[hit.project_id] || false;

        // Only an exact filename match counts as installed. Modrinth filenames
        // carry the version, so a newer build of the same plugin will not match
        // and stays installable - which is the behaviour people expect when they
        // are trying to upgrade.
        const alreadyOnDisk = jar ? installedNames.has(jar.filename.toLowerCase()) : false;

        return (
            <div key={hit.project_id} className={style.project}>
                <div className={style.projectHead}>
                    <span className={style.projectIcon}>
                        {hit.icon_url ? (
                            <img src={hit.icon_url} alt={''} />
                        ) : (
                            <FontAwesomeIcon icon={faPuzzlePiece} />
                        )}
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

                {state.failed && <div className={`${style.notice} ${style['notice--warn']}`}>Versions unavailable.</div>}

                {required.length > 0 && (
                    <div className={`${style.notice} ${style['notice--warn']} mb-2`}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>
                            Needs {required.length} required{' '}
                            {required.length === 1 ? 'dependency' : 'dependencies'}. Install{' '}
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
                    ) : state.versions.length ? (
                        <>
                            <select
                                className={style.select}
                                value={state.selected || ''}
                                onChange={(e) => setProject(hit.project_id, { selected: e.currentTarget.value })}
                                aria-label={`Version for ${hit.title}`}
                            >
                                {state.versions.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.version_number}
                                        {entry.version_type !== 'release' ? ` (${entry.version_type})` : ''}
                                        {jar && entry.id === state.selected ? ` · ${formatBytes(jar.size)}` : ''}
                                    </option>
                                ))}
                            </select>

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
        <ServerContentBlock title={'Plugins'} showFlashKey={'plugins'}>
            {installedError ? (
                <div className={`${style.notice} ${style['notice--warn']}`}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>
                        Could not read <code>plugins/</code>: {installedError}. If this server is not a plugin
                        server, that directory will not exist.
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
                                No plugins installed yet. Create a <code>plugins/</code> folder in the file
                                manager, or use Browse to add one.
                            </div>
                        ) : (
                            <div className={style.installed}>
                                {installed.map((plugin) => (
                                    <div key={plugin.name} className={style.installedRow}>
                                        <FontAwesomeIcon icon={faPuzzlePiece} className={'text-gray-400'} />
                                        <span className={style.installedName}>{plugin.name}</span>
                                        <span className={style.installedMeta}>{formatBytes(plugin.size)}</span>
                                        <Can action={'file.delete'}>
                                            <Button.Danger
                                                type={'button'}
                                                onClick={() => onRemove(plugin)}
                                                disabled={busy[plugin.name]}
                                                title={`Remove ${plugin.name}`}
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
                            <form className={style.toolbar} onSubmit={onSearch}>
                                <input
                                    className={style.search}
                                    value={query}
                                    onChange={(e) => setQuery(e.currentTarget.value)}
                                    placeholder={'Search Modrinth for a plugin…'}
                                    aria-label={'Search plugins'}
                                />
                                <Button type={'submit'} disabled={searching || !query.trim()}>
                                    <FontAwesomeIcon icon={faSearch} />
                                    <span className={'ml-2'}>{searching ? 'Searching…' : 'Search'}</span>
                                </Button>
                            </form>

                            {searchError && (
                                <div className={`${style.notice} ${style['notice--warn']}`}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    <span>{searchError}</span>
                                </div>
                            )}

                            {!results && !searchError && (
                                <div className={style.empty}>
                                    Search the Modrinth plugin catalog. Downloads go straight from Modrinth to
                                    this server.
                                </div>
                            )}

                            {results && results.hits.length === 0 && (
                                <div className={style.empty}>No plugins matched “{query.trim()}”.</div>
                            )}

                            {results && results.hits.length > 0 && (
                                <>
                                    <div className={`${style.meta} mb-3`}>
                                        <span>
                                            <strong>{formatCount(results.total)}</strong>{' '}
                                            {results.total === 1 ? 'result' : 'results'}
                                        </span>
                                    </div>
                                    <div className={style.results}>{results.hits.map(renderProject)}</div>
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </ServerContentBlock>
    );
};
