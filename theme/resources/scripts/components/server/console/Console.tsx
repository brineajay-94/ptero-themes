import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import { usePermissions } from '@/plugins/usePermissions';
import { theme as th } from 'twin.macro';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import classNames from 'classnames';
import { ChevronDoubleRightIcon, PaperAirplaneIcon } from '@heroicons/react/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompress, faExpand } from '@fortawesome/free-solid-svg-icons';

import 'xterm/css/xterm.css';
import styles from './style.module.css';

const theme = {
    background: 'rgb(var(--pt-black))',
    cursor: 'transparent',
    black: 'rgb(var(--pt-black))',
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: '#396FE2',
    magenta: '#BB80B3',
    cyan: '#2DDAFD',
    white: '#d0d0d0',
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: '#82AAFF',
    brightMagenta: '#C792EA',
    brightCyan: '#89DDFF',
    brightWhite: '#ffffff',
    selection: '#FAF089',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 30,
    theme: theme,
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[1m\u001b[33mcontainer@pterodactyl~ \u001b[0m';
    const ref = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Drives the fullscreen button's label and icon. The Fullscreen API fires no
    // React event, so without this the button would keep saying "expand" after the
    // user had already expanded - and Escape, the way most people will leave, is
    // exactly the path that would leave it stale.
    const [fullscreen, setFullscreen] = useState(false);
    const terminal = useMemo(() => new Terminal({ ...terminalProps }), []);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const searchBar = new SearchBarAddon({ searchAddon });
    const webLinksAddon = new WebLinksAddon();
    const scrollDownHelperAddon = new ScrollDownHelperAddon();
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const serverName = ServerContext.useStoreState((state) => state.server.data!.name);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);
    // SearchBarAddon has hardcoded z-index: 999 :(
    const zIndex = `
    .xterm-search-bar__addon {
        z-index: 10;
    }`;

    const handleConsoleOutput = (line: string, prelude = false) =>
        terminal.writeln((prelude ? TERMINAL_PRELUDE : '') + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');

    const handleTransferStatus = (status: string) => {
        switch (status) {
            // Sent by either the source or target node if a failure occurs.
            case 'failure':
                terminal.writeln(TERMINAL_PRELUDE + 'Transfer has failed.\u001b[0m');
                return;
        }
    };

    const handleDaemonErrorOutput = (line: string) =>
        terminal.writeln(
            TERMINAL_PRELUDE + '\u001b[1m\u001b[41m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m'
        );

    const handlePowerChangeEvent = (state: string) =>
        terminal.writeln(TERMINAL_PRELUDE + 'Server marked as ' + state + '...\u001b[0m');

    /**
     * Send whatever is in the input.
     *
     * Declared above the key handler rather than below it so the dependency reads
     * top-down, and because `handleCommandKeyDown` closes over it: a `const` arrow
     * function is in its temporal dead zone until the line above it runs, so the
     * order is not merely stylistic - anything that could invoke the handler
     * before this line executed would throw.
     *
     * Shared by Enter and the Send button so the two cannot drift: the button is
     * not a second implementation of "send", it is a second way to ask for the
     * same one. That also means the button gets the empty-input guard and the
     * history entry for free.
     */
    const sendCommand = (value: string) => {
        const command = value.trim();

        if (command.length === 0 || !instance) {
            return;
        }

        setHistory((prevHistory) => [command, ...prevHistory!].slice(0, 32));
        setHistoryIndex(-1);

        instance.send('send command', command);
    };

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, history!.length - 1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';

            // By default up arrow will also bring the cursor to the start of the line,
            // so we'll preventDefault to keep it at the end.
            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';
        }

        // Enter still sends, exactly as it always has. It is the only key a user
        // expects to send with, and the Send button is an addition rather than a
        // replacement - taking Enter away would break muscle memory for everyone.
        if (e.key === 'Enter') {
            e.preventDefault();
            sendCommand(e.currentTarget.value);
            e.currentTarget.value = '';
        }
    };

    /**
     * Fullscreen for the whole card, terminal included.
     *
     * `:fullscreen` on the CARD rather than on the terminal element on purpose.
     * The terminal is measured by xterm's FitAddon from the box it is given, and
     * a fullscreen element that is only the terminal has no header to put the
     * exit control in - so the user gets a way out via Escape alone. Growing the
     * card instead means the header, the badge and the input all come along, and
     * the ResizeObserver below already refits the terminal when the box changes.
     *
     * Every branch is feature-detected and the button is simply not rendered when
     * the API is missing, rather than rendering a control that throws when it is
     * pressed. `webkitRequestFullscreen` is the iOS Safari spelling.
     */
    const fullscreenElement = cardRef.current;

    const canFullscreen =
        typeof document !== 'undefined' &&
        (fullscreenElement?.requestFullscreen || (fullscreenElement as any)?.webkitRequestFullscreen);

    const isFullscreen = () => {
        const active = document.fullscreenElement || (document as any).webkitFullscreenElement;

        return !!active && active === fullscreenElement;
    };

    const toggleFullscreen = () => {
        if (!fullscreenElement) {
            return;
        }

        if (isFullscreen()) {
            (document as any).exitFullscreen?.();
        } else {
            fullscreenElement.requestFullscreen?.() || (fullscreenElement as any).webkitRequestFullscreen?.();
        }
    };

    useEffect(() => {
        if (connected && ref.current && !terminal.element) {
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(searchAddon);
            terminal.loadAddon(searchBar);
            terminal.loadAddon(webLinksAddon);
            terminal.loadAddon(scrollDownHelperAddon);

            terminal.open(ref.current);

            fitAddon.fit();
            searchBar.addNewStyle(zIndex);

            // Add support for capturing keys
            terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    document.execCommand('copy');
                    return false;
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    searchBar.show();
                    return false;
                } else if (e.key === 'Escape') {
                    searchBar.hidden();
                }
                return true;
            });
        }
    }, [terminal, connected]);

    useEventListener(
        'resize',
        debounce(() => {
            if (terminal.element) {
                fitAddon.fit();
            }
        }, 100)
    );

    // A window resize is not the only way this box changes width. On a phone the
    // console also resizes when the navigation drawer opens or closes, and when
    // the browser's URL bar collapses. Without this the terminal keeps the
    // column count it was fitted with, which is what left lines hanging past the
    // edge of the screen. The debounce keeps a drag of the drawer from calling
    // fit() on every frame.
    useEffect(() => {
        const sync = () => setFullscreen(isFullscreen());

        document.addEventListener('fullscreenchange', sync);
        document.addEventListener('webkitfullscreenchange', sync);

        return () => {
            document.removeEventListener('fullscreenchange', sync);
            document.removeEventListener('webkitfullscreenchange', sync);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(
            debounce(() => {
                if (terminal.element) {
                    fitAddon.fit();
                }
            }, 100)
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [terminal]);

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: handleTransferStatus,
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            // Do not clear the console if the server is being transferred.
            if (!isTransferring) {
                terminal.clear();
            }

            Object.keys(listeners).forEach((key: string) => {
                instance.addListener(key, listeners[key]);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (instance) {
                Object.keys(listeners).forEach((key: string) => {
                    instance.removeListener(key, listeners[key]);
                });
            }
        };
    }, [connected, instance]);

    return (
        <div className={classNames(styles.terminal, styles.terminal_card, 'relative')} ref={cardRef}>
            <SpinnerOverlay visible={!connected} />

            {/*
             * The card's own header, on the light card rather than inside the dark
             * terminal. The reference puts the title, the server's name and a
             * fullscreen control on one row above the terminal, and all three are
             * worth having: the title says what this panel is, the badge says which
             * server it belongs to without the eye having to travel up to the page
             * header, and the control is the one people look for when they want the
             * output as big as the screen.
             */}
            <div className={styles.terminal_head}>
                <span className={styles.terminal_headlead}>
                    <span className={styles.terminal_glyph} aria-hidden={'true'}>
                        &gt;_
                    </span>
                    <span className={styles.terminal_headtitle}>Server Console</span>
                </span>

                <span className={styles.terminal_headtail}>
                    <span className={styles.terminal_badge} title={serverName}>
                        {serverName}
                    </span>
                    {canFullscreen && (
                        <button
                            type={'button'}
                            className={styles.terminal_expand}
                            onClick={toggleFullscreen}
                            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen console'}
                            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen console'}
                        >
                            <FontAwesomeIcon icon={fullscreen ? faCompress : faExpand} aria-hidden={'true'} />
                        </button>
                    )}
                </span>
            </div>

            <div className={classNames(styles.container, styles.overflows_container, { 'rounded-b': !canSendCommands })}>
                <div className={'h-full'}>
                    <div id={styles.terminal} ref={ref} />
                </div>
            </div>

            {canSendCommands && (
                <div className={classNames(styles.command_row, styles.overflows_container)}>
                    <div className={classNames(styles.command_field, 'relative')}>
                        <input
                            ref={inputRef}
                            className={classNames('peer', styles.command_input)}
                            type={'text'}
                            placeholder={'Type a command...'}
                            aria-label={'Console command input.'}
                            disabled={!instance || !connected}
                            onKeyDown={handleCommandKeyDown}
                            autoCorrect={'off'}
                            autoCapitalize={'none'}
                        />
                        <div
                            className={classNames(
                                'text-gray-100 peer-focus:text-gray-50 peer-focus:animate-pulse',
                                styles.command_icon
                            )}
                        >
                            <ChevronDoubleRightIcon className={'w-4 h-4'} />
                        </div>
                    </div>

                    {/*
                     * The Send button.
                     *
                     * A button rather than a form submit on purpose: the command
                     * goes over the websocket, not to an endpoint, so there is no
                     * form to submit and a `type="submit"` here would reload the
                     * page. It calls the same `sendCommand` the Enter key does, so
                     * the two paths cannot drift apart.
                     *
                     * Disabled on the same condition as the input, so it never
                     * presents a control that silently does nothing.
                     */}
                    <button
                        type={'button'}
                        className={styles.command_send}
                        disabled={!instance || !connected}
                        onClick={() => {
                            sendCommand(inputRef.current?.value || '');
                            if (inputRef.current) {
                                inputRef.current.value = '';
                            }
                        }}
                    >
                        <PaperAirplaneIcon className={'w-4 h-4'} aria-hidden={'true'} />
                        <span>Send</span>
                    </button>
                </div>
            )}
        </div>
    );
};
