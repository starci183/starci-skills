---
id: fe-patterns-the-split-index
title: INDEX.md
slug: /gates/patterns/the-split
sidebar_label: the-split
sidebar_position: 0
description: Binding rules for splitting a surface that owns a request into a connected half and a drawing half.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `the-split`

## Law

A surface that owns a request is two files. `index.tsx` fetches, settles which situation the reader
is in, and resolves the words. `component.tsx` takes an already-settled situation and draws it.

The split is not organisational tidiness. It is a line drawn so that **everything that can be wrong
about DATA lives in one file and everything that can be wrong about DRAWING lives in the other** —
and neither review has to read the other file.

One question settles which half a line belongs to: **could this be wrong while the network is
fine?** A wrong tree, a wrong seam, a missing state: drawing. A wrong request, a wrong situation,
the wrong word chosen: data.

**This is binding, not advisory.** Every surface that reads the world resolves to the six codes
below, and each code is either held or broken — there is no size at which a surface is too thin to
carry them. "It is one leaf" and "it has no state yet" are not exemptions; they are the two places
the line is most often crossed, because they are the two places where crossing it costs nothing
today.

## Situation Codes

Every situation this module governs carries a code, `SPLIT-<n>`. The code names the SITUATION; the
requirement column names what that situation obliges.

| Code | Requires | Forbids |
|---|---|---|
| `SPLIT-1` | The drawing half receives every value already decided, so it renders from a fixture | Any request, store read, locale read or translation call inside `component.tsx` |
| `SPLIT-2` | The connected half decides WHICH named situation this is, and hands it down | The connected half deciding how a situation looks, how far apart things sit, or which element draws what |
| `SPLIT-3` | The situation crosses as one value from a closed set | A bag of booleans crossing the line — `isLoading`, `hasError`, `isEmpty` as incoming props |
| `SPLIT-4` | Copy crosses resolved: the drawing half receives words | A translation key, a message id or a locale crossing the line |
| `SPLIT-5` | The connected half imports exact `_${FolderName}` from `./component` and renders that one component on every JSX path | A connected file rendering a leaf, a branch or an alternate tree of its own |
| `SPLIT-6` | A surface with no request stays one file | A second file created for a component that fetches nothing |

`SPLIT-6` IS A LIMIT, NOT AN OPT-OUT. It states where the law stops applying, which is what keeps
the other five from becoming ceremony. The split exists because a request exists; where there is no
request there is no data half, so the second file would hold nothing the first could get wrong.

`SPLIT-5` HAS NO THIN-BLOCK EXCEPTION. One leaf, one tree in every state, no local domain state, or
a presentational twin that only forwards props are the cases most likely to grow a second situation
later. They cross the same exact twin.

## Tầng giữ

Which tier actually holds each code. `enforced` names the rule from
[`sources/fe/the-split.mjs`](../../../../sources/fe/the-split.mjs) that catches it; `documented` means
nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `SPLIT-1` | `enforced` | `presentational-purity` — reports any call whose callee matches the request, store, locale and formatter families, in any file named `component.tsx` |
| `SPLIT-2` | `documented` | Nothing. A file that settles the wrong situation and a file that settles the right one have the same syntax tree |
| `SPLIT-3` | `documented` | Nothing at the point of authorship. Once a discriminated union IS written, the type makes the sixteen-combination props object unwritable at every call site — but no rule requires the union to be written |
| `SPLIT-4` | `documented` | Nothing for the half that matters. `presentational-purity` catches the translation CALL in the drawing half, which is already `SPLIT-1`; a key crossing as a `string` prop is invisible to a syntax tree |
| `SPLIT-5` | `enforced` | `connected-block-has-presentational-twin` — three messages for the three failures: `missing` (no twin imported), `bypass` (something else rendered), `unused` (twin imported, never rendered) |
| `SPLIT-6` | `documented` | Nothing. A folder with two files where one would do is a correct program; only a reader can see the second file holds nothing |

Two of six are enforced. That gap is the honest state of this law, and it is why `audit.md` states,
for each `documented` code, what a rule would have to see in order to hold it.

