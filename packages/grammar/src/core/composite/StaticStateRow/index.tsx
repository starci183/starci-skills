import { StateMark } from "../../StateMark.js"
import { treatmentFor, type PresentationState } from "../../state.js"
import { staticRowClassName, staticRowCopyClassName } from "../../classNames.js"

/**
 * The outcome a row in a verdict collection reports.
 *
 * This is not `PresentationState`: a state describes how the row itself is doing, while a verdict
 * describes the direction of what the row REPORTS - a movement up or down a board - and it is drawn
 * as the collection's leading edge rather than as the row's own treatment. The same union is the
 * slot contract `SurfaceListCard` documents for an application-owned row.
 */
export type RowVerdict = "success" | "danger"

export type StaticStateRowData = {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly state?: PresentationState
    /** Draws the collection's 2px leading verdict edge on this row. */
    readonly verdict?: RowVerdict
}

export type StaticStateRowProps = {
    readonly item: StaticStateRowData
}

/** One non-interactive, product-neutral row in a Core-owned static collection. */
export const StaticStateRow = (props: StaticStateRowProps) => {
    const item = props.item
    const state = item.state ?? "neutral"
    const treatment = treatmentFor(state)

    return (
        <li
            className={staticRowClassName}
            data-grammar-row="true"
            data-grammar-state={state}
            data-grammar-treatment={treatment.tone}
            data-verdict={item.verdict}
            data-contract="GAP-3 PADDING-4 BOUNDARY-3"
        >
            <StateMark state={state} />
            <span className={staticRowCopyClassName} data-contract="GAP-1">
                <span>{item.label}</span>
                {item.description === undefined ? null : <span>{item.description}</span>}
            </span>
        </li>
    )
}
