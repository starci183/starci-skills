import { cn } from "@heroui/react"

/**
 * ui.notify.preferences' derived unsubscribe-link surface: the signed-out projection needs no shell
 * chrome, only the product name, the token-bound control, its outcome line and the policy footer.
 */

/** The signed-out column: product name, heading, control and footer stacked down the page. */
export const UNSUBSCRIBE_COLUMN_CLASS_NAME = cn("flex", "min-h-screen", "flex-col", "gap-6", "py-8")

/** The heading group stays together as one copy block. */
export const UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The token-bound control row wraps rather than overflowing a narrow viewport. */
export const UNSUBSCRIBE_ACTION_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4")

/** Policy destinations sit beside each other at the foot of the column. */
export const UNSUBSCRIBE_FOOTER_CLASS_NAME = cn("mt-auto", "flex", "items-center", "gap-6", "border-t", "border-border", "pt-6")
