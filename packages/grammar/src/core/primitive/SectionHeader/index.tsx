import { cn } from "@heroui/react"
import { createElement, type ReactNode } from "react"

export type SectionHeaderProps = {
    readonly title: ReactNode
    readonly description?: ReactNode
    readonly eyebrow?: ReactNode
    readonly action?: ReactNode
    readonly level?: 1 | 2 | 3 | 4
    readonly className?: string
    readonly id?: string
    /** Closed semantic anatomy; ContextIntro requires eyebrow, title and description. */
    readonly composition?: "section-header" | "context-intro"
}

/** Reusable title-copy-action hierarchy shared by StarCi product sections. */
export const SectionHeader = ({
    title,
    description,
    eyebrow,
    action,
    level = 2,
    className,
    id,
    composition = "section-header",
}: SectionHeaderProps) => (
    <header className={cn("starci-core-section-header", className)} data-contract="GAP-5" data-grammar-section-header="true" data-grammar-composition={composition}>
        <div className="starci-core-section-header-copy" data-contract="GAP-2">
            {eyebrow === undefined ? null : <div className="starci-core-section-eyebrow">{eyebrow}</div>}
            {createElement(`h${level}`, { className: "starci-core-section-title", id, "data-contract": "MARGIN-0 FLOW-3" }, title)}
            {description === undefined ? null : <div className="starci-core-section-description">{description}</div>}
        </div>
        {action === undefined ? null : <div className="starci-core-section-action">{action}</div>}
    </header>
)
