---
id: fe-patterns-contract-index
title: INDEX.md
slug: /fe/patterns/contract
sidebar_label: contract
sidebar_position: 0
description: Binding rules for describing one structural node once, as a key that owns its classes, its element and its reason.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `contract`

## Law

A contract is the description of ONE node. It is a key, and the key owns three things that are
worthless apart: the classes the node wears, the element it opens, and the reason what it holds sits
that way. An author who needs a shape types the key. That is the whole layout decision there is.

Everything above the leaves composes keys. A branch renders one, a composite arranges several, a
block asks for one, a page orders them — and not one of them writes a class string, because the
moment a caller can type `flex gap-3`, the tree is decided in as many places as there are call sites
and nothing above can be predicted from the key any more.

The question that settles it: **does this element hold other elements?** If it does, it is a node,
and a node comes from a key. A file that opens a `div` has answered a question the table was
supposed to answer.

**This is binding, not advisory.** Every structural element that ships resolves to exactly one code
below. There is no shape too small to have one: a two-child row is `CONTRACT-1` for the same reason
a page shell is. "It is only a wrapper" is not an exemption — it is the most common place the rule
gets skipped.

## Situation Codes

Every situation this module governs carries a code, `CONTRACT-<n>`. The code names the SITUATION;
what holds it is a separate question, answered in `Tầng giữ` below.

| Code | What it requires | What it forbids |
|---|---|---|
| `CONTRACT-1` | A structural node takes its classes from a key | A literal structural class at a call site, including one hoisted into a module constant |
| `CONTRACT-2` | A distinction between two shapes earns a key or a named prop | Any runtime class composition or interpolation |
| `CONTRACT-3` | The layout vocabulary is a closed union edited deliberately | A class value that is not a member of that union |
| `CONTRACT-4` | The entry names its own host, and the frame alone wears it | A `host`/`as` prop, or node props spread onto an element the caller chose |
| `CONTRACT-5` | A key's name says what goes inside it | `card`, `box`, `wrapper`, `row` and every other name that admits anything |
| `CONTRACT-6` | Every entry states what breaks when the node is removed | A reason built only from the words already in the key |
| `CONTRACT-7` | Exactly one file turns a key into an element | A neutral box written by hand, or a semantic element carrying a class |
| `CONTRACT-8` | The frame paints the node's markers from the entry | A hand-written contract marker attribute |
| `CONTRACT-9` | A new key is justified by a shape no existing key expresses | A second entry spelling a shape another entry already spells |
| `CONTRACT-10` | A named surface branch owns its fixed vendor wrapper as branch code | A second contract vocabulary for wrapper mechanics; a contract node worn ON the vendor body |
| `CONTRACT-11` | An entry declares every slot inside it, by name | `children`, positional child lists, bare arrows in a slot, a repeated slot with no resting count |
| `CONTRACT-12` | An entry's classes describe how children stand together | Behaviour, paint, ground and elevation in an entry |
| `CONTRACT-13` | Every key in the table is rendered somewhere | A key kept for work that has not started |

The numbering is FIXED. These codes are cited from other law files and from task records already
written, so a renumbering silently breaks a citation somebody has already made. A code believed
wrong is kept and argued in `audit.md`, never quietly repaired.

