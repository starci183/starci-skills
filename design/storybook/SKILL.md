---
name: storybook-architecture
description: Use this skill whenever a component has to be placed, moved, or judged against a Storybook tier system. Triggers on "which tier does this go in", "is this an atom or a composite", "can a frame import an atom", "where should this live", "this file is in the wrong folder", or any review of a new component's location. Also triggers when an import crosses tiers and you need to know whether that direction is legal, and when a repo has no tier architecture yet and needs one. Not for choosing which component a data shape demands — that is a matrix question, not a tier question.
argument-hint: "[tier|component|import|scan] [context]"
---

# Storybook architecture

Seven tiers, one import direction. The rules here are universal; **the numbers are not** — read
them from the repo you are in.

## Step 0, before anything else

```bash
node .claude/scripts/scan-storybook-architecture.mjs <path-to-repo>
```

| What it says | What that means |
|---|---|
| a tier table with counts | this repo has an architecture — **it is the source of truth, not this file** |
| `No .storybook/components` | this repo has none yet — adopt the tiers below, and use the reference measurement as a shape to aim at |

Never assume a repo's tier names, counts, or folder layout. A repo that already has an architecture
outranks anything written here; the job then is to judge a component against **its** tiers.

## Routing

| You are asking | Handler |
|---|---|
| what does this repo actually look like | `node .claude/scripts/scan-storybook-architecture.mjs <repo>` |
| does anything break the direction | `node .claude/scripts/scan-storybook-architecture.mjs <repo> --violations` |
| which tier does this belong to | `node .claude/design/storybook/scripts/search-tier-rules.mjs tier <name>` |
| can X import Y | `node .claude/design/storybook/scripts/search-tier-rules.mjs import <from> <to>` |
| what the tiers are, and the className rule | `architecture/concept.md` |
| one tier in depth | `architecture/elements/<tier>.md` |
| that tier in a real system | `architecture/examples/<tier>.md` |
| why a boundary sits where it does | `references/tier-boundaries.md` |
| which tiers are shared and which are per app | `references/shared-layers.md` |
| how to read what the scan printed | `references/how-to-read-a-scan.md` |
| which component a data shape demands | **not this skill** |

Never open a CSV whole. Ask it.

## The direction

```
atom  <-  frame  <-  composite  <-  block  <-  page
```

A higher tier may import a lower one. Never the reverse. `scan.mjs --violations` names any file
that breaks it.

## The one legal exception, and its test

A frame may import an atom **only to place an element the frame itself owns** — a divider between
children, for example.

> **Test:** is the imported thing something the caller handed in? If yes, the frame is doing a
> composite's job.

A frame reacting to what its children are is the failure this boundary exists to stop. Real
example, since deleted from a live system: a prop asking the caller to declare *"my body opens with
tabs"* so the frame could subtract 4px. That 4px belonged to the tabs component, and it had to own
it.

## Why an atom imports nothing

An atom is the smallest unit — it arranges nothing. An atom importing a frame is arranging its own
children, and at that moment it is a composite with the wrong name.

## Vendor sits at the bottom

Wrap the vendor at atom and frame level so nothing above ever sees it directly. Where a `XBase`
file sits beside `X`, the `Base` holds the vendor import and the plain name is the constrained
house version — the rest of the system talks to the plain name, so the vendor can be swapped in one
file.

**A block importing a vendor component is a missing atom**, not a shortcut. `scan-storybook-architecture.mjs` counts them.

The failure this prevents is specific: some vendors bake styles unlayered, so a utility class
written at the call site **loses silently** — no error, no warning, the class simply does nothing.
An atom wrapping the vendor can encode that. A block importing it directly cannot.

## Where a new component goes

Ask in order, stop at the first yes:

| # | Ask | Then |
|---|---|---|
| 1 | Does it render a value and nothing else? | `atom` |
| 3 | Does it only decide direction, seam, alignment? | `frame` |
| 4 | Does it assemble atoms without knowing any domain? | `composite` |
| 5 | Does it own domain data and its async decisions? | `block` |
| 6 | Is it the shell a whole route sits in? | `layout` |
| 7 | Does it cover the page? | `overlay` |
| 8 | Is it a list of blocks fed typed data? | `page` |

Unsure between two tiers: **pick the lower one.** Promoting is a rename; demoting leaves every
caller with nowhere to go, and the behaviour ends up hand-rolled at each call site instead.

`search.mjs tier <name>` gives each tier's signal for *belongs here* and *is misplaced*.

## Forbidden

| Forbidden | Caught by |
|---|---|
| an import against the direction | `scan.mjs --violations` |
| a block importing a vendor for a shape an atom could own | `scan-storybook-architecture.mjs`, counted |
| a frame prop that asks what the children are | discipline |
| a page importing an atom directly | discipline — it usually means a block is missing |

When a script fails, fix it rather than working around it.

## Red flags

- "It's basically an atom, just with a bit of layout" → layout means frame or composite. Atoms
  arrange nothing.
- "The frame needs to know if the first child is a heading" → that is the caller's content. The
  child owns its own geometry.
- "I'll import the vendor here, it's just one button" → then the atom is missing. Write it once.
- "It's in `blocks/` but takes no data" → it is a composite in the wrong folder.
- "The reference says 47 atoms so we should have about that many" → the reference is one repo's
  measurement, not a target. Scan your own.
- "Both tiers would work" → pick the lower one.
