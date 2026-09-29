/**
 * The back-end plugin: every law's rules, gathered once.
 *
 * A consuming repository imports THIS and nothing below it. Registering rules one by one in the
 * target's own plugin file is how the two lists drift: a law gains a rule here, nobody adds it there,
 * and the rule ships as a document. That is not hypothetical for this axis - the back end kept a
 * hand-written plugin whose names had already diverged from canon's, so `no-nest-logger` and
 * `no-framework-logger` were one law wearing two names and no build could say which had fired.
 *
 * The target's `eslint.config.mjs` stays the authority on what is switched on, at what level and
 * over which globs. That is a different question from what EXISTS, and this file answers only the
 * second.
 *
 * WHAT THIS FILE REFUSES TO DO. It does not rename anything. A rule's published name is part of the
 * law that declares it, because that name is what appears in a build log, in a disable comment and in
 * every conversation about the failure. Aliasing one here to match a target's older spelling would
 * leave two names for one rule and no way to tell which a message came from.
 */
import { recommended as asyncDisciplineRecommended, rules as asyncDisciplineRules } from "./async-discipline.mjs"
import { recommended as authorizationRecommended, rules as authorizationRules } from "./authorization.mjs"
import { recommended as cdcRecommended, rules as cdcRules } from "./cdc.mjs"
import { recommended as commentsRecommended, rules as commentsRules } from "./comments.mjs"
import { recommended as configOwnerRecommended, rules as configOwnerRules } from "./config-owner.mjs"
import { recommended as cqrsRecommended, rules as cqrsRules } from "./cqrs.mjs"
import { recommended as dataAccessRecommended, rules as dataAccessRules } from "./data-access.mjs"
import { recommended as defaultDenyRecommended, rules as defaultDenyRules } from "./default-deny.mjs"
import { recommended as e2eFlowRecommended, rules as e2eFlowRules } from "./e2e-flow.mjs"
import { recommended as errorHandlingRecommended, rules as errorHandlingRules } from "./error-handling.mjs"
import { recommended as eventDeliveryRecommended, rules as eventDeliveryRules } from "./event-delivery.mjs"
import { recommended as idempotencyRecommended, rules as idempotencyRules } from "./idempotency.mjs"
import { recommended as inputBoundsRecommended, rules as inputBoundsRules } from "./input-bounds.mjs"
import { recommended as logSafetyRecommended, rules as logSafetyRules } from "./log-safety.mjs"
import { recommended as moduleLayeringRecommended, rules as moduleLayeringRules } from "./module-layering.mjs"
import { recommended as moduleShapeRecommended, rules as moduleShapeRules } from "./module-shape.mjs"
import { recommended as namingRecommended, rules as namingRules } from "./naming.mjs"
import { recommended as observabilityRecommended, rules as observabilityRules } from "./observability.mjs"
import { recommended as querySafetyRecommended, rules as querySafetyRules } from "./query-safety.mjs"
import { recommended as resilienceRecommended, rules as resilienceRules } from "./resilience.mjs"
import { recommended as schemaAuthorityRecommended, rules as schemaAuthorityRules } from "./schema-authority.mjs"
import { recommended as sizeBudgetRecommended, rules as sizeBudgetRules } from "./size-budget.mjs"
import { recommended as specQualityRecommended, rules as specQualityRules } from "./spec-quality.mjs"
import { recommended as suppressionRecommended, rules as suppressionRules } from "./suppression.mjs"
import { recommended as temporalRecommended, rules as temporalRules } from "./temporal.mjs"
import { recommended as testingRecommended, rules as testingRules } from "./testing.mjs"
import { recommended as transportRecommended, rules as transportRules } from "./transport.mjs"
import { recommended as typeSafetyRecommended, rules as typeSafetyRules } from "./type-safety.mjs"
import { recommended as userCopyRecommended, rules as userCopyRules } from "./user-copy.mjs"

