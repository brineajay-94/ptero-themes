import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog, faPlay, faServer, faStop, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
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
 * WHY ONLY SOFTWARE AND VERSION ARE HERE
 * -------------------------------------
 * Software, version, CPU and memory were all removed from this block in 1.16.5,
 * on the grounds that Software repeated the Startup page and cost a request to
 * fetch. That reasoning was right about the OLD layout, where these were two
 * full-width labelled ROWS with their own borders and their own "Change" buttons
 * - three stacked blocks, each the width of the page, for a value the user reads
 * once. As small chips on one line under the name they are a different
 * proposition entirely: a spec line, the thing a server owner's eye goes to first.
 * So `serverVersionLabel()` is back, and so is the egg request - both scoped to
 * this component so nothing else on the page depends on them.
 *
 * CPU and memory are NOT back, and they are the two that were wrong to put here.
 * They are live numbers, so a stopped server has none, and the honest rendering
 * of "no number" was an em dash: a header reading `CPU —  Memory —` under a
 * server name, which looks like a failed read rather than a stopped server. The
 * same two values are on the page already, as cards in the column beside the
 * terminal, where they print `Offline` in words when the server is stopped and
 * carry a bar the moment they start moving. One copy of a number, in the place
 * that can actually show it, beats two copies where one of them can only ever be
 * a dash - and it drops a second subscription to the stats socket as well.
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

    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const [confirmingKill, setConfirmingKill] = useState(false);
    const [eggName, setEggName] = useState<string | null>(null);

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

    // The chips, in the order the reference prints them: what it runs, then which
    // version. Nothing live goes here - see the note at the top of the file.
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
