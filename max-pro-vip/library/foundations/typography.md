---
name: typography
tier: foundations
admitted: 2026-07-30
---

# Typography

## Role

The type-size ladder exposed by the app's own `Typography` atom — one prop (`size`) selects among
heading levels, body sizes, and code. It governs font-size, and for headings which weight tiers are
real; it does not govern color (see `color`) or which HTML tag renders (the atom picks that
internally).

## Source of truth

Not `@heroui/styles`'s own `.typography--*` component classes directly — that is the vendor recipe
the backed-up note pointed to, but the app's real text primitive is `.storybook/components/atoms/
text/Typography/Typography.tsx`, a custom atom whose own docstring says it plainly: "custom text
atom (NOT HeroUI `Typography`)". It wraps `HeroTypography.Heading` for headings and
`HeroTypography type="code"` for code, and hand-builds the third group (body) from bare Tailwind
`text-*` utility classes.

The exposed prop is `size` (type `TypographySize`), not `type` as the backed-up note claims — the
note is stale on the prop name. Comment in the source, dated 2026-07-25: "ONE SIZE AXIS for the
whole system (teacher confirmed 2026-07-25 — merged the namespace, only `Typography` remains)" —
before that date the atom exposed eight separate members (`Xs`/`Sm`/`Base`/`Lg`/`H3`/`H4`/`H5`/
`Code`/`Heading`).

## Scale

| Step | Value | Derived as | Means |
|---|---|---|---|
| `h1` | 36px | Tailwind `text-4xl`, hand-set | top-level heading — `font-semibold tracking-tight` baked via `HeroTypography.Heading level={1}` |
| `h2` | 30px | `text-3xl`, hand-set | level-2 heading |
| `h3` | 24px | `text-2xl`, hand-set | level-3 heading |
| `h4` | 20px | `text-xl`, hand-set | level-4 heading |
| `h5` | 18px | `text-lg`, hand-set | level-5 heading — the smallest heading the atom exposes |
| `lg` | 18px | `text-lg`, hand-set | body-scale option, same px as `h5` — see collisions below |
| `base` | 16px | `text-base`, hand-set | body default |
| `sm` | 14px | `text-sm`, hand-set | secondary body text |
| `xs` | 12px | `text-xs`, hand-set | quiet / meta body text |
| `code` | 14px, mono | `text-sm` + `font-mono`, hand-set | inline code, wraps `HeroTypography type="code"` |

**No `notDerived` row applies in the `radius`/`gap` sense** — this whole scale has no root. Every
step is an independently hand-set Tailwind font-size utility (Tailwind's own named type scale), not
a multiple of a single custom property. Nothing here claims a derivation in the first place, so
nothing can silently fail to follow one.

**Retired steps, no longer live:** `h6` and the old names `body` / `body-sm` / `body-xs`. The live
`TypographySize` union is exactly `"xs" | "sm" | "base" | "lg" | "h1" | "h2" | "h3" | "h4" | "h5" |
"code"` — `HEADING_LEVEL` only maps `h1`..`h5`. The vendor `.typography--h6` / `.typography--body*`
CSS classes still exist in `@heroui/styles`, but the atom never references them — dead code, not a
live step. `lg` (18px, body scale) is the reverse case: a genuinely **new** rung, added when the
size axis merged into one prop on 2026-07-25.

## How steps relate

No formula connects the steps — Tailwind's own named type scale, picked by role, not by ratio.
`h1`–`h5` are heading **levels** (rendered through `HeroTypography.Heading`, baked `font-semibold
tracking-tight`). `xs`/`sm`/`base`/`lg` are **body** sizes, rendered as bare Tailwind `text-*`
classes with no `leading-*` override at all — `TEXT_CLS` in the atom is `{ xs: "text-xs", sm:
"text-sm", base: "text-base", lg: "text-lg" }`, nothing else. `code` is its own branch (`text-sm` +
`font-mono`).

**Line-height divergence from the backed-up note, verified against `tailwindcss/theme.css`.** The
note claims body / body-sm / body-xs render at HeroUI's own `leading-7` / `leading-6` / `leading-5`
(28 / 24 / 20px) — that was true of the vendor `.typography--body*` CSS classes, but the atom does
not apply those classes, only the bare font-size utility. Tailwind's own bundled default line-height
per size then applies instead: `--text-base--line-height: calc(1.5/1)` → 24px (not 28px),
`--text-sm--line-height: calc(1.25/0.875)` → 20px (not 24px), `--text-xs--line-height:
calc(1/0.75)` → 16px (not 20px). Every body size renders one line-height step tighter than the
vendor recipe the note described.

## Forbidden

| Forbidden | Caught by |
|---|---|
| passing `weight` together with `isLink` | nothing — `weight` is a flat optional prop with no type conditioning on `isLink`; the `isLink` branch never reads `weight` at all, so it is silently dropped: no error, no visible effect |
| `weight="semibold"` at body scale (`xs`/`sm`/`base`/`lg`, or `isButton`) expecting a third tier distinct from `weight="medium"` | nothing — both branches fold `semibold` into the exact same `font-medium` class as `medium`; the two inputs are visually indistinguishable at body scale. `semibold` is only a real, distinct third tier on `h1`–`h5` — and there, unlike the old note's claim, applying `weight="bold"` on a heading DOES take real visible effect (it is passed straight through to `HeroTypography.Heading`), it is not inert |

## Read by which axes

`text` — every body of copy routes size selection through this scale.
`color` — `Typography`'s own `color` prop only bakes `default`/`muted` at the atom layer; every
other color is a className override (see `color`).

## Anchors

`@heroui/styles/dist/components/typography.css` for the vendor `.typography--h1..h6/body*/code`
recipe — still present, partially dead (`h6`/`body*` unreferenced by the app atom).
`tailwindcss/theme.css` for the default per-size line-height ratios that expose the note's
line-height drift. `.storybook/components/atoms/text/Typography/Typography.tsx` for the live
`TypographySize` union, `HEADING_LEVEL`, `TEXT_CLS`, `SKEL_H`, the 2026-07-25 "merged the
namespace" rename of the prop from `type` to `size`, the `weight`/`isLink` interaction, and the
semibold-folds-to-medium rule at body scale. `src/app/globals.css:229` confirms `--font-sans:
var(--font-inter)` is still broken (`--font-inter` undefined anywhere in the repo).
`src/app/[locale]/layout.tsx` + `src/components/svg/LogoMark/index.tsx` confirm the font that
actually loads is `Open_Sans` via `--font-open-sans`.
