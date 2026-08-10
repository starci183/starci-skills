/**
 * The front-end plugin: every law's rules, gathered once.
 *
 * A consuming repository imports THIS and nothing below it. Registering rules one by one in the
 * target's own plugin file is how the two lists drift: a law gains a rule here, nobody adds it
 * there, and the rule ships as a document. The target's `eslint.config.mjs` stays the authority on
 * what is switched on and at what level - that is a different question from what EXISTS, and this
 * file answers only the second.
 *
 * WHAT THIS FILE REFUSES TO DO. It does not rename anything. A rule's published name is part of the
 * law that declares it, because that name is what appears in a build log, in a disable comment and
 * in every conversation about the failure. Aliasing one here to match a target's older spelling
 * would leave two names for one rule and no way to tell which a message came from.
 */
import { recommended as commentsRecommended, rules as commentsRules } from "./comments.mjs"
import { recommended as contractRecommended, rules as contractRules } from "./contract.mjs"
import { recommended as fileLayoutRecommended, rules as fileLayoutRules } from "./file-layout.mjs"
import { recommended as iconRecommended, rules as iconRules } from "./icon.mjs"
import { recommended as namingRecommended, rules as namingRules } from "./naming.mjs"
import { recommended as propsRecommended, rules as propsRules } from "./props-and-slots.mjs"
import { recommended as tokensRecommended, rules as tokensRules } from "./tokens.mjs"

/** Each law's contribution, kept separate so a duplicate name is detectable rather than silent. */
const CONTRIBUTIONS = [
  { law: "comments", rules: commentsRules, recommended: commentsRecommended },
  { law: "contract", rules: contractRules, recommended: contractRecommended },
  { law: "file-layout", rules: fileLayoutRules, recommended: fileLayoutRecommended },
  { law: "icon", rules: iconRules, recommended: iconRecommended },
  { law: "naming", rules: namingRules, recommended: namingRecommended },
  { law: "props-and-slots", rules: propsRules, recommended: propsRecommended },
  { law: "tokens", rules: tokensRules, recommended: tokensRecommended },
]

/**
 * Which law declares each rule.
 *
 * Exported because a failing rule is a question about a LAW, and the shortest path from a build log
 * to the document that explains it is this map. It is also what the twin test walks to prove no two
 * laws claim one name.
 */
export const ruleOwners = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.keys(entry.rules).map((name) => [name, entry.law])),
)

/** Every rule this canon publishes, keyed by its published name. */
export const rules = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.rules)),
)

/**
 * The levels this canon asks for, as the plugin's own opinion.
 *
 * A repository adopting these with existing debt turns a rule down to `warn` while it burns the
 * count down, and back to `error` at zero. What never changes is that a rule at `error` is a broken
 * build rather than a warning to triage.
 */
export const recommended = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.recommended)),
)

/** The plugin object, shaped the way a flat config expects it. */
export default {
  meta: { name: "eslint-plugin-starci-fe" },
  rules,
}
