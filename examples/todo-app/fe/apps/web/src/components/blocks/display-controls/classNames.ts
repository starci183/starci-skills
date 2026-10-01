import { cn } from "@heroui/react"

/**
 * The display controls sit fixed in the viewport's lower corner, above the product chrome without
 * belonging to any one screen's header. Under the shell's compact breakpoint they are lifted clear
 * of the sticky navigation band and layered above it, so they stay reachable on phones.
 */
export const DISPLAY_CONTROLS_CLASS_NAME = cn(
    "fixed",
    "right-4",
    "bottom-24",
    "z-60",
    "flex",
    "items-center",
    "gap-2",
    "min-[70rem]:bottom-4",
    "min-[70rem]:z-40",
)
