/**
 * `starci/globals-shape` (HFS R61 `FE_STYLE_TOKEN_ONLY`): the global stylesheet (`globals.css`) only imports and
 * declares tokens.
 *
 * Allowed at the top level: `@import`, `@source`, and a `:root`, `.dark` or `[data-theme]` block (or a Tailwind
 * `@theme` block) that holds custom-property declarations and nothing else. A token declared here is an alias of
 * grammar tokens (`--page-x: var(--grammar-page-inset)`): its value is made of `var()` references only, because
 * a written value belongs in `brand.css`. Everything else - an element or class rule, `@apply`, `@layer`,
 * `@media`, a plain declaration - is component CSS in the one file every route loads.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"
import { isAliasValue } from "./lib/values.mjs"

/** Selectors a token block may use. */
const TOKEN_SELECTOR = /^(?::root|html|\.dark|\.light|\[data-theme=["']?(?:dark|light)["']?\]|:root\[data-theme=["']?(?:dark|light)["']?\]|:root\.(?:dark|light))$/

const TOP_LEVEL_AT_RULES = new Set(["import", "source", "theme"])

export const globalsShape = makeRule(
  "globals-shape",
  {
    atRule: (name) =>
      `\`@${name}\` in globals.css. The global sheet only has \`@import\`, \`@source\` and token blocks; put component styling in the component's grammar utilities.`,
    rule: (selector) =>
      `\`${selector}\` in globals.css. The global sheet only declares tokens, in a \`:root\`, \`.dark\` or \`[data-theme]\` block.`,
    declaration: (prop) => `\`${prop}\` is declared at the top level of globals.css. Only tokens are declared here.`,
    notToken: (prop) =>
      `\`${prop}\` in globals.css is not a token: only custom properties (\`--name\`) are declared here.`,
    notAlias: (prop, value) =>
      `\`${prop}: ${value}\` writes a value. A token in globals.css aliases grammar tokens with \`var(--...)\`; values are written in \`modules/brand/brand.css\`.`,
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) !== "globals") return

    /** A token block: custom properties only, each an alias. */
    const checkBlock = (container) => {
      container.each((child) => {
        if (child.type === "comment") return
        if (child.type !== "decl") return report(child, "notToken", [child.type === "rule" ? child.selector : `@${child.name}`])
        if (!child.prop.startsWith("--")) return report(child, "notToken", [child.prop], { word: child.prop })
        if (!isAliasValue(child.value)) report(child, "notAlias", [child.prop, child.value], { word: child.value })
      })
    }

    root.each((node) => {
      if (node.type === "comment") return
      if (node.type === "atrule") {
        if (!TOP_LEVEL_AT_RULES.has(node.name.toLowerCase())) return report(node, "atRule", [node.name], { word: `@${node.name}` })
        if (node.name.toLowerCase() === "theme") checkBlock(node)
        return
      }
      if (node.type === "rule") {
        const selectors = node.selectors.map((selector) => selector.trim())
        const bad = selectors.find((selector) => !TOKEN_SELECTOR.test(selector))
        if (bad !== undefined) return report(node, "rule", [node.selector], { word: bad })
        return checkBlock(node)
      }
      if (node.type === "decl") report(node, "declaration", [node.prop], { word: node.prop })
    })
  },
)
