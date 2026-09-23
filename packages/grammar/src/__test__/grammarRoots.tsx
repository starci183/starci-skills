/**
 * The three Grammar roots every component spec renders under: bare Common, the Core family and the
 * Offset Pop family. A Common component is only complete when its anatomy and ARIA hold in each.
 *
 * One list, three call shapes (each component lane wrote its own helper; they are merged here):
 * `FAMILY_ROOTS` (forms: `[family, Root]`), `GRAMMAR_ROOT_CASES` (overlays: `{ name, family, Root }`)
 * and `FAMILY_WRAPS` (navigation: `[family, wrap]`).
 *
 * Lives under `src/__test__/`, excluded from `tsconfig.build.json`, so it never reaches `dist`.
 */
import type { ComponentType, ReactElement, ReactNode } from "react"
import { expect } from "vitest"
import { GrammarRoot } from "../common/index.js"
import { CoreGrammarRoot } from "../core/index.js"
import { OffsetPopGrammarRoot } from "../offset-pop/index.js"

export type GrammarFamily = "common" | "core" | "offset-pop"
type Root = ComponentType<{ readonly children?: ReactNode, readonly "data-testid"?: string }>

const ROOTS: ReadonlyArray<readonly [family: GrammarFamily, name: string, Root: Root]> = [
    ["common", "bare Common", GrammarRoot as Root],
    ["core", "Core", CoreGrammarRoot as Root],
    ["offset-pop", "Offset Pop", OffsetPopGrammarRoot as Root],
]

/** Forms shape: `[family, Root]`. */
export const FAMILY_ROOTS: ReadonlyArray<readonly [family: GrammarFamily, Root: Root]> = ROOTS.map(([family, , Root]) => [family, Root] as const)

type RootCase = {
    readonly name: string
    /** `null` is bare Common: a Grammar root with no visual family installed. */
    readonly family: string | null
    readonly Root: (props: { readonly children: ReactNode }) => ReactNode
}

/** Overlays shape: `{ name, family, Root }`, with `family: null` for bare Common. */
export const GRAMMAR_ROOT_CASES: ReadonlyArray<RootCase> = ROOTS.map(([family, name, Root]) => ({
    name,
    family: family === "common" ? null : family,
    Root: ({ children }: { readonly children: ReactNode }) => <Root>{children}</Root>,
}))

export type FamilyCase = readonly [family: GrammarFamily, wrap: (children: ReactNode) => ReactElement]

/** Navigation shape: `[family, wrap]`; each root carries `data-testid="grammar-root"`. */
export const FAMILY_WRAPS: ReadonlyArray<FamilyCase> = ROOTS.map(([family, , Root]) =>
    [family, (children: ReactNode) => <Root data-testid="grammar-root">{children}</Root>] as const)

/** The text of every element an `aria-describedby` points at. */
export const describedTexts = (element: Element | null): ReadonlyArray<string> =>
    (element?.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter((id) => id !== "")
        .map((id) => document.getElementById(id)?.textContent ?? "")

/** The family scope a rendered tree sits under (`common` when no family root is present). */
export const familyOf = (container: Element) =>
    container.querySelector("[data-grammar-family]")?.getAttribute("data-grammar-family") ?? "common"

/** The family scope a root installs (Common installs none). */
export const expectedFamilyScope = (family: GrammarFamily): string | null => family === "common" ? null : family

/**
 * Assert an element (typically a portalled overlay surface) is a DOM descendant of a Grammar root that
 * carries exactly the expected family scope, i.e. family CSS selectors and tokens still reach it.
 */
export const expectInFamilyScope = (element: Element | null, family: string | null) => {
    expect(element).not.toBeNull()
    const root = element?.closest(".grammar-common-root") ?? null
    expect(root).not.toBeNull()
    expect(root?.getAttribute("data-grammar-family") ?? null).toBe(family)
}

/** jsdom lacks the layout observers and animation API the vendor overlays and collections read. */
export const installDomShims = () => {
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
