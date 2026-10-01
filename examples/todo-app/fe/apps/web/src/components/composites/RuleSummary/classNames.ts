import { cn } from "@heroui/react"

/** The rule summary and end-rule action inside the schedule card. */
export const SUMMARY_STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4", "items-start")

/** The end-rule confirmation copy and its two actions. */
export const END_CONFIRM_CLASS_NAME = cn("flex", "flex-col", "gap-3", "items-start")

/** The confirmation's action row; wraps on narrow viewports without hiding controls. */
export const FORM_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
