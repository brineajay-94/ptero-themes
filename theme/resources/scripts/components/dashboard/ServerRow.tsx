import React, { memo, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEthernet, faServer } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';

const isAlarmState = (current: number, limit: number): boolean => limit > 0 && current / (limit * 1024 * 1024) >= 0.9;

type StatusKind = 'online' | 'offline' | 'busy' | 'neutral';

const Stat = ({
    label,
    value,
    limit,
    percent,
    alarm,
}: {
    label: string;
    value: string;
    limit: string;
    percent: number | null;
    alarm: boolean;
}) => (
    <div className={'pt-stat'}>
        <div className={'pt-stat-label'}>{label}</div>
        <div className={'pt-stat-value'}>{value}</div>
        <div className={'pt-stat-limit'}>of {limit}</div>
        {percent !== null && (
            <div className={`pt-bar${alarm ? ' is-alarm' : ''}`}>
                <i style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
            </div>
        )}
    </div>
);

const ServerRow = ({ server, className }: { server: Server; className?: string }) => {
    const interval = useRef<ReturnType<typeof setInterval>>(null) as React.MutableRefObject<
        ReturnType<typeof setInterval>
    >;
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const [stats, setStats] = useState<ServerStats | null>(null);

    const getStats = () =>
        getServerResourceUsage(server.uuid)
            .then((data) => setStats(data))
            .catch((error) => console.error(error));

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        if (isSuspended || server.isNodeUnderMaintenance) return;

        getStats().then(() => {
            interval.current = setInterval(() => getStats(), 30000);
        });

        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, [isSuspended, server.isNodeUnderMaintenance]);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : stats.cpuUsagePercent >= server.limits.cpu * 0.9;
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }

    const diskLimit = server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : 'Unlimited';
    const memoryLimit = server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : 'Unlimited';
    const cpuLimit = server.limits.cpu !== 0 ? server.limits.cpu + ' %' : 'Unlimited';

    let statusLabel = 'Connecting';
    let statusKind: StatusKind = 'neutral';
    let statusColor = 'rgb(var(--pt-gray-500))';

    if (isSuspended) {
        statusLabel = server.status === 'suspended' ? 'Suspended' : 'Connection Error';
        statusKind = 'offline';
        statusColor = 'rgb(var(--pt-red-500))';
    } else if (server.isNodeUnderMaintenance) {
        statusLabel = 'Maintenance';
        statusKind = 'busy';
        statusColor = 'rgb(var(--pt-yellow-500))';
    } else if (server.isTransferring || server.status) {
        statusLabel = server.isTransferring
            ? 'Transferring'
            : server.status === 'installing'
            ? 'Installing'
            : server.status === 'restoring_backup'
            ? 'Restoring'
            : 'Unavailable';
        statusKind = 'busy';
        statusColor = 'rgb(var(--pt-yellow-500))';
    } else if (stats) {
        const running: ServerPowerState = stats.status;
        statusLabel = running === 'running' ? 'Running' : 'Stopped';
        statusKind = running === 'running' ? 'online' : 'offline';
        statusColor = running === 'running' ? 'rgb(var(--pt-green-500))' : 'rgb(var(--pt-red-500))';
    }

    const ready = !!stats && !isSuspended && !server.isNodeUnderMaintenance && !server.isTransferring && !server.status;

    const cpuPercent =
        ready && stats && server.limits.cpu > 0 ? (stats.cpuUsagePercent / server.limits.cpu) * 100 : null;
    const memPercent =
        ready && stats && server.limits.memory > 0
            ? (stats.memoryUsageInBytes / mbToBytes(server.limits.memory)) * 100
            : null;
    const diskPercent =
        ready && stats && server.limits.disk > 0
            ? (stats.diskUsageInBytes / mbToBytes(server.limits.disk)) * 100
            : null;

    return (
        <Link
            to={`/server/${server.id}`}
            className={`pt-server-card ${className || ''}`}
            style={{ ['--pt-status' as string]: statusColor }}
        >
            <div className={'pt-server-tile'}>
                <FontAwesomeIcon icon={faServer} />
            </div>

            <div className={'min-w-0'}>
                <p className={'pt-server-name'}>{server.name}</p>
                {!!server.description && <p className={'pt-server-desc'}>{server.description}</p>}
                <div className={'pt-server-meta'}>
                    <span className={`pt-chip pt-chip--${statusKind}`}>{statusLabel}</span>
                    {server.allocations
                        .filter((allocation) => allocation.isDefault)
                        .map((allocation) => (
                            <span
                                key={allocation.ip + allocation.port.toString()}
                                className={'pt-chip pt-chip--allocation'}
                            >
                                <FontAwesomeIcon icon={faEthernet} css={tw`mr-1 opacity-70`} />
                                {allocation.alias || ip(allocation.ip)}:{allocation.port}
                            </span>
                        ))}
                </div>
            </div>

            <div className={'pt-server-stats'}>
                {!ready ? (
                    <span className={'pt-stat-label'}>Awaiting live stats</span>
                ) : (
                    <>
                        <Stat
                            label={'CPU'}
                            value={`${stats!.cpuUsagePercent.toFixed(2)}%`}
                            limit={cpuLimit}
                            percent={cpuPercent}
                            alarm={alarms.cpu}
                        />
                        <Stat
                            label={'Memory'}
                            value={bytesToString(stats!.memoryUsageInBytes)}
                            limit={memoryLimit}
                            percent={memPercent}
                            alarm={alarms.memory}
                        />
                        <Stat
                            label={'Disk'}
                            value={bytesToString(stats!.diskUsageInBytes)}
                            limit={diskLimit}
                            percent={diskPercent}
                            alarm={alarms.disk}
                        />
                    </>
                )}
            </div>
        </Link>
    );
};

export default memo(ServerRow, isEqual);
