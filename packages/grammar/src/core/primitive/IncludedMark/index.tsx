import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@heroui/react"

export type IncludedMarkProps = Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
    readonly label?: string
}

/**
 * Purpose-named offering marker: an outlined 20px circle-check in inherited
 * foreground. It deliberately does not reuse affirmative/completion state.
 */
export const IncludedMark = ({ className, label, ...props }: IncludedMarkProps) => (
    <svg
        {...props}
        aria-hidden={label === undefined ? "true" : undefined}
        aria-label={label}
        className={cn("starci-core-included-mark", className)}
        data-grammar-included-mark="true"
        focusable="false"
        role={label === undefined ? undefined : "img"}
        viewBox="0 0 20 20"
    >
        <circle cx="10" cy="10" fill="none" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="m6.5 10.25 2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
    </svg>
)
