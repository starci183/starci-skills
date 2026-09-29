"use client"

import { useSyncExternalStore } from "react"

/** Intrinsic browser hook: whether a media query matches. No product state. */
export const useMediaQuery = (query: string) =>
    useSyncExternalStore(
        (notify) => {
            const list = window.matchMedia(query)
            list.addEventListener("change", notify)
            return () => list.removeEventListener("change", notify)
        },
        () => window.matchMedia(query).matches,
        () => false,
    )
