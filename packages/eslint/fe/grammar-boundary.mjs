/**
 * The boundary between product code and `@starci/grammar`.
 *
 * Grammar is a business-neutral HeroUI-backed component package. Product code may compose its
 * components with ordinary React children and typed props; this contribution deliberately does
 * not impose a second rendering protocol or a product-specific adapter lane.
 */

/** No product-specific AST restrictions are needed for the neutral Grammar boundary. */
export const rules = {}

/** No repository audit is coupled to the neutral Grammar boundary. */
export const audits = {}

/** The neutral boundary contributes no mandatory rule levels. */
export const recommended = {}
