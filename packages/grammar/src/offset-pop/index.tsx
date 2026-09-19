"use client"

import {
    COMMON_GRAMMAR_COMPONENTS,
    COMMON_UI_RULE_IDS,
    defineGrammarFamily,
    defineGrammarRuleConformance,
    type GrammarComponentRenderer,
    type GrammarRootProps,
} from "../common/index.js"
import { createElement } from "react"

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

const OFFSET_POP_FAMILY_EVIDENCE = {
    "ACCENT-1": ["Offset Pop binds one scoped pink decision accent."],
    "BOUNDARY-1": ["Offset Pop material targets emitted Common surface and frame hooks."],
    "COLOR-5": ["Offset Pop owns scoped light, dark, system, and forced-color variables."],
    "FOCUS-1": ["Offset Pop keeps Common focus ownership and supplies a visible family focus color."],
    "GAP-2": ["Family geometry uses the invariant Common spacing scale."],
    "MOTION-2": ["Reduced motion removes Offset Pop transforms and transition duration."],
    "PADDING-3": ["Offset Pop does not add a second inset owner to Common surface content."],
    "RESPONSIVE-4": ["Narrow viewports retain content and reduce only family shadow geometry."],
    "STATE-2": ["Pending and loading remain Common-owned; family CSS only reads emitted state hooks."],
    "SURFACE-1": ["Top and nested surface treatments preserve Common surface roles."],
} as const

export const offsetPopRuleConformance = defineGrammarRuleConformance({
    familyId: "offset-pop",
    inheritedCommonRules: COMMON_UI_RULE_IDS.filter((rule) => !(rule in OFFSET_POP_FAMILY_EVIDENCE)),
    familyEvidence: OFFSET_POP_FAMILY_EVIDENCE,
})

export const OffsetPopGrammarRoot = offsetPopGrammar.components.GrammarRoot
