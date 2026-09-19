import { cn } from "@heroui/react"
import type { ReactNode } from "react"

export type PrimaryRailLayoutProps = {
    readonly primary: ReactNode
    readonly rail?: ReactNode
    readonly railWidth?: "compact" | "standard" | "wide"
    readonly align?: "start" | "stretch"
    /**
     * Reading order once the container collapses to one column. `primary-first` keeps the dominant
     * content on top; `rail-first` lifts the rail above it, for a filter or summary a reader needs
     * before the content itself. Shipped in the container query, so no consumer reorders by hand.
     */
    readonly collapsedOrder?: "primary-first" | "rail-first"
    readonly className?: string
}

/**
 * Dominant product content plus one subordinate rail. The composition changes
 * to a single reading flow when the owning container becomes constrained.
 */
export const PrimaryRailLayout = ({
    primary,
    rail,
    railWidth = "standard",
    align = "start",
    collapsedOrder = "primary-first",
    className,
}: PrimaryRailLayoutProps) => (
    <div className={cn("starci-core-primary-rail-container", className)}>
        <div
            className="starci-core-primary-rail-layout"
            data-contract="GAP-5"
            data-grammar-layout-align={align}
            data-grammar-layout-collapsed-order={collapsedOrder}
            data-grammar-layout-rail={rail === undefined ? "absent" : "present"}
            data-grammar-layout-rail-width={railWidth}
        >
            <div className="starci-core-primary-region" data-grammar-primary-region="true">{primary}</div>
            {rail === undefined ? null : <div className="starci-core-rail-region" data-grammar-rail-region="true">{rail}</div>}
        </div>
    </div>
)
