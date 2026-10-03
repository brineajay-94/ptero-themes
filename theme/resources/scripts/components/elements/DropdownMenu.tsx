import React, { createRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Fade from '@/components/elements/Fade';

interface Props {
    children: React.ReactNode;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

/**
 * THE PANEL IS RENDERED THROUGH A PORTAL INTO <body>, AND THAT IS THE FIX
 * ==================================================================
 * Not decoration. The panel used to render `absolute` inside a plain wrapper and
 * be nudged with `left = viewportX - width`, which is only correct when the
 * wrapper happens to sit at the viewport origin. In the file manager the wrapper
 * is a `.file_row` at some x offset, so the panel was pushed off to the right,
 * the row grew, and the page grew a horizontal scrollbar. The row also clipped
 * its own overflow, so the panel could not be seen at all.
 *
 * Making the panel `position: fixed` was not enough on its own, and this is the
 * part that is easy to get wrong twice:
 *
 * 1. A non-none `transform` on an ANCESTOR makes that ancestor the containing
 *    block for `position: fixed` - the panel silently stops being positioned
 *    against the viewport. `.file_row:hover` carries `transform:
 *    translateY(-1px)`, so the containing block APPEARED AND DISAPPEARED as the
 *    pointer moved over the row. That is the horizontal jitter: the panel was
 *    correct in viewport pixels on one frame and row-relative on the next.
 * 2. `offsetParent` does not rescue you. The spec says it returns null for an
 *    element whose computed position is fixed, and browsers honour that - so the
 *    obvious "rebase onto `offsetParent`" is silently a no-op that reads as if it
 *    were working.
 *
 * A portal removes the whole class of problem rather than one instance of it: the
 * panel's parent is <body>, which is not transformed, is not clipped, and does
 * not establish a containing block. `position: fixed` then means the viewport, always,
 * and the coordinates below need no rebasing at all.
 *
 * The portal div carries nothing: every token the panel uses is declared on
 * `:root`, so it inherits them through <body>, and the panel is `fixed` so it
 * takes up no space in the div and the div takes up no space in the body.
 *
 * THE PANEL IS PAGE-SURFACE, NOT CHROME
 * -------------------------------------
 * This used to be `rgb(var(--pt-chrome) / 0.98)` with `--pt-chrome-ink` text.
 * `--pt-chrome` is the topbar and rail colour - a dark navy - and that is right
 * for a floating bar over the page but wrong for a menu that opens ON the page,
 * under the cursor, on a white file row. Worse, the rows are styled with PAGE ink
 * (`--pt-gray-100`), so a dark panel under dark ink is the worst of both: the file
 * manager's Rename/Move/Delete menu came out as unreadable dark grey on navy, and
 * the same panel is behind the per-row menus on backups, databases and users.
 *
 * So the panel is a card: `--pt-gray-700` fill, `--pt-gray-100` ink, a hairline and
 * a soft shadow. That is the same material as the row it belongs to, so the menu
 * reads as part of the list rather than as a piece of the shell that fell onto it.
 *
 * MOVED WITH A TRANSFORM, NEVER WITH top/left
 * ------------------------------------------
 * A transform moves the panel without touching layout, so it cannot change the
 * document's scrollable width or height and cannot fire a scroll event. Assigning
 * top/left does the opposite, and that fed straight back into the scroll listener
 * below: reposition changed the document, the document scrolled, that
 * repositioned again, forever. That loop is what the user saw as the menu
 * vibrating once a second.
 */
const Panel = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    z-index: 60;
    width: 12rem;
    max-width: calc(100vw - 1.5rem);
    padding: 0.35rem;
    border: 1px solid rgb(var(--pt-gray-600));
    border-radius: var(--pt-glass-radius-sm);
    background-color: rgb(var(--pt-gray-700));
    box-shadow: 0 14px 32px rgb(15 23 42 / 0.22), 0 2px 6px rgb(15 23 42 / 0.1);
    color: rgb(var(--pt-gray-100));
    font-size: 0.8rem;
    will-change: transform;
`;

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    ${tw`p-2 w-full flex items-center rounded text-left`};
    color: rgb(var(--pt-gray-100));
    transition: 150ms all ease;

    &:hover {
        color: rgb(var(--pt-gray-50));
        background-color: rgb(var(--pt-gray-500) / 0.28);
    }

    ${(props) =>
        props.danger
            ? `
                &:hover {
                    background-color: rgb(var(--pt-red-500) / 0.16);
                    color: rgb(var(--pt-red-500));
                }
            `
            : ''}
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

    /**
     * The <body> child the panel is portalled into, created on first use and torn
     * down with the component. Kept as a field rather than a module-level
     * singleton because two menus on one page must not share a node, and because a
     * node left behind after unmount is a node nobody will ever clean up.
     */
    portal: HTMLElement | null = null;

    componentWillUnmount() {
        this.removeListeners();
        this.cancelFrame();

        if (this.portal) {
            this.portal.remove();
            this.portal = null;
        }
    }

    portalTarget = (): HTMLElement | null => {
        if (!this.portal) {
            const node = document.createElement('div');

            node.setAttribute('data-pt-dropdown', '');
            document.body.appendChild(node);
            this.portal = node;
        }

        return this.portal;
    };

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
     * WHY THE COALESCING IS STILL HERE
     * ---------------------------------
     * The transform is the fix; this is the belt to its braces. `scroll` is
     * registered with `capture: true`, so it hears every scroller in the document
     * rather than just the window, and a page with any momentum or nested
     * scroller produces a burst of them. One reposition per frame bounds the work
     * to something a human cannot see, and costs nothing when nothing moved.
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

        // Prefer hanging the panel off the toggle's right edge, and flip it to the
        // left of the toggle when that would run past the viewport. Both are
        // VIEWPORT coordinates, which is what the clamp below is measured in.
        const preferredLeft = rect ? rect.right - width : this.state.posX - width;
        const left = Math.min(Math.max(margin, preferredLeft), window.innerWidth - width - margin);

        const below = rect ? rect.bottom + 4 : margin;
        const flipped = below + height > window.innerHeight - margin;
        const top = flipped && rect ? Math.max(margin, rect.top - height - 4) : below;

        // Plain viewport pixels, and no scroll correction, which is worth being
        // explicit about because adding `window.scrollX` here looks right and is
        // not: the panel is `position: fixed`, so its containing block is the
        // viewport and `getBoundingClientRect()` above is already measuring in
        // viewport space. A transform moves a fixed element against its containing
        // block, so the numbers translate directly. Adding the scroll offset would
        // put the menu off-screen by exactly the scroll distance on any scrolled
        // page.
        const next = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;

        // Only write on an actual move: a redundant style write is a style
        // recalculation for nothing.
        if (menu.style.transform !== next) {
            menu.style.transform = next;
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
        // Hoisted, because narrowing `this.portalTarget()` in the guard below
        // does not narrow the second call to the same method - TypeScript widens
        // it straight back to `HTMLElement | null`.
        const portalTarget = this.portalTarget();

        return (
            <div ref={this.toggle}>
                {this.props.renderToggle(this.onClickHandler)}
                {/*
                 * The Fade wrapper travels through the portal with the panel, not
                 * around it: fading in a wrapper that is still in the row would
                 * animate the row's own opacity, so the whole file list would fade
                 * with the menu.
                 */}
                {portalTarget &&
                    createPortal(
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
                        </Fade>,
                        portalTarget
                    )}
            </div>
        );
    }
}

export default DropdownMenu;
