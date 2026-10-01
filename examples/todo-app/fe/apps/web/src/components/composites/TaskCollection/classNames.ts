import { cn } from "@heroui/react"

/** Vertical rhythm between the create form and the collection section beneath it. */
export const TASK_LIST_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-8")

/** The create-task row: the field takes the free measure and the submit keeps its own; they stack on compact widths. */
export const TASK_LIST_FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4", "sm:flex-row", "sm:items-end")

/** The field half of the create row; the input grows into the free measure. */
export const TASK_LIST_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")

/** The "All tasks" collection is a page section introduced by its own heading, never a card. */
export const TASK_LIST_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The rows share one list, divided by the border hairline rather than bounded by cards. */
export const TASK_LIST_ROWS_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-border")

/** The empty state centres the turtle master above its one line of copy. */
export const TASK_LIST_EMPTY_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4", "py-8", "text-center")

/** The mascot frame holds the brand minimum measure for decorative artwork. */
export const TASK_LIST_MASCOT_FRAME_CLASS_NAME = cn("w-40")
