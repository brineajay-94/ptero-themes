import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog, faCopy, faPlug, faPowerOff, faStop, faSyncAlt, faTag } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { Dialog } from '@/components/elements/dialog';
import getServerEggs from '@/api/server/eggs';
import getServerResourceUsage from '@/api/server/getServerResourceUsage';
import { serverVersionLabel } from '@/lib/serverFamily';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

/** The panel's own power vocabulary, restated rather than imported. */
type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';

type IconProp = React.ComponentProps<typeof FontAwesomeIcon>['icon'];

/**
 * The Aternos-style status block at the top of a server's page.
 *
 * WHAT IS IN THE REFERENCE, AND WHAT HAPPENS TO IT HERE
 * ---------------------------------------------------
 *   Address card + "Connect"  Kept. The heading is the server's address, and the
 *                             button copies it - Aternos's Connect opens a
 *                             launcher dialog and this panel has nothing to
 *                             launch, so the title says "copy" rather than the
 *                             button pretending to open something.
 *   Full-width status bar     Kept, and it is the one thing here that has to be
 *                             right: red for offline, green for running, amber
 *                             while it is changing state.
 *   Green Start button        Kept as the primary action, becoming a red Stop
 *                             when the server is up. Restart and Forcibly-stop
 *                             sit beside it as small buttons - the reference
 *                             shows only Start, but dropping restart and kill
 *                             would take away what the panel's own power
 *                             controls offer.
 *   Blue RAM-boost banner     DROPPED. It is Aternos selling an upgrade; here
 *                             it would advertise a product that does not exist.
 *   Address / Software /      Kept. Address from the server's allocation,
 *   Version rows              Software from /auth/servers/eggs (the panel's own
 *                             server payload carries no egg name), Version from
 *                             the egg's variables.
 *   "Change" buttons          Rendered only where they lead somewhere, which is
 *                             the whole point. Software is an egg change: this
 *                             panel's updateBuild takes allocations and limits
 *                             and no egg_id, so it is an admin action and the
 *                             button appears for a root admin pointing at the
 *                             admin Software tab, and for anyone else there is
 *                             no button. Version is different - the panel's
 *                             Startup page is exactly where a user changes
 *                             these values - so that one is always there.
 *   Empty left card           Filled with live CPU / memory / disk rather than
 *                             left blank.
 *
 * WHY POWER GOES OVER THE SOCKET
 * -----------------------------
 * The panel's own PowerButtons use `socket.send('set state', action)`, and the
 * socket is already open here carrying live resource stats. An HTTP call would be
 * a second channel to the same daemon and would throw away the state the socket
 * pushes back.
 */

const statusKind = (status?: string): 'online' | 'busy' | 'offline' => {
    if (status === 'running') return 'online';
    if (status === 'starting' || status === 'stopping') return 'busy';

    return 'offline';
};

const statusLabel = (status?: string): string => {
    if (status === 'running') return 'Running';
    if (status === 'starting') return 'Starting';
    if (status === 'stopping') return 'Stopping';

    return 'Offline';
};

/** Bytes as the largest unit that still leaves a readable number. */
const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) return '0 B';

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }

    return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

/**
 * One labelled row: the label on a tab sitting on the value's edge, the value
 * beside it, and an optional action at the far end.
 *
 * Not a `<dl>`: the reference's shape is a tab ON the value's edge rather than a
 * label above it, and the value carries a copy target with a button in it - a
 * paragraph, not a `<dd>`. Putting a button inside a `<dd>` is valid, but the
 * label-then-value ordering of a description list fights this layout, so the
 * association is carried by the text itself and the wrapper.
 */
const Row: React.FC<{ label: string; icon: IconProp; children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className={'pt-sv-row'}>
        <span className={'pt-sv-row-label'}>
            <FontAwesomeIcon icon={icon} aria-hidden={'true'} />
            <span>{label}</span>
        </span>
        <div className={'pt-sv-row-body'}>{children}</div>
    </div>
);

