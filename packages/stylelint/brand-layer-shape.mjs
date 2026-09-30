/**
 * `starci/brand-layer-shape` (HFS R61 `FE_STYLE_TOKEN_ONLY`): `modules/brand/brand.css` is the brand layer, and
 * it has one shape.
 *
 * It is the only stylesheet where a raw colour or pixel value may be written, so it may hold nothing else: token
 * declarations, on tokens the grammar publishes, in a light block (`:root`, `.light`, `[data-theme="light"]`) and
 * a dark block (`.dark`, `[data-theme="dark"]`, or `:root` inside `@media (prefers-color-scheme: dark)`), with
 * `color-scheme` allowed beside them. Every token has a value in both, so a brand can never be half a theme.
 *
 * A COMPOUND SELECTOR IS BOTH THEMES. `:root, .light, .dark { --success-soft: ... }` is one block that sets its tokens
 * for the light theme and for the dark theme (a token shared by the two, such as a soft pair mixed from the theme's own
 * tokens); each selector of the list must be a light or a dark scope, and the block counts for every theme it names.
 *
 * THE FAMILY ROOT IS A SCOPE TOO. The grammar re-declares its tokens on
 * `.grammar-common-root[data-grammar-family="<family>"]` itself, so a value written on `:root` is inherited and loses
 * to that re-declaration. A brand that has to win writes its light block on the family root, its dark block on the same
 * root with `[data-grammar-theme="dark"]` (or `.dark`), and the follow-the-system block inside
 * `@media (prefers-color-scheme: dark)` on the root with `[data-grammar-theme="system"]`. Light and dark still carry
 * the same token set.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf, isDarkMedia, isSystemSelector, themeOfSelector } from "./lib/scope.mjs"
import { isGrammarToken } from "./lib/vocabulary.mjs"

export const brandLayerShape = makeRule(
  "brand-layer-shape",
  {
    selector: (selector) =>
      `\`${selector}\` in brand.css. The brand layer has a light block (\`:root\`) and a dark block (\`.dark\`, \`[data-theme="dark"]\` or \`@media (prefers-color-scheme: dark)\`) and nothing else. The grammar family root (\`.grammar-common-root[data-grammar-family="<family>"]\`, with \`[data-grammar-theme="dark"]\` for dark) is admitted as the same two scopes.`,
    atRule: (name) => `\`@${name}\` in brand.css. The only at-rule the brand layer has is \`@media (prefers-color-scheme: dark)\`.`,
    property: (prop) => `\`${prop}\` in brand.css is not a token. The brand layer only declares grammar tokens (and \`color-scheme\`).`,
    foreign: (name) => `\`${name}\` in brand.css is not a token the grammar publishes. The brand is set only on the grammar's tokens.`,
    missingDark: (name) => `\`${name}\` has a light value and no dark value. Every brand token has both.`,
    missingLight: (name) => `\`${name}\` has a dark value and no light value. Every brand token has both.`,
    noDark: () => "brand.css has no dark block. The brand layer carries a light and a dark value for every token.",
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) !== "brand") return
    /** Token name to the first declaration that sets it, per theme. */
    const light = new Map()
    const dark = new Map()

    const checkBlock = (block, into) => {
      block.each((child) => {
        if (child.type === "comment") return
        if (child.type !== "decl") return report(child, "property", [child.type === "rule" ? child.selector : `@${child.name}`])
        if (child.prop === "color-scheme") return
        if (!child.prop.startsWith("--")) return report(child, "property", [child.prop], { word: child.prop })
        if (!isGrammarToken(child.prop)) return report(child, "foreign", [child.prop], { word: child.prop })
        if (!into.has(child.prop)) into.set(child.prop, child)
      })
    }

    const checkRule = (rule) => {
      const themes = rule.selectors.map((selector) => themeOfSelector(selector))
      if (themes.includes(null)) return report(rule, "selector", [rule.selector], { word: rule.selector })
      for (const name of new Set(themes)) checkBlock(rule, name === "light" ? light : dark)
    }

    root.each((node) => {
      if (node.type === "comment") return
      if (node.type === "rule") return checkRule(node)
      if (node.type === "atrule" && node.name.toLowerCase() === "media" && isDarkMedia(node.params)) {
        return node.each((child) => {
          if (child.type === "comment") return
          if (child.type !== "rule" || !child.selectors.every(isSystemSelector)) {
            return report(child, "selector", [child.type === "rule" ? child.selector : `@${child.name ?? child.prop}`])
          }
          checkBlock(child, dark)
        })
      }
      if (node.type === "atrule") return report(node, "atRule", [node.name], { word: `@${node.name}` })
      report(node, "property", [node.prop], { word: node.prop })
    })

    if (dark.size === 0) return report(root.first ?? root, "noDark")
    for (const [name, decl] of light) if (!dark.has(name)) report(decl, "missingDark", [name], { word: name })
    for (const [name, decl] of dark) if (!light.has(name)) report(decl, "missingLight", [name], { word: name })
  },
)
