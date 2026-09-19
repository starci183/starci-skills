/**
 * Accessibility landmarks for ordinary React route composition.
 *
 * Native HTML landmarks are intentionally independent of component implementation details. The
 * application may pass children through layouts and pages normally.
 */

const normalize = (filename) => String(filename || "").replace(/\\/g, "/")

/** Whether a file is a Next route layout. */
export const isRouteLayoutFile = (filename) => /\/app\/(?:.*\/)?layout\.tsx$/.test(normalize(filename))

/** Whether a file is a Next route entry. */
export const isRouteFile = (filename) => /\/app\/(?:.*\/)?(?:layout|page)\.tsx$/.test(normalize(filename))

/** Whether a file owns a page component. */
export const isPageTierFile = (filename) => /\/src\/components\/pages\//.test(normalize(filename))

/** Named branch owners that may provide landmark semantics. */
export const LANDMARK_BRANCHES = new Set(["Main"])

/** No custom landmark AST rule is needed; semantic ownership is enforced by the component code. */
export const rules = {}

/** No repository audit is coupled to landmark ownership. */
export const audits = {}

/** The landmark contribution has no mandatory rule levels. */
export const recommended = {}
