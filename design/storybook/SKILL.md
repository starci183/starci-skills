---
name: storybook-architecture
description: Use this skill whenever a component has to be placed, moved, or judged against the Storybook tier system. Triggers on "which tier does this go in", "is this an atom or a composite", "can a frame import an atom", "where should this live", "this file is in the wrong folder", or any review of a new component's location. Also triggers when an import crosses tiers and you need to know whether that direction is legal. Not for choosing which component a data shape demands — that is a matrix question, not a tier question.
argument-hint: "[tier|component|import] [context]"
stack: HeroUI + Tailwind v4
---

# Storybook architecture

Eight tiers, one import direction, no exceptions measured across 265 files.

## Routing

| You are asking | Handler | Resource |
|---|---|---|
| which tier does this belong to | `tiers.csv` | `node scripts/search.mjs tier <name>` |
| what lives in a tier already | `groups.csv` | `node scripts/search.mjs group <tier>` |
| can X import Y | `import-rules.csv` | `node scripts/search.mjs import <from> <to>` |
| why a boundary is drawn where it is | reference | `references/tier-boundaries.md` |
| which component a data shape demands | **not this skill** | the component matrix |

Never open a CSV whole. Ask it.

## The direction

```
atom  <-  frame  <-  composite  <-  block  <-  page
```

Measured on the real tree: **0 imports against this direction**, across 265 files.

| Tier | Files | Imports upward |
|---|---:|---:|
| atom | 47 | 0 |
| behavior | 2 | 0 |
| frame | 9 | 0 |
| composite | 48 | 0 |
| block · layout · overlay · page | 159 | 0 |

## The one legal exception, and its test

`frames/Stack/Stack.tsx` imports one atom: `Divider`, to place a rule **between** children.

That is legal because the divider is **the frame's own chrome** — the caller does not pass it in,
`Stack` decides it with a boolean prop. It is not the caller's content.

> **Test:** is the imported thing something the caller handed in? If yes, the frame is doing a
> composite's job.

A frame reacting to what its children are is the failure this boundary exists to stop. A real
example that was deleted: a prop asking the caller to declare *"my body opens with tabs"* so the
frame could subtract 4px. That 4px belongs to `Tabs`, and `Tabs` must own it.

## Why an atom imports nothing

An atom is the smallest unit — it arranges nothing. An atom importing a frame is arranging its own
children, and at that moment it is a composite with the wrong name. Measured: **0 of 47**.

## HeroUI sits at the bottom

| Tier | Files touching `@heroui/react` |
|---|---|
| atom | 42 of 47 |
| frame | 9 of 9 |
| composite | 41 of 48 |
| block and above | 36 of 159 |

Atoms wrap HeroUI so the rest of the system never sees it directly. Where a `<XBase>` file exists
next to `<X>`, the `Base` file is the one holding the vendor import — the plain name is the
constrained house version.

**A block reaching for `@heroui/react` is a missing atom**, not a shortcut. 36 of 159 do it today;
each is a candidate entry, not a precedent.

## Where a new component goes

Ask in this order, stop at the first yes:

| # | Ask | Then |
|---|---|---|
| 1 | Does it render a value and nothing else? | `atom` |
| 2 | Is it a capability with no shape at all? | `behavior` |
| 3 | Does it only decide direction, seam, alignment? | `frame` |
| 4 | Does it assemble atoms without knowing any domain? | `composite` |
| 5 | Does it own domain data and its async decisions? | `block` |
| 6 | Is it the shell a whole route sits in? | `layout` |
| 7 | Does it cover the page? | `overlay` |
| 8 | Is it a list of blocks fed typed data? | `page` |

Unsure between atom and composite: **pick atom**. Promoting is cheap, demoting is expensive.

## Forbidden

| Forbidden | Caught by |
|---|---|
| an import against the direction | nothing yet — a gate can be written, and should be |
| a block importing `@heroui/react` for a shape an atom could own | nothing yet |
| a frame prop that asks what the children are | discipline; the deleted `bodyStartsWithTabs` is the anchor |
| a page importing an atom directly | discipline — it usually means a block is missing |

When a script fails, fix it rather than working around it.

## Red flags

- "It's basically an atom, just with a bit of layout" → layout means frame or composite. Atoms
  arrange nothing.
- "The frame needs to know if the first child is a heading" → that is the caller's content. The
  child owns its own geometry.
- "I'll import HeroUI here, it's just one button" → then the atom is missing. Write it once.
- "It's in `blocks/` but takes no data" → it is a composite in the wrong folder.
- "Both tiers would work" → pick the lower one.
