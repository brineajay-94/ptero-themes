import React, { memo } from 'react';
import { ServerContext } from '@/state/server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faPlug } from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import CopyOnClick from '@/components/elements/CopyOnClick';
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
 * The console, under the status panel.
 *
 * The power controls and the status chip MOVED into ServerStatusPanel, which sits
 * above, because the reference has one large Start that both states the server's
 * condition and offers to change it - a chip plus a row of buttons told the same
 * thing twice on one screen. `PowerButtons` is kept and still imported elsewhere
 * in the panel; nothing was deleted.
 *
 * The ADDRESS came down here too, above the console and beside
 * `ServerDetailsBlock` (which carries uptime, CPU, memory, disk and network).
 * Those two belong together: one is where you connect, the other is how the thing
 * is doing. It used to sit at the very top of the page as a heading, which is the
 * one place nobody looks while reading console output.
 */
const ServerConsoleContainer = () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const description = ServerContext.useStoreState((state) => state.server.data!.description);
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    // The primary allocation. `isDefault` is the panel's own flag for it; the
    // fallback to the first entry covers a server mid-transfer, which can have
    // none marked, while the first allocation is still the one shown elsewhere.
    const primary = allocations?.find((allocation) => allocation.isDefault) || allocations?.[0];
    const address = primary ? `${primary.ip}:${primary.port}` : '';

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

            <div className={'pt-console-sub'}>
                <p className={'pt-hero-eyebrow'}>Server console</p>
                <h1>{name}</h1>
                {description && <p className={'pt-console-desc'}>{description}</p>}
            </div>

            <div className={'grid grid-cols-4 gap-2 sm:gap-4 mb-4'}>
                <div className={'flex col-span-4 lg:col-span-3'}>
                    {/* The address, as a row above the terminal. It is the one
                        fact a player needs and the terminal is where a player
                        looks; `CopyOnClick` does the copy AND the confirmation. */}
                    {address && (
                        <div className={'pt-sv-row pt-console-address'}>
                            <span className={'pt-sv-row-label'}>
                                <FontAwesomeIcon icon={faPlug} aria-hidden={'true'} />
                                <span>Address</span>
                            </span>
                            <div className={'pt-sv-row-body'}>
                                <span className={'pt-sv-row-value'}>{address}</span>
                                <CopyOnClick text={address}>
                                    <button type={'button'} className={'pt-sv-row-btn is-primary'}>
                                        <FontAwesomeIcon icon={faCopy} aria-hidden={'true'} />
                                        <span>Copy</span>
                                    </button>
                                </CopyOnClick>
                            </div>
                        </div>
                    )}

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
