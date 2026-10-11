"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"

/** The smallest height the region keeps on a short window, so a chat or board never collapses to a sliver. */
export type FillViewportMinHeight = "none" | "sm" | "md" | "lg"

/** Space kept free below the region: `none` reaches the viewport edge, `page` leaves the page inset (1.5rem). */
export type FillViewportBottomInset = "none" | "page"

export type FillViewportProps = {
    readonly children: ReactNode
    /** `sm` 20rem, `md` 28rem (default), `lg` 36rem, `none` no floor. */
    readonly minHeight?: FillViewportMinHeight
    readonly bottomInset?: FillViewportBottomInset
    /** Accessible name when the region is a landmark (e.g. the conversation pane). Omit for a plain layout box. */
    readonly label?: string
}

/** Layout effect on the client, plain effect during server rendering (no warning, nothing to measure there). */
const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect

/**
 * Makes its child fill the viewport height left below whatever chrome sits above it (top bar, page header, tabs), and
 * keeps that true when the chrome or the window changes. It measures its own top edge in document coordinates and writes
 * it to `--starci-core-fill-top`; CSS does the rest (`100dvh` minus that offset minus the bottom inset), so the server
 * render already has a sensible full-height fallback. Children fill it (a SurfaceCard with `height="fill"`, a
 * ChatWorkspace).
 */
export const FillViewport = ({ children, minHeight = "md", bottomInset = "page", label }: FillViewportProps) => {
    const ref = useRef<HTMLDivElement>(null)

    useIsoLayoutEffect(() => {
        const node = ref.current
        if (node === null) return undefined
        let frame = 0
        const measure = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const top = node.getBoundingClientRect().top + window.scrollY
                node.style.setProperty("--starci-core-fill-top", `${Math.max(0, Math.round(top))}px`)
            })
        }
        measure()
        window.addEventListener("resize", measure)
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
        observer?.observe(document.body)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener("resize", measure)
            observer?.disconnect()
        }
    }, [])

    return (
        <div
            ref={ref}
            className="starci-core-fill-viewport"
            data-component="FillViewport"
            data-tier="composite"
            data-contract="LAYOUT-1 OVERFLOW-1"
            data-grammar-fill-min={minHeight}
            data-grammar-fill-inset={bottomInset}
            {...(label === undefined ? {} : { role: "region", "aria-label": label })}
        >
            {children}
        </div>
    )
}
