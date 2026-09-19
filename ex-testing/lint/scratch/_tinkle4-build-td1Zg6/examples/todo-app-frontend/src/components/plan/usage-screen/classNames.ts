import { cn } from "@heroui/react"

/** Brand rev 3's primary-label ink: the direction's black label on the #2F6BFF accent is provided by
 * re-pointing the accent-foreground tokens at the installed --color-black primitive, scoped to this
 * feature's GrammarRoot (brand/index.yaml assigns this to implementation, globals.css stays
 * untouched). Both are set because --accent-foreground is substituted once at :root and inherited,
 * so overriding --starci-core-accent-foreground alone cannot reach the HeroUI --button-fg chain. */
export const PLAN_THEME_SCOPE_CLASS_NAME = cn("[--starci-core-accent-foreground:var(--color-black)]", "[--accent-foreground:var(--color-black)]")

/** The desktop top bar; below the shell's compact breakpoint the compactHeader/compactNavigation own it. */
export const PLAN_HEADER_CLASS_NAME = cn("hidden", "min-[70rem]:flex", "items-center", "justify-between", "gap-6", "border-b", "border-separator", "px-6", "py-2")

/** The primary destination row inside the desktop bar. */
export const PLAN_HEADER_NAV_CLASS_NAME = cn("flex", "items-center", "gap-1")

/** The account presence cluster at the trailing edge of either header form. */
export const PLAN_ACCOUNT_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** The synthetic account avatar: decorative initials, not a control. */
export const PLAN_AVATAR_CLASS_NAME = cn("flex", "size-8", "items-center", "justify-center", "rounded-full", "bg-default", "text-sm", "font-medium")

/** The compact top bar the WorkspaceShell reveals under 70rem. */
export const PLAN_COMPACT_HEADER_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4", "border-b", "border-separator", "px-4", "py-2")

/** The destination row inside the shell's compact (sticky bottom) navigation. */
export const PLAN_COMPACT_NAV_CLASS_NAME = cn("flex", "w-full", "items-center", "justify-between", "gap-2")

/** The primary column: content first, footer parked at the bottom of the viewport column. */
export const PLAN_PRIMARY_CLASS_NAME = cn("flex", "min-h-[70dvh]", "w-full", "flex-col", "gap-6", "py-6")

/** Vertical rhythm inside the usage card, matching the task-list body's gap scale. */
export const PLAN_USAGE_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The usage row: the clamped bar fills, the truthful ratio text keeps its own width. */
export const PLAN_PROGRESS_ROW_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** The bar's share of the usage row. */
export const PLAN_PROGRESS_TRACK_CLASS_NAME = cn("min-w-0", "flex-1")

/** The action row: the upgrade button beside the Manage tasks destination; wraps on compact widths. */
export const PLAN_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-6", "gap-y-3")

/** The legal destinations at the foot of the page. */
export const PLAN_FOOTER_CLASS_NAME = cn("mt-auto", "flex", "gap-6", "border-t", "border-separator", "pt-4")
