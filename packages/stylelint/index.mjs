/**
 * @starci/stylelint-canon: the CSS half of the StarCi lint canon (HFS R61 `FE_STYLE_TOKEN_ONLY`).
 *
 *   // stylelint.config.mjs
 *   import { starciStylelintConfig } from "@starci/stylelint-canon"
 *   export default starciStylelintConfig()
 *
 * The factory returns a complete stylelint config with every rule of the canon at error. There is no option to
 * turn a rule off, downgrade it, ignore a file or honour an inline `stylelint-disable`; `assertEveryRuleOn`
 * refuses a config that does.
 */
import { brandLayerShape } from "./brand-layer-shape.mjs"
import { breakpointScale } from "./breakpoint-scale.mjs"
import { globalsImportOrder } from "./globals-import-order.mjs"
import { noClassSelector } from "./no-class-selector.mjs"
import { noCssModule } from "./no-css-module.mjs"
import { sourceResolves } from "./source-resolves.mjs"
import { globalsShape } from "./globals-shape.mjs"
import { noApplyRaw } from "./no-apply-raw.mjs"
import { noImportant } from "./no-important.mjs"
import { noInlineLintConfig } from "./no-inline-lint-config.mjs"
import { noTokenRedefinition } from "./no-token-redefinition.mjs"
import { rawBrandValue } from "./raw-brand-value.mjs"
import { tokenOnly } from "./token-only.mjs"
import { isGrammarToken } from "./lib/vocabulary.mjs"

export { why } from "./lib/why.mjs"
export { findRawBrandValue, HEX_COLOR, COLOR_FUNCTION, PIXEL_LENGTH } from "./lib/brand-value.mjs"
export { isGrammarToken, FAMILY_PREFIXES } from "./lib/vocabulary.mjs"
export { BRAND_FILE, fileKind } from "./lib/scope.mjs"

/** Every rule of the canon by short name; each is published as `starci/<name>`. */
export const rules = {
  "token-only": tokenOnly,
  "raw-brand-value": rawBrandValue,
  "no-apply-raw": noApplyRaw,
  "no-important": noImportant,
  "globals-shape": globalsShape,
  "no-token-redefinition": noTokenRedefinition,
  "brand-layer-shape": brandLayerShape,
  "no-inline-lint-config": noInlineLintConfig,
  "no-css-module": noCssModule,
  "no-class-selector": noClassSelector,
  "breakpoint-scale": breakpointScale,
  "source-resolves": sourceResolves,
  "globals-import-order": globalsImportOrder,
}

/** The stylelint plugin objects, in rule order. */
export const plugins = Object.values(rules).map((entry) => entry.plugin)

/** The rule names as stylelint knows them. */
export const ruleNames = Object.values(rules).map((entry) => entry.ruleName)

/** The rules that take the repository's own token names. */
const TAKES_APP_TOKENS = new Set(["starci/token-only", "starci/no-apply-raw"])

/** True when a rule entry is `true` or `[true, secondary]` with no severity other than error. */
function isOn(entry) {
  const primary = Array.isArray(entry) ? entry[0] : entry
  if (primary !== true) return false
  const secondary = Array.isArray(entry) ? entry[1] : undefined
  return !secondary || secondary.severity === undefined || secondary.severity === "error"
}

/**
 * Throws unless the config runs every rule of the canon at error, honours no inline disable and ignores no file.
 * `starciStylelintConfig` calls it on what it returns; a repository that extends the result calls it on the merge.
 */
export function assertEveryRuleOn(config) {
  const problems = []
  const scopes = [["config", config.rules ?? {}], ...(config.overrides ?? []).map((entry, index) => [`overrides[${index}]`, entry.rules ?? {}])]
  for (const [scope, set] of scopes) {
    for (const name of ruleNames) {
      if (scope === "config" && !(name in set)) problems.push(`${name} is missing`)
      else if (name in set && !isOn(set[name])) problems.push(`${name} is off or downgraded in ${scope}`)
    }
  }
  if (config.defaultSeverity !== "error") problems.push("defaultSeverity is not error")
  if (config.ignoreDisables !== true) problems.push("ignoreDisables is not true, so an inline disable would switch a rule off")
  if (config.ignoreFiles !== undefined) problems.push("ignoreFiles hides files from every rule")
  if (problems.length) throw new Error(`@starci/stylelint-canon: no rule is off. ${problems.join("; ")}.`)
}

/**
 * The stylelint config of a StarCi repository.
 *
 * @param {{ appTokens?: string[] }} [options] `appTokens`: custom properties the repository's `globals.css` declares
 *   as aliases of grammar tokens and other CSS may then reference. A name inside the grammar vocabulary is refused:
 *   the grammar's tokens are already allowed and are set only in `brand.css`. Any other option is refused.
 */
export function starciStylelintConfig(options = {}) {
  const unknown = Object.keys(options).filter((key) => key !== "appTokens")
  if (unknown.length) {
    throw new Error(`@starci/stylelint-canon: unknown option ${unknown.join(", ")}. The canon has no switch to turn a rule off; only appTokens is accepted.`)
  }
  const appTokens = options.appTokens ?? []
  for (const name of appTokens) {
    if (typeof name !== "string" || !name.startsWith("--")) throw new Error(`@starci/stylelint-canon: appTokens entry ${JSON.stringify(name)} is not a custom property name.`)
    if (isGrammarToken(name)) throw new Error(`@starci/stylelint-canon: appTokens entry ${name} is a grammar token; it is already allowed and is set only in brand.css.`)
  }
  const config = {
    plugins,
    defaultSeverity: "error",
    ignoreDisables: true,
    rules: Object.fromEntries(
      ruleNames.map((name) => [name, TAKES_APP_TOKENS.has(name) ? [true, { appTokens: [...appTokens] }] : true]),
    ),
  }
  assertEveryRuleOn(config)
  return config
}

export default plugins
