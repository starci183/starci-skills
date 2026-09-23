import { createElement, type ReactNode } from "react"

/**
 * The document-outline rank a surface's visible name takes. Surfaces default to `3` (a card under
 * a page section's `h2`); a page whose cards sit directly under its `h1` passes `2`, a card nested
 * under a `h3` passes `4`, so the outline never skips a level (axe `heading-order`).
 */
export type SurfaceHeadingLevel = 2 | 3 | 4 | 5 | 6

/** The default rank of a surface name. */
export const DEFAULT_SURFACE_HEADING_LEVEL: SurfaceHeadingLevel = 3
import { getLabelClassName, getLabelContract } from "./classNames.js"

export type LabelProps = {
    readonly id?: string
    readonly children: ReactNode
    readonly depth?: "top" | "nested"
    /** A surface branch may promote its visible name into the document outline at any rank. */
    readonly as?: "span" | "h2" | "h3" | "h4" | "h5" | "h6"
}

/** Names a bounded surface region without claiming document-outline heading rank. */
export const Label = ({ id, children, depth = "top", as = "span" }: LabelProps) => {
    const shared = {
        id,
        className: getLabelClassName(),
        "data-grammar-label": "true",
        "data-grammar-label-depth": depth,
        "data-contract": getLabelContract(depth),
    } as const

    return createElement(as, shared, children)
}
