---
id: fe-patterns-tokens-index
title: INDEX.md
slug: /fe/patterns/tokens
sidebar_label: tokens
sidebar_position: 0
description: Binding rules for a closed token vocabulary — what a union makes unrepresentable, and what a rule must catch in the one folder the union cannot see.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `tokens`

## Law

A token is a member of a closed set. Not a value somebody agreed to prefer — a value that is the
only thing which can be typed, so a screen off the scale is not a screen that failed review, it is a
screen that failed to compile.

Most of this law is therefore held by a type, and the rest of it exists to cover the places the type
does not reach. That division is the whole shape of this module: **the union protects the table, and
the rules protect the folder the union cannot see.**

**This is binding, not advisory.** Every measurement, every colour and every control height a screen
emits has a code below. There is no value small enough to be exempt: a `size-3.5` on one glyph is
`TOKEN-3` for the same reason a raw hex fill is `TOKEN-4`. "It is only one class" is not an
exemption — it is where the last off-scale value in a real codebase survived every rule that
existed.

**The scale, as it actually is.** Six rungs for the seam between things, unevenly spaced.

| Rung | Class | Reads as |
|---|---|---|
| 4px | `gap-1` | two lines of ONE identity — a name over its handle, a figure over the word labelling it, a title over its muted subtitle, a price over the caption qualifying it |
| 8px | `gap-2` | compact horizontal peers in one functional cluster — glyph and label, peer tabs, grouped cards, or an input and its direct inline action |
| 12px | `gap-3` | owner-to-owned or independently readable local units — label to card/input, field to field, card to caption, toolbar to governed content, or unrelated groups sharing a row |
| 16px | `gap-4` | two participants that are each already a cluster — a stack over the stack beneath it, an identity cluster against the trailing fact at the far end of its row, a prompt against the action answering it, or peer cards repeating across a grid |
| 24px | `gap-6` | two blocks on a page |
| 32px | `gap-8` | the layout seam — a rail against the column beside it |

`gap-2` requires two facts at once: the peers are horizontal AND they form one functional cluster.
Fail either test and the seam is `gap-3`. Tokens are selected by relationship and grouping, never by
component name or direction. `gap-4` is selected by the participants alone: once each side is itself
composed, the seam between them out-ranks the seams inside them, in a column, a row and a grid
alike.

**There is no zero rung, and its absence is deliberate.** "Touching" and "almost touching" are not a
distinction a second author reproduces from memory, so the surface this replaced ended up spelling
one identity stack both ways. Only the 4px rung survived that, and it survived because it names a
relationship rather than an amount — the second line qualifies the first. A container that wants no
seam declares no gap class, which is a different statement from naming a rung that measures nothing.

**Insets take 16px and 24px symmetric, or 12/8 and 16/12 asymmetric.** And the relationship that
makes an unfamiliar surface decidable is visible in the table rather than asserted over it: **the
house surface carries a 16px inset around a 16px interior seam.** The edge breathes at the rhythm of
the contents, so the two are one decision and not two. An ordinary surface therefore uses `p-4`. A
joined-list surface preserves that same 16px outer edge without insetting its dividers: the vendor
surface and its content host are `p-0`, the list root is `p-0`, a single row is `p-4`, and
first/middle/last rows are respectively `px-4 pt-4 pb-3`, `px-4 py-3`, and `px-4 pt-3 pb-4`. When
the generic surface inset is enforced with `!important`, the joined-list root wins at equal cascade
strength through a semantic `data-component` selector; utility presence is insufficient, and the
proof is computed padding of `0px` on the rendered page.

**Control height has two tokens, selected by placement rather than importance.**

| Token | Placement |
|---|---|
| `sm` | Embedded action inside a row, list item, compact toolbar, card cluster or another control's local seam |
| `md` | Standalone action that owns a line or anchors a form or surface |

The `variant` axis stays independent: it says whether an action is primary, secondary, outline or
tertiary; it does not select height. A primary action may be `sm` in a compact cluster, and a
tertiary action may be `md` when it stands alone. Label length never changes the size token.

## Situation Codes

Every situation this module governs carries a code, `TOKEN-<n>`. The code names the SITUATION; the
requirement column names what that situation obliges. Codes are cited from other law files and from
task records, so a number is permanent even when the wording around it changes.

