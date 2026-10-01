import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

export type ListProps = Omit<ComponentPropsWithoutRef<"ul">, "children" | "role"> & {
    readonly children: ReactNode
    /** Localized accessible name of the list. */
    readonly label?: string
    /** `ul` is an unordered list (the default); `ol` is an ordered one. */
    readonly as?: "ul" | "ol"
}

/**
 * A semantic list without a card: a real `<ul>` or `<ol>` whose `ListItem` children are real `<li>` elements.
 * The list marker, margin and padding are reset so the rows carry the look; the list semantics stay with the browser.
 */
export const List = (props: ListProps) => {
    const { as: Element = "ul", label, className, children, ...rest } = props
    return (
        <Element
            {...rest}
            {...(label === undefined ? {} : { "aria-label": label })}
            className={cn("starci-core-semantic-list", className)}
            data-component="List"
            data-contract="MARGIN-0 PADDING-0 GAP-0"
            data-tier="atom"
        >
            {children}
        </Element>
    )
}
