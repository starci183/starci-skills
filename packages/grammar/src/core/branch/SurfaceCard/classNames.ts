import { cn } from "@heroui/react"
import {
    formCompactSurfaceClassName,
    formScrollViewportClassName,
    formSurfaceClassName,
} from "../../classNames.js"

export type SurfaceCardMeasure = "content" | "form" | "formCompact"
export type SurfaceCardHeight = "auto" | "fill"

/**
 * Surface-card geometry is SHIPPED.
 *
 * Every name below hooks a `.starci-core-*` rule in `src/common/styles.css`. The card, its header
 * and its content region are HeroUI `Card` parts, so the sheet re-states their box in the
 * `starci-grammar-common` layer with `!important` where the vendor's `components` layer sets the
 * same property; the utilities that used to do that only existed where a consumer's Tailwind build
 * scanned this package.
 */

/** Identifies the outer labelled surface-card anatomy. */
export const surfaceCardClassName = cn("starci-core-surface-card") ?? "starci-core-surface-card"
/** Selects an owned measure and height contract without exposing structural class hooks to consumers. */
export const getSurfaceCardClassName = (measure: SurfaceCardMeasure, height: SurfaceCardHeight) => cn(
    surfaceCardClassName,
    measure === "form" || measure === "formCompact" ? formSurfaceClassName : undefined,
    measure === "formCompact" ? formCompactSurfaceClassName : undefined,
    height === "fill" ? "starci-core-surface-card--fill" : undefined,
)
/** Identifies the external label row of a surface card. */
export const surfaceLabelClassName = cn("starci-core-surface-label") ?? "starci-core-surface-label"
/** Identifies the bounded surface content shell. */
export const surfaceClassName = cn("starci-core-surface") ?? "starci-core-surface"
/** Frameless surfaces let nested bounded cards own clipping; Core CSS sets overflow: visible. */
export const framelessSurfaceClassName = cn("starci-core-surface", "starci-core-frameless-surface") ?? "starci-core-surface starci-core-frameless-surface"
/** Identifies the content region inside a surface. */
export const surfaceContentClassName = cn("starci-core-surface-content") ?? "starci-core-surface-content"
/** Binds the form-scroll measure to the Grammar-owned scroll viewport only when it exists. */
export const getSurfaceContentClassName = (measure: SurfaceCardMeasure, contained: boolean) => cn(
    surfaceContentClassName,
    contained && (measure === "form" || measure === "formCompact") ? formScrollViewportClassName : undefined,
)
/** Anchor the singular legacy continuation highlight at the surface boundary. */
export const surfaceHighlightClassName = cn("starci-core-surface-highlight") ?? "starci-core-surface-highlight"
/** Decorative sweep layer painted behind the highlighted surface. */
export const surfaceHighlightSweepClassName = cn("starci-core-surface-highlight-sweep") ?? "starci-core-surface-highlight-sweep"

/** Selects the bounded or frameless surface treatment without changing anatomy. */
export const getSurfaceFrameClassName = (frame: "bounded" | "frameless") => cn(
    frame === "frameless" ? framelessSurfaceClassName : surfaceClassName,
)
