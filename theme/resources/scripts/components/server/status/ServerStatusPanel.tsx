import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faPlay, faStop, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import { Dialog } from '@/components/elements/dialog';

/**
 * The power controls at the top of a server page, and the state they act on.
 *
 * THIS IS ALL IT IS NOW
 * ---------------------
 * It used to be more. It carried the address as a heading with a Connect button,
 * then a Software row and a Version row, then the power buttons. All three are
 * gone, at the requester's instruction, and the removals were not only cosmetic:
 *
 *   The Connect button opened a launcher dialog on the reference and has no
 *   equivalent here, so it was a button that quietly copied something.
 *   Software and Version repeated what the console's own Startup page says, and
 *   the egg name cost a request to fetch (GET /auth/servers/eggs) plus a state
 *   hook and a fallback chain, for a label. Removing them also removed that
 *   request from every console page load.
 *
 * What remains is the one thing the block was ever for: is the server running,
 * and the four things you can do about it. Nothing here reads the app store or
 * fetches anything, so it cannot fail in a way that takes the page with it.
 *
 * ORDER: THE BUTTONS ARE FIRST, THE STATUS BAND UNDER THEM. The first thing on
 * the page is what you can do; the second is what state you are in.
 *
 * WHY FOUR BUTTONS IN ONE TREATMENT
 * -------------------------------
 * The reference shows only Start. These are four signals the panel offers, and
 * they were a large Start with Restart and Kill as two small square icons beside
 * it - two sizes, which read as two different classes of action when they are the
 * same class. Colour carries the difference now: green start, red stop/kill,
 * blue restart, so the shape stays uniform and only the hue says which.
 *
 * WHY POWER GOES OVER THE SOCKET
 * -----------------------------
 * The panel's own PowerButtons use `socket.send('set state', action)`, and the
 * socket is already open here carrying live resource stats. An HTTP call would be
 * a second channel to the same daemon and would throw away the state the socket
 * pushes back.
 */

/** The panel's own power vocabulary, restated rather than imported. */
type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';

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
    if (status === 'running') return 'Running';
    if (status === 'starting') return 'Starting';
    if (status === 'stopping') return 'Stopping';

    return 'Offline';
};


const ServerStatusPanel: React.FC = () => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const [confirmingKill, setConfirmingKill] = useState(false);

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

    return (
        <div className={'pt-sv'}>
            {/*
             * THE POWER BUTTONS COME FIRST, before anything else on the page.
             *
             * The Software and Version rows that used to sit here are gone, at
             * the requester's instruction - they repeated what the console's own
             * Startup page says, and the egg name cost a request to fetch. The
             * address row above the terminal is gone too. What is left is the one
             * thing this block is for: whether the server is running, and the
             * four things you can do about it.
             *
             * All four in one treatment. They were a large Start with Restart and
             * Kill as two small square icons beside it, and two sizes read as two
             * different classes of action when they are the same class: any of
             * them that the panel exposes.
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

            {/*
             * The status band, under the buttons it describes rather than above
             * them, so the first thing on the page is what you can do and the
             * second is what state you are in.
             *
             * A live region on purpose: the state changes on a socket push, with
             * no navigation and no focus move, which is exactly what
             * role="status" is for.
             */}
            <div className={`pt-sv-status is-${kind}`} role={'status'} aria-live={'polite'}>
                <span className={'pt-sv-dot'} aria-hidden={'true'} />
                <span>{statusLabel(status)}</span>
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
