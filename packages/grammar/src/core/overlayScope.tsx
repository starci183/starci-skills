import { useLayoutEffect, useRef, useState } from "react"
import type { PresentationState } from "../common/state.js"

/** The neutral Common boundary every visual family installs its scope on. */
export const GRAMMAR_ROOT_SELECTOR = ".grammar-common-root"

/**
 * Where an overlay's portal lands: the nearest Grammar root around the element that invoked it.
 *
 * Overlays (dialog, drawer, popover, menu) are portalled by React Aria. Its default target is
 * `document.body`, which is OUTSIDE `.grammar-common-root[data-grammar-family]`: every family
 * selector, every family token (`--offset-pop-*`, `--starci-core-*`), the scoped light/dark theme and
 * the forced-colors mapping would silently stop applying to the overlay surface. Portalling into the
 * nearest root keeps the overlay a DOM descendant of the same scope as its trigger, so family CSS,
 * inherited custom properties and `data-grammar-theme` all still resolve. Nested roots resolve to
 * the innermost one. With no Grammar root at all the body is used, which is React Aria's default.
 */
export const resolveOverlayContainer = (anchor: Element | null): Element | null => {
    if (anchor === null) return null
    return anchor.closest(GRAMMAR_ROOT_SELECTOR) ?? anchor.ownerDocument.body
}

/**
 * Renders an inert in-place anchor and resolves the overlay portal container from it.
 *
 * The container is `null` until the anchor has mounted, so an overlay never renders into the body
 * for one frame before moving into its scope (`defaultOpen` included). Server markup contains only
 * the hidden anchor.
 */
export const useOverlayContainer = (component: string) => {
    const anchorRef = useRef<HTMLSpanElement>(null)
    const [container, setContainer] = useState<Element | null>(null)
    useLayoutEffect(() => {
        setContainer(resolveOverlayContainer(anchorRef.current))
    }, [])
    const anchor = <span ref={anchorRef} hidden data-grammar-overlay-anchor={component} />
    return { anchor, container } as const
}

/** Open-state props shared by every trigger-owned overlay. Controlled when `isOpen` is present. */
export type OverlayOpenState = {
    readonly isOpen?: boolean
    readonly defaultOpen?: boolean
    readonly onOpenChange?: (isOpen: boolean) => void
}

export const overlayOpenProps = ({ isOpen, defaultOpen, onOpenChange }: OverlayOpenState) => ({
    ...(isOpen === undefined ? {} : { isOpen }),
    ...(defaultOpen === undefined ? {} : { defaultOpen }),
    ...(onOpenChange === undefined ? {} : { onOpenChange }),
})

/** Vendor status vocabulary used by HeroUI alert, meter and alert-dialog parts. */
export type VendorStatus = "default" | "accent" | "success" | "warning" | "danger"

/** Map a render-neutral PresentationState onto the vendor status vocabulary. */
export const vendorStatusFor = (tone: PresentationState): VendorStatus => {
    if (tone === "affirmative") return "success"
    if (tone === "cautionary") return "warning"
    if (tone === "negative") return "danger"
    if (tone === "informative") return "accent"
    return "default"
}
