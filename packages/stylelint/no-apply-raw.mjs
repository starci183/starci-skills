/**
 * `starci/no-apply-raw` (HFS R61 `FE_STYLE_TOKEN_ONLY`): `@apply` composes scale utilities, never a raw value.
 *
 * `@apply bg-[#fff] w-[12px]` smuggles a raw brand value past `raw-brand-value` (which reads declarations) and
 * past the grammar's scale. An arbitrary value is allowed only when it is a token reference
 * (`bg-[var(--accent)]`, `bg-(--accent)`); anything else, and any hex, colour function or pixel length written
 * bare, is refused.
 */
import { COLOR_FUNCTION, HEX_COLOR, PIXEL_LENGTH } from "./lib/brand-value.mjs"
import { makeRule } from "./lib/make-rule.mjs"
import { isKnownToken } from "./lib/vocabulary.mjs"

/** `[...]` arbitrary value or `(--token)` variable shorthand at the end of a utility. */
const ARBITRARY = /\[([^\]]*)\]/
const VARIABLE_SHORTHAND = /\(\s*(--[\w-]+)\s*\)/

/** The token names a `var(...)` or shorthand reference inside an arbitrary value uses, or null when it is not one. */
const tokenOf = (inner) => {
  const match = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(inner.trim().replace(/^[\w-]+:/, ""))
  return match ? match[1] : null
}

export const noApplyRaw = makeRule(
  "no-apply-raw",
  {
    arbitrary: (utility) =>
      `\`@apply ${utility}\` applies an arbitrary value. Arbitrary values are raw values by another name; use a scale utility, or a token reference such as \`[var(--accent)]\`.`,
    raw: (utility) =>
      `\`@apply ${utility}\` writes a raw colour or pixel value. Apply a scale utility from the grammar instead.`,
  },
  ({ root, report, options }) => {
    root.walkAtRules("apply", (rule) => {
      for (const utility of rule.params.split(/\s+/).filter(Boolean)) {
        const variable = VARIABLE_SHORTHAND.exec(utility)
        if (variable) {
          if (!isKnownToken(variable[1], options.appTokens)) report(rule, "arbitrary", [utility], { word: utility })
          continue
        }
        const arbitrary = ARBITRARY.exec(utility)
        if (arbitrary) {
          const token = tokenOf(arbitrary[1])
          if (token === null || !isKnownToken(token, options.appTokens)) {
            report(rule, "arbitrary", [utility], { word: utility })
          }
          continue
        }
        if (HEX_COLOR.test(utility) || COLOR_FUNCTION.test(utility) || PIXEL_LENGTH.test(utility)) {
          report(rule, "raw", [utility], { word: utility })
        }
      }
    })
  },
)
