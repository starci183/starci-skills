/**
 * `starci/token-only` (HFS R61 `FE_STYLE_TOKEN_ONLY`): colour, spacing, radius and typography come from the
 * tokens the grammar publishes, never from a value written in place.
 *
 * Every `var()` in every stylesheet must name a token of the grammar vocabulary (`lib/vocabulary.mjs`, read from
 * the grammar's own CSS) or one the repository declared to the factory as an `appTokens` name: a private
 * namespace (`--nv-*`) is a second design system. A property that takes colour, spacing, radius or typography
 * takes a token, a `calc()` over tokens, or a neutral keyword. A named colour in a shorthand
 * (`border: 1px solid red`) is judged the same way.
 *
 * Hex, colour functions and pixel lengths are not reported here: `raw-brand-value` owns them, so one span has
 * one finding.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"
import { isShorthandColour, namedColour, strictProblem, strictRole, unknownVar } from "./lib/values.mjs"

export const tokenOnly = makeRule(
  "token-only",
  {
    unknown: (name) =>
      `\`var(${name})\` names a token the grammar does not publish. Colour, spacing, radius and typography come from the grammar's tokens (\`--grammar-*\`, the family tokens and the semantic layer); a private token namespace is a second design system.`,
    value: (prop, role, text) =>
      `\`${prop}: ${text}\` is a ${role} value written in place. Use a grammar token (\`var(--...)\`) or a neutral keyword.`,
    named: (prop, text) =>
      `\`${prop}\` writes the named colour \`${text}\`. Colour is a token, not a word: use \`var(--...)\`.`,
  },
  ({ root, report, options }) => {
    const brand = fileKind(fileOf(root)) === "brand"
    root.walkDecls((decl) => {
      const unknown = unknownVar(decl.value, options.appTokens)
      if (unknown) return report(decl, "unknown", [unknown.name], { word: unknown.name })
      if (decl.prop.startsWith("--")) return
      if (brand) return
      const role = strictRole(decl.prop)
      if (role) {
        const problem = strictProblem(decl.value)
        if (problem) report(decl, "value", [decl.prop, role, problem], { word: problem })
        return
      }
      if (isShorthandColour(decl.prop)) {
        const colour = namedColour(decl.value)
        if (colour) report(decl, "named", [decl.prop, colour], { word: colour })
      }
    })
  },
)
