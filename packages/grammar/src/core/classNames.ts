import { cn } from "@heroui/react"

/** Identifies the quiet ordinal prefix used by ordered content. */
export const leadingNumberClassName = cn("starci-core-leading-number") ?? "starci-core-leading-number"
/** Identifies one static state row shell. */
export const staticRowClassName = cn("starci-core-static-row") ?? "starci-core-static-row"
/** Identifies the text grouping inside a static state row. */
export const staticRowCopyClassName = cn("starci-core-static-row-copy") ?? "starci-core-static-row-copy"

/** Identifies the full page that centres one compact form surface. */
export const formPageClassName = cn("starci-core-form-page")
/** Identifies the bounded viewport that owns form-surface scrolling under zoom. */
export const formScrollViewportClassName = cn("starci-core-form-scroll-viewport")
/** Identifies a form card whose inset belongs to its content region. */
export const formSurfaceClassName = cn("starci-core-form-surface")
/** Narrows only a form state whose own content remains comfortable at the compact measure. */
export const formCompactSurfaceClassName = cn("starci-core-form-surface--compact")
/** Identifies the vertical label-control-help anatomy of one form field. */
export const formFieldClassName = cn("starci-core-form-field")
/** Identifies a semantic form label that remains available only to assistive technology. */
export const formScreenReaderLabelClassName = cn("starci-core-form-label--screen-reader")
/** Identifies content whose intrinsic inline measure must scroll instead of being compressed. */
export const horizontalScrollRegionClassName = cn("starci-core-horizontal-scroll-region")
