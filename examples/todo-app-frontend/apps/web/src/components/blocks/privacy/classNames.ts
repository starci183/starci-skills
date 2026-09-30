import { cn } from "@heroui/react"

/** ui.audit.privacy: the page furniture the settled direction draws; the shell chrome is the AccountShell composite. */

/** One bordered face inside the frameless joined card; each section owns its own boundary. */
export const FACE_CLASS_NAME = cn("flex", "flex-col", "gap-3", "rounded-lg", "border", "border-[oklch(90%_0.0015_354.13)]", "bg-white", "p-6")

/** The hairline the direction draws between the two faces and above the footer. */
export const PRIVACY_RULE_CLASS_NAME = cn("border-t", "border-t-[oklch(90%_0.0015_354.13)]")

/** The confirm/cancel pair that replaces the single request action while confirmation is pending. */
export const CONFIRM_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4")

/** The request action and its nearby secondary link sit on one row. */
export const PRIVACY_ACTION_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4")
