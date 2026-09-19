import { cn } from "@heroui/react"

/**
 * Rail geometry is SHIPPED: `.starci-core-rail*` in `src/common/styles.css` owns the widths, the
 * frame rhythm, the body scroll and the footer row. The names below are hooks, not utilities.
 */

/** Identifies the rail landmark wrapper. */
export const railClassName = cn("starci-core-rail") ?? "starci-core-rail"
/** Identifies the rail's internal frame. */
export const railFrameClassName = cn("starci-core-rail-frame") ?? "starci-core-rail-frame"
/** Identifies the rail's primary body region. */
export const railBodyClassName = cn("starci-core-rail-body") ?? "starci-core-rail-body"
/** Identifies the optional rail footer region. */
export const railFooterClassName = cn("starci-core-rail-footer") ?? "starci-core-rail-footer"