| Code | Requires | Forbids |
|---|---|---|
| `TOKEN-1` | The layout vocabulary is a closed union, so an off-scale value cannot be typed at all | Patrolling by convention a value the type could have refused |
| `TOKEN-2` | A new member is added deliberately, in the named list, where the diff shows it | A value arriving inside a component nobody reviewed closely |
| `TOKEN-3` | Whole rungs only; the nearest rung when in doubt | Any fractional step in any family that measures |
| `TOKEN-4` | A member of the vocabulary, or a semantic colour token | A bracketed length or a raw colour, even when it equals a rung today |
| `TOKEN-5` | Rank comes from the component that owns tag and metrics together | Large text plus heavy weight assembled from raw classes |
| `TOKEN-6` | Rules read class strings in source, including strings hoisted into module constants | Assuming the leaf folder is covered because the tiers above it are typed |
| `TOKEN-7` | A bare mark uses `text-*`; a plate pairs `bg-*-soft` with `text-*-soft-foreground`, or `bg-*` with `text-*-foreground` | A `*-soft` background token used as an ink colour |
| `TOKEN-8` | Size selected from placement, variant selected from priority | Height inferred from variant, word count, or how loud the control feels; custom padding used to shrink a control |
| `TOKEN-9` | The name is a union member AND the variable it requests exists in the stylesheet | Reporting names the framework resolves itself — `screen`, `full`, `fit`, the viewport units |

## Tầng giữ

Which tier actually holds each code. A rule is named only where one was found in `tokens.mjs` and
read; everything else is `documented`, and that gap is a measurement, not a failure.

| Code | Tier | What holds it |
|---|---|---|
| `TOKEN-1` | `unrepresentable` | The closed `LayoutClassName` union. `gap-[13px]` is not refused; it is not a member |
| `TOKEN-2` | `documented` | Nothing mechanical. A union can refuse a non-member; it cannot judge whether a new member was a considered decision |
| `TOKEN-3` | `enforced` | `no-fractional-step` |
| `TOKEN-4` | `enforced` | `no-arbitrary-value` (two messages: `length` and `colour`) |
| `TOKEN-5` | `enforced` | `no-hand-rolled-heading` |
| `TOKEN-6` | `documented` | Nothing reports a violation of it. `isSourceFile` and the `VariableDeclarator` visitor in `tokens.mjs` IMPLEMENT it; no rule can fail when coverage is missing |
| `TOKEN-7` | `documented` | Nothing mechanical. Pairing is a two-class relationship no rule in `tokens.mjs` looks for |
| `TOKEN-8` | `documented` | The size union closes the set to two, so a third height is unrepresentable — but WHICH of the two is right is a placement judgement nothing checks |
| `TOKEN-9` | `enforced` | `no-unresolved-token-class` |

Four codes are `enforced`, one is `unrepresentable`, four are `documented`.

## Anchor

Where each code can be checked against real code. Paths are repository-relative: `sources/fe/…` is
this trust tree, `src/…` is a consuming front-end repository.

