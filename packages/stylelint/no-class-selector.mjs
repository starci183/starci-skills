/**
 * `starci/no-class-selector` (HFS R61 `FE_STYLE_TOKEN_ONLY`): no class selector in app CSS.
 *
 * A `.sign-in-card { ... }` rule is a component defined in a stylesheet: it bypasses the grammar's anatomy and
 * every check that reads components. App CSS has no component vocabulary of its own; styling goes through grammar
 * components and tokens. This reads plain stylesheets; `globals.css` and `brand.css` have their own shape rules and
 * a CSS module is refused whole by `no-css-module`.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"

/**
 * A class selector, after attribute selectors and strings are removed: a dot that is not escaped, then a name that starts with a
 * letter or underscore. A compound `div.card` is a class selector too; a keyframe offset `50.5%` is not (a digit follows the dot).
 */
const CLASS = /(?<!\\)\.-?[A-Za-z_][\w-]*/

export const noClassSelector = makeRule(
  "no-class-selector",
  {
    selector: (selector) =>
      `\`${selector}\` is a class selector. App CSS defines no components: style through grammar components and tokens.`,
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) !== "css") return
    root.walkRules((rule) => {
      for (const selector of rule.selectors) {
        const bare = selector.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"|'[^']*'/g, "")
        const match = CLASS.exec(bare)
        if (match) report(rule, "selector", [selector.trim()], { word: match[0] })
      }
    })
  },
)
