import { CANONICAL_RULE_IDS } from "./rule-catalog.generated.js"

/**
 * The catalog is GENERATED, not transcribed.
 *
 * A hand-typed copy of the knowledge tree's family list is only correct on the day it is typed, and
 * a conformance check against a wrong catalog keeps passing, which is the worst outcome a check
 * can have, so the table is read from the tree.
 *
 * Regenerate with `node packages/grammar/scripts/generate-rule-catalog.mjs [knowledgeDir]` from the package root.
 */
export { RULE_FAMILY_COUNTS } from "./rule-catalog.generated.js"

/** Every canonical Common UI rule id, exactly as the knowledge tree spells it. */
export const COMMON_UI_RULE_IDS = CANONICAL_RULE_IDS

export type GrammarRuleConformance = {
    readonly familyId: string
    readonly inheritedCommonRules: ReadonlyArray<string>
    readonly familyEvidence: Readonly<Record<string, ReadonlyArray<string>>>
}

/** Machine-checkable family coverage against the canonical knowledge/ui X-n catalog. */
export const defineGrammarRuleConformance = (definition: GrammarRuleConformance) => {
    const inherited = new Set(definition.inheritedCommonRules)
    const evidence = new Set(Object.keys(definition.familyEvidence))
    const missing = COMMON_UI_RULE_IDS.filter((rule) => !inherited.has(rule) && !evidence.has(rule))
    const unknown = [...inherited, ...evidence].filter((rule) => !COMMON_UI_RULE_IDS.includes(rule))
    if (missing.length > 0 || unknown.length > 0) {
        throw new TypeError(`Invalid ${definition.familyId} Grammar conformance: missing=[${missing.join(", ")}], unknown=[${unknown.join(", ")}]`)
    }
    return Object.freeze({
        familyId: definition.familyId,
        inheritedCommonRules: Object.freeze([...definition.inheritedCommonRules]),
        familyEvidence: Object.freeze({ ...definition.familyEvidence }),
    })
}