| Code | Anchor | What to look for |
|---|---|---|
| `TOKEN-1` | `sources/fe/contracts.ts` · `src/components/contracts/index.ts` | `export type LayoutClassName` — a union of literals with the six gap rungs among them |
| `TOKEN-2` | `sources/fe/contracts.ts` | The comment above the union: grow this list deliberately, so the addition reads as a decision in the diff |
| `TOKEN-3` | `sources/fe/tokens.mjs` | The `FRACTIONAL` pattern and the `noFractionalStep` rule built from it |
| `TOKEN-4` | `sources/fe/tokens.mjs` | `ARBITRARY_LENGTH`, `RAW_COLOUR`, and the two message ids in `noArbitraryValue` |
| `TOKEN-5` | `sources/fe/tokens.mjs` · `src/components/leaves/Heading/index.tsx` | `LARGE_TEXT` and `HEAVY_WEIGHT` tested together; and the leaf where `level` drives tag and metrics as one decision |
| `TOKEN-6` | `sources/fe/tokens.mjs` · `sources/fe/contract.mjs` | `isSourceFile`, the `VariableDeclarator` branch of `classTextVisitors`; and `LEAF_DIR_RELATIVE` / `isLeafFile`, which name the exempt folder |
| `TOKEN-7` | `src/components/leaves/IconTile/index.tsx` · `src/components/leaves/RankDeltaCaret/index.tsx` | A tone table pairing `bg-*-soft` with `text-*-soft-foreground`; and a bare mark using plain `text-success` |
| `TOKEN-8` | `src/components/leaves/Button/index.tsx` | `export type ButtonSize = "sm" \| "md"` and the comment stating size follows placement, independently of visual priority |
| `TOKEN-9` | `sources/fe/tokens.mjs` · `src/app/globals.css` | `TOKEN_CLASS_FAMILIES` and `TAILWIND_OWN_NAMES`; and the `--container-app-*` variables the `max-w-app-*` names request |
| inset pairing | `src/app/globals.css` · `src/components/branches/SurfaceListCard/index.tsx` | `.card { padding: calc(var(--spacing) * 4) !important }` beside `.card[data-component="SurfaceListCardSurface"] { padding: 0 !important }` — the equal-strength semantic exception |
| joined-list rows | `src/components/contracts/index.ts` | Entries carrying `p-0`, `[&>*]:px-4`, `[&>*]:py-3`, `[&>*:first-child]:pt-4`, `[&>*:last-child]:pb-4` |

The last two rows anchor decisions the flat law made in prose without giving them a number. They are
listed here so the decisions stay checkable; they are not new codes.

## Inputs

| Input | Evidence required |
|---|---|
| class string | The literal text, whether written in markup, hoisted into a module constant, or listed in an entry array |
| tier | Which folder the file sits in — typed entry tier, or the leaf folder that writes its own classes |
| vocabulary | The current union members, read from the union itself and not from memory |
| theme | The stylesheet that defines the variables a token name requests |
| placement | For a control: embedded in a row or cluster, versus standalone and owning a line |
| role | For a colour: bare mark, soft plate, or solid plate |

## Invariants

- An off-scale layout value is unrepresentable, not merely refused.
- A new member of the vocabulary is a diff in the named list, never a value introduced at a call site.
- No measurement takes a fractional step, in any family.
- No bracketed length and no raw colour appears in product source, whatever it evaluates to.
- Rank is emitted by the component that owns tag and metrics together, never assembled from classes.
- A rule that reads class strings reads constants as well as markup.
- A background token is never used as a foreground token.
- Size comes from placement and variant comes from priority; the two axes never select each other.
- A class naming a theme token resolves only when the stylesheet defines its variable.
- The edge of a surface and the seam inside it are one decision.
- Every emitted measurement, colour and control height resolves to exactly one code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Positional selectors in an entry.** `TOKEN-1` admits `[&>*]:px-4`-shaped members inside the
  entry table and nowhere else, because a joined list must inset its rows without insetting the
  dividers between them.
- **Names the framework resolves itself.** `TOKEN-9` does not apply to `screen`, `full`, `fit`,
  `auto`, `none`, `min`, `max`, `prose`, `px` or the viewport units. They promise nothing about this
  theme, and reporting them sends an author to define a variable nothing reads.
- **No stylesheet found.** `TOKEN-9` stays silent rather than calling every token dead. A reader
  that cannot find the theme has no evidence, and no evidence is not a finding.
- **Product source only.** `TOKEN-3`, `TOKEN-4`, `TOKEN-5` and `TOKEN-9` read files under `src/`.
  Tooling and configuration are out of scope, because they render nothing.
- **Equal cascade strength.** Where a generic inset is enforced with `!important`, `TOKEN-1`'s
  preference for utilities yields to a semantic `data-component` selector — a utility cannot beat an
  important declaration, and the proof of the exception is computed padding on the rendered page.

## Output

```text
value: <the class or token as written>
tier: <entry | leaf>
code: <TOKEN-1 … TOKEN-9>
holder: <unrepresentable | enforced:<rule-name> | documented>
verdict: <member | replace with <member> | define <variable> | pair with <token>>
reason: <the fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that closes its class vocabulary in a type. It names
no product and no component library. Every example is ordinary TSX with ordinary class strings. The
Anchor table cites repository-relative paths as EVIDENCE that the law is checkable — those paths are
not part of the vocabulary the law defines.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
