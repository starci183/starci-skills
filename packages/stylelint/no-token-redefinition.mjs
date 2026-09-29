/**
 * `starci/no-token-redefinition` (HFS R61 `FE_STYLE_TOKEN_ONLY`): a grammar token is set in one place,
 * `modules/brand/brand.css`. Any other stylesheet - a CSS module, `globals.css`, a component sheet - that
 * declares a token of the grammar vocabulary, or registers one with `@property`, redefines what the grammar and
 * the brand own: the component then looks different from its family and cannot be re-branded.
 *
 * A CSS module may still declare its own local custom property (`--row-index`) that is not a grammar token.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"
import { isGrammarToken } from "./lib/vocabulary.mjs"

export const noTokenRedefinition = makeRule(
  "no-token-redefinition",
  {
    declared: (name, kind) =>
      `\`${name}\` is a grammar token and is redefined in ${kind === "module" ? "a CSS module" : "this stylesheet"}. Grammar tokens are set only in \`modules/brand/brand.css\`.`,
    registered: (name) =>
      `\`@property ${name}\` registers a grammar token. Grammar tokens are declared by the grammar and set only in \`modules/brand/brand.css\`.`,
  },
  ({ root, report }) => {
    const kind = fileKind(fileOf(root))
    if (kind === "brand") return
    root.walkDecls((decl) => {
      if (decl.prop.startsWith("--") && isGrammarToken(decl.prop)) report(decl, "declared", [decl.prop, kind], { word: decl.prop })
    })
    root.walkAtRules("property", (rule) => {
      const name = rule.params.trim()
      if (isGrammarToken(name)) report(rule, "registered", [name], { word: name })
    })
  },
)
