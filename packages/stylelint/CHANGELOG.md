# Changelog

## 1.0.0

First release. HFS R61 `FE_STYLE_TOKEN_ONLY` for CSS.

- `starciStylelintConfig({ appTokens })` returns a complete config: eight rules at error, `defaultSeverity: "error"`,
  `ignoreDisables: true`, no `ignoreFiles`. The only option is `appTokens`; any other option throws.
- `starci/token-only`, `starci/raw-brand-value`, `starci/no-apply-raw`, `starci/no-important`, `starci/globals-shape`,
  `starci/no-token-redefinition`, `starci/brand-layer-shape`, `starci/no-inline-lint-config`.
- The token vocabulary is generated from `@starci/grammar`'s CSS (`npm run vocabulary`); a twin test fails when it is stale.
- The notion of a raw brand value (hex, colour function, px) is the one `@starci/eslint-canon-fe` `no-raw-brand-value` uses;
  a twin test compares the patterns.
- `why` maps every rule to its catalogue code and a Vietnamese headline and next step.
