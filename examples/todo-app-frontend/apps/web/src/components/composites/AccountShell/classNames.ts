import { cn } from "@heroui/react"

/** The header row: the brand leads and the account presence trails. */
export const HEADER_ROW_CLASS_NAME = cn("flex", "h-16", "items-center", "justify-between", "gap-6")

/** Avatar, name and sign-out form the trailing account cluster. */
export const ACCOUNT_CLUSTER_CLASS_NAME = cn("flex", "items-center", "gap-4")

/** The readable column the shell's primary slot stacks: breadcrumb, the screen's content, footer. */
export const PRIMARY_COLUMN_CLASS_NAME = cn("flex", "flex-col", "gap-6", "py-8")
