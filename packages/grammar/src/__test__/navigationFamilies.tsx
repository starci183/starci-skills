import type { ReactElement, ReactNode } from "react"
import { vi } from "vitest"
import { GrammarRoot } from "../common/index.js"
import { CoreGrammarRoot } from "../core/index.js"
import { OffsetPopGrammarRoot } from "../offset-pop/index.js"

export type FamilyCase = readonly [family: "common" | "core" | "offset-pop", wrap: (children: ReactNode) => ReactElement]

/** Every navigation-group spec renders the same object bare, under Core, and under Offset Pop. */
export const FAMILY_ROOTS: ReadonlyArray<FamilyCase> = [
    ["common", (children) => <GrammarRoot data-testid="grammar-root">{children}</GrammarRoot>],
    ["core", (children) => <CoreGrammarRoot data-testid="grammar-root">{children}</CoreGrammarRoot>],
    ["offset-pop", (children) => <OffsetPopGrammarRoot data-testid="grammar-root">{children}</OffsetPopGrammarRoot>],
]

/** The family scope the root installed (Common installs none). */
export const expectedFamilyScope = (family: FamilyCase[0]): string | null => family === "common" ? null : family

/** jsdom lacks the layout observers the vendor collections read. */
export const installVendorDomStubs = () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    })
    if (!("getAnimations" in Element.prototype)) {
        Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] })
    }
}
