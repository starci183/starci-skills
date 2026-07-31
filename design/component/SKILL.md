---
name: component-matrix
description: Use this skill before writing the first line of JSX for any content cluster, to decide which component a shape of data demands. Triggers on "which component for this", "should this be a card or a list", "is this an accordion or a disclosure", "what do I wrap this paragraph in", "this renders fine but feels wrong", and on any review asking whether the right shell was chosen. Also triggers when a shape has no obvious component and someone is about to invent one. Not for deciding which tier a component lives in — that is a tier question, not a matrix question.
argument-hint: "[shape|section|row|traps|used-by] [context]"
---

# Component matrix

**Enter from the shape of data in your hand.** Read rightward to exactly one component. Never read
backward from a component name you already have in mind — that is how the wrong shell survives a
review.

The whole failure this skill exists to block is type-valid and renders fine: the right field, the
right business logic, clean `tsc`, every gate green — and the wrong shell. A paragraph pushed into
a list whose `items` length is always 1. An accordion nested inside itself to get one trigger. No
machine catches either. Only the table does.

## Step 0, before anything else

```bash
node scripts/search.mjs shape "<the shape you are holding, in your own words>"
```

Describe the **data**, not the look. "an array of rows where each row hides a body" finds the row.
"a nice collapsible card" finds nothing, because it describes a picture.

| What comes back | What to do |
|---|---|
| one row | that is the component; open its entry point and build |
| several rows | re-read the deciding test of the section and pick — they differ on one axis, named |
| nothing | **stop.** A shape with no row is not permission to invent |

Never open `data/matrix.csv` whole. One question touches one row — 356 bytes, against 75 KB for the
markdown table this replaced.

## Routing

| You are asking | Command |
|---|---|
| which component does this shape demand | `search.mjs shape "<words>"` |
| what are the 15 doors and their deciding tests | `search.mjs` |
| every case in one section | `search.mjs section <slug>` |
| one row, in full | `search.mjs row <id>` |
| what bites in this section | `search.mjs traps <slug>` |
| is this component the right one — **audit only** | `search.mjs used-by <Name>` |
| did the data itself break | `node scripts/validate_data.mjs` |
| why the table is shaped this way | `references/general-rules.md` |

Sections: `surface-card` · `list` · `disclosure` · `text` · `viewer` · `label` · `measure` ·
`pair` · `frame` · `page` · `async` · `form` · `button` · `nav` · `identity`.

## The two questions that decide most rows

**One block, or an array of uniform rows?** A paragraph is not a one-element list. An `items` whose
length is always 1 is the wrong family, chosen at the data-shape level — and it drags in a divider
between rows that will never exist and a `key` that means nothing.

**If an array — does each row hide a part, and is the row pressable?** A hidden body means an
accordion. One collapsible region means a disclosure, not an accordion with a single item. A
pressable row with the panel opening *elsewhere* is a row plus a drawer, not a disclosure at all.

`SurfaceCardList` and `SurfaceCardAccordion` wear the same skin. A screenshot cannot separate them.
Only the data can.

## Where the surface comes from

A card **inside** another surface does not change component — turn on `variant="nested"`, where a
border stands in for a shadow that is invisible against the parent. Highlighting does not add a
wrapper either; it is a prop on the card itself.

The rule underneath both: **a surface is a property of the component you already picked, not a
reason to pick a different one.**

## Frame API, by what the frame does

| The frame | Takes | Never |
|---|---|---|
| wraps free-form content | `children` | — |
| repeats a list | `items` data | `children` |
| holds multiple roles | named slots | `children` |

A repeating frame that accepts `children` has handed the caller control of the row, and every call
site then draws the row slightly differently.

## No row matches

That is a real outcome, not a failure of searching. It means one of three things, in this order:

1. The shape was described as a picture. Describe the data and search again.
2. The shape belongs to a section you did not think to look in. `search.mjs` lists all 15.
3. The set genuinely has no door for it.

Only in the third case is there a proposal to make, and it is **drawn as a widget for the teacher
to rule on** — never added on your own authority. A row added without an anchor is a claim wearing
the clothes of a rule.

## Forbidden

| Forbidden | Caught by |
|---|---|
| entering from a component name while building | discipline — `used-by` prints the warning itself |
| `items` whose length is always 1 | discipline; the trap block of `surface-card` |
| a second label inside a frame that already draws one | discipline |
| markdown inside a cell the script reads | `validate_data.mjs` |
| a row whose id drifted from its section | `validate_data.mjs` |
| adding a component to the set without the teacher | `boundary` rule, not a script |

When a script fails, fix the data rather than working around the script.

## Red flags

- "It's basically a list, there's just one of them" → then it is not a list. Length-1 is the
  anchor case this whole table was written after.
- "I'll use the accordion and add a label" → the label now renders twice, because an accordion
  item is required to carry its own title.
- "It looks right in the screenshot" → two components in this set share one skin on purpose. A
  screenshot is not evidence of the shape.
- "The component is unused, so it's probably wrong" → five entries have zero call sites for stated
  reasons. See `references/general-rules.md`.
- "There's no row so I'll compose it myself" → composing around a missing row is how a sixth
  almost-identical card gets born.
- "I'll put the markdown in `title`" → `title` is a plain string. An icon there is forced to
  `currentColor` and drags the whole line's color with it.
