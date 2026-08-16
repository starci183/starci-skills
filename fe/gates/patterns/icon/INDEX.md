---
id: fe-patterns-icon-index
title: INDEX.md
slug: /gates/patterns/icon
sidebar_label: icon
sidebar_position: 0
description: Binding rules for drawing a product meaning as a glyph through one closed vocabulary and three semantic roles.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `icon`

## Law

An icon is a **closed product meaning**, drawn through one glyph vocabulary. A caller names what the
glyph MEANS and the ROLE it performs. The icon leaf alone chooses the concrete drawing.

The question that classifies the role is: **is this introducing content, leading an ordinary control
or row, or sitting inside a compact chip?** A heading glyph is not a leading glyph made larger, and
a chip glyph is not either one made smaller. The vocabulary ships separate drawings for those jobs,
authored at those optical sizes, and CSS cannot restore geometry it never had.

**This is binding, not advisory.** Every glyph a screen renders has a situation below, and that
situation has a code. "It is one small caret" is not an exemption — it is the exact case that opened
this law: a leaf reached into the glyph package directly, at a size off both steps and in a cut the
icon leaf does not offer, and nothing reported it.

## Situation Codes

Every situation this module governs carries a code, `ICON-<n>`. The code names the SITUATION; it is
not a component, a size or a package name.

| Code | What it requires | What it forbids |
|---|---|---|
| `ICON-1` | Exactly three semantic roles: `heading`, `leading`, `chip` | A fourth role; a caller passing pixels, a size class or a weight |
| `ICON-2` | A heading glyph is the 24 outline drawing at `size-6` | Mini or micro artwork grown into a heading box |
| `ICON-3` | A leading glyph is the outline drawing at `size-5` | Heading weight, or chip compression, for navigation, rows, fields and ordinary icon controls |
| `ICON-4` | A chip glyph is the native 16 solid micro drawing at `size-4` | A 24 outline glyph scaled down; the 20px mini family used as a chip |
| `ICON-5` | A glyph draws in `currentColor` | A product glyph carrying its own colour |
| `ICON-6` | Only the icon leaf names a glyph library; callers name meanings | A glyph component imported at a call site, or a second route into the library from a sibling file |
| `ICON-7` | Two families only: 24 outline and 16 solid | Any other glyph package, even inside the icon leaf; a brand mark approximated from a general package |
| `ICON-8` | Every role carries `shrink-0` | A glyph deforming when its row becomes tight |
| `ICON-9` | The source feature map owns meaning-to-glyph selection, and name, map and table move together | Two unrelated meanings sharing one glyph; a stale or missing row |
| `ICON-10` | A compact business fact whose reference is text-only stays text-only | A decorative feature glyph on a metric, goal, kind label, streak caption or fact cell |
| `ICON-11` | Every plated icon tile draws the `leading` glyph at `size-5`; only the plate varies | Deriving glyph role from plate size |
| `ICON-12` | A leading glyph belongs in a heterogeneous set of peer choices or destinations | A leading glyph on a lone summary or header row already named by its section |
| `ICON-13` | Product reactions are the checked-in attributed artwork, passed by identity through the reaction leaf | Unicode emoji, caller-supplied asset paths or images, or importing that artwork as a glyph catalogue |

`ICON-1` IS THE CODE THE OTHERS HANG FROM. Roles are semantic names, not styling shorthands. Once a
caller can say "this size" instead of "this job", `ICON-2`, `ICON-3` and `ICON-4` have nothing left
to be true about: a third step appears, it is picked for a reason true on one screen, and everyone
after copies the nearest of three.

## Tầng giữ

Which tier actually holds each code today. `unrepresentable` means a closed union or prop shape makes
the wrong value impossible to write; `enforced` means a rule in
[`sources/fe/icon.mjs`](../../../../sources/fe/icon.mjs) reports it, named here; `documented` means only
a reader holds it.

