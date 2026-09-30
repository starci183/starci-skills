/**
 * Accessibility landmarks for ordinary React route composition.
 *
 * Native HTML landmarks are intentionally independent of component implementation details. The
 * application may pass children through layouts and pages normally.
 */

/** Named branch owners that may provide landmark semantics. */
export const LANDMARK_BRANCHES = new Set(["Main"])

/** No custom landmark AST rule is needed; semantic ownership is enforced by the component code. */
export const rules = {}

/** No repository audit is coupled to landmark ownership. */
export const audits = {}

/** The landmark contribution has no mandatory rule levels. */
export const recommended = {}
