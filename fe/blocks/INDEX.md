---
id: fe-blocks-index
title: INDEX.md
slug: /fe/blocks
sidebar_label: blocks
sidebar_position: 0
description: The second gate — it takes one section of a settled layout and returns the anatomy of the block that renders it, down to the element each field is drawn with.
---

# INDEX.md

Version: `2.00` · Shelf: `blocks` · Gate: `2 of 5`

## What this shelf answers

**Given one section of a settled layout, which block renders it, what does that block contain, and
what element draws each field?**

Not which region the section sits in, which is [`layouts`](../layouts/gate.schema.json). Not which
gap sits between two children, which is [`principles`](../principles/gate.schema.json). This shelf stops at
the anatomy: the block's name, its surface, its state set, its copy, its fields and its owners.

```text
prompt/ảnh/feedback → layouts → [ blocks ] → principles → patterns → lints → code
```

| Side | Shape | Authority |
|---|---|---|
| IN | one `Section` of a `LayoutPlan` — `id`, `region`, `order`, `renderForm`, `repeats` | [`../layouts/gate.schema.json`](../layouts/gate.schema.json) `#/$defs/Section` |
| OUT | one `Block` per section, collected into a `BlockPlan` | [`gate.schema.json`](gate.schema.json) `#/$defs/BlockPlan` |

The output of gate 1 is the input of gate 2 **by machine**: `gate.schema.json` `$ref`s straight into
the layouts schema rather than restating it, so the two gates cannot drift into two vocabularies.
The same holds downstream — `BlockPlan` is exactly what `principles` receives.

## The law that generates every module here

**`BLOCK-0` · A block is the smallest thing that owns a business situation. It decides which tree
the reader sees, and it is the only tier allowed to decide that.**

Every module on this shelf is a consequence of that one sentence. A block owns the situation, so it
owns the state set (`b10`), the empty branch (`b4`), the failure branch (`b12`) and the pending flag
of each action (`b11`). It owns the situation and nothing above it, so it does not own its position
on the page (`b3`) and it does not own the paint (`b3` again). It owns the situation and nothing
below it, so it hands closed data down (`b13`) and never an arbitrary node.

> `state` is the business situation and it picks a tree; `props` is what that tree says. There is no
> `isLoading` here — a block writes the flag when it hands a tree down, and never receives one.

Anchor: `D:\Repositories\starci-academy-fe\src\components\contracts\props.ts:214-215` — neo CODE.

## Three tier laws that belong to no single module

These hold for **every** block regardless of archetype. They are stated here, not in a module,
because a module is entered by a question and nobody thinks to ask these. Each was proved missing by
a blind build in [`proofs/`](proofs/INDEX.md) rather than argued into existence.

**`BLOCK-1` · A block with data is a PAIR.** `component.tsx` is pure: it takes one settled union and
imports no request hook and no translation. `index.tsx` is connected: it owns the request, resolves
copy, formats, and chooses the state. **The connected half is mounted with no props** — the page puts
it in a named slot and says nothing else. A block with no data to resolve has no twin, and says so.
Anchor: `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\component.tsx:12-23`
beside `index.tsx:18-23` — neo CODE.

**`BLOCK-2` · A block owns its request when the NUMBER of requests varies with the data.** One card
per course, each pricing itself for this viewer, is a request whose count only the row knows — so
the row owns it. A figure the page already fetched once is handed down settled. This is the only
rule that adjudicates block-fetch versus page-fetch, and getting it wrong is the most expensive
single mistake on this shelf: it is the difference between one request and N.
Anchor: `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CourseCatalogCard\index.tsx:64-67`
— neo CODE.

**`BLOCK-3` · A viewer-scoped request keys on the viewer, and keys on `null` until the viewer
resolves.** Without the viewer in the key, one reader's answer is served to the next. Without the
`null`, the block fires an anonymous request and then paints somebody else's data.
Anchor: `D:\Repositories\starci-academy-fe\src\hooks\swr\useQueryMyDailyQuestSwr.ts:22-25` — neo CODE.

## Routing — by render form

A section arrives carrying `renderForm`. The value **is** the module name, so routing is a lookup
rather than a judgement.

| `renderForm` | Module | What it serves |
|---|---|---|
| `named-run` | [`archetypes/named-run`](archetypes/named-run/INDEX.md) | A set of comparable rows under one name |
| `standing-figure` | [`archetypes/standing-figure`](archetypes/standing-figure/INDEX.md) | One standing figure on a bare rail |
| `figure-and-offer` | [`archetypes/figure-and-offer`](archetypes/figure-and-offer/INDEX.md) | One figure, one story, one button that changes the outcome |
| `owned-item` | [`archetypes/owned-item`](archetypes/owned-item/INDEX.md) | An item whose data belongs to the list around it |
| `block-of-blocks` | [`archetypes/block-of-blocks`](archetypes/block-of-blocks/INDEX.md) | A region made of child blocks that each settle alone |
| `workbench` | [`archetypes/workbench`](archetypes/workbench/INDEX.md) | A place the reader works, not reads |
| `purchase-column` | [`archetypes/purchase-column`](archetypes/purchase-column/INDEX.md) | The purchase column and its mobile bar |
| `global-touchpoint` | [`archetypes/global-touchpoint`](archetypes/global-touchpoint/INDEX.md) | A touch point that is always present and belongs to no page |
| `evidence-tile` | [`archetypes/evidence-tile`](archetypes/evidence-tile/INDEX.md) | The public-profile evidence tiles — the branch that broke the mould |

Nine archetypes, and every one of them is a shape the app already runs. A tenth is admitted only
with an `Anchor` to a shipped block; a shape nobody has built is a proposal, and proposals do not
live in this tree.

## Routing — by question

