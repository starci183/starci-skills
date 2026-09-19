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
import { recommended as classNamesRecommended, rules as classNamesRules } from "./class-names.mjs"
import { recommended as fileLayoutRecommended, rules as fileLayoutRules } from "./file-layout.mjs"
import {
  audits as grammarBoundaryAudits,
  recommended as grammarBoundaryRecommended,
  rules as grammarBoundaryRules,
} from "./grammar-boundary.mjs"
import { recommended as iconRecommended, rules as iconRules } from "./icon.mjs"
import { recommended as landmarkRecommended, rules as landmarkRules } from "./landmark.mjs"
import { recommended as loadingRecommended, rules as loadingRules } from "./loading.mjs"
import {
  audits as lintAdoptionAudits,
  recommended as lintAdoptionRecommended,
  rules as lintAdoptionRules,
} from "./lint-adoption.mjs"
import {
  linterOptions as strictLinterOptions,
  recommended as lintEscapeRecommended,
  rules as lintEscapeRules,
} from "./lint-escape-hatch.mjs"
import { recommended as namingRecommended, rules as namingRules } from "./naming.mjs"
import { recommended as propsRecommended, rules as propsRules } from "./props-and-slots.mjs"
import { recommended as servedLocaleRecommended, rules as servedLocaleRules } from "./served-locale.mjs"
import { recommended as splitRecommended, rules as splitRules } from "./the-split.mjs"
import { recommended as tokensRecommended, rules as tokensRules } from "./tokens.mjs"
import { recommended as translationRecommended, rules as translationRules } from "./translation.mjs"
import { recommended as typeSafetyRecommended, rules as typeSafetyRules } from "./type-safety.mjs"
import { recommended as typographyRecommended, rules as typographyRules } from "./typography.mjs"
import { recommended as vendorRecommended, rules as vendorRules } from "./vendor-boundary.mjs"

/** Each law's contribution, kept separate so a duplicate name is detectable rather than silent. */
const CONTRIBUTIONS = [
  { law: "comments", rules: commentsRules, recommended: commentsRecommended },
  {
    law: "class-names",
    rules: classNamesRules,
    recommended: classNamesRecommended,
  },
  { law: "file-layout", rules: fileLayoutRules, recommended: fileLayoutRecommended },
  {
    law: "grammar-boundary",
    rules: grammarBoundaryRules,
    recommended: grammarBoundaryRecommended,
    audits: grammarBoundaryAudits,
  },
  { law: "icon", rules: iconRules, recommended: iconRecommended },
  { law: "landmark", rules: landmarkRules, recommended: landmarkRecommended },
  { law: "loading", rules: loadingRules, recommended: loadingRecommended },
  {
    law: "lint-adoption",
    rules: lintAdoptionRules,
    recommended: lintAdoptionRecommended,
    audits: lintAdoptionAudits,
  },
  { law: "lint-escape-hatch", rules: lintEscapeRules, recommended: lintEscapeRecommended },
  { law: "naming", rules: namingRules, recommended: namingRecommended },
  { law: "props-and-slots", rules: propsRules, recommended: propsRecommended },
  { law: "served-locale", rules: servedLocaleRules, recommended: servedLocaleRecommended },
  { law: "the-split", rules: splitRules, recommended: splitRecommended },
  { law: "tokens", rules: tokensRules, recommended: tokensRecommended },
  { law: "translation", rules: translationRules, recommended: translationRecommended },
  { law: "type-safety", rules: typeSafetyRules, recommended: typeSafetyRecommended },
  { law: "typography", rules: typographyRules, recommended: typographyRecommended },
  { law: "vendor-boundary", rules: vendorRules, recommended: vendorRecommended },
]

/** Every gathered law, including repository audits that publish no AST rule. */
export const lawOwners = CONTRIBUTIONS.map((entry) => entry.law)

/** Which law declares each repository-level audit. */
export const auditOwners = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) =>
    Object.keys(entry.audits ?? {}).map((name) => [name, entry.law]),
  ),
)

/** Repository-level audits gathered beside the plugin. */
export const audits = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.audits ?? {})),
)

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

/**
 * Every (law, rule name) pair as DECLARED, before any collapsing.
 *
 * `ruleOwners` above and `rules` below are both built with `Object.fromEntries`, which silently
 * keeps the last writer when two laws declare one name. A guard that walks either of them cannot
 * see a collision - the duplicate is gone before it looks, so every name appears exactly once BY
 * CONSTRUCTION and the check passes forever while being blind.
 *
 * That is not hypothetical. The back-end twin had this exact shape, three rules were declared by two
 * laws each, one copy was discarded on import, and its guard reported green throughout. This axis
 * has no collision today; publishing the raw declarations is what keeps that a FACT rather than an
 * assumption nobody can test.
 */
export const ruleDeclarations = CONTRIBUTIONS.flatMap((entry) =>
  Object.keys(entry.rules).map((name) => ({ law: entry.law, name })),
)

/** Every rule this canon publishes, keyed by its published name. */
export const rules = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.rules)),
)

/**
 * The levels this canon asks for, as the plugin's own opinion.
 *
 * Every FE canon rule is an error. Existing debt is fixed before adoption; lowering architecture
 * to warn teaches every later author that the boundary is optional and is not a supported rollout.
 */
export const recommended = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.recommended)),
)

/** Flat-config options that make inline directives ineffective rather than merely forbidden. */
export const linterOptions = strictLinterOptions

/** The plugin object, shaped the way a flat config expects it. */
export default {
  meta: { name: "eslint-plugin-starci-fe" },
  rules,
}

/** Attach this canon to a repository: one block, one branch for its layout. */
export { starciFeConfig, LAYOUTS } from "./lint-adoption.mjs"
