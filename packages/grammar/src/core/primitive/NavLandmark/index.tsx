import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

/** `bar` clusters the links in a roomy top bar; `scrolling` keeps one tight row that scrolls sideways when narrow. */
export type NavLandmarkLayout = "bar" | "scrolling"

export type NavLandmarkProps = Omit<ComponentPropsWithoutRef<"nav">, "aria-label" | "aria-labelledby" | "children" | "role"> & {
    /** The landmark's accessible name, so a screen reader can tell this navigation from another. */
    readonly label: string
    /** How the links are laid out. */
    readonly layout: NavLandmarkLayout
    /** The links of the navigation. */
    readonly children: ReactNode
}

/**
 * A named navigation landmark: a real `<nav>` that holds a row of links and draws no surface of its own.
 * Use `Subnav`, `Breadcrumbs` or `NavigationFeatureNav` when the navigation has its own anatomy.
 */
export const NavLandmark = (props: NavLandmarkProps) => {
    const { label, layout, className, children, ...rest } = props
    return (
        <nav
            {...rest}
            aria-label={label}
            className={cn("starci-core-nav-landmark", className)}
            data-component="NavLandmark"
            data-contract={layout === "bar" ? "GAP-4" : "GAP-1"}
            data-grammar-nav-layout={layout}
            data-tier="atom"
        >
            {children}
        </nav>
    )
}