| Code | Tier | What holds it |
|---|---|---|
| `ICON-1` | `unrepresentable` | The role union is closed to three names, and the leaf's prop shape carries no size, class or colour slot, so a fourth role does not compile and a pixel value has no channel. The residue — an off-scale `size-*` written on any element — is additionally reported by `starci-fe/no-off-scale-glyph-size` |
| `ICON-2` | `documented` | Nothing mechanical pairs `heading` with the 24 outline drawing; the pairing lives in one map inside the leaf, and a twin test asserts the `size-6` box only |
| `ICON-3` | `documented` | Same map, same absence: the `size-5` step is a line of source no rule reads |
| `ICON-4` | `documented` | No rule distinguishes the 16 solid micro family from a 24 outline glyph in a `size-4` box; the two produce identical CSS |
| `ICON-5` | `documented` | A glyph inherits colour because the leaf draws it that way, not because anything refuses a hard-coded fill |
| `ICON-6` | `enforced` | `starci-fe/no-vendor-icon-outside-icon-leaf` — glyph packages matched as a prefix, so a subpath cannot walk around the check |
| `ICON-7` | `enforced` | `starci-fe/heroicons-is-the-glyph-vendor` — applies inside the icon leaf too, which is the half `ICON-6` cannot see |
| `ICON-8` | `documented` | `shrink-0` is baked into every role's class string; a hand-written glyph beside it is held by nothing |
| `ICON-9` | `documented` | The map and the table sit in the same folder and are updated by hand. The parity test the flat law claims could not be found in source |
| `ICON-10` | `enforced` | `starci-fe/no-decorative-icon-in-metric-cell` — bound to one composite path, so the rule holds that cell and no other |
| `ICON-11` | `documented` | The plate leaf passes `leading` in one line; nothing stops a second plated leaf choosing differently |
| `ICON-12` | `documented` | Peer identity is a judgement about a set, and no rule reads a set |
| `ICON-13` | `documented` | The reaction identities are a closed set in the leaf; no rule refuses a Unicode pictograph or an asset path at a call site |

FIVE RULES EXIST, FOUR CODES CARRY ONE. The fifth, `starci-fe/rank-artwork-is-a-closed-set`, guards
a named exemption to `ICON-7` — one file, one package, four artwork identities — and its own comments
cite `ICON-11`, which in this law means the plated tile. The number collision is real and is recorded
in [`audit.md`](./audit.md) rather than fixed by renumbering, because a code somebody has already
cited cannot quietly change meaning.

## Anchor

Where each code can be checked against real code. Paths under `src/` are front-end product source;
paths under `sources/fe/` are the rules in this trust tree.

| Code | Path | What to look for |
|---|---|---|
| `ICON-1` | `src/components/leaves/Icon/index.tsx` · `src/components/contracts/props.ts` | The three-name role union and the role-to-class map; the leaf prop shape with exactly `props`, `on`, `isLoading` — and therefore no place to write a size |
| `ICON-2` | `src/components/leaves/Icon/index.tsx` · `src/components/leaves/Icon/index.test.tsx` | The 24 outline import block; the `heading` entry reading `size-6 shrink-0`; the twin test asserting `size-6` |
| `ICON-3` | `src/components/leaves/Icon/index.tsx` | The `leading` entry reading `size-5 shrink-0`, selected from the same outline import block as `heading` |
| `ICON-4` | `src/components/leaves/Icon/index.tsx` | The separate 16 solid import block, aliased per meaning, and the `chip` entry reading `size-4 shrink-0` |
| `ICON-5` | `src/components/leaves/Icon/index.tsx` · `src/components/leaves/Icon/brands.tsx` | `stroke="currentColor"` on the locally drawn glyphs; in the brand file, one mark keeping four authored hex fills while the monochrome mark uses `currentColor` — the exception and the rule side by side |
| `ICON-6` | `sources/fe/icon.mjs` | `noVendorIconOutsideIconLeaf`; the single allowed module path; the package list matched by prefix |
| `ICON-7` | `sources/fe/icon.mjs` | `heroiconsIsTheGlyphVendor`; the two-package allow set; the rank exemption threaded through both vendor rules |
| `ICON-8` | `src/components/leaves/Icon/index.tsx` | Every one of the three role strings ending in `shrink-0` — including `chip`, the one most often assumed too small to matter |
| `ICON-9` | `src/components/leaves/Icon/icon.md` · `src/components/leaves/Icon/index.tsx` | The feature table beside the meaning union and the glyph map, in one folder. The parity test named by the law: `chưa neo được` |
| `ICON-10` | `sources/fe/icon.mjs` · `src/components/composites/LabelledProgressRow/index.tsx` | `noDecorativeIconInMetricCell` and the path it is bound to; that composite rendering a label, a figure and a bar with no glyph |
| `ICON-11` | `src/components/leaves/IconTile/index.tsx` | Two plate steps in the size map, and one line below it passing `role: "leading"` unconditionally |
| `ICON-12` | `src/components/composites/IconLabelFactRow/index.tsx` | Three recipes; the peer recipe is the code's positive case. The label-led recipe already renders its trailing fact small and muted **and still draws a glyph** — the half of the code source does not yet keep |
| `ICON-13` | `src/components/leaves/ReactionPicker/index.tsx` · `public/reactions/` | The closed identity list in the leaf; the six checked-in artwork files and the attribution travelling with them |

