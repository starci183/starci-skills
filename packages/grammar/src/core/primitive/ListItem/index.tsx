import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

export type ListItemProps = Omit<ComponentPropsWithoutRef<"li">, "children" | "role"> & {
    readonly children: ReactNode
}

/** One row of a `List`: a real `<li>` with no marker and no box of its own. */
export const ListItem = (props: ListItemProps) => {
    const { className, children, ...rest } = props
    return (
        <li {...rest} className={cn("starci-core-semantic-list-item", className)} data-component="ListItem" data-contract="MARGIN-0 PADDING-0" data-tier="atom">
            {children}
        </li>
    )
}
