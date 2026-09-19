import { cn } from "@heroui/react"
import { horizontalScrollRegionClassName } from "../../classNames.js"

/** Owns the full-width peer-tab region without allowing intrinsic content to widen the page. */
export const tabsFrameClassName = cn("starci-core-tabs-frame")
/** Makes clipped destinations reachable through the Core horizontal overflow treatment. */
export const tabsScrollClassName = cn(horizontalScrollRegionClassName, "starci-core-tabs-scroll")
/** Preserves the tab row's intrinsic width inside its scroll owner. */
export const tabsClassName = cn("starci-core-tabs")
/** Keeps icon and stable label aligned as one tab identity. */
export const tabContentClassName = cn("starci-core-tab-content")
/** Core hides labels only while the accessible name and icon remain available. */
export const tabLabelClassName = cn("starci-core-tab-label")
