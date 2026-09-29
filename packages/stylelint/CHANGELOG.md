# Changelog

## 1.1.0

- `starci/brand-layer-shape` admits the grammar family root as a brand scope: `.grammar-common-root[data-grammar-family="<family>"]` for light, the same root with `[data-grammar-theme="dark"]` (or `.dark`, or an ancestor `.dark`) for dark, and the same root with `[data-grammar-theme="system"]` inside `@media (prefers-color-scheme: dark)`. The grammar re-declares its tokens on the family root, so a brand written on `:root` is inherited and loses; light and dark still carry the same token set.

## 1.0.0

First release. HFS R61 `FE_STYLE_TOKEN_ONLY` for CSS.

- `starciStylelintConfig({ appTokens })` returns a complete config: thirteen rules at error, `defaultSeverity: "error"`,
  `ignoreDisables: true`, no `ignoreFiles`. The only option is `appTokens`; any other option throws.
- `starci/token-only`, `starci/raw-brand-value`, `starci/no-apply-raw`, `starci/no-important`, `starci/globals-shape`,
  `starci/no-token-redefinition`, `starci/brand-layer-shape`, `starci/no-inline-lint-config`, `starci/no-css-module`, `starci/no-class-selector`,
  `starci/breakpoint-scale`, `starci/source-resolves` (finding `FE_STYLE_SOURCE_UNRESOLVED`), `starci/globals-import-order`.
- The token vocabulary is generated from `@starci/grammar`'s CSS (`npm run vocabulary`); a twin test fails when it is stale.
- The notion of a raw brand value (hex, colour function, px) is the one `@starci/eslint-canon-fe` `no-raw-brand-value` uses;
  a twin test compares the patterns.
- `why` maps every rule to its catalogue code and a Vietnamese headline and next step.
