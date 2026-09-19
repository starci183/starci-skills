import { describe, expect, it } from "vitest"
import { COMMON_UI_RULE_IDS, defineGrammarRuleConformance } from "./conformance.js"

describe("Common UI X-n conformance catalog", () => {
    it("contains the complete canonical UI rule set exactly once", () => {
        expect(COMMON_UI_RULE_IDS).toHaveLength(150)
        expect(new Set(COMMON_UI_RULE_IDS).size).toBe(150)
        expect(COMMON_UI_RULE_IDS).toContain("ACTION-3")
        expect(COMMON_UI_RULE_IDS).toContain("LAYOUT-5")
        expect(COMMON_UI_RULE_IDS).toContain("SURFACE-5")
    })

    it("rejects missing and unknown family evidence", () => {
        expect(() => defineGrammarRuleConformance({
            familyId: "incomplete",
            inheritedCommonRules: [],
            familyEvidence: {},
        })).toThrow(/missing=/)
        expect(() => defineGrammarRuleConformance({
            familyId: "unknown",
            inheritedCommonRules: COMMON_UI_RULE_IDS,
            familyEvidence: { "MADE-UP-1": ["none"] },
        })).toThrow(/unknown=/)
    })
})
