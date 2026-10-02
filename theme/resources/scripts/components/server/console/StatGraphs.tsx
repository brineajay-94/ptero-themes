import React, { useEffect, useRef, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { Line } from 'react-chartjs-2';
import { useChart, useChartTickLabel } from '@/components/server/console/chart';
import { bytesToString } from '@/lib/formatters';
import { ptColor } from '@/lib/theme';
import { CloudDownloadIcon, CloudUploadIcon } from '@heroicons/react/solid';
import { faMemory, faMicrochip, faWifi } from '@fortawesome/free-solid-svg-icons';
import ChartBlock from '@/components/server/console/ChartBlock';
import Tooltip from '@/components/elements/tooltip/Tooltip';

/** The latest reading of each chart, printed in its header beside the title. */
interface Readings {
    cpu: number;
    memoryMb: number;
    throughput: number;
}

export default () => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

    /**
     * The current values, for the card headers.
     *
     * Kept in React state rather than read back out of the chart objects, because
     * `useChart` exposes `props` for the `<Line>` and nothing for "the last value
     * pushed". Reading it out of the chart's internal dataset would work right up
     * until the chart was rebuilt - which happens on every resize - and would
     * leave the header showing a number from a chart that is no longer on screen.
     *
     * `throughput` is bytes per second from the delta between the last two frames,
     * for the same reason the details column's Network card works that way: the
     * socket sends cumulative counters, and a cumulative byte count labelled
     * "Network" reads as a rate.
     */
    const [readings, setReadings] = useState<Readings>({ cpu: 0, memoryMb: 0, throughput: 0 });
    const throughputRef = useRef<{ total: number; at: number } | null>(null);

    const cpu = useChartTickLabel('CPU', limits.cpu, '%', 2);
    const memory = useChartTickLabel('Memory', limits.memory, 'MiB');
    const network = useChart('Network', {
        sets: 2,
        options: {
            scales: {
                y: {
                    ticks: {
                        callback(value) {
                            return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
                        },
                    },
                },
            },
        },
        callback(opts, index) {
            return {
                ...opts,
                label: !index ? 'Network In' : 'Network Out',
                borderColor: !index ? ptColor('cyan-400', '#22d3ee') : ptColor('yellow-400', '#facc15'),
                backgroundColor: !index ? ptColor('cyan-700', '#0e7490', 0.5) : ptColor('yellow-700', '#a16207', 0.5),
            };
        },
    });

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            network.clear();
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }
        cpu.push(values.cpu_absolute);
        memory.push(Math.floor(values.memory_bytes / 1024 / 1024));
        network.push([
            previous.current.tx < 0 ? 0 : Math.max(0, values.network.tx_bytes - previous.current.tx),
            previous.current.rx < 0 ? 0 : Math.max(0, values.network.rx_bytes - previous.current.rx),
        ]);

        previous.current = {
            tx: values.network.tx_bytes,
            rx: values.network.rx_bytes,
        };

        // The same delta the chart plots, summed over both directions, floored at
        // one second - see ServerDetailsBlock for why the elapsed time is clamped.
        const total = values.network.tx_bytes + values.network.rx_bytes;
        const now = Date.now();
        const last = throughputRef.current;

        if (last) {
            const seconds = Math.max(1, (now - last.at) / 1000);

            setReadings({
                cpu: Number(values.cpu_absolute) || 0,
                memoryMb: Math.floor(values.memory_bytes / 1024 / 1024),
                throughput: Math.round(Math.max(0, total - last.total) / seconds),
            });
        }

        throughputRef.current = { total, at: now };
    });

    return (
        <>
            <ChartBlock title={'CPU Load'} icon={faMicrochip} value={`${readings.cpu.toFixed(0)}%`}>
                <Line {...cpu.props} />
            </ChartBlock>
            <ChartBlock title={'Memory'} icon={faMemory} value={`${readings.memoryMb} / ${limits?.memory ?? 0} MB`}>
                <Line {...memory.props} />
            </ChartBlock>
            <ChartBlock
                title={'Network'}
                icon={faWifi}
                value={`${bytesToString(readings.throughput)}/s`}
                legend={
                    <>
                        <Tooltip arrow content={'Inbound'}>
                            <CloudDownloadIcon className={'mr-2 w-4 h-4 text-blue-500'} />
                        </Tooltip>
                        <Tooltip arrow content={'Outbound'}>
                            <CloudUploadIcon className={'w-4 h-4 text-yellow-500'} />
                        </Tooltip>
                    </>
                }
            >
                <Line {...network.props} />
            </ChartBlock>
        </>
    );
};
