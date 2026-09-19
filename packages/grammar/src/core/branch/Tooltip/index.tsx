import { useId, type ReactNode } from "react"
import { tooltipContentClassName, tooltipRootClassName } from "./classNames.js"

/** Where the tooltip sits relative to its trigger. */
export type TooltipPlacement = "top" | "bottom"

/** Props for {@link Tooltip}. */
export type TooltipProps = {
    /** The already-resolved words shown on hover or focus. */
    readonly content: ReactNode
    readonly children: ReactNode
    readonly placement?: TooltipPlacement
}

/**
 * BRANCH - `Tooltip`: one hover/focus annotation anchored to a trigger.
 *
 * The trigger keeps its own semantics; this branch only owns placement, contrast and the zero-delay
 * reveal rhythm shared across StarCi surfaces.
 */
export const Tooltip = ({
    content,
    children,
    placement = "top",
}: TooltipProps) => {
    const tooltipId = useId()

    return (
        <span
            className={tooltipRootClassName}
            data-grammar-tooltip="true"
            data-grammar-tooltip-placement={placement}
        >
            <span aria-describedby={tooltipId} data-grammar-tooltip-trigger="true">
                {children}
            </span>
            <span
                id={tooltipId}
                role="tooltip"
                className={tooltipContentClassName}
                data-contract="PADDING-1 PADDING-2 FLOW-2 FONT-1"
                data-grammar-tooltip-content="true"
            >
                {content}
            </span>
        </span>
    )
}
