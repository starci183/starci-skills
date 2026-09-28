import { cn } from "@heroui/react"

/**
 * ui.audit.privacy: the shell chrome and page furniture the settled direction draws. The wide
 * breakpoint is 70rem because WorkspaceShell's own compact chrome appears below that viewport width
 * (styles.css's `@media (max-width: 69.999rem)` rule for compactHeader/compactNavigation), so the
 * desktop header and the compact shell never overlap.
 */

/** Desktop top bar: full-width hairline divider with the header row held to the readable measure. */
export const HEADER_BAR_CLASS_NAME = cn("hidden", "min-[70rem]:block", "border-b", "border-[oklch(90%_0.0015_354.13)]")
/** The desktop header row itself: brand left, destinations centre-left, account presence right. */
export const HEADER_ROW_CLASS_NAME = cn("mx-auto", "flex", "h-20", "max-w-[70rem]", "items-center", "justify-between", "gap-6", "px-4", "sm:px-6")
/** Brand wordmark and the destination navigation share the header's leading side. */
export const HEADER_BRAND_NAV_CLASS_NAME = cn("flex", "items-center", "gap-10")
/** The four settled destinations sit on one horizontal row. */
export const HEADER_NAV_LIST_CLASS_NAME = cn("flex", "items-center", "gap-8")
/** Avatar, name and sign-out form the header's trailing account cluster. */
export const HEADER_ACCOUNT_CLASS_NAME = cn("flex", "items-center", "gap-4")

/** Compact top bar: brand plus account access only; the destinations live in compactNavigation. */
export const COMPACT_HEADER_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4", "border-b", "border-[oklch(90%_0.0015_354.13)]", "px-4", "py-3")
/** Avatar, name and sign-out form the compact header's trailing account cluster. */
export const COMPACT_ACCOUNT_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** The synthetic account presence: a neutral circle with the person's initial. */
export const AVATAR_CLASS_NAME = cn("flex", "h-8", "w-8", "items-center", "justify-center", "rounded-full", "bg-[oklch(92%_0.002_354.13)]", "text-sm", "font-medium")

/** The one readable column the direction centers at about 1120px. `mainLandmark: "caller"` makes the
 * shell render a neutral div rather than `<main>`, so this role="main" div owns the landmark and the
 * global `main { max-width: 32rem }` rule in globals.css (which this lane cannot edit) does not cap it. */
export const PRIMARY_COLUMN_CLASS_NAME = cn("mx-auto", "flex", "w-full", "max-w-[70rem]", "flex-col", "gap-6", "px-4", "py-8", "sm:px-6")

/** One bordered face inside the frameless joined card; each section owns its own boundary. */
export const FACE_CLASS_NAME = cn("flex", "flex-col", "gap-3", "rounded-lg", "border", "border-[oklch(90%_0.0015_354.13)]", "bg-white", "p-6")

/** The hairline the direction draws between the two faces and above the footer. */
export const RULE_CLASS_NAME = cn("border-t", "border-t-[oklch(90%_0.0015_354.13)]")

/** The confirm/cancel pair that replaces the single request action while confirmation is pending. */
export const CONFIRM_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4")

/** The request action and its nearby secondary link sit on one row. */
export const ACTION_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4")

/** Footer destinations sit beside each other above the page's bottom edge. */
export const FOOTER_ROW_CLASS_NAME = cn("flex", "items-center", "gap-6", "pt-6")
