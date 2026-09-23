import { cn } from "@heroui/react"

/** Joins an owned anatomy class with an optional consumer class, never yielding `undefined`. */
export const navigationClassName = (base: string, extra?: string): string => cn(base, extra) ?? base
