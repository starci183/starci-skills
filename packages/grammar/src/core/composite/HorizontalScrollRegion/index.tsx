import { forwardRef, type ComponentProps, type ReactNode } from "react"
import { ScrollShadow, cn } from "@heroui/react"

/**
 * Which overflow answer this region gives for its one axis.
 *
 * `always` is the region standing on its own: the axis scrolls, full stop (OVERFLOW-3). `needed` is
 * the same one axis scrolling only where the content actually overflows (OVERFLOW-4) - the answer a
 * peer strip gives. The region is the node that carries the stamp, so the owner has to be able to
 * say which of the two it is; passing `data-contract` in was silently replaced by this element's own.
 */
export type HorizontalScrollRegionOverflow = "always" | "needed"

export type HorizontalScrollRegionProps = Omit<ComponentProps<"div">, "children"> & {
    readonly children: ReactNode
    /** Uses the ScrollShadow-owned no-chrome treatment while retaining horizontal reachability. */
    readonly hideScrollBar?: boolean
    /** The region's own overflow answer; the stamp and the render both follow it. */
    readonly overflow?: HorizontalScrollRegionOverflow
}

/** Preserve intrinsic inline content and expose HeroUI's horizontal overflow affordance. */
export const HorizontalScrollRegion = forwardRef<HTMLDivElement, HorizontalScrollRegionProps>((props, ref) => {
    const { hideScrollBar = true, overflow = "always", className, ...regionProps } = props
    const contract = overflow === "needed"
        ? "PADDING-1 MEASURE-3 OVERFLOW-4 OVERFLOW-5"
        : "PADDING-1 MEASURE-3 OVERFLOW-3 OVERFLOW-5"
    return (
        <ScrollShadow
            {...regionProps}
            ref={ref}
            className={cn("starci-core-horizontal-scroll-region", className)}
            data-contract={contract}
            data-grammar-overflow={overflow}
            hideScrollBar={hideScrollBar}
            orientation="horizontal"
        />
    )
})

HorizontalScrollRegion.displayName = "HorizontalScrollRegion"
