import { cn } from "@heroui/react"

/** Vertical rhythm between the create form and the collection section beneath it. */
export const TASK_LIST_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-8")

/**
 * The create-task row: the field takes the free measure and the submit keeps its own; they stack on
 * compact widths. The `--accent-foreground` token is bound on this wrapper only: the accepted direction
 * spells black ink on the #2F6BFF primary, and `globals.css` leaves the token at its near-white default.
 * This is the only primary button on the surface, so the binding cannot leak to a second control.
 */
export const TASK_LIST_FORM_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-4",
    "sm:flex-row",
    "sm:items-end",
    "[--accent-foreground:var(--color-black)]",
)

/** The field half of the create row; the input grows into the free measure. */
export const TASK_LIST_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")

/** The "All tasks" collection is a page section introduced by its own heading, never a card. */
export const TASK_LIST_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The rows share one list, divided by the border hairline rather than bounded by cards. */
export const TASK_LIST_ROWS_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-[var(--border)]")

/** One row: the toggle and title lead, the actions trail and wrap as a group on compact widths. */
export const TASK_LIST_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-2", "py-3")

/** The completion toggle and its task title keep the leading half of the row. */
export const TASK_LIST_ROW_LABEL_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-48", "items-center", "gap-3")

/** The native checkbox keeps platform semantics; the accent check is the brand primary. */
export const TASK_LIST_CHECKBOX_CLASS_NAME = cn("size-5", "shrink-0", "accent-[var(--accent)]")

/**
 * The per-row actions sit at the trailing edge and wrap as one group on compact widths. The accepted
 * direction rests every text destination on a dark label over an accent underline; Grammar's `inline`
 * appearance underlines on hover only, so the resting underline is bound here - scoped to this cluster
 * and to the installed `--accent` token, never an invented colour.
 */
export const TASK_LIST_ROW_ACTIONS_CLASS_NAME = cn(
    "ml-auto",
    "flex",
    "items-center",
    "gap-3",
    "[&_.starci-core-text-action]:no-underline",
    "[&_.starci-core-text-action]:border-b-2",
    "[&_.starci-core-text-action]:border-[var(--accent)]",
)

/**
 * A destructive action's danger edge. The installed `ButtonVariant` vocabulary has no danger variant
 * (the ui record's GRAMMAR_REQUIRED gap), so the outline button keeps its own dark label while the
 * brand's own `--starci-core-danger` token is bound to `--border` on this wrapper - the token's
 * declared value, not an app-local red, and nothing else inside the wrapper draws a border. The edge
 * is two pixels so its centre rows rasterize at full coverage instead of a one-pixel antialiased
 * blend of the danger token. The outline also follows the direction's modest corner radius rather
 * than the vendor pill - a 24px radius spends most of the edge on antialiased corner blends.
 */
export const TASK_LIST_DANGER_SCOPE_CLASS_NAME = cn(
    "[--border:var(--starci-core-danger,oklch(65.32%_0.2335_37.78))]",
    "[&_.starci-core-button]:rounded-lg",
    "[&_.starci-core-button]:border-2",
)

/** The inline delete confirmation replaces the row's actions while it is open. */
export const TASK_LIST_CONFIRM_CLASS_NAME = cn("ml-auto", "flex", "items-center", "gap-3")

/** The empty state centres the turtle master above its one line of copy. */
export const TASK_LIST_EMPTY_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4", "py-8", "text-center")

/** The mascot frame holds the brand minimum measure for decorative artwork. */
export const TASK_LIST_MASCOT_FRAME_CLASS_NAME = cn("w-40")
