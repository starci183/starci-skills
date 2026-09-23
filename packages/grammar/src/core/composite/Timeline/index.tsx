import type { ReactNode } from "react"
import { assertPresentationState, type PresentationState } from "../../../common/state.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type TimelineItem = {
    readonly id: string
    readonly title: ReactNode
    /** A machine-readable instant for `<time dateTime>`; `timeLabel` is what the reader sees. */
    readonly dateTime?: string
    readonly timeLabel?: ReactNode
    readonly description?: ReactNode
    readonly state?: PresentationState
    /** The entry the reader is at now (`aria-current="step"`). */
    readonly isCurrent?: boolean
    /** App-owned marker glyph; defaults to a dot. */
    readonly marker?: ReactNode
}

export type TimelineProps = {
    /** Names the list, e.g. "Order history". */
    readonly label: string
    readonly items: ReadonlyArray<TimelineItem>
    readonly className?: string
}

/**
 * An ordered history of events. Each entry exposes `data-grammar-timeline-state` from the Common
 * presentation states and `data-grammar-current`; the connector line is drawn by the stylesheet.
 * Contract: list HIERARCHY-3, entry STATE-1 TRUTH-1 (closed presentation states, neutral default), marker ICON-6.
 */
export const Timeline = ({ label, items, className }: TimelineProps) => (
    <ol
        aria-label={label}
        className={navigationClassName("starci-core-timeline", className)}
        data-component="Timeline"
        data-contract="HIERARCHY-3"
        data-tier="composite"
    >
        {items.map((item) => {
            const state = item.state ?? "neutral"
            assertPresentationState(state)
            return (
                <li
                    key={item.id}
                    aria-current={item.isCurrent ? "step" : undefined}
                    className="starci-core-timeline-item"
                    data-contract="STATE-1 TRUTH-1"
                    data-grammar-timeline-state={state}
                    data-grammar-current={item.isCurrent ? "true" : "false"}
                >
                    <span aria-hidden="true" className="starci-core-timeline-marker" data-contract="ICON-6" data-grammar-timeline-marker="true">{item.marker}</span>
                    <div className="starci-core-timeline-copy">
                        <p className="starci-core-timeline-title">{item.title}</p>
                        {item.timeLabel === undefined ? null : (
                            <time className="starci-core-timeline-time" {...(item.dateTime === undefined ? {} : { dateTime: item.dateTime })}>{item.timeLabel}</time>
                        )}
                        {item.description === undefined ? null : <div className="starci-core-timeline-description">{item.description}</div>}
                    </div>
                </li>
            )
        })}
    </ol>
)
