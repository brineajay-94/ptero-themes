import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { brandName } from '@/lib/brand';
import { useLocation } from 'react-router-dom';

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
        <PageContentBlock title={'Dashboard'} showFlashKey={'dashboard'}>
            <section className={'pt-hero'}>
                <p className={'pt-hero-eyebrow'}>{brandName()}</p>
                <h1>Welcome back{firstName ? `, ${firstName}` : ''}</h1>
                <p className={'pt-hero-sub'}>
                    Spin up, manage and monitor every server you own - files, backups, databases and schedules all live
                    in one place.
                </p>
                <div className={'pt-hero-stats'}>
                    <div className={'pt-hero-stat'}>
                        <b>{servers ? servers.pagination.total : '—'}</b>
                        <span>{servers && servers.pagination.total === 1 ? 'Server' : 'Servers'}</span>
                    </div>
                    <div className={'pt-hero-stat'}>
                        <b>{servers ? servers.pagination.totalPages : '—'}</b>
                        <span>Pages</span>
                    </div>
                    <div className={'pt-hero-stat'}>
                        <b>{rootAdmin ? 'Admin' : 'Member'}</b>
                        <span>Access</span>
                    </div>
                </div>
            </section>

            <div className={'flex flex-wrap justify-between items-center gap-3'}>
                <h2 className={'pt-section-title !mt-0 flex-1'}>Your servers</h2>
                {rootAdmin && (
                    <div className={'flex justify-end items-center'}>
                        <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>
                            {showOnlyAdmin ? "Showing others' servers" : 'Showing your servers'}
                        </p>
                        <Switch
                            name={'show_all_servers'}
                            defaultChecked={showOnlyAdmin}
                            onChange={() => setShowOnlyAdmin((s) => !s)}
                        />
                    </div>
                )}
            </div>

            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            items.map((server) => <ServerRow key={server.uuid} server={server} />)
                        ) : (
                            <div className={'pt-server-card'} style={{ cursor: 'default' }}>
                                <div className={'pt-server-tile'}>
                                    <span>0</span>
                                </div>
                                <div className={'min-w-0'}>
                                    <p className={'pt-server-name'}>No servers yet</p>
                                    <p className={'pt-server-desc'}>
                                        {showOnlyAdmin
                                            ? 'There are no other servers to display.'
                                            : 'There are no servers associated with your account. Ask an administrator to assign one to you.'}
                                    </p>
                                </div>
                            </div>
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