## Anchor

Real code each code can be checked against. Paths are repository-relative; the shape, not any one
product's folder, is what is being pointed at.

| Code | Path | What to look for |
|---|---|---|
| `SPLIT-1` | `src/components/**/component.tsx` | Imports are components, types and pure helpers only. A tree-wide grep for the request, store, locale and formatter hook families across every `component.tsx` returns nothing — that empty result is the anchor, and any hit is a violation the rule will already have reported |
| `SPLIT-2` | `src/components/**/index.tsx` that import `./component` | No `className`, no spacing value, no element choice anywhere in the connected file. Grepping `className` across every connected index and getting zero hits is the check; a `variant`-shaped prop naming an appearance is the part this anchor cannot see |
| `SPLIT-3` | `src/components/**/component.tsx` | The exported props type is a union of members discriminated by a literal `state`. Counter-check the same files for `readonly isLoading?: boolean` and similar incoming flags — every hit is a line that crossed as a flag |
| `SPLIT-4` | The boundary props declared in `component.tsx`, and the JSX that fills them in `index.tsx` | Copy-carrying props are typed `string` and hold sentences. No prop named `*Key`, no dotted namespace literal passed down. A `selectedKey`-shaped identity prop is not copy and is not a hit |
| `SPLIT-5` | `src/components/**/index.tsx` and [`sources/fe/the-split.mjs`](../../../../sources/fe/the-split.mjs) | `import { _X } from "./component"` where `X` is the folder name, and `_X` is the only JSX identifier the file renders. The rule's `connectedBlock` matcher fixes `X` from the folder, so the twin name is not a convention a file can restate differently |
| `SPLIT-6` | Folders holding `index.tsx` and no `component.tsx` | The index makes no world call: it composes other connected surfaces, or holds only local UI state such as which overlay is open. The absence of `component.tsx` is correct only while the absence of a request is |

A code with no anchor is a proposal, not a law. All six are anchored; none reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| surface | The folder that owns the request |
| request | Whether this surface reads the world at all, or receives everything from a caller |
| situations | The closed set of named states that request can produce |
| copy | Where each visible string is resolved |
| twin | The `_${FolderName}` the folder fixes |

## Invariants

- Everything that can be wrong about data lives in `index.tsx`; everything that can be wrong about
  drawing lives in `component.tsx`.
- The discriminator is one question: could this be wrong while the network is fine?
- The drawing half renders from a fixture, with no world stood up first.
- A situation crosses the line as one value from a closed set, never as several independent booleans.
- Copy crosses the line resolved.
- A connected file renders exactly one JSX identifier of its own: its `_X` twin.
- A surface with no request is one file.
- Neither review has to read the other file.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Flags below the line.** `SPLIT-3` bans flags CROSSING. Deriving `isLoading` from `state` inside
  the drawing half, and passing that boolean further down to something presentational, is the
  drawing half doing its own job.
- **Local UI state is not a request.** `SPLIT-6` turns on a request. Holding which overlay is open,
  or which tab is selected, reads nothing and settles nothing, so it does not create a data half.
- **A surface composed of connected surfaces.** Under `SPLIT-6`, a file whose children each own
  their own request owns none itself: it has no twin, because it has nothing to resolve.
- **A twin that only forwards.** Not an exception to `SPLIT-5`. A twin whose whole body forwards its
  props is still the crossing point, and it is the file the first added state will land in.
- **Identity strings are not copy.** Under `SPLIT-4`, an id, a slug or a selection key crossing the
  line is a value like any other. What is banned is a string the drawing half would have to look up.

## Output

```text
surface: <folder>
request: <yes | no>
files: <index.tsx + component.tsx | index.tsx only>
twin: <_X | none>
situations: <closed set of state names | none>
codes: <SPLIT-1..SPLIT-6, each holds | breaks>
reason: <which half could be wrong while the network is fine>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that fetches. It names no product, no component
library, no registry key and no repository. Every example is ordinary TSX with ordinary props.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
