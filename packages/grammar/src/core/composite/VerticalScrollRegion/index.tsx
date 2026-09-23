import { createElement, type ComponentProps, type ReactNode } from "react"
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
    /**
     * The element the region renders when it is NOT scrollable. A list owner passes `ul`/`ol` so its
     * `<li>` rows have a real list parent; when scrollable the region is HeroUI's ScrollShadow `div`,
     * and the owner gives it `role="list"` instead.
     */
    readonly as?: "div" | "ul" | "ol"
    /**
     * Keyboard reachability of a scrolling region (WCAG 2.1.1, axe `scrollable-region-focusable`).
     * Default `true`: a scrollable region joins the Tab order (`tabIndex=0`) so its content can be
     * scrolled without a pointer, and a region named by `aria-label`/`aria-labelledby` is exposed as
     * `role="region"` unless the owner passes its own role. Pass `false` only when every scrolled
     * item is itself focusable (a tab strip, an input group), so the region adds no empty stop.
     */
    readonly isFocusable?: boolean
    /** Hide scrollbar chrome by default while retaining wheel, touch and keyboard scrolling. */
    readonly hideScrollBar?: boolean
    /** The region's own overflow answer; the stamp and the render both follow it. */
    readonly overflow?: VerticalScrollRegionOverflow
}

/**
 * The attributes that make a scrolling region keyboard-reachable and, when named, a navigable
 * region. Shared by every Common scroll owner so the rule is stated once.
 */
export const scrollRegionFocusProps = (
    props: Pick<ComponentProps<"div">, "aria-label" | "aria-labelledby" | "role" | "tabIndex">,
    isFocusable: boolean,
): Pick<ComponentProps<"div">, "role" | "tabIndex"> => {
    if (!isFocusable) return {}
    const isNamed = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined
    const role = props.role ?? (isNamed ? "region" : undefined)
    return { tabIndex: props.tabIndex ?? 0, ...(role === undefined ? {} : { role }) }
}

/** Use HeroUI's Vertical ScrollShadow without making consumers own its DOM contract. */
export const VerticalScrollRegion = (props: VerticalScrollRegionProps) => {
    const { children, isScrollable, as: Element = "div", isFocusable = true, hideScrollBar = true, overflow = "always", ...regionProps } = props
    const contract = overflow === "needed" ? "MEASURE-7 OVERFLOW-4" : "MEASURE-7 OVERFLOW-3"
    return isScrollable
        ? <ScrollShadow {...regionProps} {...scrollRegionFocusProps(regionProps, isFocusable)} data-contract={contract} data-grammar-overflow={overflow} data-grammar-scroll-region="vertical" hideScrollBar={hideScrollBar} orientation="vertical">{children}</ScrollShadow>
        : createElement(Element, regionProps, children)
}
