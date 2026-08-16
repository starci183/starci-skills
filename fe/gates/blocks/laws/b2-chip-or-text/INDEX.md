---
id: fe-blocks-laws-b2-chip-or-text-index
title: INDEX.md
slug: /gates/blocks/laws/b2-chip-or-text
sidebar_label: b2-chip-or-text
sidebar_position: 0
description: A lookup table that decides, per field, whether it renders as plain text, as a chip, as a status dot, or as nothing at all.
---

# INDEX.md

Version: `2.00` · Module: `b2-chip-or-text` · Law: `B2` · Refusals: **6 across 3 records**

## Law

A secondary field in a row is **text**. A chip is reserved for a **real state** of the object: a
fact that changes on its own, carries a consequence, and whose tone means something.

Chrome is not emphasis. A pill around a number does not make the number more important; it makes the
row noisier and teaches the reader that pills mean nothing.

> không cần bọc hình tròn số 0 làm gì, đấy là rules của row rồi

**This module is a lookup, not a discussion.** Bring one field, read one row, get one renderer. If
the field does not appear in the table, it is `B2-2` — text — until a refusal or a shipped state
moves it.

## Situation Codes

| Code | Field kind | Renders as | Live example |
|---|---|---|---|
| `B2-1` | A count or quantity | **text** (`endText` of the row) | scope count, result count |
| `B2-2` | A classification, taxonomy or naming label | **text** | `kind`, problem tag, price-phase name, work mode, location, role |
| `B2-3` | A real lifecycle state the server changes, with a consequence | **chip** (`Badge`, tone = meaning) | claimed, discount active, scarcity, trial, testcase passed/failed |
| `B2-4` | Which item is currently chosen | **neither chip nor tick** — the row's own selected paint | active search scope |
| `B2-5` | A state with many outcomes that the reader is actively waiting on | **`StatusDot` + `Text`** | judge verdict (eleven situations) |
| `B2-6` | A glyph that repeats what the text already says | **nothing** | the purple `review` icon after each lesson |
| `B2-7` | A figure the backend does not serve | **nothing** — not a placeholder, not `1` | unread count |
| `B2-8` | A figure that is **also a verdict** — a number whose existence is itself good or bad news | **chip**, tone carrying the verdict | discount percentage, seats remaining |

The codes are ordered from the most frequent mistake to the rarest. `B2-1` and `B2-2` together cover
the great majority of fields, and both of them emit plain text.

`B2-8` IS THE ONE EXCEPTION TO `B2-1`, AND IT IS NARROW. "Twelve" is a count and is text. "−30%" is a
count **and** a verdict: the number's presence is the news, and `success` versus `warning` is not
interchangeable. Every other money figure on the same card — list price, payable price, instalment —
is text, so a card can legitimately show one chip beside four numbers. If the tone could be swapped
without lying, this is `B2-1`.

`B2-6` AND `B2-7` EMIT NOTHING, AND THAT IS A DECISION. A field classified `B2-7` was measured
against the backend and found to have no producer; writing a constant in its place is
[`b5`](../b5-no-invented-field/INDEX.md) with extra chrome.

## The three questions

A field earns `B2-3` only when all three answers are yes. Any single no sends it to `B2-2`.

| # | Question | No means |
|---|---|---|
| 1 | Does it change **without the reader touching this row**? | It is a naming label → `B2-2` |
| 2 | Does the change carry a **consequence** the reader must act on or understand? | It is decoration → `B2-2` |
| 3 | Does the **tone** carry meaning — would `success` versus `danger` be wrong to swap? | Tone is a colour, not a meaning → `B2-2` |

Question 3 is the one that catches the most look-alikes. A tag chip in `neutral` fails it: there is
no tone that would be wrong, because there is no meaning for a tone to carry.

## Inputs

| Input | Evidence required |
|---|---|
| `field` | The backend field name, not the display label |
| `producer` | The query or projection that serves it, `file:line` |
| `changesWithoutReader` | `yes` · `no` — question 1 |
| `consequence` | The thing the reader does or understands differently, in words |
| `toneMeaning` | The meaning each tone would carry, or `none` |
| `outcomeCount` | How many distinct outcomes the field can take |

