import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef } from "react"

export type PageContainerProps = ComponentPropsWithoutRef<"div"> & {
    readonly measure?: "reading" | "product" | "full"
    /** Additional rule ids a composing branch already knows apply to this same element. */
    readonly ["data-contract"]?: string
}

/** Centred responsive page inset using the packaged StarCi measure scale. */
export const PageContainer = ({ className, measure = "product", ...props }: PageContainerProps) => {
    const { "data-contract": composedContract, ...rest } = props
    return (
        <div
            {...rest}
            className={cn("starci-core-page-container", className)}
            data-contract={["MARGIN-AUTO", "MEASURE-1", composedContract].filter(Boolean).join(" ")}
            data-grammar-page-measure={measure}
        />
    )
}
