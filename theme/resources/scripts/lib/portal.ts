/**
 * Guarantees the `#modal-portal` node the panel's dialogs mount into.
 *
 * `Modal` and `Portal` both resolve the node with
 * `document.getElementById('modal-portal')` and hand the result straight to
 * `createPortal`. When it is missing, React throws "Target container is not a
 * DOM element" (minified error #200) on the very first render that uses one, and
 * the surrounding error boundary replaces the whole view with "An error was
 * encountered by the application while rendering this view."
 *
 * The node is rendered by `resources/views/templates/base/core.blade.php`, which
 * this theme does not ship, so anything that rewrites that view - a second
 * theme, a Blueprint plugin, a hand edit - removes it without any error. What
 * that looks like in practice is a blank panel on exactly the pages that open a
 * dialog, and nothing at all on the pages that do not: every server page,
 * because the console's stat blocks portal through `CopyOnClick`, while the
 * dashboard and the login screens keep rendering normally.
 *
 * Re-creating it here makes the theme independent of that view. On a stock panel
 * this finds the existing node and does nothing; anywhere else it is the
 * difference between a working console and a blank one. It runs when this module
 * is imported, which happens before any component renders.
 */
export const ensureModalPortal = (): HTMLElement => {
    const existing = document.getElementById('modal-portal');
    if (existing) return existing;

    const node = document.createElement('div');
    node.id = 'modal-portal';
    (document.body || document.documentElement).appendChild(node);

    return node;
};

ensureModalPortal();
