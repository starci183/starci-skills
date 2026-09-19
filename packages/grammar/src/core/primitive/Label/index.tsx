import type { ReactNode } from "react"
import { getLabelClassName, getLabelContract } from "./classNames.js"

export type LabelProps = {
    readonly id?: string
    readonly children: ReactNode
    readonly depth?: "top" | "nested"
    /** A surface branch may promote its visible name into the document outline. */
    readonly as?: "span" | "h3"
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

    return as === "h3" ? <h3 {...shared}>{children}</h3> : <span {...shared}>{children}</span>
}
