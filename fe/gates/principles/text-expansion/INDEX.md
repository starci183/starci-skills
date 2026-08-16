---
id: fe-principles-text-expansion-index
title: INDEX.md
slug: /gates/principles/text-expansion
sidebar_label: text-expansion
sidebar_position: 0
description: Binding rules for how much a run grows in another language, and which geometry mirrors under RTL.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `text-expansion`

## Law

A rendered string is not a fixed quantity. The same message is a different number of characters in
every language it ships in, and in some of them it runs the other way across the screen. Choose the
box from the whole set of languages the product ships, never from the one string in front of you.

The box absorbs the growth. The string is never shortened to fit a box that was measured once, in
one language, on one machine — that is not a translation, it is a different sentence.

**This is binding, not advisory.** Every rendered run carries an expansion situation, and that
situation has a code below. There is no string short enough to be exempt: a four-character button
label is the single most dangerous run on the page, because it is the one that grows the most —
`Save` becomes `Speichern`, `Undo` becomes `Rückgängig`, and a box built to hold four characters
holds neither. "It is only one word" is not an exemption; it is the sentence under which a bilingual
product ships a control that is broken in half of the languages it claims to support.

Direction is the same fact seen from the side. A layout that reads left-to-right encodes that
assumption in every physical padding, every absolute offset, every arrow. Under `dir="rtl"` those
assumptions do not degrade gracefully — they invert the meaning of the screen while continuing to
render without error.

## Situation Codes

