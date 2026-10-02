import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import getServerEggs, { ServerEggNames } from '@/api/server/eggs';
import Pagination from '@/components/elements/Pagination';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const username = useStoreState((state) => state.user.data?.username);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined })
    );

    // The egg names, which the panel's servers list does not carry. Separate from
    // the list above on purpose: it is not paginated and does not change when the
    // page or the filter does, so giving it its own key means switching pages does
    // not refetch it, and switching the "show all servers" switch does not
    // refetch it either - the endpoint already answers for every server the
    // caller can see, admin-sighted ones included.
    //
    // Deliberately not awaited and not allowed to block the grid. A card that
    // cannot name its software still has to render: ServerRow falls back to the
    // family it can derive from the egg's variables, and then to the node name.
    // An endpoint failure must not take the dashboard down with it, so this is
    // never fed to the flash the way the list error is.
    const { data: eggs } = useSWR<ServerEggNames>('/auth/servers/eggs', getServerEggs);

    useEffect(() => {
        setPage(1);
    }, [showOnlyAdmin]);

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        // Don't use react-router to handle changing this part of the URL, otherwise it
        // triggers a needless re-render. We just want to track this in the URL incase the
        // user refreshes the page.
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    const firstName = (username || '').split(/[ ._-]/)[0];

    return (
        <PageContentBlock className={'pt-dash'} title={'Dashboard'} showFlashKey={'dashboard'}>
            {/*
             * The reference opens on a centred blue title rather than a greeting
             * block. `firstName` is still read for the greeting below it, which
             * stays as a quiet line - dropping the user's name from the page
             * entirely would be a loss the layout change does not require.
             */}
            <div className={'pt-dash-head'}>
                <h1 className={'pt-dash-title'}>Servers</h1>
                {firstName && <p className={'pt-dash-greeting'}>Welcome back, {firstName}</p>}
            </div>

            <div className={'pt-dash-bar'}>
                <div className={'pt-dash-bar-lead'}>
                    {rootAdmin && (
                        <label className={'pt-dash-filter'}>
                            <span>
                                {showOnlyAdmin ? "Showing others' servers" : 'Showing your servers'}
                            </span>
                            <Switch
                                name={'show_all_servers'}
                                defaultChecked={showOnlyAdmin}
                                onChange={() => setShowOnlyAdmin((s) => !s)}
                            />
                        </label>
                    )}
                </div>
            </div>

            {!servers ? (
                <Spinner centered />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            <div className={'pt-dash-grid'}>
                                {items.map((server) => (
                                    <ServerRow key={server.uuid} server={server} eggName={eggs?.[server.uuid]} />
                                ))}
                            </div>
                        ) : (
                            <div className={'pt-server-card is-empty'}>
                                <div className={'pt-server-body'}>
                                    <span className={'pt-server-name'}>No servers yet</span>
                                    <span className={'pt-server-egg'}>
                                        {showOnlyAdmin
                                            ? 'There are no other servers to display.'
                                            : 'There are no servers associated with your account. Ask an administrator to assign one to you.'}
                                    </span>
                                </div>
                            </div>
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
