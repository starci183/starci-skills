import { cn } from "@heroui/react"

/** Completes the controlled vendor root without a second visible opener. */
export const drawerBranchTriggerClassName = cn("sr-only", "pointer-events-none")

/** The interior owns its padding, so the vendor body adds none. */
export const drawerBranchBodyClassName = cn("flex", "flex-col", "gap-4", "p-0")
