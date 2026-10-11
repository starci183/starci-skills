import type { ReactNode } from "react"
import { staticRowClassName } from "../../classNames.js"
import { treatmentFor, type PresentationState } from "../../state.js"
import type { RowVerdict } from "../StaticStateRow/index.js"

export type ListRowProps = {
    /** The row's name: the one thing the reader scans the collection for. */
    readonly title: ReactNode
    /** One supporting line under the title (facts, owner, last activity). Muted. */
    readonly description?: ReactNode
    /** A compact identity mark at the start: an `IconTile`, an `Avatar`, or a provider/bank logo in a tile. Decorative beside the title. */
    readonly leading?: ReactNode
    /** Status marks after the title - at most two `Badge`s: the operational state, then one exception. */
    readonly badges?: ReactNode
    /** The row's commands at the end: at most one visible `Button`, then a `DropdownMenu` for the rest. */
    readonly actions?: ReactNode
    /** Content that belongs to this row and sits under its copy (an `Alert` about this row, revealed values). */
    readonly children?: ReactNode
    /** How the row itself is doing; paints nothing new, exposes `data-grammar-state` for the family. */
    readonly state?: PresentationState
    /** In a verdict collection, the outcome this row reports (the collection's leading edge). */
    readonly verdict?: RowVerdict
}

/**
 * One interactive row in a `SurfaceListCard` (or an app-owned `<ul>`): leading mark, title with its badges,
 * one supporting line, and trailing actions, with an optional detail region under the copy.
 *
 * It shares `StaticStateRow`'s shipped geometry - the row inset, the row gap and the edge-to-edge separator
 * between consecutive rows - so static and interactive rows mix in one collection. It is an `<li>`: render it
 * inside a list, never loose. The actions keep their own semantics; the row itself is not a target.
 */
export const ListRow = ({ title, description, leading, badges, actions, children, state = "neutral", verdict }: ListRowProps) => {
    const treatment = treatmentFor(state)
    return (
        <li
            className={`${staticRowClassName} starci-core-list-row`}
            data-grammar-row="true"
            data-component="ListRow"
            data-tier="composite"
            data-grammar-state={state}
            data-grammar-treatment={treatment.tone}
            data-grammar-leading={leading == null ? "false" : "true"}
            data-grammar-actions={actions == null ? "false" : "true"}
            {...(verdict === undefined ? {} : { "data-verdict": verdict })}
            data-contract="GAP-3 PADDING-4 BOUNDARY-3"
        >
            {leading == null ? null : <span className="starci-core-list-row-leading">{leading}</span>}
            <span className="starci-core-list-row-copy" data-contract="GAP-1">
                <span className="starci-core-list-row-title">
                    <span className="starci-core-list-row-name">{title}</span>
                    {badges == null ? null : <span className="starci-core-list-row-badges" data-contract="GAP-2">{badges}</span>}
                </span>
                {description == null ? null : <span className="starci-core-list-row-description" data-contract="TONE-2 FONT-2">{description}</span>}
            </span>
            {actions == null ? null : <span className="starci-core-list-row-actions" data-contract="GAP-2">{actions}</span>}
            {children == null ? null : <div className="starci-core-list-row-detail" data-contract="GAP-3">{children}</div>}
        </li>
    )
}
