import React, { memo } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import ServerStatusPanel from '@/components/server/status/ServerStatusPanel';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

/**
 * The console page.
 *
 * The header above it (ServerStatusPanel) carries the server's name as the page's
 * heading, the state, and the power controls; the console card carries its own
 * title and the server's name as a badge; and ServerDetailsBlock carries the
 * numbers beside the terminal. So there is no name block here any more - there
 * were three of them once this file printed an eyebrow, an <h1> and a
 * description, and with the header card in place a fourth would have been one
 * too many.
 *
 * The description stays, though, and deliberately: the name is a fact and the
 * description is the only prose anywhere on the page. It renders under the
 * header rather than inside the console card, because a server's description is
 * about the server, not about its console.
 */
const ServerConsoleContainer = () => {
    const description = ServerContext.useStoreState((state) => state.server.data!.description);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

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

            <ServerStatusPanel />

            {description && <p className={'pt-console-desc'}>{description}</p>}

            {/*
             * The console and the statistics column, 3:1 from lg and stacked below.
             *
             * `minmax(0, 3fr)` rather than `col-span-3`: a grid track sized in
             * fractions will not shrink below its content's min-content width, and
             * the terminal's own markup (an absolutely positioned xterm viewport
             * inside a `width: 100%` wrapper) has a min-content width that is much
             * larger than it looks. That is what pushes the details column off the
             * right edge of a narrow window - the `minmax(0, …)` is what lets the
             * track actually shrink.
             */}
            <div className={'pt-console-grid'}>
                <div className={'pt-console-main'}>
                    <Spinner.Suspense>
                        <Console />
                    </Spinner.Suspense>
                </div>
                <ServerDetailsBlock className={'pt-console-side order-last lg:order-none'} />
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
