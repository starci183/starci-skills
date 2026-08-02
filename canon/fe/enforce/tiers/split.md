# The presentational / connected split

How a data-owning tier is written as two files, so the same component can be rendered from live data in
the app AND from plain props in a story — and so the story tree and the app tree converge into one.

Read [`concept.md`](concept.md) first. This refines what [`elements/block.md`](elements/block.md) and
[`elements/page.md`](elements/page.md) already say about who owns data and the async switch.

## The problem it solves

A block owns domain data and its async decisions (`block.md` BLOCK-1, BLOCK-8). Written as one file, that
block both **fetches** and **renders**. A fetching component cannot be rendered in a story: there is no
server, no store, no session — so the states that matter (loading, empty, error, the full-data case) can
never be put side by side. The usual workaround is a second, hand-kept **blueprint** copy of the component
that takes props instead of fetching. Two files for one component, kept in sync by hand, drifting the day
someone edits one and not the other.

The split removes the second copy by making the divide a property of the component itself.

## The two files

A data-owning tier (`block` · `layout` · `page`) is one folder with two files:

| File | Export | Is | Takes | Never |
|---|---|---|---|---|
| `component.tsx` | `_Name` | **presentational** | typed props, already resolved | fetches, reads a store, resolves i18n |
| `index.tsx` | `Name` | **connected** | nothing from its parent | draws a shape of its own |

`index.tsx` wires the data — from wherever the app keeps it — and renders `<_Name {...resolved} />`. The
app imports `Name`. A story imports `_Name`. **`_Name` is the single source of truth for the shape**; there
is no separate blueprint to keep in sync, because the story renders the real presentational file.

`_Name` renders whatever it is handed. That is the whole discipline: the same function, fed live data in
the app and fixture data in a story, cannot render two different shapes.

## The async switch spans the two files

`block.md` BLOCK-8 puts the switch — error, then loading, then empty, then content — in the block. The split
does not move it out of the block; it divides the block:

- The connected `index.tsx` owns the **decision**: it holds the request and derives the status.
- The presentational `_Name` owns the **switch**: it takes `isLoading` / `error` / the data as props and
  renders the four branches in the fixed order.

BLOCK-10 still holds — nothing below the block knows a request exists — because `_Name` is handed a status,
not a request.

## i18n is data, so it lives in the connected file

Translated text is resolved from a catalog and interpolated with values — counts, names — that only the
connected layer holds. So **`t()` lives in `index.tsx`, next to the fetch.** `_Name` and every tier below it
take already-resolved strings.

This is the same rule as `className` stopping at the vocabulary (`concept.md`): a presentational component
takes what it renders, it does not go and get it. A component that resolves its own text has reached past
its props for a source of truth, the identical failure as one that reads a store.

**A story passes the translation key as the text prop's value.** `_Name` renders the string it is given, so
the app passes `t(key)` and the story passes the bare `key`. The key names the slot without inventing
fixture copy or baking a locale into the story. A locale-neutral story surface (one where `t()` returns its
key) shows the same thing for any component not yet migrated.

## Imports across the split

| From | Imports | Not |
|---|---|---|
| a folder's `index.tsx` | its own `component.tsx` | — |
| a parent's `component.tsx` (`_Screen`) | the child's **connected** `Name` | the child's `_Name` |

A screen is arrangement, and each block it places fetches its own data (`page.md`), so a presentational
screen renders **connected** children. It never threads a child's data through itself — that would be the
prop-drilling the tiers exist to prevent. `_Screen` importing `_Block` would be a screen taking on a block's
fetch; it is always the connected `Block` that a screen composes.

## Scope

The split applies only where data enters — `block`, `layout`, `page`. An `atom` or `composite` never
fetches and never resolves i18n (`concept.md`: they are vocabulary), so they are one file, already
presentational. Giving them a connected half would be an empty file.

## Identity is `data-tier` + `data-component`; the anatomy overlay is retired

Every component emits its own identity — unconditionally, from the component itself, with nothing drilled
in from a parent: a **`data-tier`** naming its layer (`atom` · `composite` · `block` · …) and a
**`data-component`** naming the component. The BlockAnatomy inspector builds its structure tree by walking
`data-component` ancestors in the DOM, so identity is always present and can never be hand-mistyped or
drift.

This replaced an earlier overlay — a `showAnatomy` switch drilled through every level, plus
`data-anat-part` badges each parent hand-set on its children. That scaffolding is **removed**: a
`component.tsx` carries no `showAnatomy` prop, no `anatPart` prop, no `data-anat-part` /
`data-anat-marker` attribute. The tree reads the always-on `data-component` instead.

Separately, the layout test-runner reads **`data-principles`** — a space-separated list of the layout
patterns an element embodies (`test-runner/patterns.mjs`), queryable like `class`. It names WHY a gap or
padding is what it is; it is not identity and has no bearing on how the component renders.

`check-presentational-purity.mjs` enforces the removal: a `component.tsx` that names `showAnatomy`,
`anatPart`, or `data-anat-part` fails, the same way one that fetches or resolves i18n does.

## Convergence

The end state is one tree. Each component's presentational file becomes the real code; any separate
blueprint copy is deleted; stories import `_Name` from the real file. The design system stops being a
parallel component tree kept in sync and becomes a story layer over the code that actually ships.

## The test

> Could this file be rendered in a story with no server, no store, no session, no locale — just props?
> For `component.tsx`, always. If not, a fetch or a `t()` has leaked down from the connected half.
