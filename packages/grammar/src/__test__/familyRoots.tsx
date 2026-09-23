/**
 * The three roots every form-control spec renders under: bare Common, the Core family and the
 * Offset Pop family. A Common component is only complete when its anatomy and ARIA hold in each.
 *
 * Lives under `src/__test__/`, excluded from `tsconfig.build.json`, so it never reaches `dist`.
 */
import type { ComponentType, ReactNode } from "react"
import { GrammarRoot } from "../common/index.js"
import { CoreGrammarRoot } from "../core/index.js"
import { OffsetPopGrammarRoot } from "../offset-pop/index.js"

type Root = ComponentType<{ readonly children?: ReactNode }>

export const FAMILY_ROOTS: ReadonlyArray<readonly [family: string, Root: Root]> = [
    ["common", GrammarRoot as Root],
    ["core", CoreGrammarRoot as Root],
    ["offset-pop", OffsetPopGrammarRoot as Root],
]

/** The text of every element an `aria-describedby` points at. */
export const describedTexts = (element: Element | null): ReadonlyArray<string> =>
    (element?.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter((id) => id !== "")
        .map((id) => document.getElementById(id)?.textContent ?? "")

/** The family scope a rendered tree sits under (`common` when no family root is present). */
export const familyOf = (container: Element) =>
    container.querySelector("[data-grammar-family]")?.getAttribute("data-grammar-family") ?? "common"

/** jsdom lacks the layout observers the vendor overlays and collections rely on. */
export const installOverlayShims = () => {
    if (typeof globalThis.ResizeObserver === "undefined") {
        globalThis.ResizeObserver = class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver
    }
    if (typeof Element !== "undefined" && !("getAnimations" in Element.prototype)) {
        Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] })
    }
}
