/**
 * The Grammar guard vocabulary (starci/grammar-guards-v1): a finite public contract the check-scoped-lint
 * canon probes directly by dynamic import. It is plain ESM - no JSX, no TypeScript syntax - so Node's own
 * loader can execute it without a build step. `./index` (the JSX leaves) never needs to import this file;
 * the two live side by side in the same package because they describe the same closed vocabulary.
 */

/** The common rule vocabulary every Grammar leaf family must declare it inherits in full. */
export const COMMON_UI_RULE_IDS = Object.freeze(['intrinsic-only-render', 'no-inline-color', 'forwards-standard-dom-props']);

/** The closed set of presentation states a Grammar leaf may report itself as being in. */
export const PRESENTATION_STATES = Object.freeze(['default', 'hover', 'focus', 'disabled']);

/** Fails closed at module init when a leaf family's inherited common-rule set is not exactly this canon's. */
export function defineGrammarRuleConformance(definition) {
  const canonical = new Set(COMMON_UI_RULE_IDS);
  const inherited = new Set(definition?.inheritedCommonRules ?? []);
  const exact = inherited.size === canonical.size && [...canonical].every(rule => inherited.has(rule));
  if (!exact) {
    throw new TypeError(`Grammar family ${definition?.familyId} must inherit exactly the common UI rule set.`);
  }
}

/** Fails closed on anything outside the closed presentation-state vocabulary. */
export function assertPresentationState(state) {
  if (typeof state !== 'string' || !PRESENTATION_STATES.includes(state)) {
    throw new TypeError('Unknown Grammar presentation state.');
  }
}
