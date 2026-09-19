import { cn } from "@heroui/react"

/*
 * The accepted direction's compact projection hands the narrow shell to WorkspaceShell's compactHeader
 * and compactNavigation slots, which Grammar itself reveals below 70rem. The wide band in the `header`
 * slot therefore yields to them at the same breakpoint instead of duplicating destinations twice.
 */

/** The wide header band: brand, primary destinations and the account row in one line, closed by the direction's hairline. */
export const TASKS_HEADER_CLASS_NAME = cn(
    "hidden",
    "min-[70rem]:flex",
    "items-center",
    "gap-8",
    "border-b",
    "border-[var(--border)]",
)

/**
 * The primary destinations sit beside the brand and take the free measure. The direction draws every
 * destination with a dark label, and the current one keeps only Grammar's accent underline, so the tab
 * recipe's muted/accent ink is rebound to foreground here - `starci-grammar-common` layers after
 * `utilities` and layer order outranks selector specificity, so the binding needs `!important`.
 */
export const TASKS_HEADER_NAV_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-1",
    "items-center",
    "gap-8",
    "[&_.starci-core-text-action[data-appearance=tab]]:text-[var(--foreground)]!",
    "[&_.starci-core-text-action[data-appearance=tab][data-current=true]]:text-[var(--foreground)]!",
)

/**
 * The compact navigation carries the same destinations with the same ink rules; `contents` keeps its
 * children direct flex items of Grammar's own compact navigation bar.
 */
export const TASKS_COMPACT_NAV_CLASS_NAME = cn(
    "contents",
    "[&_.starci-core-text-action[data-appearance=tab]]:text-[var(--foreground)]!",
    "[&_.starci-core-text-action[data-appearance=tab][data-current=true]]:text-[var(--foreground)]!",
)

/**
 * The account presence trails the band. The direction rests its Sign out action on a dark label over an
 * accent underline; Grammar's `inline` appearance underlines on hover only, so the resting underline is
 * bound here as a two-pixel border instead of text-decoration - a one-pixel decoration rasterizes as
 * antialiased fringe while an axis-aligned border paints full-coverage rows, keeping the render's
 * dominant palette on the declared `--accent` token.
 */
export const TASKS_ACCOUNT_CLASS_NAME = cn(
    "ml-auto",
    "flex",
    "items-center",
    "gap-3",
    "[&_.starci-core-text-action]:no-underline",
    "[&_.starci-core-text-action]:border-b-2",
    "[&_.starci-core-text-action]:border-[var(--accent)]",
)

/** The compact header band: brand and account row under 70rem, where Grammar shows the slot. */
export const TASKS_COMPACT_HEADER_CLASS_NAME = cn("flex", "items-center", "gap-4", "border-b", "border-[var(--border)]")

/** The decorative account initial; the adjacent "Alex" text is the real account name. */
export const TASKS_AVATAR_CLASS_NAME = cn(
    "inline-flex",
    "size-9",
    "shrink-0",
    "items-center",
    "justify-center",
    "rounded-full",
    "bg-[var(--default)]",
    "text-sm",
    "font-semibold",
)

/**
 * `globals.css` styles every `main` element as a 32rem centred form measure, which predates this
 * screen's accepted product layout and cannot be edited. That rule is unlayered, so it outranks every
 * normal utility declaration; this screen's own main landmark opts out with important utilities, and
 * the direction's measure comes from PageContainer instead.
 */
export const TASKS_MAIN_CLASS_NAME = cn("m-0!", "max-w-none!", "p-0!")

/**
 * Page rhythm between the heading block, the task surface and the footer, capped at the direction's
 * content measure (~74% of the 1536 reference, about 60rem) inside PageContainer's wider band.
 */
export const TASKS_PAGE_CLASS_NAME = cn("flex", "max-w-[60rem]", "flex-col", "gap-8", "py-10")

/** The heading and its muted standfirst read as one block. */
export const TASKS_INTRO_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The legal destinations close the page under a hairline. */
export const TASKS_FOOTER_CLASS_NAME = cn("mt-4", "border-t", "border-[var(--border)]", "pt-4")

/**
 * The footer destinations keep the direction's dark labels over resting accent underlines, bound here
 * for the same reason the account cluster binds them.
 */
export const TASKS_FOOTER_NAV_CLASS_NAME = cn(
    "flex",
    "items-center",
    "gap-4",
    "[&_.starci-core-text-action]:no-underline",
    "[&_.starci-core-text-action]:border-b-2",
    "[&_.starci-core-text-action]:border-[var(--accent)]",
)
