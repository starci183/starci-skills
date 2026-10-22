// The harness UI adopts the typed half of the front-end canon first: the typed-source config of @starci/eslint-canon-fe lints all of `src/`
// with types, the React Hooks rules, the type-aware typescript-eslint rules and the Sonar way rules, all at error. The canon's own
// product-structure rules (starciPlainSourceConfig, which fe-kit already runs) are the next adoption step. The one rule below is the
// UI's own and only adds: a colour is a design token, never a literal.
// The canon is imported from this repository's own source; `npm run lint` links the plugins it resolves (packages/fe-kit/scripts/link-peers.mjs).
import { starciTypedSourceConfig } from "../packages/eslint/fe/index.mjs"

const literalColour = /(?:^|[\s:[(])#[0-9a-f]{3,8}(?![0-9a-f])|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|color)\s*\(/i

const noLiteralColours = {
  meta: { type: "problem", messages: { literal: "Use a semantic design token instead of a literal colour." }, schema: [] },
  create(context) {
    const check = (node, value) => {
      if (literalColour.test(value)) context.report({ node, messageId: "literal" })
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
      JSXAttribute(node) {
        if (typeof node.value?.value === "string") check(node.value, node.value.value)
      },
    }
  },
}

export default [
  ...starciTypedSourceConfig({ root: import.meta.dirname }),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { starci: { rules: { "no-literal-colours": noLiteralColours } } },
    rules: { "starci/no-literal-colours": "error" },
  },
]
