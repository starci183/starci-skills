import { cn } from "@heroui/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

type NamedByLabel = {
    /** Localized accessible name of the region; it becomes the landmark's `aria-label`. */
    readonly label: string
    readonly labelledBy?: undefined
}

type NamedByHeading = {
    readonly label?: undefined
    /** The `id` of the visible heading that names the region; it becomes the landmark's `aria-labelledby`. */
    readonly labelledBy: string
}

/** `spaced` keeps room below the region; `flush` leaves it to the next region. */
export type RegionSpacing = "spaced" | "flush"

export type RegionProps = (NamedByLabel | NamedByHeading) & Omit<ComponentPropsWithoutRef<"section">, "aria-label" | "aria-labelledby" | "children" | "role"> & {
    readonly children: ReactNode
    /** Room below the region. Default `flush`. */
    readonly spacing?: RegionSpacing
}

/**
 * A named, non-card region of a page: a real `<section>` landmark with no surface, border or padding of its own.
 * A `<section>` is a landmark only when it has an accessible name, so one is required: `label`, or `labelledBy`
 * naming the region's own visible heading (for example a `SectionHeader` given that `id`). `id` is the in-page anchor
 * a link targets. Use `SurfaceCard` when the region is a card.
 */
export const Region = (props: RegionProps) => {
    const { label, labelledBy, spacing = "flush", className, children, ...rest } = props
    return (
        <section
            {...rest}
            {...(label === undefined ? { "aria-labelledby": labelledBy } : { "aria-label": label })}
            className={cn("starci-core-region", className)}
            data-component="Region"
            data-contract={spacing === "spaced" ? "MARGIN-0 PADDING-6" : "MARGIN-0 PADDING-0"}
            data-grammar-region-spacing={spacing}
            data-tier="atom"
        >
            {children}
        </section>
    )
}
