"use client"

import {
    COMMON_GRAMMAR_COMPONENTS,
    defineGrammarFamily,
    type GrammarComponentRenderer,
    type GrammarRootProps,
} from "../common/index.js"
import { createElement } from "react"

// Offset Pop inherits every Common renderer and type, exactly like Core; the names Offset Pop defines
// itself (its root, tokens, DNA, conformance) win over the same names below. A consumer may import
// renderers from this entry or from @starci/grammar/common; both name the same Common components.
export * from "../common/index.js"

export {
    OFFSET_POP_BAND_TOKEN_NAMES,
    OFFSET_POP_DARK_TOKEN_DEFAULTS,
    OFFSET_POP_DNA,
    OFFSET_POP_SPACING_SCALE,
    OFFSET_POP_TOKEN_DEFAULTS,
    OFFSET_POP_TOKEN_NAMES,
    type OffsetPopBandTokenName,
    type OffsetPopDna,
    type OffsetPopSpacingStep,
    type OffsetPopSpacingValue,
    type OffsetPopTokenDefaults,
    type OffsetPopTokenName,
} from "./dna.js"

export { OFFSET_POP_FAMILY_EVIDENCE, offsetPopRuleConformance } from "./conformance.js"

/** Installs the Offset Pop scope without changing Common root props or behavior. */
const OffsetPopGrammarRootRenderer: GrammarComponentRenderer<GrammarRootProps> = (props) => {
    const CommonGrammarRoot = COMMON_GRAMMAR_COMPONENTS.GrammarRoot
    return createElement(CommonGrammarRoot, { ...props, "data-grammar-family": "offset-pop" })
}

/** Official product-neutral Offset Pop sibling family over the Common contract. */
export const offsetPopGrammar = defineGrammarFamily({
    id: "offset-pop",
    styles: {
        entrypoint: "@starci/grammar/offset-pop/styles.css",
        scope: { attribute: "data-grammar-family", value: "offset-pop" },
    },
    components: {
        replacements: {
            GrammarRoot: OffsetPopGrammarRootRenderer,
        },
        extensions: {},
    },
})

export const OffsetPopGrammarRoot = offsetPopGrammar.components.GrammarRoot
