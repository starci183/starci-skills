import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef } from "react"

export type GrammarRootProps = Omit<ComponentPropsWithoutRef<"div">, "color"> & {
    /** `system` follows the reader unless an explicit light or dark scope is requested. */
    readonly theme?: "system" | "light" | "dark"
    /** Visual families install their scoped material contract on this neutral root. */
    readonly "data-grammar-family"?: string
}

/** Neutral Common boundary. Select a visual family with its `scopeProps`. */
export const GrammarRoot = ({ className, theme = "system", ...props }: GrammarRootProps) => (
    <div
        {...props}
        className={cn("grammar-common-root", className)}
        data-grammar="common"
        data-grammar-theme={theme}
    />
)
