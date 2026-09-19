import type { ComponentProps, ReactNode } from "react"
import { ScrollShadow } from "@heroui/react"

/**
 * Which overflow answer this region gives for its one axis.
 *
 * `always` is the region standing on its own: the block axis scrolls, full stop (OVERFLOW-3).
 * `needed` is that same one axis scrolling only where the content actually overflows (OVERFLOW-4).
 * The region is the node that carries the stamp, so the owner has to be able to say which of the two
 * it is; a `data-contract` passed in was, and still is, silently replaced by this element's own.
 */
export type VerticalScrollRegionOverflow = "always" | "needed"

export type VerticalScrollRegionProps = Omit<ComponentProps<"div">, "children"> & {
    readonly children: ReactNode
    readonly isScrollable: boolean
    /** Hide scrollbar chrome by default while retaining wheel, touch and keyboard scrolling. */
    readonly hideScrollBar?: boolean
    /** The region's own overflow answer; the stamp and the render both follow it. */
    readonly overflow?: VerticalScrollRegionOverflow
}

/** Use HeroUI's Vertical ScrollShadow without making consumers own its DOM contract. */
export const VerticalScrollRegion = (props: VerticalScrollRegionProps) => {
    const { children, isScrollable, hideScrollBar = true, overflow = "always", ...regionProps } = props
    const contract = overflow === "needed" ? "MEASURE-7 OVERFLOW-4" : "MEASURE-7 OVERFLOW-3"
    return isScrollable
        ? <ScrollShadow {...regionProps} data-contract={contract} data-grammar-overflow={overflow} data-grammar-scroll-region="vertical" hideScrollBar={hideScrollBar} orientation="vertical">{children}</ScrollShadow>
        : <div {...regionProps}>{children}</div>
}
