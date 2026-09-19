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

/** Resolved institutional identity; destination behavior remains with the consumer. */
export type HeritageBrandProps = {
    readonly name: string
    readonly descriptor: string
    readonly logo: {
        readonly src: string
        readonly width: number
        readonly height: number
    }
}

const HeritageGrammarRootRenderer: GrammarComponentRenderer<GrammarRootProps> = (props) => {
    const CommonGrammarRoot = COMMON_GRAMMAR_COMPONENTS.GrammarRoot
    return createElement(CommonGrammarRoot, { ...props, "data-grammar-family": "heritage" })
}

/** Family extension for non-interactive brand content inside a consumer-owned destination. */
const HeritageBrandRenderer: GrammarComponentRenderer<HeritageBrandProps> = ({ name, descriptor, logo }) => (
    <span data-family-component="Brand">
        <span data-family-part="brand-mark" aria-hidden="true">
            <img src={logo.src} alt="" width={logo.width} height={logo.height} />
        </span>
        <span data-family-part="brand-copy">
            <strong>{name}</strong>
            <span>{descriptor}</span>
        </span>
    </span>
)

/** Official product-neutral Heritage family contract. */
export const heritageGrammar = defineGrammarFamily({
    id: "heritage",
    styles: {
        entrypoint: "@starci/grammar/heritage/styles.css",
        scope: { attribute: "data-grammar-family", value: "heritage" },
    },
    components: {
        replacements: {
            GrammarRoot: HeritageGrammarRootRenderer,
        },
        extensions: {
            Brand: HeritageBrandRenderer,
        },
    },
})

const HERITAGE_FAMILY_EVIDENCE = {
    "A11Y-4": ["Brand is non-interactive and its supplied image is decorative."],
    "BOUNDARY-1": ["Heritage surfaces bind material only through emitted Common surface hooks."],
    "COLOR-5": ["Heritage owns scoped light, dark, system, and forced-color variables."],
    "FOCUS-1": ["Heritage binds the shared visible focus variable without replacing focus ownership."],
    "GAP-2": ["Brand anatomy uses the invariant Common spacing tokens."],
    "MEDIA-6": ["Brand receives approved logo identity; asset generation remains outside Grammar."],
} as const

export const heritageRuleConformance = defineGrammarRuleConformance({
    familyId: "heritage",
    inheritedCommonRules: COMMON_UI_RULE_IDS.filter((rule) => !(rule in HERITAGE_FAMILY_EVIDENCE)),
    familyEvidence: HERITAGE_FAMILY_EVIDENCE,
})

export const HeritageGrammarRoot = heritageGrammar.components.GrammarRoot
export const HeritageButton = heritageGrammar.components.Button
export const HeritageHeading = heritageGrammar.components.Heading
export const HeritageBrand = heritageGrammar.components.Brand
