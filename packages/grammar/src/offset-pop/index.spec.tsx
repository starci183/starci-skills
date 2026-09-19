import { renderToStaticMarkup } from "react-dom/server"
import { COMMON_GRAMMAR_COMPONENTS, COMMON_UI_RULE_IDS } from "../common/index.js"
import { describe, expect, it } from "vitest"
import { OffsetPopGrammarRoot, offsetPopGrammar, offsetPopRuleConformance } from "./index.js"

describe("@starci/grammar/offset-pop", () => {
    it("publishes its exact style scope and replaces only Common GrammarRoot", () => {
        expect(offsetPopGrammar.styles).toEqual({
            entrypoint: "@starci/grammar/offset-pop/styles.css",
            scope: { attribute: "data-grammar-family", value: "offset-pop" },
        })
        expect(OffsetPopGrammarRoot).not.toBe(COMMON_GRAMMAR_COMPONENTS.GrammarRoot)

        for (const name of Object.keys(COMMON_GRAMMAR_COMPONENTS) as Array<keyof typeof COMMON_GRAMMAR_COMPONENTS>) {
            if (name === "GrammarRoot") continue
            expect(offsetPopGrammar.components[name]).toBe(COMMON_GRAMMAR_COMPONENTS[name])
        }
    })

    it("installs family scope while preserving Common root props, anatomy, and content", () => {
        const markup = renderToStaticMarkup(
            <OffsetPopGrammarRoot className="consumer-class" id="family-root" theme="dark">
                Content
            </OffsetPopGrammarRoot>,
        )

        expect(markup).toContain("class=\"grammar-common-root consumer-class\"")
        expect(markup).toContain("data-grammar=\"common\"")
        expect(markup).toContain("data-grammar-theme=\"dark\"")
        expect(markup).toContain("data-grammar-family=\"offset-pop\"")
        expect(markup).toContain("id=\"family-root\"")
        expect(markup).toContain("Content")
    })

    it("binds family-specific evidence while inheriting the complete Common X-n catalog", () => {
        const covered = new Set([
            ...offsetPopRuleConformance.inheritedCommonRules,
            ...Object.keys(offsetPopRuleConformance.familyEvidence),
        ])

        expect(covered).toEqual(new Set(COMMON_UI_RULE_IDS))
        expect(offsetPopRuleConformance.familyEvidence).toHaveProperty("FOCUS-1")
        expect(offsetPopRuleConformance.familyEvidence).toHaveProperty("MOTION-2")
        expect(offsetPopRuleConformance.familyEvidence).toHaveProperty("PADDING-3")
    })
})
