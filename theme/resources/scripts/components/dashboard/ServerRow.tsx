import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faStop, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState } from '@/api/server/getServerResourceUsage';
import { serverFamilyLabel } from '@/lib/serverFamily';
import http from '@/api/http';

/** What the card shows about power, which is not the same as the API's states. */
type CardPower = 'running' | 'stopped' | 'busy' | 'offline';

const busy = (server: Server) =>
    server.status === 'installing' || server.status === 'restoring_backup' || !!server.isTransferring;

/**
 * Start or stop a server.
 *
 * Deliberately the shared `http` client rather than a per-server API module. The
 * panel's own `api/server/sendPowerAction` is not present on every version in
 * this theme's supported range, and importing it made the production build fail
 * outright with "Module not found" - a hard error at build time, not a runtime
 * one. `http` is imported by AppShell and ServerRouter already, so it resolves
 * wherever the theme works at all, and the client power endpoint
 * (`POST /api/client/servers/{uuid}/power` with a `signal`) is the most stable
 * part of the client API.
 */
const sendPower = (uuid: string, signal: 'start' | 'stop') => http.post(`/api/client/servers/${uuid}/power`, { signal });

/**
 * One server, as a card in the reference's two-column grid.
 *
 * This replaced a full-width row carrying live CPU / memory / disk bars. The
 * reference's card is much quieter - name, uuid, software, and a power button -
 * and those bars were why a scrolling list of these was expensive to render as
 * well as why it read as a data table rather than a list of servers. The numbers
 * are still available one click away on the server's own page.
 *
 * The card is a single <Link>, as the row was. The power button is inside it, so
 * it stops propagation - otherwise clicking it would navigate as well as fire.
 *
 * `eggName` is passed in rather than fetched here, because the answer is one
 * request for the whole dashboard - see `api/server/eggs`. It is optional so the
 * card still renders (and still says something true) before that request lands.
 */
const ServerRow = ({
    server,
    className,
    eggName,
}: {
    server: Server;
    className?: string;
    eggName?: string | null;
}) => {
    const interval = useRef<ReturnType<typeof setInterval>>(null) as React.MutableRefObject<
        ReturnType<typeof setInterval>
    >;
    const [power, setPower] = useState<CardPower>(() => (busy(server) ? 'busy' : 'offline'));
    const [pending, setPending] = useState(false);

    // Suspended and node-maintenance servers have no live stats to poll, and
    // asking anyway just fills the panel log with errors.
    const pollable = server.status !== 'suspended' && !server.isNodeUnderMaintenance;

    useEffect(() => {
        if (!pollable) {
            setPower(busy(server) ? 'busy' : 'offline');

            return;
        }

        let cancelled = false;
        const read = () =>
            getServerResourceUsage(server.uuid)
                .then((data: { status: ServerPowerState }) => {
                    if (cancelled || pending) return;
                    setPower(data.status === 'running' ? 'running' : 'stopped');
                })
                .catch((error) => console.error(error));

        read().then(() => {
            interval.current = setInterval(read, 30000);
        });

        return () => {
            cancelled = true;
            interval.current && clearInterval(interval.current);
        };
        // `pending` is deliberately absent: including it would tear down and
        // rebuild the 30s timer on every press of the button.
    }, [pollable, server.status, server.isNodeUnderMaintenance, server.isTransferring]);

    // Flip locally the moment the press lands rather than waiting up to 30s for
    // the poll, then let the poll correct it if the daemon disagrees.
    const toggle = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (pending || power === 'busy' || power === 'offline') return;

            const next: CardPower = power === 'running' ? 'stopped' : 'running';
            setPending(true);
            setPower(next);

            sendPower(server.uuid, next === 'running' ? 'start' : 'stop')
                .then(() => getServerResourceUsage(server.uuid).then((data) => setPower(data.status === 'running' ? 'running' : 'stopped')))
                .catch((error) => {
                    console.error(error);
                    // Roll the optimistic flip back - the daemon refused it.
                    setPower(power === 'running' ? 'running' : 'stopped');
                })
                .finally(() => setPending(false));
        },
        [pending, power, server.uuid]
    );

    // What goes on the third line, in descending order of certainty.
    //
    // 1. The egg name, from the theme's own endpoint. This is the answer, and it
    //    is a real one: the panel does not send the egg name on the servers list
    //    at all (ServerTransformer returns neither a name nor an id, and the
    //    egg relationship needs `?include=egg`, which ServerController::index
    //    never asks for), so the card used to read `server.eggName ||
    //    server.egg` and print "No egg assigned" when both were missing - which
    //    was always, on every server on the panel.
    // 2. The family, from the egg's variable names. A guess at a coarser grain
    //    than the name, and a real one rather than nothing: Paper, Spigot and
    //    Purpur all look identical here, which is why it is only a fallback.
    // 3. The node name, which the transformer always sends.
    //
    // Step 3 is not theoretical: `includeVariables()` returns a null RESOURCE for
    // a subuser without ACTION_STARTUP_READ, so their variables relationship is
    // absent rather than empty. And steps 1 and 2 are both absent for a server
    // that genuinely has no egg, which is what an explicit null from the
    // endpoint means.
    const detail = eggName || serverFamilyLabel(server.variables) || server.node;

    const canToggle = power === 'running' || power === 'stopped';
    const label =
        power === 'running' ? 'Stop this server' : power === 'stopped' ? 'Start this server' : 'Power state unavailable';

    return (
        <Link to={`/server/${server.id}`} className={`pt-server-card ${className || ''}`} data-power={power}>
            <span className={'pt-server-accent'} aria-hidden={'true'} />

            <span className={'pt-server-body'}>
                <span className={'pt-server-name'}>{server.name}</span>
                <span className={'pt-server-uuid'}>{server.uuid}</span>
                <span className={'pt-server-egg'} title={detail}>
                    <FontAwesomeIcon icon={faServer} aria-hidden={'true'} />
                    {detail}
                </span>
            </span>

            <button
                type={'button'}
                className={'pt-server-power'}
                onClick={toggle}
                disabled={!canToggle || pending}
                aria-label={label}
                title={label}
            >
                <FontAwesomeIcon icon={power === 'running' ? faStop : faPlay} aria-hidden={'true'} />
            </button>
        </Link>
    );
};

export default memo(ServerRow);
