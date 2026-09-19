import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef } from "react"

export type SurfaceCopyGroupProps = ComponentPropsWithoutRef<"div"> & {
    readonly density?: "compact" | "comfortable"
}

/** Groups one title with its explanation before a separate action boundary. */
export const SurfaceCopyGroup = ({ className, density = "compact", ...props }: SurfaceCopyGroupProps) => (
    <div
        {...props}
        className={cn("starci-core-surface-copy-group", className)}
        data-contract={density === "comfortable" ? "GAP-3" : "GAP-2"}
        data-grammar-copy-density={density}
    />
)
