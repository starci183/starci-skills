import { cn } from "@heroui/react"

/** Field stack inside the schedule form. */
export const SCHEDULE_FORM_CLASS_NAME = cn("flex", "flex-col", "gap-5")

/** The save/cancel action row; wraps on narrow viewports without hiding controls. */
export const SCHEDULE_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
