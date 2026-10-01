import { cn } from "@heroui/react"

/** One row: the toggle and title lead, the actions trail and wrap as a group on compact widths. */
export const TASK_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-2", "py-3")

/** The completion toggle and its task title keep the leading half of the row. */
export const TASK_ROW_LABEL_CLASS_NAME = cn("min-w-0", "flex-1", "basis-48")

/** The per-row actions sit at the trailing edge and wrap as one group on compact widths. */
export const TASK_ROW_ACTIONS_CLASS_NAME = cn("ml-auto", "flex", "items-center", "gap-3")

/** The inline delete confirmation replaces the row's actions while it is open. */
export const TASK_ROW_CONFIRM_CLASS_NAME = cn("ml-auto", "flex", "items-center", "gap-3")
