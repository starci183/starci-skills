import type { ReactNode } from "react"
import { expect } from "vitest"
import { GrammarRoot } from "../common/renderers.js"
import { CoreGrammarRoot } from "../core/index.js"
import { OffsetPopGrammarRoot } from "../offset-pop/index.js"

type RootCase = {
    readonly name: string
    /** `null` is bare Common: a Grammar root with no visual family installed. */
    readonly family: string | null
    readonly Root: (props: { readonly children: ReactNode }) => ReactNode
}

/** Every overlay/feedback spec renders under all three scopes: bare Common, Core and Offset Pop. */
export const GRAMMAR_ROOT_CASES: readonly RootCase[] = [
    { name: "bare Common", family: null, Root: ({ children }) => <GrammarRoot>{children}</GrammarRoot> },
    { name: "Core", family: "core", Root: ({ children }) => <CoreGrammarRoot>{children}</CoreGrammarRoot> },
    { name: "Offset Pop", family: "offset-pop", Root: ({ children }) => <OffsetPopGrammarRoot>{children}</OffsetPopGrammarRoot> },
]

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
