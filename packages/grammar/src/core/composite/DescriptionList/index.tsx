import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"
import type { IconSource } from "../../primitive/Icon/index.js"
import { IconTile } from "../../primitive/IconTile/index.js"

export type DescriptionListItem = {
    readonly id: string
    readonly term: ReactNode
    readonly description: ReactNode
}

/**
 * One cell of the `stat-strip` layout: a key figure (KPI). `term` is its label, `description` the figure
 * itself (a number, or a status Badge); `unit` follows the figure in a lighter face, `meta` (its source,
 * its time) sits under it. `icon` draws a neutral `IconTile` (sm) before the label.
 */
export type DescriptionListStatItem = DescriptionListItem & {
    readonly icon?: IconSource
    readonly unit?: ReactNode
    readonly meta?: ReactNode
}

export type DescriptionListLayout = "columns" | "stacked" | "stat-strip"

type PairLayout = {
    /**
     * `columns` pairs each term with its value on one row and falls back to `stacked` below 30rem;
     * `stacked` always puts the value under its term.
     */
    readonly layout?: "columns" | "stacked"
    readonly items: ReadonlyArray<DescriptionListItem>
}

type StatStripLayout = {
    /**
     * `stat-strip` lays 2-4 key figures side by side: one row of equal cells at 48rem and wider, with a
     * hairline between cells when divided; a 2 x 2 grid below.
     */
    readonly layout: "stat-strip"
    readonly items: ReadonlyArray<DescriptionListStatItem>
}

export type DescriptionListProps = (PairLayout | StatStripLayout) & {
    /** Draw a separator between pairs (between cells, for `stat-strip`). */
    readonly isDivided?: boolean
    readonly className?: string
}

/**
 * Term/value pairs (details, metadata, settings summaries) as a real `<dl>`.
 * Contract: HIERARCHY-3 (term precedes value in source and paint), TRUTH-1 (no tone carrier on facts).
 * A stat-strip cell keeps the same `<dt>`/`<dd>` order: label, figure (+ unit), then its meta as a
 * second `<dd>` of the same term.
 */
export const DescriptionList = (props: DescriptionListProps) => {
    const { isDivided = true, className } = props
    const layout: DescriptionListLayout = props.layout ?? "columns"
    return (
        <dl
            className={navigationClassName("starci-core-description-list", className)}
            data-component="DescriptionList"
            data-contract="HIERARCHY-3 TRUTH-1"
            data-tier="composite"
            data-grammar-description-layout={layout}
            data-grammar-description-divided={isDivided ? "true" : "false"}
        >
            {props.layout === "stat-strip"
                ? props.items.map((item) => (
                    <div key={item.id} className="starci-core-description-pair" data-grammar-description-pair="true">
                        <dt className="starci-core-description-term starci-core-description-stat-term">
                            {item.icon === undefined ? null : <IconTile source={item.icon} size="sm" tone="neutral" />}
                            <span>{item.term}</span>
                        </dt>
                        <dd className="starci-core-description-value starci-core-description-figure" data-contract="FONT-5">
                            <span className="starci-core-description-figure-value">{item.description}</span>
                            {item.unit === undefined ? null : <span className="starci-core-description-unit">{item.unit}</span>}
                        </dd>
                        {item.meta === undefined ? null : (
                            <dd className="starci-core-description-meta" data-contract="FONT-2">{item.meta}</dd>
                        )}
                    </div>
                ))
                : props.items.map((item) => (
                    <div key={item.id} className="starci-core-description-pair" data-grammar-description-pair="true">
                        <dt className="starci-core-description-term">{item.term}</dt>
                        <dd className="starci-core-description-value">{item.description}</dd>
                    </div>
                ))}
        </dl>
    )
}
