import React, { useEffect, useMemo, useState } from 'react';
import {
    faClock,
    faHdd,
    faLink,
    faMemory,
    faMicrochip,
    faWifi,
} from '@fortawesome/free-solid-svg-icons';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import UptimeDuration from '@/components/server/UptimeDuration';
import StatBlock, { StatTone } from '@/components/server/console/StatBlock';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import classNames from 'classnames';
import { capitalize } from '@/lib/strings';

import BeforeInformation from '@blueprint/components/Server/Terminal/BeforeInformation';
import AfterInformation from '@blueprint/components/Server/Terminal/AfterInformation';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime' | 'rx' | 'tx', number>;

/**
 * The panel's stock threshold colouring, kept as a TONE rather than a class.
 *
 * The stock version returned Tailwind background classes (`bg-red-500`) to paint
 * behind the icon. `StatBlock` now takes a tone instead, because a light card
 * wants a pale tinted square and a coloured bar rather than a saturated fill -
 * but the thresholds themselves are the panel's, not the theme's, and they are
 * worth keeping: 80% to warn and 90% to shout is a judgement about how much
 * headroom a server has, and it does not change because the card got prettier.
 */
const pressureTone = (value: number, max: number | null | undefined): StatTone => {
    const delta = !max ? 0 : value / max;

    if (delta > 0.9) return 'red';
    if (delta > 0.8) return 'amber';

    return 'blue';
};

const Limit = ({ limit, children }: { limit: string | null; children: React.ReactNode }) => (
    <>
        {children}
        <span className={'text-gray-400 text-[80%] select-none'}> / {limit || <>&infin;</>}</span>
    </>
);

/**
 * The column of statistics beside the console.
 *
 * SIX CARDS, AND WHY THE STOCK SEVEN ARE NOT WHAT IS HERE
 * -------------------------------------------------------
 * The stock block renders Network Inbound and Network Outbound as two separate
 * cards. The reference has one Network card showing a throughput figure, and the
 * merge is not only cosmetic:
 *
 *   - Two cards for one metric makes the column seven tall and pushes the
 *     remaining cards below a shorter fold, on a panel whose page is already
 *     taller than most people scroll.
 *   - The numbers are CUMULATIVE byte counts. `network.tx_bytes` is bytes sent
 *     since the process started, so printing it in a card labelled Network, next
 *     to a Memory card in MB, invites reading it as a current rate. It is not
 *     one. This card prints bytes per second, derived from the delta between two
 *     stats frames, which is what the word on the card then actually means.
 *
 * That derivation needs the previous frame, so this component keeps one in a ref.
 * The first frame after a socket connect has nothing to subtract from, so it
 * reports 0 rather than the cumulative total - a wrong number that looks
 * plausible is worse than a zero that is merely uninteresting for two seconds.
 *
 * `col-span` here is a 6-column grid that the console page places beside the
 * terminal from `lg` up and below it below that, which is where the reference
 * stacks the two. Below `lg` each card is a full row; from `lg` they are two per
 * row, which keeps the column from becoming six very short wide cards beside a
 * tall terminal.
 */
const ServerDetailsBlock = ({ className }: { className?: string }) => {
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0, tx: 0, rx: 0 });
    const [throughput, setThroughput] = useState(0);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : null,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : null,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : null,
        }),
        [limits]
    );

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data!.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    // The previous frame, for the throughput delta. A ref rather than state: this
    // value is only ever read while handling the NEXT frame, and putting it in
    // state would re-render the column on every push just to store a number
    // nothing displays.
    const previous = React.useRef<{ total: number; at: number } | null>(null);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        const next = {
            memory: stats.memory_bytes,
            cpu: stats.cpu_absolute,
            disk: stats.disk_bytes,
            tx: stats.network.tx_bytes,
            rx: stats.network.rx_bytes,
            uptime: stats.uptime || 0,
        };

        setStats(next);

        // Both directions, because "Network" on a card means the wire, not one
        // half of it. `rx + tx` rather than the max of the two: a card showing
        // the larger single direction understates a busy server, and the label
        // does not say which direction it is showing.
        const total = next.tx + next.rx;
        const now = Date.now();
        const last = previous.current;

        if (last) {
            // The elapsed time is clamped to a second at the bottom. A socket
            // reconnect delivers two frames back to back, and dividing by the
            // real (near-zero) interval produces a rate in the gigabytes that
            // then decays over the next few pushes - a visible spike of nonsense
            // every time the connection drops.
            const seconds = Math.max(1, (now - last.at) / 1000);
            const delta = Math.max(0, total - last.total);

            setThroughput(Math.round(delta / seconds));
        }

        previous.current = { total, at: now };
    });

    // A stopped server has no stats, so every derived number would be a stale
    // zero from before the last stop. Treating "not running" as unknown is the
    // honest reading, and it matches what the CPU and memory cards already do.
    const offline = status === 'offline' || status === null;

    return (
        <div className={classNames('grid grid-cols-6 gap-2 md:gap-3', className)}>
            <BeforeInformation />

            {/* The address is the one card with no bar: it is not a quantity, and
                a bar under it would imply a proportion of something. The copy
                button replaces it, and it is the only card whose value is worth
                copying without selecting it by hand. */}
            <StatBlock icon={faLink} title={'Address'} copyOnClick={allocation === 'n/a' ? undefined : allocation}>
                {allocation}
            </StatBlock>

            {/* Red when the server is not running, which is the reference's own
                choice and the only saturated card on the page - it is meant to be
                the thing that catches the eye when something is wrong. */}
            <StatBlock
                icon={faClock}
                title={'Uptime'}
                tone={status === 'running' ? 'blue' : 'red'}
            >
                {status === null ? (
                    'Offline'
                ) : stats.uptime > 0 ? (
                    <UptimeDuration uptime={stats.uptime / 1000} />
                ) : (
                    capitalize(status)
                )}
            </StatBlock>

            <StatBlock
                icon={faMicrochip}
                title={'CPU Load'}
                tone={pressureTone(stats.cpu, limits?.cpu)}
                progress={offline ? null : Math.min(1, stats.cpu / 100)}
            >
                {offline ? (
                    <span className={'text-gray-400'}>Offline</span>
                ) : (
                    <Limit limit={textLimits.cpu}>{stats.cpu.toFixed(2)}%</Limit>
                )}
            </StatBlock>

            <StatBlock
                icon={faMemory}
                title={'Memory'}
                tone={pressureTone(stats.memory / 1024, limits?.memory)}
                progress={offline || !limits?.memory ? null : Math.min(1, stats.memory / mbToBytes(limits.memory))}
            >
                {offline ? (
                    <span className={'text-gray-400'}>Offline</span>
                ) : (
                    <Limit limit={textLimits.memory}>{bytesToString(stats.memory)}</Limit>
                )}
            </StatBlock>

            <StatBlock
                icon={faHdd}
                title={'Disk'}
                tone={pressureTone(stats.disk / 1024, limits?.disk)}
                progress={offline || !limits?.disk ? null : Math.min(1, stats.disk / mbToBytes(limits.disk))}
            >
                <Limit limit={textLimits.disk}>{bytesToString(stats.disk)}</Limit>
            </StatBlock>

            <StatBlock icon={faWifi} title={'Network'} tone={'blue'}>
                {offline ? <span className={'text-gray-400'}>Offline</span> : `${bytesToString(throughput)}/s`}
            </StatBlock>

            <AfterInformation />
        </div>
    );
};

export default ServerDetailsBlock;