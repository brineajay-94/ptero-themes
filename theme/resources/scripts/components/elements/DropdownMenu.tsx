import React, { createRef } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Fade from '@/components/elements/Fade';

interface Props {
    children: React.ReactNode;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

/**
 * The panel used to render `absolute` inside a plain wrapper and be nudged with
 * `left = viewportX - width`. That is only correct when the wrapper happens to
 * sit at the viewport origin: in the file manager the wrapper is a `.file_row`
 * at some x offset, so the panel was pushed off to the right and, because the
 * row clips its own overflow, it never became visible at all. It is `fixed`
 * here so the click coordinates line up, with the vertical placement taken from
 * the toggle's own rect and clamped to the viewport.
 */
const Panel = styled.div`
    position: fixed;
    z-index: 60;
    width: 12rem;
    max-width: calc(100vw - 1.5rem);
    padding: 0.35rem;
    border: 1px solid var(--pt-glass-border);
    border-radius: var(--pt-glass-radius-sm);
    background-color: rgb(var(--pt-gray-800) / 0.97);
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.55);
    color: rgb(var(--pt-gray-300));
    font-size: 0.8rem;
    backdrop-filter: blur(var(--pt-glass-blur));
`;

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    ${tw`p-2 w-full flex items-center rounded text-left`};
    color: rgb(var(--pt-gray-300));
    transition: 150ms all ease;

    &:hover {
        color: rgb(var(--pt-gray-50));
    }

    ${(props) =>
        props.danger
            ? `
                &:hover {
                    background-color: rgb(var(--pt-red-500) / 0.22);
                    color: rgb(var(--pt-red-300));
                }
            `
            : `
                &:hover {
                    background-color: rgb(var(--pt-gray-500) / 0.38);
                }
            `}
`;

interface State {
    posX: number;
    visible: boolean;
}

class DropdownMenu extends React.PureComponent<Props, State> {
    menu = createRef<HTMLDivElement>();
    toggle = createRef<HTMLDivElement>();

    state: State = {
        posX: 0,
        visible: false,
    };

    /** Pending reposition, coalesced to one per animation frame. See below. */
    frame: number | null = null;

    componentWillUnmount() {
        this.removeListeners();
        this.cancelFrame();
    }

    componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
        if (this.state.visible && !prevState.visible) {
            this.position();
            document.addEventListener('click', this.windowListener);
            document.addEventListener('contextmenu', this.contextMenuListener);
            window.addEventListener('resize', this.repositionListener);
            window.addEventListener('scroll', this.repositionListener, true);
        }

        if (!this.state.visible && prevState.visible) {
            this.removeListeners();
        }
    }

    removeListeners = () => {
        document.removeEventListener('click', this.windowListener);
        document.removeEventListener('contextmenu', this.contextMenuListener);
        window.removeEventListener('resize', this.repositionListener);
        window.removeEventListener('scroll', this.repositionListener, true);
    };

    cancelFrame = () => {
        if (this.frame !== null) {
            window.cancelAnimationFrame(this.frame);
            this.frame = null;
        }
    };

    /**
     * WHY THIS IS COALESCED
     * ---------------------
     * The scroll listener is registered with `capture: true`, so it hears every
     * scroller in the document rather than just the window. `position()` then
     * WRITES `top` and `left`. When the panel is not laid out against the
     * viewport - which happens whenever an ancestor between it and <body> has a
     * transform, a filter or a backdrop-filter, because that makes `position:
     * fixed` resolve against that ancestor instead - writing `top` changes the
     * document height. That fires another scroll. That repositions again. The
     * menu oscillates, and hovering it keeps re-triggering the loop, which is the
     * vibration on the file rows' "..." menu.
     *
     * One reposition per frame bounds it, and the guard inside `position()` stops
     * the write entirely when nothing moved - which breaks the feedback edge
     * rather than only slowing it down.
     */
    repositionListener = () => {
        if (!this.state.visible || this.frame !== null) {
            return;
        }

        this.frame = window.requestAnimationFrame(() => {
            this.frame = null;
            this.position();
        });
    };

    position = () => {
        const menu = this.menu.current;
        const toggle = this.toggle.current;

        if (!menu) {
            return;
        }

        const rect = toggle ? toggle.getBoundingClientRect() : null;
        const height = menu.offsetHeight;
        const width = menu.offsetWidth;
        const margin = 12;

        // Prefer hanging the panel off the toggle's right edge, and flip it to
        // the left of the toggle when that would run past the viewport.
        const preferredLeft = rect ? rect.right - width : this.state.posX - width;
        const left = Math.min(Math.max(margin, preferredLeft), window.innerWidth - width - margin);

        const below = rect ? rect.bottom + 4 : margin;
        const flipped = below + height > window.innerHeight - margin;
        const top = flipped && rect ? Math.max(margin, rect.top - height - 4) : below;

        const nextLeft = `${Math.round(left)}px`;
        const nextTop = `${Math.round(top)}px`;

        // Only write on an actual move. Assigning the same value still dirties
        // style, and - inside a transformed ancestor - still shifts the document
        // height that the scroll listener above is watching.
        if (menu.style.left !== nextLeft) {
            menu.style.left = nextLeft;
        }

        if (menu.style.top !== nextTop) {
            menu.style.top = nextTop;
        }
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();
        this.triggerMenu(e.clientX);
    };

    contextMenuListener = () => this.setState({ visible: false });

    windowListener = (e: MouseEvent) => {
        const menu = this.menu.current;

        if (e.button === 2 || !this.state.visible || !menu) {
            return;
        }

        if (menu.contains(e.target as Node)) {
            return;
        }

        this.setState({ visible: false });
    };

    triggerMenu = (posX: number) =>
        this.setState((s) => ({
            posX: !s.visible ? posX : s.posX,
            visible: !s.visible,
        }));

    render() {
        return (
            <div ref={this.toggle}>
                {this.props.renderToggle(this.onClickHandler)}
                <Fade timeout={150} in={this.state.visible} unmountOnExit>
                    <Panel
                        ref={this.menu}
                        onClick={(e) => {
                            e.stopPropagation();
                            this.setState({ visible: false });
                        }}
                    >
                        {this.props.children}
                    </Panel>
                </Fade>
            </div>
        );
    }
}

export default DropdownMenu;
