import { cn } from "@heroui/react"

/**
 * The signed-in workspace chrome: the wide breakpoint is 70rem because WorkspaceShell's own compact
 * chrome appears below that viewport width (the `@media (max-width: 69.999rem)` rule that turns
 * compactHeader/compactNavigation on), so the desktop header and the compact shell never overlap.
 * Colour utilities are the theme's semantic tokens, not raw palette values.
 */

/** Desktop top bar: full-width hairline divider, hidden while the compact shell is active. */
export const ACCOUNT_SHELL_HEADER_BAR_CLASS_NAME = cn("hidden", "min-[70rem]:block", "border-b", "border-border")

/** The desktop header row itself: brand and destinations left, account presence right. */
export const HEADER_ROW_CLASS_NAME = cn("flex", "h-20", "items-center", "justify-between", "gap-6")

/** Brand wordmark and the destination navigation share the header's leading side. */
export const HEADER_BRAND_NAV_CLASS_NAME = cn("flex", "items-center", "gap-10")

/** The four settled destinations sit on one horizontal row. */
export const HEADER_NAV_LIST_CLASS_NAME = cn("flex", "items-center", "gap-8")

/** Avatar, name and sign-out form the trailing account cluster, in either header. */
export const ACCOUNT_CLUSTER_CLASS_NAME = cn("flex", "items-center", "gap-4")

/** Compact top bar: brand plus account access only; the destinations live in compactNavigation. */
export const COMPACT_HEADER_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4", "border-b", "border-border", "px-4", "py-3")

/** The synthetic account presence: a neutral circle with the person's initial. */
export const ACCOUNT_SHELL_AVATAR_CLASS_NAME = cn("flex", "h-8", "w-8", "items-center", "justify-center", "rounded-full", "bg-surface-secondary", "text-sm", "font-medium")

/** The readable column the shell's primary slot stacks: breadcrumb, the screen's content, footer. */
export const PRIMARY_COLUMN_CLASS_NAME = cn("flex", "flex-col", "gap-6", "py-8")

/** Footer destinations sit beside each other at the bottom of the column. */
export const FOOTER_ROW_CLASS_NAME = cn("flex", "items-center", "gap-6", "pt-6")
