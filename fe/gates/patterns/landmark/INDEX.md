---
id: fe-patterns-landmark-index
title: INDEX.md
slug: /gates/patterns/landmark
sidebar_label: landmark
sidebar_position: 0
description: Binding rules for which file opens a landmark element, and which file may never open one.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `landmark`

## Law

A landmark is one of the few elements a reader can jump BETWEEN without reading what is inside them —
`main`, `nav`, `aside`, `header`, `footer`. Which element a node opens is a fact about the DOCUMENT,
so it is declared where the node's classes and children are already declared, never at the call site
and never by hand.

**This is binding, not advisory.** A registry makes the failure silent rather than loud: an entry
named `dashboard-main` records the intent perfectly and still renders a `div`, because the branch
that draws registry nodes draws divs. An entire application shipped that way — every region
correctly named, not one landmark in the document, and no gate with anything to say about it. The
sentence this module exists to hold is therefore: **a name in a key is not an element in a
document.**

## Situation Codes

Every situation this module governs carries a code, `LANDMARK-<n>`. The code names the SITUATION; the
row states what that situation requires and what it refuses.

| Code | Requires | Forbids |
|---|---|---|
| `LANDMARK-1` | One branch per landmark element, identical to the ordinary node branch except the element it opens | One branch that decides its element at runtime from a caller |
| `LANDMARK-2` | The landmark branch supplies the element and nothing else; the key supplies classes, admitted children and the reason | A class, a style prop or a second registry living on the branch |
| `LANDMARK-3` | The element is fixed by the entry, so it cannot be selected per call site | `as` / `element` / `tag` on the branch that draws ordinary nodes |
| `LANDMARK-4` | The layout that composes the chrome around the routed children marks those children as the page landmark | Requiring the same of the root layout or a pass-through layout |
| `LANDMARK-5` | The landmark belongs to whoever owns a whole screen — a route file, or the page surface — and the carrier decides which of the two | A landmark opened by any tier that draws a PART of a screen |

The numbers are fixed and cross-referenced. `LANDMARK-2` and `LANDMARK-3` look like one rule stated
twice and are not: one is about what the branch may CARRY, the other about who may CHOOSE. A branch
that owned a class would still fix the element correctly; a branch that took `as` would still own no
class. They fail separately, so they are cited separately.

## Tầng giữ

Which tier actually holds each code, as opposed to which one a reader would like to believe holds it.

| Code | Tier | What holds it |
|---|---|---|
| `LANDMARK-1` | `documented` | Nothing mechanical. The lint's `LANDMARK_BRANCHES` set records WHICH names are landmark branches; it never asks whether a branch exists per element, nor refuses a second one |
| `LANDMARK-2` | `documented` | Nothing mechanical. No rule reads the branch's own props for a class |
| `LANDMARK-3` | `unrepresentable` | The node branch's props interface is closed — exactly the key and the content. An `as` attribute is an excess property and fails to typecheck; the element comes from the entry's closed `host` union |
| `LANDMARK-4` | `enforced` | `routed-page-is-a-main-landmark` — a route `layout.tsx` that both composes chrome and renders `children` must reach a landmark |
| `LANDMARK-5` | `enforced` | `main-landmark-belongs-to-a-route-file` — a landmark drawn outside the files that own a whole screen reports |

Two codes are held only by a reader, and that is the honest shape of this module rather than a gap to
be papered over. Both are about the SHAPE of the branch, and a rule that read shape from a folder
would fire on the ordinary node branch too. What the lint can see — which FILE opened a landmark —
is exactly what the two rules do see.

## Anchor

Every row names a path and what to look for in it. Paths are relative to the front-end application
root, except the lint, which lives in this trust tree.

| Code | Where | What to look for |
|---|---|---|
| `LANDMARK-1` | `.claude/sources/fe/landmark.mjs` | `LANDMARK_BRANCHES` — the set of branch names that open a landmark, one entry per element. **Chưa neo được trong ứng dụng:** the application now carries the element on the entry instead, so no landmark branch remains to point at |
| `LANDMARK-2` | `src/components/branches/Tree/index.tsx` | The node branch's props: a key and its content, no class. Its classes arrive from the entry lookup. The landmark branch that would inherit this shape does not currently exist |
| `LANDMARK-3` | `src/components/branches/Tree/index.tsx` | The props interface, and the comment block recording that `as` was considered and refused; the element is read from the entry's `host` |
| `LANDMARK-4` | `src/app/[lang]/dashboard/layout.tsx` | A layout that draws navigation as a sibling and hands the routed `children` to the frame keyed `routed-page-main`. Its sibling route layouts repeat the shape |
| `LANDMARK-5` | `src/components/contracts/index.ts` | `routed-page-main` declares `host: "main"`; the keys named for reading columns declare no host at all, which is the trap this code exists for |

## Inputs

| Input | Evidence required |
|---|---|
| file | Path and tier: route file, page surface, or a tier below either |
| composer | Whether this file draws the screen's chrome and hands it the routed children |
| carrier | How the element is claimed: an imported landmark branch, or the entry's declared host |
| key | The key's name, and whether it names a whole screen or a reading column inside one |
| document | Which landmark elements the finished route ends up containing, and how many of each |

## Invariants

- One `main` per document.
- A name in a key is not an element in a document.
- The element is declared beside the classes and the children, never at the call site.
- The landmark branch supplies the element and nothing else.
- A hand-written landmark element carries no key, so nothing records its classes, its children or why
  it exists.
- Adding a landmark element is a one-file change, which is what stops the cheaper wrong answer from
  winning.
- A key whose name ends in the element's name is still a name; only the declared host is a promise.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The landmark branch's own file.** `LANDMARK-1` lets that one file write the element by hand,
  exactly as the ordinary node branch is the one place a `div` is written.
- **Root layout.** `LANDMARK-4` does not reach it. It draws the document shell and mounts providers;
  a landmark there would be a second one.
- **Pass-through layout.** `LANDMARK-4` does not reach a layout that delegates its chrome to another.
  Requiring it would put a second landmark in the document that `LANDMARK-5` refuses.
- **Page surface under `LANDMARK-5`.** The two carriers are held to different sets of files. The
  landmark BRANCH stays in route files, because a page reaching for it is the trap. An entry that
  declares the host is rendered by whoever renders the screen's outermost node, and the file-layout
  law says that is emphatically not the route file — so the page surface may carry that one.
- **The cross-file case is not held.** A file-at-a-time rule cannot see that a layout and a page
  beneath it both opened a landmark. That remains a review question, and saying so is cheaper than a
  gate implying a guarantee it does not have.

## Output

```text
file: <path>
tier: <route file | page surface | tier below>
composer: <draws chrome and routed children | draws part of a screen>
carrier: <landmark branch | entry host | none>
element: <main | nav | aside | header | footer>
situation: <LANDMARK-1 | LANDMARK-2 | LANDMARK-3 | LANDMARK-4 | LANDMARK-5>
reason: <what makes this file the owner of a whole screen, or what makes it not>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that draws its nodes from a registry. It names no
product, no component library and no repository. Component and key names in `example.md` are
illustrative: substitute the ones a given application uses.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
