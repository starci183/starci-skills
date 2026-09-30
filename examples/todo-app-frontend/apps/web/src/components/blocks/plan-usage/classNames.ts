import { cn } from "@heroui/react"

/** Vertical rhythm inside the usage card, matching the task-list body's gap scale. */
export const PLAN_USAGE_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The usage row: the clamped bar fills, the truthful ratio text keeps its own width. */
export const PLAN_PROGRESS_ROW_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** The bar's share of the usage row. */
export const PLAN_PROGRESS_TRACK_CLASS_NAME = cn("min-w-0", "flex-1")

/** The action row: the upgrade button beside the Manage tasks destination; wraps on compact widths. */
export const PLAN_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-6", "gap-y-3")
