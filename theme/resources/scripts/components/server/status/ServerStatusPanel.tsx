import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBolt,
    faCog,
    faMemory,
    faMicrochip,
    faPlay,
    faServer,
    faStop,
    faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import Can from '@/components/elements/Can';
import { Dialog } from '@/components/elements/dialog';
import getServerEggs from '@/api/server/eggs';
import { serverFamilyLabel, serverVersionLabel } from '@/lib/serverFamily';

/** The panel's own power vocabulary, restated rather than imported. */
type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';

/**
 * The server page header: who this server is, what it is running, and the four
 * things you can do to it.
 *
 * THE SHAPE IS THE REFERENCE'S, AND IT IS A TWO-COLUMN HEADER
 * -------------------------------------------------------
 * The identity and its meta row sit on the left; the status band and the power
 * buttons sit on the right, top-aligned with it. That is the reference's layout
 * and it is a good one for a reason worth keeping: the left column is a label
 * ("this is what you are looking at") and the right column is a control surface
 * ("this is what you can do about it"), and a user scanning the top of a server
 * page reads them in that order. Stacking them instead - identity, then status,
 * then buttons, each full width - spends three vertical bands saying two things.
 *
 * WHY THE META CHIPS ARE BACK
 * ---------------------------
 * Software, version, CPU and memory were all removed from this block in 1.16.5,
 * on the grounds that Software repeated the Startup page and cost a request to
 * fetch. That reasoning was right about the OLD layout, where these were two
 * full-width labelled ROWS with their own borders and their own "Change" buttons
 * - three stacked blocks, each the width of the page, for a value the user reads
 * once. As four small chips on one line under the name they are a different
 * proposition entirely: they are a spec line, the thing a server owner's eye goes
 * to first, and they cost one request on a page that already opens a websocket.
 *
 * So `serverVersionLabel()` is back, and so is the egg request - and both are
 * scoped to this component so nothing else on the page depends on them.
 *
 * WHY THE CPU AND MEMORY CHIPS ARE NOT FROM THE DETAILS BLOCK
 * -----------------------------------------------------------
 * They are the same numbers, arriving over the same socket, and they are read
 * here rather than shared because a shared value needs a context provider or a
 * module-level store - and this component is rendered by ServerConsoleContainer
 * while the details block is rendered beside it in a `grid-cols-6` of its own. Two
 * subscriptions to one websocket event is not a cost worth a new abstraction; the
 * panel's own components do exactly this.
 *
 * WHY POWER GOES OVER THE SOCKET
 * -----------------------------
 * The panel's own PowerButtons use `socket.send('set state', action)`, and the
 * socket is already open here carrying live resource stats. An HTTP call would be
 * a second channel to the same daemon and would throw away the state the socket
 * pushes back.
 */

/**
 * `null` is in the type on purpose: `state.status.value` is `ServerStatus`, which
 * includes null, and it is null before the socket's first push - which is the
 * first thing a user sees on a page load. So the unknown case is a real state,
 * not a theoretical one, and it has to render as Offline rather than crash.
 */
const statusKind = (status?: string | null): 'online' | 'busy' | 'offline' => {
    if (status === 'running') return 'online';
    if (status === 'starting' || status === 'stopping') return 'busy';

    return 'offline';
};

const statusLabel = (status?: string | null): string => {
    if (status === 'running') return 'Online';
    if (status === 'starting') return 'Starting';
    if (status === 'stopping') return 'Stopping';

    return 'Offline';
};

/**
 * Megabytes, as a whole number, from a byte count.
 *
 * Deliberately not `bytesToString()`: that switches units as the number grows
 * (1024 MB becomes 1 GB), and a chip reading "0 / 1024 MB" next to a limit the
 * panel also reports in MB cannot become "0 / 1 GB" without the two numbers
 * silently disagreeing about their own units. The limit is in MB too, so both
 * sides of the slash stay in MB.
 */
const toMb = (bytes: number): number => Math.floor(bytes / 1024 / 1024);

/** One of the small facts under the server name: an icon and a value. */
const Chip: React.FC<{ icon: Parameters<typeof FontAwesomeIcon>[0]['icon']; children: React.ReactNode }> = ({
    icon,
    children,
}) => (
    <li className={'pt-sv-chip'}>
        <FontAwesomeIcon icon={icon} className={'pt-sv-chip-icon'} aria-hidden={'true'} />
        <span className={'pt-sv-chip-value truncate'}>{children}</span>
    </li>
);

