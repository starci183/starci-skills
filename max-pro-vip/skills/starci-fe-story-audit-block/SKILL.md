---
name: starci-fe-story-audit-block
description: Use this skill whenever a single block is on the table. Triggers when the teacher names one, pastes a cropped screenshot of one, gives a Storybook story id, describes a feature that needs one, or points at one already built and says it is off. Fires on "audit this card", "what component for this", "this block looks wrong", "sai rules", "build the X block", or a feature sentence like "this is the table-booking part". It decides which library entry the data shape demands, and renders the candidates as widgets instead of asking in prose. Not for arranging several blocks on a page — that is starci-fe-story-audit-composition.
---

# Auditing a block

One question: **which library entry does this data shape demand, and does what exists match it.**

> Read first: [`house-rules.md`](../../references/house-rules.md)

## The one rule

**UI is a function of data, not of taste.** A list of outcomes is a surface card because a result is
read once and has nothing to open. A list whose items each carry a long body may be an accordion —
but only after one more question, and that question is the whole discipline:

> **Does the reader need every body at once, or one at a time?**

One at a time means the bodies compete for attention, so they hide and open on demand: accordion.
All at once means hiding them costs the reader N clicks to read what they came for: a flat list of
surfaces. **Length alone decides nothing.** A row of five long paragraphs that must be compared
side by side is not an accordion, however long each paragraph is.

*Anchored 2026-07-31, first eval run.* This rule previously read "a long description has to be
hidden" as if it followed from the length. It does not, and an agent following it reached the
opposite conclusion by noticing that nothing in the data said "hidden" — correctly. The rule was
asserting a reading behaviour the data never carried.

Ask the matrix by **what you are holding**:

```bash
node scripts/matrix.mjs "an array of expandable rows"
```

Never enter by a component name you already have in mind, and never open
[`matrix.md`](../../library/matrix.md) whole — it is 73 KB. Reading the matrix backwards is how the
wrong shell gets picked, and a wrong shell makes all 15 axes being right worthless.

## Three inputs, none optional

| Input | Answers | Blocks which failure |
|---|---|---|
| `text` — the feature in words | what the user wants | building the right thing nobody needs |
| `fe code` | what shape already exists | re-inventing something already built |
| `be code` | what the data really is — entity, fields, cardinality, states | inventing fields, inventing states |

Missing one? **Go get it.** A guess here poisons every step after it. If `be code` is unreachable,
say so and stop — do not substitute an assumption about the data.

## Steps

1. **Collect the three inputs.** Name what you could not get.

2. **Read the shape out of `be code`**, not out of the mockup: how many records, which fields are
   long text, which are enums, which can be empty, which arrive late.

3. **Look up the matrix** by that shape. Write down every candidate it yields, not just the first.

4. **Render the candidates as widgets.** Never ask in prose which one to use — draw them.

   | Candidates | Draw |
   |---|---|
   | two or more valid | all of them, side by side, teacher picks |
   | exactly one | that one, plus the sentence *"the data forces this, there is no option two"* |
   | none | a **library gap** — see below |

   Each widget shows the block with the real field names from `be code`, not lorem text. A widget
   with fake content proves nothing about whether the shape fits.

5. **Verdict**, then fix what the verdict says.

6. **Reflect.** Mandatory, see the last section.

## One round, worked through

A real case from this system, to show what each step actually produces.

**Input.** Teacher says *"the findings list looks off"* and sends a cropped screenshot. `fe code`
is `SubmissionFindingsList.tsx`. `be code` says each finding has `message` — free text, author
written, can run several paragraphs — plus a `verdict` enum and an `icon`.

**Shape.** An array. Each item has a short identifier and a long body that does not need to be read
until asked for. Not a flat list, not a set of outcomes read once.

**Matrix.** `node scripts/matrix.mjs "expandable rows"` returns one row: an array of expandable
rows, trigger plus hidden body, takes `SurfaceCardAccordion`, whose `title` is a **plain string**.
One candidate, so one widget, with the sentence that there is no option two.

**Verdict — `grit`.** The `message` field was rendered through `MarkdownContent`, which emits
block-level markup, and it sat **inside the accordion trigger**, which is a `<button>`. Block markup
inside a button is invalid HTML. It compiled, rendered, and looked fine.

**Fix.** The icon moved to `titleStart`; `message` became a `string` through `parseInlineCode`.

**Reflect.** Could canon have answered this? Only partly — the `markdown` axis had the tier rule,
but nothing stopped a `ReactNode` from being passed in the first place. So the fix went two places:
the code, and `docs/API-BACKLOG.md` as *tighten `title` to `string`*. That entry deletes the rule
rather than restating it.

The whole round touched one matrix query, one axis, and one widget. It did not open a single
`rationale.md`.

## Verdicts

| Verdict | Means | Next |
|---|---|---|
| `pass` | comes from the library, values on scale | done |
| `grit` | a raw value, a hand-rolled layout, or a wrong step of the right scale | fix here, at the block |
| `library gap` | no entry answers this data shape | propose a new entry — **as a widget** |
| `NOT COVERED` | an axis tree accepts nothing | [`research-when-silent.md`](../../references/research-when-silent.md) |

**A library gap is proposed, never enacted.** Draw the proposed entry as a widget: its role, its
API, its full state set, its skeleton. The teacher decides whether it enters the library. Filling
in [`assets/library-entry.md`](../../assets/library-entry.md) happens only after that yes.

Two entries already doing one job is also a gap — propose the merge as a widget, do not merge on
your own.

## When to open `principles/`

Only on `grit` you cannot classify, or on a proposed new entry. A proposed entry gets the **full
15-axis sweep** before it is drawn — that sweep is the expensive part and it is deliberate, because
a wrong library entry is wrong on every screen that ever uses it.

A block assembled correctly from the library means you open no axis file at all.

## Measure, don't look

Every verdict cites a number or a source line — `getComputedStyle`, a real prop, a real field. A
screenshot proves how it looks, never which value produced it. Check the viewport before trusting
any measurement: a hidden document returns zeroes and healthy code looks broken.

## Reflect — the last step, not optional

Before closing, ask: **did the teacher have to say something canon should already have answered?**

| Answer | Do |
|---|---|
| no, canon was right and unread | fix the block only |
| canon was silent on this case | write the rule now, in this same turn |
| canon taught the opposite of what was measured | fix canon, with a dated anchor and before/after |

A rule no machine catches goes to `principles/judgement.md`; a scale or tree branch goes to
`principles/decisions/<axis>.md`; a rule an API could delete goes to `docs/API-BACKLOG.md`;
reasoning goes to `references/axis-notes/<axis>/rationale.md`. One example is not a
rule — a general rule needs two independent sources, otherwise anchor it to this exact case and say
so. See [`writing-canon.md`](../../references/writing-canon.md).

## Red flags

- "This looks like a card, use a card" → you entered the matrix backwards. Start from the data.
- "Let me draw four options" when the shape forces one → that is a fake choice, and it invites a
  wrong pick. Draw one and say why there is no second.
- "I'll sketch it with placeholder text" → a widget with lorem proves nothing. Use the real fields.
- "The teacher said it looks cheap, so I'll restyle it" → vague feedback means no fixed picture yet.
  Draw options, do not guess. See [`visualize.md`](../../references/visualize.md).
- "The library is close enough, I'll nudge it here" → that is grit. Change it in the library or not
  at all.
- "Library gap, I'll add the entry" → propose it. The library is law; you do not enact law.
- "Fixed the code, canon later" → if canon should have answered it, the next round repeats it.
