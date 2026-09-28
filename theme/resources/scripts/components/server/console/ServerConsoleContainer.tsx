import React, { memo } from 'react';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import PowerButtons from '@/components/server/console/PowerButtons';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const ServerConsoleContainer = () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const description = ServerContext.useStoreState((state) => state.server.data!.description);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);
    const status = ServerContext.useStoreState((state) => state.status.value);

    const statusLabel = !status || status === 'offline' ? 'Offline' : status === 'running' ? 'Running' : status;
    const statusKind = status === 'running' ? 'online' : status && status !== 'offline' ? 'busy' : 'offline';

    return (
        <ServerContentBlock title={'Console'}>
            {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                <Alert type={'warning'} className={'mb-4'}>
                    {isNodeUnderMaintenance
                        ? 'The node of this server is currently under maintenance and all actions are unavailable.'
                        : isInstalling
                        ? 'This server is currently running its installation process and most actions are unavailable.'
                        : 'This server is currently being transferred to another node and all actions are unavailable.'}
                </Alert>
            )}
            <div className={'pt-console-head'}>
                <div className={'min-w-0'}>
                    <p className={'pt-hero-eyebrow'}>Server console</p>
                    <h1>{name}</h1>
                    <p className={'pt-console-desc'}>
                        <span className={`pt-chip pt-chip--${statusKind} mr-2 align-middle`}>{statusLabel}</span>
                        {description || 'Live output, power controls and resource usage for this server.'}
                    </p>
                </div>
                <div className={'pt-console-actions'}>
                    <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                        <PowerButtons
                            className={'flex flex-wrap justify-start sm:justify-end gap-2 w-full sm:w-auto'}
                        />
                    </Can>
                </div>
            </div>
            <div className={'grid grid-cols-4 gap-2 sm:gap-4 mb-4'}>
                <div className={'flex col-span-4 lg:col-span-3'}>
                    <Spinner.Suspense>
                        <Console />
                    </Spinner.Suspense>
                </div>
                <ServerDetailsBlock className={'col-span-4 lg:col-span-1 order-last lg:order-none'} />
            </div>
            <div className={'grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4'}>
                <Spinner.Suspense>
                    <StatGraphs />
                </Spinner.Suspense>
            </div>
            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
