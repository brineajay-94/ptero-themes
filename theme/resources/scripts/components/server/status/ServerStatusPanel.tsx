import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog, faPlay, faStop, faSyncAlt, faTag } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import { Dialog } from '@/components/elements/dialog';
import getServerEggs from '@/api/server/eggs';
import { serverVersionLabel } from '@/lib/serverFamily';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

/** The panel's own power vocabulary, restated rather than imported. */
type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';

type IconProp = React.ComponentProps<typeof FontAwesomeIcon>['icon'];

/**
 * The status block at the top of a server page: what it runs, what version, and
 * the power controls.
 *
 * ORDER, AND WHY IT IS NOT THE REFERENCE'S ORDER
 * ----------------------------------------------
 * The reference reads top to bottom as address card, status bar, banner, Start,
 * then Address / Software / Version. This is: SOFTWARE and VERSION first, then the
 * power buttons, and the address moved down beside the console.
 *
 * The address was the odd one out up here - it is the thing a PLAYER needs, and
 * the player is looking at the console, not at a heading - while Software and
 * Version are the things an OWNER checks before touching anything. They are also
 * the two rows that carry an action, and an action is worth more next to the power
 * controls than stranded above them. There is no Connect button: Aternos's Connect
 * opens a launcher dialog and this panel has nothing to launch, so it went rather
 * than becoming a button that quietly copies something.
 *
 * WHAT THE REFERENCE GOT AND WHAT IT DIDN'T
 * -----------------------------------------
 *   Blue RAM-boost banner      DROPPED. It is Aternos selling an upgrade; on this
 *                              panel it advertises a product that does not exist.
 *   One large Start            Start and Stop, with Restart and Forcibly-stop
 *                              beside them in the SAME treatment. The reference
 *                              shows only Start, but these are four signals the
 *                              panel offers and the second row of tiny square
 *                              icons it was replaced with read as a different,
 *                              lesser class of action than the one beside them.
 *   Software -> Change         Only for a root admin, to the admin Software tab.
 *                              Changing the egg is an admin action here -
 *                              updateBuild takes allocations and limits and no
 *                              egg_id - so for anyone else there is NO button.
 *                              A button that goes nowhere is the same failure as
 *                              the "No egg assigned" string this theme shipped
 *                              once.
 *   Version -> Change          Always, to the panel's Startup page, which is
 *                              genuinely where a user changes these values.
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
    const variables = ServerContext.useStoreState((state) => state.server.data!.variables);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const [confirmingKill, setConfirmingKill] = useState(false);
    const [eggName, setEggName] = useState<string | null>(null);

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
            {/*
             * Software and Version first, as full-width labelled blocks. These
             * are the two facts an owner checks before touching anything, and
             * both carry an action - which is worth having next to the power
             * controls rather than stranded above them.
             */}
            <div className={'pt-sv-rows pt-sv-rows-top'}>
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

            {/*
             * The status band, and then the power controls. A live region, on
             * purpose: the state changes on a socket push, with no navigation and
             * no focus move, which is exactly what role="status" is for.
             */}
            <div className={`pt-sv-status is-${kind}`} role={'status'} aria-live={'polite'}>
                <span className={'pt-sv-dot'} aria-hidden={'true'} />
                <span>{statusLabel(status)}</span>
            </div>

            {/*
             * All four signals in one treatment. They were a large Start with two
             * small square icons beside it, and the two sizes read as two
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

            {/*
             * The address, the live usage card and the panel's uptime/resource
             * details all moved DOWN beside the console, into
             * ServerConsoleContainer. What is left here is what belongs above it:
             * what the server runs, what version, and the power controls. The
             * address in particular is the thing a PLAYER wants, and the player is
             * reading the console.
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