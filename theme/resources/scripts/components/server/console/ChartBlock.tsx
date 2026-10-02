import React from 'react';
import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import styles from '@/components/server/console/style.module.css';

interface ChartBlockProps {
    title: string;
    /** The glyph in the tinted square beside the title, as on the stat cards. */
    icon?: IconDefinition;
    /** The current reading, printed at the right of the header. */
    value?: React.ReactNode;
    /** Extra content for the header's right side, beside the value. */
    legend?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * One graph, as a light card with a header row.
 *
 * The header used to be a bare `<h3>` and an optional legend. The reference puts
 * an icon tile and the title on the left and the CURRENT VALUE on the right -
 * and the value is the reason this is worth changing rather than just restyling:
 * a chart is the only place on the page where the recent history and the present
 * reading are visible at the same time, and the reference puts them in the same
 * line of sight for exactly that reason. Without the value the user has to read
 * the last point off the line, which is the one thing a chart is worst at.
 *
 * The value is the caller's to compute, not this component's: `StatGraphs` owns
 * the socket subscription and the chart data, so it already knows both, and
 * duplicating the "latest frame" logic here would be a second place for the two
 * to disagree.
 *
 * `legend` still exists and still renders, after the value - `StatGraphs` uses it
 * for the network card's inbound/outbound swatches.
 */
export default ({ title, icon, value, legend, children }: ChartBlockProps) => (
    <div className={classNames(styles.chart_container, 'group')}>
        <div className={styles.chart_head}>
            <span className={styles.chart_headlead}>
                {icon && (
                    <span className={styles.chart_icon} aria-hidden={'true'}>
                        <FontAwesomeIcon icon={icon} />
                    </span>
                )}
                <h3 className={styles.chart_title}>{title}</h3>
            </span>

            {(value || legend) && (
                <span className={styles.chart_headtail}>
                    {value && <span className={styles.chart_value}>{value}</span>}
                    {legend && <span className={styles.chart_legend}>{legend}</span>}
                </span>
            )}
        </div>

        <div className={styles.chart_body}>{children}</div>
    </div>
);