Every situation this module governs carries a code, `EXPANSION-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and
two of them emit nothing.

| Code | Situation | className |
|---|---|---|
| `EXPANSION-0` | The run is identical in every locale; there is no growth to absorb | *no expansion class* |
| `EXPANSION-1` | One translated run; its own box must absorb its growth band | `w-auto whitespace-normal` |
| `EXPANSION-2` | A track shared by many translated runs at once, sized for the widest locale | `min-w-fit` · `grid-cols-[max-content_minmax(0,1fr)]` · `flex-wrap` |
| `EXPANSION-3` | One sentence assembled from parts; word order belongs to the locale | *no expansion class — one run, placeholders inside* |
| `EXPANSION-4` | Direction-relative geometry that must mirror under RTL | `ps-*` `pe-*` `ms-*` `me-*` `text-start` `start-*` `rtl:-scale-x-100` |
| `EXPANSION-5` | A run or glyph whose meaning is destroyed by mirroring | `dir="ltr"` · *no `rtl:` class* |
| `EXPANSION-6` | A value the locale shapes: number, date, currency, plural, list | `tabular-nums` |

### Three questions, asked in this order

The unit of decision is one run and the box that holds it. Three questions apply to it, and each has
exactly one answer in the table above.

1. **Length.** Does this run change length between locales, and who absorbs that? This question is
   TOTAL: every rendered run answers `EXPANSION-0`, `EXPANSION-1`, `EXPANSION-2` or `EXPANSION-3`,
   and exactly one of them.
2. **Direction.** Does this box's geometry, or this glyph's meaning, depend on which way the script
   runs? Answered by `EXPANSION-4` or `EXPANSION-5`, and only when the box has direction-relative
   geometry or the glyph carries direction.
3. **Shape.** Is this run a value the locale prints rather than a phrase a translator writes?
   Answered by `EXPANSION-6`, and only for machine values.

A price in a table answers all three: it shares a numeric column with every locale (`EXPANSION-2`),
its digits never mirror (`EXPANSION-5`), and its separators, symbol and symbol POSITION are the
locale's to choose (`EXPANSION-6`). A decorative divider answers none, because it holds no run.

### The two codes that emit nothing are not the same code

`EXPANSION-0` says there is **nothing to reserve**: the run is a closed, enumerable vocabulary that
is the same glyphs in Vietnamese, German and Arabic — a file extension, an ISO code, a version
string, a keyboard glyph. Its box may be measured from what it holds, because what it holds does not
change.

`EXPANSION-3` says there is **nothing to style**: the defect is structural. A sentence split into
sibling elements so that each fragment can be positioned has already lost, because word order is not
a constant across languages and the fragments cannot reorder themselves. The repair is markup — one
run, placeholders inside it — not a class.

Reading them as one code produces the exact mistake this module exists to prevent: treating an
untranslated fragment as if it were an untranslatable token.

### Growth bands

Reserve by the length of the SOURCE run, not by feel. Shorter source runs grow by a far larger
proportion, which is why the smallest controls fail first.

| Source length (characters) | Additional space to survive |
|---|---|
| 1–10 | 100–200% |
| 11–20 | 80–100% |
| 21–30 | 60–80% |
| 31–50 | 40–60% |
| 51–70 | 31–40% |
| over 70 | 30% |

A box that survives 30% more characters is adequate for a paragraph and useless for a button. The
band is a floor for the box, never a budget for the translator.

Contraction is the same law read backwards. A run that is shorter in another script — many CJK
strings land near half the source length — does not license a box measured from that script either.
A box is correct when it holds the LONGEST supported locale and does not look abandoned holding the
shortest.

## Inputs

| Input | Evidence required |
|---|---|
| run | Where the string comes from: a translation catalogue, a machine value, or an invariant token |
| locales | Which languages ship, including whether any is written right-to-left |
| band | Source length in characters, mapped to the growth band above |
| box | Which element owns the extent: this run's own box, or a track shared with other runs |
| direction | Whether the geometry is direction-relative, and whether the glyph carries direction |
| value | Whether the run is printed by a locale formatter rather than written by a translator |

## Invariants

- The box absorbs growth. The string is never edited, abbreviated or clipped to preserve a width.
- No extent is derived from measuring one language. A number typed after looking at one string is a
  measurement of that string, not a decision about the control.
- A translated run is never `whitespace-nowrap` inside a bounded box. Only `EXPANSION-0` may be.
- A shared track is sized by the widest supported locale, not the current one.
- A sentence is one run with placeholders. Concatenated fragments are a defect in every locale and a
  visibly reordered defect in a right-to-left one.
- Spacing, offsets, alignment and radii are logical by default. A physical direction is a claim that
  the property does not mirror, and that claim must be true.
- Numbers, brand marks, media transport controls and time-ordered charts do not mirror.
- A value the locale prints is produced by a locale formatter, never by string concatenation.
- A situation code maps to exactly one className, and no className serves two codes.
- Every rendered run resolves to exactly one length code. No run is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Fixed extent for an invariant run.** A track may be measured exactly when every run it holds is
  `EXPANSION-0`. A column of ISO currency codes may be three characters wide; a column of currency
  NAMES may not.
- **Embedded invariant inside a translated sentence.** A URL, an identifier, a code snippet or an
  email inside a right-to-left sentence is an `EXPANSION-5` island inside an `EXPANSION-4` box. The
  island is the exception; the sentence around it is not.
- **Icon-only control.** The absence of a visible run does not remove the situation. Its accessible
  name and its tooltip are translated runs, and the tooltip box is `EXPANSION-1`.
- **Glyph pairs that mirror together.** Undo and redo, previous and next, reply and forward mirror as
  a pair or not at all. Mirroring one of a pair is worse than mirroring neither.
- **Task progress versus media progress.** A bar that reports how much of a task is done mirrors; a
  bar that reports position within a recording does not. Same shape, different codes, and the
  difference is what the bar means.
- **Two codes both match on length.** Prefer the code that keeps the run whole. Growth is cheaper to
  live with than a control that cannot state its own name.
- **Pseudo-localisation.** An expanded test build is EVIDENCE for a code, never a code of its own and
  never a class.

## Output

```text
run: <catalogue string | machine value | invariant token>
box: <element owning the extent>
band: <source length -> reserved growth>
situation: <EXPANSION-0 | EXPANSION-1 | EXPANSION-2 | EXPANSION-3 | EXPANSION-4 | EXPANSION-5 | EXPANSION-6>
className: <no class | w-auto whitespace-normal | min-w-fit | ps-*/pe-* | dir="ltr" | tabular-nums>
reason: <locale fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

What gives way when content overruns its box, and who owns an extent on an axis, are decided by the
neighbouring modules. This module decides only the locale fact those decisions consume: how much
longer the run gets, and which way it runs.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