`outcomeCount` separates `B2-3` from `B2-5`. Past roughly four outcomes, a set of chips stops being
readable as a state and becomes a legend; the judge strip carries eleven and uses a dot plus a word.

## Invariants

- There is exactly **one door to a chip** in the whole repository: the `Badge` leaf, which wraps the
  vendor `Chip`. A block never reaches the vendor directly.
- Tone is a meaning, not a colour. `success` survives a palette rewrite; `green` does not.
- A count is text. Always. Under every layout.
- A selected row is painted as a selected row; it does not grow a tick and it does not grow a chip.
- A field with no producer renders nothing — never a constant, never a zero, never a `1`.
- A chip's content is a resolved translated string, never a raw enum value.
- The same fact keeps the same renderer across every surface that shows it. One price shown as a
  chip in one block and as text in another is a defect in whichever block is newer.

## Exceptions

- **Difficulty tier.** A course level keeps its chip. It was reviewed and the correction was to give
  the three tiers three tones, not to remove the chip — an ordered scale whose tone carries the
  order passes question 3.
- **Discount and scarcity on the pricing rail.** `B2-3`. A discount is a promotion the server turns
  on and off, and scarcity changes the reader's decision. Both carry real tones.
- **The result-row indicator in Global Search.** A tick on a **result** row is legal and was
  explicitly preserved; the same tick on a **scope** row was refused. Two branches, two anatomies —
  see [`b6`](../b6-one-owner-two-hosts/INDEX.md).
- **A testcase selector.** Not an exception: the passed/failed tone is `B2-3`, but the neutral chip
  used while `passed === undefined` is a tab wearing chip chrome and is `B2-4`.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A count is a rule of the row, not a chip | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:625` | "User: \"không cần bọc hình tròn số 0 làm gì, đấy là rules của row rồi\"." |
| A count badge circle becomes a text-only optional fact | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:725` | "User nói đây là rule của row, không cần chrome." |
| A selected scope has no tick | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:382` | "User: \"không có dấu tick\"." |
| A price-phase name is text, not chip chrome | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:430` | "Phase comparison cần typography đồng cấp, không cần chip chrome." |
| A glyph that repeats the text is removed | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-review-identity-cards.md:239` | "Thầy yêu cầu \"xóa cái logo màu tím kia đi\"." |
| No badge until the API serves a real count | neo TỪ CHỐI | `.workflows\designs\starci-academy\shell-account-language-menus.md:385` | "Current FE/backend evidence không có badge count." |
| A tier chip survives review; only its tones were corrected | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1773` | "User yêu cầu ba cấp độ phải khác màu." |
| One door to a chip: the `Badge` leaf over the vendor `Chip` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\Badge\index.tsx:1` | — |
| Tone is a meaning, not a colour | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\Badge\index.tsx:7-9` | — |
| A many-outcome state refuses the chip and uses a dot plus a word | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\coding\JudgeStatusStrip\component.tsx:21-24` | — |
| A price line is a fact row with `endText`, not a chip | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePriceDetail\component.tsx:91-97` | — |
| The result-row indicator is kept while the scope row has none | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\SelectionList\index.tsx:102` | — |
| A discount figure is a chip while every other money figure on the card is text | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CourseCatalogCard\component.tsx:132-136` | — |
| Seats remaining is a chip with a warning tone | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:189` | — |

## Scope

This module decides the renderer of one field. It does not decide the field's copy, its position in
the row, or its type size — copy is `copy.labelKey` in [`gate.schema.json`](../../gate.schema.json),
position is [`b7`](../b7-repeat-alignment/INDEX.md), and type is
[`gates/principles/typography`](../../../principles/typography/INDEX.md).

Its output is one `FieldRendering` entry per field: `render`, `isRealState` and the reason. The gate
refuses `render: "badge"` together with `isRealState: false`, so a `B2-2` field cannot reach a chip
by accident.

## Version Rule

Increment all five records by `0.01` for an accepted rule change. Adding a row to the lookup table is
a minor bump and must arrive with the anchor that justifies the row.
