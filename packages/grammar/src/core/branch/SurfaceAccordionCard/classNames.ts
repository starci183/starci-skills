import { cn } from "@heroui/react"
import { getSurfaceFrameClassName } from "../SurfaceCard/classNames.js"

/**
 * Disclosure-card geometry is SHIPPED.
 *
 * The root, every row, the trigger, the panel and the body are HeroUI `Accordion` parts, so
 * `.starci-core-accordion-*` in `src/common/styles.css` re-states their box in the
 * `starci-grammar-common` layer with `!important` where the vendor's `components` layer sets the
 * same property. Nothing here depends on a consumer scanning this package with Tailwind.
 */

/** Identifies the joined disclosure-card outer shell. */
export const accordionCardClassName = cn("starci-core-surface-accordion-card") ?? "starci-core-surface-accordion-card"
/** Selects bounded or frameless disclosure surfaces. */
export const getAccordionShellClassName = (bounded: boolean) => cn(
    "starci-core-accordion-shell",
    getSurfaceFrameClassName(bounded ? "bounded" : "frameless"),
)
/** Keeps the HeroUI primitive full-width inside the Grammar-owned surface shell. */
export const accordionRootClassName = cn("starci-core-accordion-root") ?? "starci-core-accordion-root"
/** Identifies one HeroUI-owned disclosure row; the primitive owns sibling separators. */
export const accordionRowClassName = cn("starci-core-accordion-row") ?? "starci-core-accordion-row"
/** Identifies the semantic disclosure heading. */
export const accordionHeadingClassName = cn("starci-core-accordion-heading") ?? "starci-core-accordion-heading"
/** Identifies the disclosure trigger control. */
export const accordionTriggerClassName = cn("starci-core-accordion-trigger") ?? "starci-core-accordion-trigger"
/** The animated HeroUI region owns no inset, so a closed panel collapses to zero height. */
export const accordionPanelClassName = cn("starci-core-accordion-panel") ?? "starci-core-accordion-panel"
/** Expanded content starts flush beneath its trigger while preserving the bottom and inline insets. */
export const accordionBodyClassName = cn("starci-core-accordion-body") ?? "starci-core-accordion-body"
/** Scroll owner around the joined disclosure rows. */
export const accordionScrollRegionClassName = cn("starci-core-accordion-scroll-region") ?? "starci-core-accordion-scroll-region"
