/**
 * The "why" of each rule of this canon, in the same shape as `@starci/eslint-canon-fe`'s `lib/why.mjs`.
 *
 * A stylelint message is written for the developer at the terminal, in English. The agent that reads a failed land
 * gate needs the catalogue's sentence instead: the finding code (a key of `modules/kernel/failure-codes.yaml`), an
 * English headline (`en`) with `<file>` / `<what>` placeholders the reader fills from the stylelint location, and one
 * sentence "what do I do now" (`fix`). The owner reads both in Vietnamese through the declared message catalog: the
 * `en` and `fix` strings are the keys of `modules/i18n/messages/v4.yaml` (`translator('vi')(entry.en)` hands back the
 * Vietnamese of the same sentence). Every rule has an entry; the twin test refuses a rule with none and an entry for
 * a rule that does not exist.
 */

/** @typedef {{ code: string, en: string, fix: string }} Why */

/** @type {Record<string, Why>} */
export const why = {
  "token-only": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "CSS in `<file>` uses `<what>`, which is not a grammar token. Colour, spacing, radius and type come only from grammar tokens; a private variable name is a second design system.",
    fix: "Replace it with a grammar `var(--...)` (`--grammar-*`, a family token, a semantic token) or a neutral keyword.",
  },
  "raw-brand-value": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "CSS in `<file>` writes a raw colour/length value (`<what>`: hex, rgb, hsl, oklch or px). Raw values may live only in `modules/brand/brand.css`, with both a light and a dark value.",
    fix: "Use a grammar token; for a brand colour declare it in `modules/brand/brand.css` for both light and dark.",
  },
  "no-apply-raw": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`@apply <what>` in `<file>` applies an arbitrary value or a raw value. An arbitrary value is a raw value renamed, slipping past the grammar scale.",
    fix: "Use a utility from the scale, or a token reference of the form `[var(--...)]`.",
  },
  "no-important": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`!important` in `<file>` (`<what>`). It wins the priority fight by making the next one unwinnable, and lets a grammar override survive a rebrand.",
    fix: "Drop `!important`; fix the cascade order (grammar's layers already decide who wins).",
  },
  "globals-shape": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`globals.css` (`<file>`) contains `<what>`. The global stylesheet holds only `@import`, `@source` and token declaration blocks.",
    fix: "Move the styling into grammar utilities; inside `globals.css` keep only `@import`/`@source` and tokens that alias `var(--...)`.",
  },
  "no-token-redefinition": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`<file>` redeclares a grammar token (`<what>`). A grammar token may be assigned only in `modules/brand/brand.css`; a CSS module or `globals.css` redeclaring one makes a component leave the family and unrebrandable.",
    fix: "Delete the declaration; to change the value, change it in `modules/brand/brand.css`, for both light and dark.",
  },
  "brand-layer-shape": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`brand.css` (`<file>`) has the wrong shape (`<what>`). The brand layer declares only grammar tokens, in one light block and one dark block, each token carrying both values.",
    fix: "Keep only token declarations in `:root` and `.dark` (or `@media (prefers-color-scheme: dark)`); add the value the other mode is missing.",
  },
  "status-contrast": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`brand.css` (`<file>`) has a status colour failing the HeroUI soft-pair standard (`<what>`). Each status tone (success, warning, danger, info) has `--<tone>-soft` (light background) and `--<tone>-soft-foreground` (text, icon, dot colour) in both light and dark; soft text on a light surface and on the page must reach at least 3:1, body `--foreground` on `--background` at least 4.5:1, and a solid tone may not be a text colour when under 4.5:1.",
    fix: "Declare the full soft pair for both light and dark (the shared block `:root, .light, .dark` counts for both); blend `--<tone>-soft-foreground` toward `--foreground` until the threshold is met; a value that cannot be resolved is rewritten as a readable colour (hex, rgb, hsl, oklab, oklch, color-mix).",
  },
  "no-inline-lint-config": {
    code: "HFS_INLINE_SUPPRESSION",
    en: "A comment disabling a rule sits at `<file>:<line>`. HFS does not allow in-place suppression - fix the code, or propose a rule change.",
    fix: "Remove `stylelint-disable` and fix the cause.",
  },
  "no-css-module": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`<file>` is a CSS module. HFS forbids `*.module.css`: a private stylesheet per component is where a second design system begins.",
    fix: "Delete the file; style with grammar components and tokens, and extend grammar where it falls short.",
  },
  "no-class-selector": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "CSS in `<file>` has a class selector (`<what>`). App CSS does not define components; styling flows through grammar components and tokens.",
    fix: "Remove the rule; use a grammar component or token instead of a private class.",
  },
  "breakpoint-scale": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "A `@media` in `<file>` uses breakpoint `<what>` outside the grammar scale, so the layout changes at a width different from the other components.",
    fix: "Use a breakpoint of the grammar scale (30rem, 40rem, 48rem, 70rem), or the px equivalent at 16px/rem.",
  },
  "source-resolves": {
    code: "FE_STYLE_SOURCE_UNRESOLVED",
    en: "`@source` in `<file>` points at a path that does not exist (`<what>`). Tailwind scans no file and silently drops the utilities the components use.",
    fix: "Fix the `@source` path so it points at a real directory, resolved from the CSS file itself.",
  },
  "globals-import-order": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`globals.css` (`<file>`) imports in the wrong order or imports outside the standard list (`<what>`). The standard order: tailwindcss, @heroui/styles/css, the grammar family stylesheet, modules/brand/brand.css, then `@source`.",
    fix: "Reorder `@import` to the standard order and drop imports outside the list; `@source` comes last.",
  },
}