The list ends at thirteen. A new situation is a rule change with a version bump, not a fourteenth row
added while nobody is reading.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write. `enforced` means a rule in
[`sources/fe/contract.mjs`](../../../sources/fe/contract.mjs) catches it. `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `CONTRACT-1` | `enforced` | `no-literal-structural-class` — both the JSX attribute and the hoisted module constant |
| `CONTRACT-2` | `enforced` | `no-class-composition-outside-contract` — `cn`/`clsx`/`twMerge`/`cva` and interpolated `className` |
| `CONTRACT-3` | `unrepresentable` | the `LayoutClassName` union; a non-member does not compile |
| `CONTRACT-4` | `enforced` | `only-the-frame-wears-a-node`; the frame's props carry no host to pass |
| `CONTRACT-5` | `documented` | nothing. A reader decides whether a name fixes its children |
| `CONTRACT-6` | `enforced` | `contract-why-is-a-reason` — length floor, plus a restatement check against the key's own words |
| `CONTRACT-7` | `enforced` | `no-structural-host-outside-contract-frame` — neutral boxes always, semantic elements once they carry a class |
| `CONTRACT-8` | `enforced` | `no-hand-written-contract-attrs` |
| `CONTRACT-9` | `enforced` | `no-unknown-contract-key` for a key that does not exist, `no-duplicate-entry-shape` for a key that should not |
| `CONTRACT-10` | `documented` | nothing directly. The rules only EXEMPT the named surface branches; no rule checks that what they own stayed wrapper mechanics |
| `CONTRACT-11` | `unrepresentable` | the slot record type, the branded component types, and the `repeats`/`restingCount` pairing |
| `CONTRACT-12` | `enforced` | `no-interaction-class-in-entry` — interaction, paint and raised-object families |
| `CONTRACT-13` | `enforced` | `no-dead-contract-key`, over a repository-wide reference walk |

Nine codes are held by a rule, two by a type, and two by a reader alone. The two held by a type are
held BETTER than the nine: there is nothing to police when the wrong value cannot be typed. The two
held by a reader are the module's real exposure, and they are listed again under *Rủi ro còn mở* in
[`audit.md`](./audit.md) with what a rule would have to see.

## Anchor

A law that cannot be pointed at in real code is a proposal, not a law. Every code below names a path
and what to look for there.

| Code | Path | What to look for |
|---|---|---|
| `CONTRACT-1` | `src/components/contracts/index.ts` | every entry's `classes: [...]` array — and the absence of any `className=` literal in the block, page and composite tiers |
| `CONTRACT-2` | the whole governed tree under `src/` | zero call sites of `cn`, `clsx`, `twMerge`, `cva`; zero interpolated `className` |
| `CONTRACT-3` | `src/components/contracts/index.ts` → `export type LayoutClassName` | the union itself; a value outside it fails to compile rather than failing review |
| `CONTRACT-4` | `src/components/contracts/index.ts` → `export type ContractHost`; `src/components/branches/Tree/index.tsx` | `const Host = spec.host ?? "div"` — the element read off the entry, and no `host`/`as` on the frame's props |
| `CONTRACT-5` | `src/components/contracts/index.ts` key names | names that fix a child (`label-fact-over-progress`, `page-header-stack`) against the banned generic (`card`, `row`) |
| `CONTRACT-6` | `src/components/contracts/index.ts` → every `why:` field | a sentence naming what breaks, wraps or overflows without the node |
| `CONTRACT-7` | `src/components/branches/Tree/index.tsx` | the one `<Host>` opened from a spec anywhere in the tree |
| `CONTRACT-8` | `src/components/contracts/index.ts` → `contractNodeProps` | `data-node` and `data-why` produced in exactly one function |
| `CONTRACT-9` | `src/components/contracts/index.ts` → `export type ContractKey = keyof typeof CONTRACTS` | the key union a call site is checked against |
| `CONTRACT-10` | `src/components/branches/SurfaceCard`, `SurfaceListCard`, `SurfaceFormCard` | the fixed vendor seam written as ordinary branch code, with the contract node standing INSIDE the content body |
| `CONTRACT-11` | `src/components/contracts/props.ts` → `ContractSlots`, `ContractProjection`, `ContractComponent`, `defineContractComponent`; `index.ts` → `ContractChildCardinality`, `ChildrenOf` | the named slot record, and the union that makes `repeats: true` without `restingCount` unwritable |
| `CONTRACT-12` | `src/components/contracts/index.ts` → `LayoutClassName` | live debt in plain sight: the union still admits `cursor-pointer`, `group`, `bg-surface`, `shadow-surface` that the rule refuses in an entry |
| `CONTRACT-13` | `src/components/contracts/index.ts` → `CONTRACT_KEYS` | every key reachable from a `contract="…"`, a `defineContractComponent("…")`, or another entry's slot |

All thirteen are anchored. `CONTRACT-12`'s anchor is deliberately an anchor to a CONTRADICTION and
is argued in `audit.md`; it is still an anchor, because the thing the law is about can be pointed at.

## Inputs

| Input | Evidence required |
|---|---|
| element | Whether it holds other elements, which is what makes it a node |
| key | The entry it resolves to, or the finding that none fits |
| classes | The entry's array, every member drawn from the closed layout union |
| host | The element the entry names, from the closed host union |
| slots | The named child record, with identity, optionality and cardinality per slot |
| reason | What breaks, wraps, overflows or stops being pressable without the node |
| call sites | Every place the key is rendered, including another entry's slot |

## Invariants

- A structural node's classes come from its key and from nowhere else.
- No class string is assembled or interpolated while a component runs.
- Every class value is a member of the closed layout union.
- The element belongs to the entry; the frame is its only wearer.
- Exactly one file turns a key into an element.
- Contract markers are emitted by that frame, never written by hand.
- Every slot is named; no child is reached by counting.
- A repeated slot always declares its resting count, and a scalar slot never does.
- Two entries never spell one shape under two names.
- An entry's classes are the arrangement, never the behaviour, the paint or the object.
- Every key in the table is rendered somewhere.
- A key's name fixes what may go inside it.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The leaf tier owns its own interior.** A leaf wraps ONE vendor primitive and writes the glue that
  holds one line together, so `CONTRACT-1` and `CONTRACT-7` do not reach it. The exemption is a
  FOLDER, which makes it a policy boundary rather than a type: anything filed there escapes. What
  keeps a region out is a question a person asks — does this file arrange two contents?
- **A named surface branch owns its fixed vendor wrapper.** `CONTRACT-10`. The seam cannot vary by
  caller, cannot admit children and never receives contract markers.
- **A semantic element opened for MEANING, carrying no class, is not a node.** `CONTRACT-7`. A
  `form` submits and a `ul` is a list; wrapping a contract node in one decides no shape at all. The
  moment it carries a class it has become a node with no key.
- **A twin test may build fixture markup by hand.** `CONTRACT-8`. Product source may not, and a test
  that spreads the node props itself proves its own fixture and nothing about the product.
- **A plan record carries a copy of the vocabulary.** `CONTRACT-13`. A design candidate renders the
  one page it was built to answer, so most of that copy is drawn by nobody — which is what a plan
  record IS, and not a list of deletions.

## Output

```text
element: <the element being written>
holds-others: <yes | no>
code: <CONTRACT-1 … CONTRACT-13>
key: <existing key | new key justified by a shape | none, this is a leaf>
host: <element the entry names>
slots: <name: identity, per slot>
reason: <what breaks, wraps or overflows without this node>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, the exceptions and the request mapping of every code, and `audit.md` only while reviewing the
canon.

## Scope

This module states a rule true of any front end that keeps a registry of layout nodes. It names no
product and no repository. Paths in the `Anchor` table are ordinary component-tree paths; every
example in `example.md` is ordinary TSX.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
code is never renumbered and never removed; a retired situation keeps its number and says so.
