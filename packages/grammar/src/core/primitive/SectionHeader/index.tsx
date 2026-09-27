import { cn } from "@heroui/react"
import { createElement, type ReactNode } from "react"

export type SectionHeaderProps = {
    readonly title: ReactNode
    readonly description?: ReactNode
    readonly eyebrow?: ReactNode
    readonly action?: ReactNode
    /**
     * How many items the section holds, drawn after the title as a muted "(n)" in the title's own line
     * (e.g. "Installations (2)"). It is part of the heading's accessible name.
     */
    readonly count?: number
    /**
     * Trailing meta of the section - where and when its facts come from (a source time, "Inventoried at
     * 10:00"). FONT-1 muted, at the end of the header row, before any `action`.
     */
    readonly meta?: ReactNode
    /** Outline rank of the title. Default `2`; pick the rank that follows the heading above it. */
    readonly level?: 1 | 2 | 3 | 4 | 5 | 6
    readonly className?: string
    readonly id?: string
    /** Closed semantic anatomy; ContextIntro requires eyebrow, title and description. */
    readonly composition?: "section-header" | "context-intro"
}

/**
 * Reusable title-copy-action hierarchy shared by StarCi product sections.
 *
 * It renders a plain `div`, never `<header>`: outside a sectioning element a `<header>` is the page
 * banner landmark, and the banner belongs to the application bar (TopBar / NavigationFeatureNav /
 * WorkspaceShell header). A section heading group must not add a second one.
 */
export const SectionHeader = ({
    title,
    description,
    eyebrow,
    action,
    count,
    meta,
    level = 2,
    className,
    id,
    composition = "section-header",
}: SectionHeaderProps) => (
    <div
        className={cn("starci-core-section-header", className)}
        data-component="SectionHeader"
        data-tier="atom"
        data-contract="GAP-5"
        data-grammar-section-header="true"
        data-grammar-composition={composition}
    >
        <div className="starci-core-section-header-copy" data-contract="GAP-2">
            {eyebrow === undefined ? null : <div className="starci-core-section-eyebrow">{eyebrow}</div>}
            {createElement(
                `h${level}`,
                { className: "starci-core-section-title", id, "data-contract": "MARGIN-0 FLOW-3" },
                title,
                count === undefined ? null : (
                    <span key="count" className="starci-core-section-count" data-grammar-section-count={count} data-contract="TONE-2">
                        {` (${count})`}
                    </span>
                ),
            )}
            {description === undefined ? null : <div className="starci-core-section-description">{description}</div>}
        </div>
        {meta === undefined ? null : <div className="starci-core-section-meta" data-contract="FONT-1 TONE-2">{meta}</div>}
        {action === undefined ? null : <div className="starci-core-section-action">{action}</div>}
    </div>
)
