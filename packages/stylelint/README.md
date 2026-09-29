# @starci/stylelint-canon

The CSS half of the StarCi lint canon (HFS R61 `FE_STYLE_TOKEN_ONLY`). The TypeScript half is
`starci-fe/no-raw-brand-value` in `@starci/eslint-canon-fe`; both use one definition of a *raw brand value*
(`lib/brand-value.mjs`: a hex colour, a colour function such as `rgb`/`hsl`/`oklch`/`color-mix`, or a `px` length).

```js
// stylelint.config.mjs
import { starciStylelintConfig } from "@starci/stylelint-canon"

export default starciStylelintConfig()
```

Peers: `stylelint` (17) and `postcss-value-parser`; exact versions are in `knowledge/hfs/canon-pins.yaml`.

## No rule is off

The factory has one option, `appTokens` (custom properties a repository's `globals.css` declares as aliases of grammar
tokens). Any other option throws. The config it returns sets every rule to error, `ignoreDisables: true` (a
`stylelint-disable` comment switches nothing off) and no `ignoreFiles`. `assertEveryRuleOn(config)` throws when a config
turns a rule off, downgrades it, omits it, ignores a file or honours inline disables; call it on a config you extended.

## The law

Colour values exist only in `modules/brand/brand.css`, on the tokens the grammar declares, with a light and a dark
value. Everywhere else CSS uses the grammar's tokens.

| Rule | Refuses |
|---|---|
| `starci/token-only` | A `var()` of a token the grammar does not publish; a colour, spacing, radius or typography property whose value is not a token, a `calc()` over tokens or a neutral keyword; a named colour in a shorthand (`border: 0 solid red`). |
| `starci/raw-brand-value` | A hex, colour function or `px` length in any stylesheet except `brand.css`. |
| `starci/no-apply-raw` | `@apply` of an arbitrary value (`bg-[#fff]`, `w-[12px]`) that is not a token reference (`bg-[var(--accent)]`, `bg-(--accent)`). |
| `starci/no-important` | `!important` in a declaration, and `!` on an `@apply` utility. |
| `starci/globals-shape` | In `globals.css`: anything but `@import`, `@source` and `:root`/`.dark`/`[data-theme]`/`@theme` blocks of alias tokens (`var()` values only). |
| `starci/no-token-redefinition` | A grammar token declared (or `@property`-registered) anywhere but `brand.css`, CSS modules included. Local custom properties are fine. |
| `starci/brand-layer-shape` | `brand.css` with a selector other than a light or dark block, a non-token property, a token the grammar does not publish, or a token that lacks its light or its dark value. |
| `starci/no-inline-lint-config` | `stylelint-disable`, `-enable` and `-disable-next-line` comments. |

The file kind comes from the path: `**/modules/brand/brand.css` is the brand layer, `globals.css` the global sheet,
`*.module.css` a CSS module, anything else a plain stylesheet. There is no per-file override to turn a rule off.

## The vocabulary

The tokens the rules accept are the grammar's own, read from `packages/grammar/src/**/*.css` by
`lib/extract-vocabulary.mjs`: every custom property under `--grammar-`, `--starci-core-`, `--heritage-` and
`--offset-pop-`, the un-prefixed semantic layer the grammar declares (`--accent`, `--surface`, `--border`, ...) and
the vendor tokens it reads (`--radius-md`, `--font-mono`). `lib/vocabulary.generated.mjs` is the committed result;
`npm run vocabulary` regenerates it and `vocabulary.test.mjs` fails when it is stale.

## Not covered (R61 asks, this release does not)

Class selectors in app CSS, a ban on `*.module.css`, the breakpoint scale, `@source` resolution and the order of
`globals.css` imports. `raw-brand-value` reads declarations only: a `px` inside an `@media` query is not reported.

## Why

`lib/why.mjs` (exported as `why`) maps each rule to its finding code (`FE_STYLE_TOKEN_ONLY`, or
`HFS_INLINE_SUPPRESSION` for the suppression rule), a Vietnamese headline with `<file>` / `<what>` placeholders and a
Vietnamese next step, in the shape of eslint-canon-fe's `why`.

```sh
npm test            # node --test "*.test.mjs"
```