/** Each law's contribution, kept separate so a duplicate name is detectable rather than silent. */
const CONTRIBUTIONS = [
    { law: "async-discipline", rules: asyncDisciplineRules, recommended: asyncDisciplineRecommended },
    { law: "authorization", rules: authorizationRules, recommended: authorizationRecommended },
    { law: "cdc", rules: cdcRules, recommended: cdcRecommended },
    { law: "comments", rules: commentsRules, recommended: commentsRecommended },
    { law: "config-owner", rules: configOwnerRules, recommended: configOwnerRecommended },
    { law: "cqrs", rules: cqrsRules, recommended: cqrsRecommended },
    { law: "data-access", rules: dataAccessRules, recommended: dataAccessRecommended },
    { law: "default-deny", rules: defaultDenyRules, recommended: defaultDenyRecommended },
    { law: "e2e-flow", rules: e2eFlowRules, recommended: e2eFlowRecommended },
    { law: "error-handling", rules: errorHandlingRules, recommended: errorHandlingRecommended },
    { law: "event-delivery", rules: eventDeliveryRules, recommended: eventDeliveryRecommended },
    { law: "idempotency", rules: idempotencyRules, recommended: idempotencyRecommended },
    { law: "input-bounds", rules: inputBoundsRules, recommended: inputBoundsRecommended },
    { law: "log-safety", rules: logSafetyRules, recommended: logSafetyRecommended },
    { law: "module-layering", rules: moduleLayeringRules, recommended: moduleLayeringRecommended },
    { law: "module-shape", rules: moduleShapeRules, recommended: moduleShapeRecommended },
    { law: "naming", rules: namingRules, recommended: namingRecommended },
    { law: "observability", rules: observabilityRules, recommended: observabilityRecommended },
    { law: "query-safety", rules: querySafetyRules, recommended: querySafetyRecommended },
    { law: "resilience", rules: resilienceRules, recommended: resilienceRecommended },
    { law: "schema-authority", rules: schemaAuthorityRules, recommended: schemaAuthorityRecommended },
    { law: "size-budget", rules: sizeBudgetRules, recommended: sizeBudgetRecommended },
    { law: "spec-quality", rules: specQualityRules, recommended: specQualityRecommended },
    { law: "suppression", rules: suppressionRules, recommended: suppressionRecommended },
    { law: "temporal", rules: temporalRules, recommended: temporalRecommended },
    { law: "testing", rules: testingRules, recommended: testingRecommended },
    { law: "transport", rules: transportRules, recommended: transportRecommended },
    { law: "type-safety", rules: typeSafetyRules, recommended: typeSafetyRecommended },
    { law: "user-copy", rules: userCopyRules, recommended: userCopyRecommended },
]

/** Every gathered law. */
export const lawOwners = CONTRIBUTIONS.map((entry) => entry.law)

/**
 * Every (law, rule name) pair as DECLARED, before any collapsing.
 *
 * This exists because `ruleOwners` and `rules` below are both built with `Object.fromEntries`, which
 * silently keeps the last writer when two laws declare one name. A test that walks either of them
 * therefore cannot see a collision: the duplicate is already gone by the time it looks, so every
 * name appears exactly once BY CONSTRUCTION and the check passes forever while being blind.
 *
 * That is exactly what happened - three back-end rules were declared by two laws each, one copy was
 * discarded on import, and the guard reported green the whole time. A gate that cannot fail is
 * indistinguishable from no gate, so the raw declarations are published here and the guard walks
 * these instead.
 */
export const ruleDeclarations = CONTRIBUTIONS.flatMap((entry) =>
  Object.keys(entry.rules).map((name) => ({ law: entry.law, name })),
)

/**
 * Which law declares each rule.
 *
 * Exported because a failing rule is a question about a LAW, and the shortest path from a build log
 * to the document that explains it is this map. It answers "who owns this name" for a name that
 * SHIPPED; proving no two laws claim one name is `ruleDeclarations`' job, not this map's.
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
 * Unlike the front end, this axis allows `warn`, and the allowance is the burn-down playbook rather
 * than a softer standard: a rule measured with debt arrives at `warn` with a ledger entry naming the
 * offenders, and flips to `error` the day that entry closes. Switching a rule on over existing
 * offenders is what teaches an author to scroll past it, and a reader who has learned to scroll past
 * one rule reads none of them.
 */
export const recommended = Object.fromEntries(
    CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.recommended)),
)

/** The plugin object, shaped the way a flat config expects it. */
export default {
    meta: { name: "eslint-plugin-starci-be" },
    rules,
}

export { starciBeConfig, linterOptions } from "./lib/config.mjs"
