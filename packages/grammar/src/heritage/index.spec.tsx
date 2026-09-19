import { renderToStaticMarkup } from "react-dom/server"
import { COMMON_GRAMMAR_COMPONENTS, COMMON_UI_RULE_IDS } from "../common/index.js"
import { describe, expect, it } from "vitest"
import {
    HeritageBrand,
    HeritageButton,
    HeritageGrammarRoot,
    HeritageHeading,
    heritageGrammar,
    heritageRuleConformance,
} from "./index.js"

describe("@starci/grammar/heritage", () => {
    it("publishes its exact style scope, one Common replacement, and Brand extension", () => {
        expect(heritageGrammar.styles).toEqual({
            entrypoint: "@starci/grammar/heritage/styles.css",
            scope: { attribute: "data-grammar-family", value: "heritage" },
        })
        expect(HeritageGrammarRoot).not.toBe(COMMON_GRAMMAR_COMPONENTS.GrammarRoot)
        expect(HeritageButton).toBe(COMMON_GRAMMAR_COMPONENTS.Button)
        expect(HeritageHeading).toBe(COMMON_GRAMMAR_COMPONENTS.Heading)
        expect(heritageGrammar.components.SurfaceCard).toBe(COMMON_GRAMMAR_COMPONENTS.SurfaceCard)
        expect(heritageGrammar.components.Brand).toBe(HeritageBrand)
    })

    it("keeps Common semantic and accessibility behavior substitutable", () => {
        const markup = renderToStaticMarkup(
            <HeritageGrammarRoot>
                <HeritageHeading level={2}>Giới thiệu</HeritageHeading>
                <HeritageButton variant="primary">Tiếp tục</HeritageButton>
            </HeritageGrammarRoot>,
        )

        expect(markup).toContain("data-grammar-family=\"heritage\"")
        expect(markup).toContain("<h2")
        expect(markup).toContain("Giới thiệu")
        expect(markup).toContain("<button")
        expect(markup).toContain("Tiếp tục")
    })

    it("keeps the inherited Common Card header outside its painted Card content", () => {
        const HeritageSurfaceCard = heritageGrammar.components.SurfaceCard
        const markup = renderToStaticMarkup(
            <HeritageGrammarRoot>
                <HeritageSurfaceCard label="Overview">Content</HeritageSurfaceCard>
            </HeritageGrammarRoot>,
        )

        expect(markup.indexOf("data-grammar-surface-label=\"true\"")).toBeGreaterThanOrEqual(0)
        expect(markup.indexOf("data-grammar-surface-label=\"true\"")).toBeLessThan(
            markup.indexOf("data-grammar-frame=\"bounded\"", markup.indexOf("data-grammar-surface-card")),
        )
        expect(markup).toContain("data-slot=\"card\"")
        expect(markup).toContain("data-slot=\"card-header\"")
        expect(markup).toContain("data-slot=\"card-content\"")
        expect(markup.indexOf("data-slot=\"card-header\"")).toBeLessThan(
            markup.indexOf("data-slot=\"card-content\""),
        )
    })

    it("binds family-specific evidence while inheriting the complete Common X-n catalog", () => {
        const covered = new Set([
            ...heritageRuleConformance.inheritedCommonRules,
            ...Object.keys(heritageRuleConformance.familyEvidence),
        ])

        expect(covered).toEqual(new Set(COMMON_UI_RULE_IDS))
        expect(heritageRuleConformance.familyEvidence).toHaveProperty("GAP-2")
        expect(heritageRuleConformance.familyEvidence).toHaveProperty("COLOR-5")
        expect(heritageRuleConformance.familyEvidence).toHaveProperty("MEDIA-6")
    })

    it("keeps Brand non-interactive and its image decorative", () => {
        const markup = renderToStaticMarkup(<HeritageBrand
            name="Heritage House"
            descriptor="Business community"
            logo={{ src: "/logo.png", width: 84, height: 84 }}
        />)

        expect(markup).toContain("Heritage House")
        expect(markup).toContain("alt=\"\"")
        expect(markup).not.toContain("<button")
        expect(markup).not.toContain("<a")
    })
})
