import { describe, expect, it } from "vitest"
import { COMMON_UI_RULE_IDS, defineGrammarRuleConformance } from "./conformance.js"

describe("Common UI rule conformance", () => {
    it("accepts the complete declared set through inherited rules or family evidence", () => {
        const inherited = defineGrammarRuleConformance({
            familyId: "inherited",
            inheritedCommonRules: COMMON_UI_RULE_IDS,
            familyEvidence: {},
        })
        expect(inherited.inheritedCommonRules).toEqual(COMMON_UI_RULE_IDS)
        expect(Object.isFrozen(inherited.inheritedCommonRules)).toBe(true)
        const evidence = Object.fromEntries(COMMON_UI_RULE_IDS.map((id) => [id, ["measured in this family"]]))
        expect(() => defineGrammarRuleConformance({
            familyId: "family-owned",
            inheritedCommonRules: [],
            familyEvidence: evidence,
        })).not.toThrow()
    })

    it("names a missing declared rule and rejects invented or retired family evidence", () => {
        const [missing, ...rest] = COMMON_UI_RULE_IDS
        expect(() => defineGrammarRuleConformance({
            familyId: "incomplete",
            inheritedCommonRules: rest,
            familyEvidence: {},
        })).toThrow(`missing=[${missing}]`)
        for (const id of ["MADE-UP-1", "STATE-4"]) {
            expect(() => defineGrammarRuleConformance({
                familyId: "unknown",
                inheritedCommonRules: COMMON_UI_RULE_IDS,
                familyEvidence: { [id]: ["none"] },
            })).toThrow(`unknown=[${id}]`)
        }
    })
})