## Inputs

| Input | Evidence required |
|---|---|
| meaning | A product feature, state or action already present in the source feature map |
| role | Introducing a region, leading an ordinary control or row, or sitting in a compact chip |
| placement | The set the glyph sits in: peers, a lone summary, a repeated metric cell, a plated tile |
| reference | What the named reference actually draws there — text-only, or a glyph |
| container | Which state the surrounding node carries: disabled, muted, selected, themed |

## Invariants

- A caller names a meaning and a role; the icon leaf owns vendor, family, drawing and size.
- One meaning maps to one drawing, and one drawing serves one meaning.
- Role does not follow from plate size, container size, viewport or density.
- A glyph inherits colour; an identity mark keeps the colours that make it that identity.
- A glyph never shrinks; words give way first.
- A glyph appears where it distinguishes something the words have not already closed.
- A situation code maps to exactly one requirement, and no requirement serves two codes.
- Artwork vocabularies — reactions, awards — are closed sets owned by one leaf each, never catalogues.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Identity marks keep their colour** (`ICON-5`). An exact provider or house mark is recognised by
  its colours; recolouring it produces a different mark. Monochrome marks still take `currentColor`.
- **Identity marks are local SVG** (`ICON-7`). A brand is drawn exactly, from a file in the icon
  folder — never approximated by the nearest glyph in a general-purpose package.
- **Reference-backed generic semantics stay** (`ICON-10`). Complete, failed, pending, close and
  disclosure are meanings a compact reference genuinely carries. Navigation, named feature entry
  points and large empty-region headings keep their reference glyphs, because there the glyph is part
  of locating the region.
- **Reaction artwork** (`ICON-13`). A closed set of product artwork, owned by one leaf, passed by
  identity. It is a narrow artwork boundary and does not open a second glyph vocabulary.
- **Award artwork** (`ICON-7`, by the rank exemption in the lint source). One file may name one extra
  package, for four artwork identities and no fifth. It is bounded on three sides at once, and it is
  recorded as a decision made knowing the checked-in route was the stronger mechanism.

## Output

```text
meaning: <feature, state or action from the source map>
role: <heading | leading | chip>
situation: <ICON-1 … ICON-13>
placement: <peers | lone summary | metric cell | plated tile | chip | heading region>
decision: <the glyph that is drawn, or the decision to draw none>
reason: <the business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping, and
[`audit.md`](./audit.md) only while reviewing the law itself.

## Scope

This module states a rule true of any front end. It names no product, no repository, no component
library and no registry key. It does name a glyph vendor, because the closed vendor choice IS the
substance of `ICON-7`; substitute your own and every other code still reads the same. Every example
is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md). A code is never renumbered and never removed; a code believed wrong
is kept and argued in `audit.md`.
