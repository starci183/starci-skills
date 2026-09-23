import type { KeyboardEvent } from "react"

export type RovingOrientation = "horizontal" | "vertical" | "both"

const PREVIOUS: Record<RovingOrientation, ReadonlyArray<string>> = {
    horizontal: ["ArrowLeft"],
    vertical: ["ArrowUp"],
    both: ["ArrowLeft", "ArrowUp"],
}

const NEXT: Record<RovingOrientation, ReadonlyArray<string>> = {
    horizontal: ["ArrowRight"],
    vertical: ["ArrowDown"],
    both: ["ArrowRight", "ArrowDown"],
}

const isOperable = (element: HTMLElement) => !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true"

/**
 * Arrow/Home/End focus movement between the peer controls of one navigation object.
 *
 * Every peer stays in the Tab order (these are links and buttons, not a composite widget), so the
 * arrows are an accelerator, never the only way to reach an item. Right-to-left documents swap the
 * horizontal arrows. Returns whether focus moved, and only then prevents the browser default.
 */
export const moveFocusBetweenPeers = (
    event: KeyboardEvent<HTMLElement>,
    selector: string,
    orientation: RovingOrientation,
): boolean => {
    const container = event.currentTarget
    const peers = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(isOperable)
    const index = peers.findIndex((peer) => peer === event.target || peer.contains(event.target as Node))
    if (index < 0 || peers.length === 0) return false
    const rtl = container.closest("[dir]")?.getAttribute("dir") === "rtl"
    const key = rtl && orientation !== "vertical"
        ? event.key === "ArrowLeft" ? "ArrowRight" : event.key === "ArrowRight" ? "ArrowLeft" : event.key
        : event.key
    let next = index
    if (PREVIOUS[orientation].includes(key)) next = index === 0 ? peers.length - 1 : index - 1
    else if (NEXT[orientation].includes(key)) next = index === peers.length - 1 ? 0 : index + 1
    else if (key === "Home") next = 0
    else if (key === "End") next = peers.length - 1
    else return false
    event.preventDefault()
    peers[next]?.focus()
    return true
}