const ServerStatusPanel: React.FC = () => {
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);

    const internalId = ServerContext.useStoreState((state) => state.server.data!.internalId);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations);
    const variables = ServerContext.useStoreState((state) => state.server.data!.variables);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const [confirmingKill, setConfirmingKill] = useState(false);
    const [eggName, setEggName] = useState<string | null>(null);
    const [usage, setUsage] = useState<{ cpu: number; memory: number; disk: number } | null>(null);

    // The primary allocation. `isDefault` is the panel's own flag for it; the
    // fallback to the first entry is because a server mid-transfer can have none
    // marked, and the first allocation is still the one the panel shows as the
    // address elsewhere.
    const primary = allocations?.find((allocation) => allocation.isDefault) || allocations?.[0];
    const address = primary ? `${primary.ip}:${primary.port}` : '';

    // The egg name. The server payload carries none, so this is the only source,
    // and a failure leaves the row on its fallback rather than taking the page
    // down - there is nothing to fall back to but the family from the variables.
    useEffect(() => {
        if (!uuid) {
            setEggName(null);
            return;
        }

        let active = true;

        getServerEggs()
            .then((eggs) => {
                if (active) setEggName(eggs[uuid] ?? null);
            })
            .catch(() => {
                if (active) setEggName(null);
            });

        return () => {
            active = false;
        };
    }, [uuid]);

    // Live usage for the left card. Polled, because the card IS a usage card.
    // Skipped entirely while the server is offline - the daemon has nothing to
    // report and asking anyway only fills the panel log, which is the same
    // complaint the jar-flavour probe raises.
    useEffect(() => {
        if (!uuid || status !== 'running') {
            setUsage(null);
            return;
        }

        let active = true;

        const read = () =>
            getServerResourceUsage(uuid)
                .then((stats) => {
                    if (active) {
                        setUsage({
                            cpu: stats.cpuUsagePercent,
                            memory: stats.memoryUsageInBytes,
                            disk: stats.diskUsageInBytes,
                        });
                    }
                })
                // The daemon can refuse mid-restart. Leave the card on its last
                // reading rather than blanking it on one failed poll.
                .catch(() => undefined);

        read();
        const timer = setInterval(read, 10000);

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [uuid, status]);

    const send = (signal: PowerSignal) => {
        setConfirmingKill(false);

        if (instance) {
            instance.send('set state', signal);
        }
    };

    const version = serverVersionLabel(variables || []);
    const kind = statusKind(status);
    const isRunning = kind === 'online';
    const isBusy = kind === 'busy';
    const locked = isInstalling || isTransferring || isNodeUnderMaintenance;

    return (
        <div className={'pt-sv'}>
            <div className={'pt-sv-hero'}>
                <h1 className={'pt-sv-host'} title={address || undefined}>
                    {address || 'No allocation assigned'}
                </h1>

                {address && (
                    <CopyOnClick text={address}>
                        <button type={'button'} className={'pt-sv-connect'} title={'Copy the address to your clipboard'}>
                            <FontAwesomeIcon icon={faPlug} aria-hidden={'true'} />
                            <span>Connect</span>
                        </button>
                    </CopyOnClick>
                )}
            </div>

            {/*
             * A live region on purpose: the state changes on a socket push, with
             * no navigation and no focus move, which is exactly what
             * role="status" is for.
             */}
            <div className={`pt-sv-status is-${kind}`} role={'status'} aria-live={'polite'}>
                <span className={'pt-sv-dot'} aria-hidden={'true'} />
                <span>{statusLabel(status)}</span>
            </div>

            <div className={'pt-sv-power'}>
                <Can action={['control.start', 'control.stop']} matchAny>
                    <button
                        type={'button'}
                        className={`pt-sv-power-btn ${isRunning ? 'is-stop' : 'is-start'}`}
                        // Offline is the only state Start means anything in, and a
                        // state already in flight would be refused by the daemon.
                        disabled={isBusy || locked}
                        onClick={() => send(isRunning ? 'stop' : 'start')}
                    >
                        <FontAwesomeIcon icon={isRunning ? faStop : faPowerOff} aria-hidden={'true'} />
                        <span>{isRunning ? 'Stop' : 'Start'}</span>
                    </button>
                </Can>

                <div className={'pt-sv-power-alt'}>
                    <Can action={'control.restart'}>
                        <button
                            type={'button'}
                            className={'pt-sv-icon-btn'}
                            disabled={!isRunning || locked}
                            onClick={() => send('restart')}
                            title={'Restart this server'}
                            aria-label={'Restart this server'}
                        >
                            <FontAwesomeIcon icon={faSyncAlt} aria-hidden={'true'} />
                        </button>
                    </Can>

                    <Can action={'control.stop'}>
                        <button
                            type={'button'}
                            className={'pt-sv-icon-btn is-danger'}
                            disabled={!isRunning || locked}
                            onClick={() => setConfirmingKill(true)}
                            title={'Forcibly stop this server'}
                            aria-label={'Forcibly stop this server'}
                        >
                            <FontAwesomeIcon icon={faBolt} aria-hidden={'true'} />
                        </button>
                    </Can>
                </div>

                {locked && (
                    <p className={'pt-sv-locked'}>
                        {isNodeUnderMaintenance
                            ? 'The node is under maintenance, so power controls are unavailable.'
                            : isInstalling
                            ? 'The server is installing, so power controls are unavailable.'
                            : 'The server is being transferred, so power controls are unavailable.'}
                    </p>
                )}
            </div>

            <div className={'pt-sv-grid'}>
                <div className={'pt-sv-usage'}>
                    {usage ? (
                        <dl className={'pt-sv-usage-list'}>
                            <div>
                                <dt>CPU</dt>
                                <dd>{usage.cpu.toFixed(1)}%</dd>
                            </div>
                            <div>
                                <dt>Memory</dt>
                                <dd>{formatBytes(usage.memory)}</dd>
                            </div>
                            <div>
                                <dt>Disk</dt>
                                <dd>{formatBytes(usage.disk)}</dd>
                            </div>
                        </dl>
                    ) : (
                        <p className={'pt-sv-usage-empty'}>
                            {isRunning
                                ? 'Reading resource usage...'
                                : 'Resource usage appears while the server is running.'}
                        </p>
                    )}
                </div>

                <div className={'pt-sv-rows'}>
                    <Row label={'Address'} icon={faPlug}>
                        <span className={'pt-sv-row-value'}>{address || 'No allocation assigned'}</span>
                        {/*
                         * CopyOnClick does the copy AND the confirmation, and it
                         * clones its child's onClick over its own - so this button
                         * carries no click handler of its own. It used to, to flip
                         * the label to "Copied", which meant two independent
                         * confirmation mechanisms racing each other for the same
                         * click: the panel's toast and a label that could go stale
                         * if the component unmounted inside its own timeout.
                         */}
                        {address && (
                            <CopyOnClick text={address}>
                                <button type={'button'} className={'pt-sv-row-btn is-primary'}>
                                    <FontAwesomeIcon icon={faCopy} aria-hidden={'true'} />
                                    <span>Copy</span>
                                </button>
                            </CopyOnClick>
                        )}
                    </Row>

                    <Row label={'Software'} icon={faCog}>
                        <span className={'pt-sv-row-value'}>{eggName || 'Unknown'}</span>
                        {rootAdmin && internalId !== undefined && internalId !== null && (
                            <a
                                className={'pt-sv-row-btn is-success'}
                                href={`/admin/servers/view/${internalId}/software`}
                                target={'_blank'}
                                rel={'noreferrer'}
                            >
                                <FontAwesomeIcon icon={faCog} aria-hidden={'true'} />
                                <span>Change</span>
                            </a>
                        )}
                    </Row>

                    <Row label={'Version'} icon={faTag}>
                        <span className={'pt-sv-row-value'}>{version || 'Not set by this software'}</span>
                        <Link className={'pt-sv-row-btn is-success'} to={`/server/${internalId}/startup`}>
                            <FontAwesomeIcon icon={faTag} aria-hidden={'true'} />
                            <span>Change</span>
                        </Link>
                    </Row>
                </div>
            </div>

            <Dialog.Confirm
                open={confirmingKill}
                hideCloseIcon
                onClose={() => setConfirmingKill(false)}
                title={'Forcibly Stop Process'}
                confirm={'Continue'}
                onConfirmed={() => send('kill')}
            >
                Forcibly stopping a server can lead to data corruption.
            </Dialog.Confirm>
        </div>
    );
};

export default ServerStatusPanel;