const ServerStatusPanel: React.FC = () => {
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const variables = ServerContext.useStoreState((state) => state.server.data!.variables);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const [confirmingKill, setConfirmingKill] = useState(false);
    const [eggName, setEggName] = useState<string | null>(null);
    const [stats, setStats] = useState({ cpu: 0, memory: 0 });

    // The egg name. The server payload carries none, so this is the only source,
    // and a failure leaves the chip on its fallback rather than taking the page
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

    // Live CPU and memory for the chips. Same event the details block listens to;
    // see the note at the top of the file about why that is two subscriptions
    // rather than a shared value.
    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let parsed: any = {};

        try {
            parsed = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            cpu: Number(parsed.cpu_absolute) || 0,
            memory: Number(parsed.memory_bytes) || 0,
        });
    });

    const send = (signal: PowerSignal) => {
        setConfirmingKill(false);

        if (instance) {
            instance.send('set state', signal);
        }
    };

    const kind = statusKind(status);
    const isRunning = kind === 'online';
    const isBusy = kind === 'busy';
    const locked = isInstalling || isTransferring || isNodeUnderMaintenance;

    // The chips, in the order the reference prints them: what it runs, which
    // version, then the two numbers that are actually moving.
    //
    // Software is the egg name when the endpoint answered, the family from the
    // egg's variable names when it did not, and the node as a last resort - the
    // panel always sends the node, so this chip is never empty. Version is
    // different: there is genuinely nothing to print for an egg with no
    // version-ish variable, so the chip is dropped rather than filled with a
    // placeholder, which is the same reasoning as the "No egg assigned" string
    // this theme shipped once.
    const software = eggName || serverFamilyLabel(variables || []) || node;
    const version = serverVersionLabel(variables || []);
    const offline = status === 'offline' || status === null;

    return (
        <div className={'pt-sv'}>
            <div className={'pt-sv-head'}>
                <div className={'pt-sv-ident'}>
                    <span className={'pt-sv-mark'} aria-hidden={'true'}>
                        <FontAwesomeIcon icon={faServer} />
                    </span>

                    <div className={'pt-sv-identtext'}>
                        <h1 className={'pt-sv-name truncate'} title={name}>
                            {name}
                        </h1>
                        <span className={`pt-sv-state is-${kind}`}>
                            <span className={'pt-sv-statedot'} aria-hidden={'true'} />
                            {statusLabel(status)}
                        </span>
                    </div>

                    <ul className={'pt-sv-meta'}>
                        <Chip icon={faServer}>{software}</Chip>
                        {version && <Chip icon={faCog}>{version}</Chip>}
                        <Chip icon={faMicrochip}>{offline ? '—' : `${stats.cpu.toFixed(0)}% CPU`}</Chip>
                        <Chip icon={faMemory}>
                            {offline ? '—' : `${toMb(stats.memory)} / ${limits?.memory ?? 0} MB`}
                        </Chip>
                    </ul>
                </div>

                <div className={'pt-sv-actions'}>
                    {/*
                     * The status band, and then the power controls.
                     *
                     * A live region on purpose: the state changes on a socket
                     * push, with no navigation and no focus move, which is exactly
                     * what role="status" is for. The dot inside it is decorative -
                     * the band already carries the word, so the colour is
                     * reinforcement rather than the only carrier of the meaning.
                     */}
                    <div className={`pt-sv-status is-${kind}`} role={'status'} aria-live={'polite'}>
                        <span className={'pt-sv-dot'} aria-hidden={'true'} />
                        <span>{statusLabel(status)}</span>
                    </div>

                    {/*
                     * All four signals in one treatment. They were a large Start
                     * with Restart and Kill as two small square icons beside it,
                     * and two sizes read as two different classes of action when
                     * they are the same class: any of them that the panel exposes.
                     */}
                    <div className={'pt-sv-power'}>
                        <Can action={'control.start'}>
                            <button
                                type={'button'}
                                className={'pt-sv-power-btn is-start'}
                                disabled={isRunning || isBusy || locked}
                                onClick={() => send('start')}
                            >
                                <FontAwesomeIcon icon={faPlay} aria-hidden={'true'} />
                                <span>Start</span>
                            </button>
                        </Can>

                        <Can action={'control.stop'}>
                            <button
                                type={'button'}
                                className={'pt-sv-power-btn is-stop'}
                                disabled={!isRunning || isBusy || locked}
                                onClick={() => send('stop')}
                            >
                                <FontAwesomeIcon icon={faStop} aria-hidden={'true'} />
                                <span>Stop</span>
                            </button>
                        </Can>

                        <Can action={'control.restart'}>
                            <button
                                type={'button'}
                                className={'pt-sv-power-btn is-restart'}
                                disabled={!isRunning || isBusy || locked}
                                onClick={() => send('restart')}
                            >
                                <FontAwesomeIcon icon={faSyncAlt} aria-hidden={'true'} />
                                <span>Restart</span>
                            </button>
                        </Can>

                        <Can action={'control.stop'}>
                            <button
                                type={'button'}
                                className={'pt-sv-power-btn is-kill'}
                                disabled={!isRunning || isBusy || locked}
                                onClick={() => setConfirmingKill(true)}
                            >
                                <FontAwesomeIcon icon={faBolt} aria-hidden={'true'} />
                                <span>Kill</span>
                            </button>
                        </Can>
                    </div>
                </div>
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

            {/*
             * Kill is the one action here that is not undoable, so it confirms.
             * Start, stop and restart do not: they are the everyday controls, and
             * a dialog on every one of them is a dialog people learn to dismiss
             * without reading.
             */}
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