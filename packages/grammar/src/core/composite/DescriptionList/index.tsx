import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type DescriptionListItem = {
    readonly id: string
    readonly term: ReactNode
    readonly description: ReactNode
}

export type DescriptionListProps = {
    readonly items: ReadonlyArray<DescriptionListItem>
    /**
     * `columns` pairs each term with its value on one row and falls back to `stacked` below 30rem;
     * `stacked` always puts the value under its term.
     */
    readonly layout?: "columns" | "stacked"
    /** Draw a separator between pairs. */
    readonly isDivided?: boolean
    readonly className?: string
}

/** Term/value pairs (details, metadata, settings summaries) as a real `<dl>`. */
export const DescriptionList = ({ items, layout = "columns", isDivided = true, className }: DescriptionListProps) => (
    <dl
        className={navigationClassName("starci-core-description-list", className)}
        data-component="DescriptionList"
        data-tier="composite"
        data-grammar-description-layout={layout}
        data-grammar-description-divided={isDivided ? "true" : "false"}
    >
        {items.map((item) => (
            <div key={item.id} className="starci-core-description-pair" data-grammar-description-pair="true">
                <dt className="starci-core-description-term">{item.term}</dt>
                <dd className="starci-core-description-value">{item.description}</dd>
            </div>
        ))}
    </dl>
)
