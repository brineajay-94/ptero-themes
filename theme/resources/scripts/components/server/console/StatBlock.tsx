import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import styles from './style.module.css';
import CopyOnClick from '@/components/elements/CopyOnClick';

/**
 * The three tones a stat card can be in.
 *
 * A named union rather than the panel's `color` prop, which took a Tailwind
 * background CLASS (`bg-red-500`) and painted it behind the icon. That worked
 * while the card was a dark tile with a coloured status bar, and it is the wrong
 * shape for a light card: the icon belongs in a pale tinted square, and the bar
 * at the bottom belongs in the state colour. A class name cannot drive both, and
 * accepting arbitrary classes here is how a card ends up with an unreadable
 * combination nobody chose on purpose.
 *
 * `blue` is the default and the reference's own choice: five of the six cards on
 * a server page are blue, and the single red one (Uptime, when the server is not
 * running) is the only thing on the page that is meant to catch the eye.
 */
export type StatTone = 'blue' | 'red' | 'green' | 'amber';

interface StatBlockProps {
    title: string;
    icon: IconDefinition;
    /** The value. Long values truncate rather than shrink - see the note below. */
    children: React.ReactNode;
    /** Makes the card's trailing control a copy button for this text. */
    copyOnClick?: string;
    /** 0-1 for the bar at the bottom. Omit it and the card has no bar. */
    progress?: number | null;
    tone?: StatTone;
    className?: string;
}

/**
 * One statistic, as a light card: an icon in a tinted square, a label, a value,
 * an optional control on the right and an optional bar along the bottom.
 *
 * WHY THE VALUE TRUNCATES INSTEAD OF SHRINKING
 * ---------------------------------------------
 * This used to run `use-fit-text`, which measured the value and stepped the font
 * down until it fit. It is the right idea for a fixed-width tile and the wrong one
 * here, for two reasons. The cards are in a grid whose columns are fractions of
 * the page, so the width changes with the viewport and the measured size is only
 * correct until the next resize - a value silently re-flows as the window moves.
 * And a fitted value has no floor: an address on a narrow screen ends up at 8px,
 * which is not a value anyone can read or copy.
 *
 * Truncating keeps one type size for every card on the page, so the six of them
 * are comparable at a glance - which is the entire reason they are stacked in a
 * column. The full value stays reachable: the card's title attribute carries it,
 * and the Address card has a copy button.
 */
export default ({ title, icon, copyOnClick, progress, tone = 'blue', className, children }: StatBlockProps) => {
    const hasProgress = typeof progress === 'number' && Number.isFinite(progress);

    // Clamped rather than trusted. `progress` arrives from a division against a
    // limit that can be 0 for an unconfigured server, and the panel's own helper
    // returns NaN there; a bar sized `NaN%` renders at zero width silently, and
    // one sized 400% would paint outside the card.
    const pct = hasProgress ? Math.max(0, Math.min(1, progress as number)) * 100 : 0;

    return (
        <div className={classNames(styles.stat_block, `is-${tone}`, className)} title={title}>
            <span className={styles.stat_icon} aria-hidden={'true'}>
                <FontAwesomeIcon icon={icon} />
            </span>

            <span className={styles.stat_text}>
                <span className={styles.stat_label}>{title}</span>
                <span className={styles.stat_value}>{children}</span>
            </span>

            {copyOnClick && (
                <CopyOnClick text={copyOnClick}>
                    <button type={'button'} className={styles.stat_copy} aria-label={`Copy ${title}`}>
                        <FontAwesomeIcon icon={faCopy} aria-hidden={'true'} />
                    </button>
                </CopyOnClick>
            )}

            {hasProgress && (
                <span className={styles.stat_bar} aria-hidden={'true'}>
                    <span className={styles.stat_fill} style={{ width: `${pct}%` }} />
                </span>
            )}
        </div>
    );
};