| The question in front of you | Module |
|---|---|
| May this draw a card? May a card sit inside it? | [`laws/b1-one-surface-owner`](laws/b1-one-surface-owner/INDEX.md) |
| Is this field a chip or is it text? | [`laws/b2-chip-or-text`](laws/b2-chip-or-text/INDEX.md) |
| Who owns the padding, the scroll, the width, the position? | [`laws/b3-block-owns-its-frame`](laws/b3-block-owns-its-frame/INDEX.md) |
| There is nothing to show — what renders? | [`laws/b4-empty-is-a-state`](laws/b4-empty-is-a-state/INDEX.md) |
| The design shows a fact the backend does not serve | [`laws/b5-no-invented-field`](laws/b5-no-invented-field/INDEX.md) |
| Two places look the same — one component or two? | [`laws/b6-one-owner-two-hosts`](laws/b6-one-owner-two-hosts/INDEX.md) |
| The rows do not line up; the expanded panel is indented | [`laws/b7-repeat-alignment`](laws/b7-repeat-alignment/INDEX.md) |
| It feels cramped — should I change the gap? | [`laws/b8-group-before-gap`](laws/b8-group-before-gap/INDEX.md) |
| Where does the list's title come from? | [`laws/b9-list-label-owner`](laws/b9-list-label-owner/INDEX.md) |
| How many states does this have? | [`laws/b10-state-enumeration`](laws/b10-state-enumeration/INDEX.md) |
| Which spinner spins while this runs? | [`laws/b11-pending-owner`](laws/b11-pending-owner/INDEX.md) |
| The request failed — where does the reader see that? | [`laws/b12-error-owner`](laws/b12-error-owner/INDEX.md) |
| Can I pass a node in and let the caller decide? | [`laws/b13-closed-data`](laws/b13-closed-data/INDEX.md) |

## Refusal density decides module size

The thirteen laws are not equal, and the shelf does not pretend they are. Module size follows the
measured count of times the founder had to say the same thing again.

| Law | Refusals | Records | Module weight |
|---|---|---|---|
| `b1` | 9 | 5 | The largest module on the shelf |
| `b6` | 8 | 2 | Two halves, written as one law |
| `b3` | 7 | 4 | Full |
| `b2` | 6 | 3 | Full, and written as a lookup table |
| `b4` · `b5` · `b7` · `b8` | 5 each | 4 · 4 · 2 · 3 | Full |
| `b10` · `b13` | 3 each | — | Standard |
| `b9` | 2 | — | Standard |
| `b11` · `b12` | 1 each | — | Standard, and the two the live code still breaks most |

A law refused nine times across five separate tasks is not a preference that keeps resurfacing; it
is a rule the tree failed to state clearly enough to be followed. `b1` is written at the length that
failure earned.

## What a module here carries

| Section | Holds |
|---|---|
| `Law` | The one sentence the module exists to enforce |
| `Situation Codes` | Every situation the module governs, each with a code, including the ones that emit nothing |
| `Inputs` | What must be known before the code can be chosen, and what counts as evidence |
| `Invariants` | What must be true after the module is applied |
| `Exceptions` | Closed, named, anchored departures — never "use judgement" |
| `Anchor` | Every claim's `REJECTED` line or `file:line`, or the words `suy luận, không có neo` |
| `Scope` | What the module decides and what it hands on |
| `Version Rule` | How a change to the module is recorded |

Then four Vietnamese records: `vi.md` (the business situation behind each code), `example.md` (every
case, exception and look-alike), `audit.md` (the challenge, including where the live code still
disagrees) and `changelog.md`.

## Anchor discipline

Every rule sentence on this shelf carries exactly one of two anchors, never a blend:

- **neo TỪ CHỐI** — a real `REJECTED` row in
  `D:\Repositories\starci-academy-backend\.workflows\`, quoting its `Why` column verbatim.
- **neo CODE** — a real `file:line` in the live repository
  `D:\Repositories\starci-academy-fe` (branch `main`).

A sentence with neither says `suy luận, không có neo` in place of an anchor. The old repository
named `starci-academy` is never read and never cited; `gate.schema.json` blocks it at the anchor
pattern, so an attempt to cite it fails the gate rather than passing quietly.

## Proofs

[`proofs/`](proofs/INDEX.md) holds blind-build scorings: a business requirement is handed to a reader
who has only this shelf, their block is compared against the real one, and every miss becomes an
owed sentence. A proof is evidence about the gate, not about the block — a low score is a finding
against this shelf.

Three blocks have been scored so far, across three pages, at **53% hit rate on 83 scored items**.
That number is the honest state of this shelf: half of what a block needs is written down here, and
the other half currently comes from reading neighbouring source. The proofs' owed list is what
`BLOCK-1`, `BLOCK-2` and `BLOCK-3` above answer, and what the remaining owed items on
[`proofs/INDEX.md`](proofs/INDEX.md) still do not.

## Scope

This shelf decides block anatomy for StarCi. Unlike [`principles`](../principles/gate.schema.json), it is
not product-neutral and does not claim to be: its vocabulary is `SurfaceCard`, `SurfaceListCard`,
`EmptyNotice`, `Badge`, `IconLabelFactRow`, `CONTRACTS` and `restingCount`, and each of those names
is anchored to a file that exists. A module here that starts naming gap values or type sizes has
crossed into `fe/principles/` and belongs there.

The machine-checkable half of this shelf lives in [`gate.schema.json`](gate.schema.json). Where the
schema and a module disagree, that is a finding to resolve, not a choice to make.

## Version Rule

`2.00`. A new archetype or a new situation code is a minor bump on that module plus this file. A
change to `BLOCK-0` is a major bump on the whole shelf, because every module is derived from it.
