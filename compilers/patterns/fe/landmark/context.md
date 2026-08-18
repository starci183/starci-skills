---
title: Landmark
runtime: true
source: en.md
sourceHash: c4c5ab02d045ee2cfeb9cf7499d9ec3c46c4cbf727ef791828d1928e891808cf
contextVersion: 1
---

# Landmark

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is a shape somebody already accepted: a screen, a layout, a region of chrome around routed
children, a key in the registry. The decision that the region exists and that a reader may jump
straight into it is not re-opened here. What this module produces is source architecture — which file
opens the landmark element, which file may never open one, what that file may carry, and what it must
declare so the element survives into the finished document.

## Law

A landmark is one of the few elements a reader can jump BETWEEN without reading what is inside them —
`main`, `nav`, `aside`, `header`, `footer`. Which element a node opens is a fact about the DOCUMENT,
so it is declared where the node's classes and children are already declared, never at the call site
and never by hand.

**This is binding, not advisory.** A registry makes the failure silent rather than loud: an entry
named `dashboard-main` records the intent perfectly and still renders a `div`, because the branch
that draws registry nodes draws divs. An entire application shipped that way — every region correctly
named, not one landmark in the document, and no gate with anything to say about it. The sentence this
module exists to hold is therefore: **a name in a key is not an element in a document.**

## Situation codes

Every situation this module governs carries a code, `LANDMARK-<n>`. The code names the SITUATION; the
row states what the source must look like once that situation is resolved, and what it refuses.

| Code | Situation | What the source must look like |
|---|---|---|
| `LANDMARK-1` | A screen needs a new kind of landmark | One branch per landmark element, identical to the ordinary node branch except the element it opens. Never one branch that decides its element at runtime from a caller |
| `LANDMARK-2` | Someone wants to put a class on the landmark branch | The landmark branch supplies the element and nothing else; the key supplies classes, admitted children and the reason. Never a class, a style prop or a second registry living on the branch |
| `LANDMARK-3` | A single branch is proposed that takes `as="main"` | The element is fixed by the entry, so it cannot be selected per call site. Never `as` / `element` / `tag` on the branch that draws ordinary nodes |
| `LANDMARK-4` | A layout composes chrome around the routed page | The layout that composes the chrome around the routed children marks those children as the page landmark. Never required of the root layout or of a pass-through layout |
| `LANDMARK-5` | A key named `*-main` sits deep inside a page | The landmark belongs to whoever owns a whole screen — a route file, or the page surface — and the carrier decides which of the two. Never a landmark opened by any tier that draws a PART of a screen |

The numbers are fixed and cross-referenced. `LANDMARK-2` and `LANDMARK-3` look like one rule stated
twice and are not: one is about what the branch may CARRY, the other about who may CHOOSE. A branch
that owned a class would still fix the element correctly; a branch that took `as` would still own no
class. They fail separately, so they are cited separately.

## Reading an accepted shape

1. Read what the shape states: that a region exists, what belongs inside it, and whether a reader is
   allowed to jump straight into it. That is the accepted decision, and it stands.
2. Note what the shape does not state, and therefore does not resolve: which file opens the element,
   whether the element arrives from an imported landmark branch or from the entry's declared host, and
   whether the key's name has any force at all. A key whose name ends in the element's name is still a
   name; only the declared host is a promise.
3. Resolve outermost first. The root layout, then the layout that composes chrome around routed
   children, then the page surface, then the tiers below. Once a `main` is opened, everything under it
   is a reading column, not a landmark.
4. Ask each code's question in turn. Does this need a branch that does not exist yet (`LANDMARK-1`)?
   Is the branch growing something the key already owns (`LANDMARK-2`)? Is the element becoming a prop
   (`LANDMARK-3`)? Does this file both draw chrome and receive routed `children` (`LANDMARK-4`)? Does
   this file own a whole screen, or only a part of one (`LANDMARK-5`)?
5. When two codes both match, cite both. Merging two branches into one that takes a prop violates
   `LANDMARK-1` and `LANDMARK-3` for different reasons, and a branch that both exists per element and
   carries a class is `LANDMARK-1` satisfied and `LANDMARK-2` broken. They fail separately, so they are
   recorded separately; do not collapse them into whichever is easier to fix.

## `LANDMARK-1` — one branch per element

**Situation.** A new screen needs a real `nav` or a real `aside`, not a `div` that looks like one. The
question on the table is whether to add another branch, or to teach the existing branch one more
parameter.

**What it emits in source.** One branch file per landmark element, identical to the ordinary node
branch at every line except the element it opens. The branch's own file is the one place that element
is written by hand. Adding a landmark element stays a one-file change.

**Boundary.** This is not `LANDMARK-3`: `LANDMARK-1` says how MANY branches there are, `LANDMARK-3`
says who may CHOOSE the element. Collapsing two branches into one that takes a prop breaks both, for
two different reasons. It is not `LANDMARK-2` either: the new branch must match the ordinary branch
including in owning no class — the moment it grows one, the situation is `LANDMARK-2`.

## `LANDMARK-2` — the branch owns no class

**Situation.** The landmark branch has just been created, and immediately someone wants it to accept
`className`, `padding`, or "just one `min-w-0`".

**What it emits in source.** A branch whose props carry the element and nothing else. Classes, the set
of admitted children and the reason all stay on the key in the registry, which is where they were
already declared.

**Boundary.** This is not `LANDMARK-1`: `LANDMARK-1` lets the branch EXIST, `LANDMARK-2` limits what it
may CARRY. And it is not `LANDMARK-3`: a class on the branch loses the REASON, while a prop that picks
the element loses the DOCUMENT's meaning. The first makes layout hard to trace; the second makes the
screen impossible to jump into.

## `LANDMARK-3` — the element is not a prop

**Situation.** A single branch is proposed that takes `as="main"` or `element="nav"`. It sounds tidy:
one branch, every element.

**What it emits in source.** A closed props interface on the node branch — exactly the key and the
content — so `as` / `element` / `tag` is an excess property and fails to typecheck. The element is read
from the entry's closed `host` union, and the branch file records that `as` was considered and refused.

**Boundary.** Against `LANDMARK-1`, see above. Against `LANDMARK-5`: `LANDMARK-3` says the call site may
not CHOOSE the element, `LANDMARK-5` says which call site may CARRY a landmark at all. A legal prop
placed in exactly the right file is still wrong under `LANDMARK-3`.

## `LANDMARK-4` — the layout that composes chrome is the marker

**Situation.** A layout draws navigation, then draws the routed page beside it. That file is the one
that KNOWS where navigation ends and the page begins — so it is the file that must say so.

**What it emits in source.** A route `layout.tsx` that both composes chrome and renders `children` must
reach a landmark: it hands the routed `children` to a frame keyed as the page landmark, with the
navigation drawn as a sibling. Sibling route layouts repeat the shape.

**Boundary.** This is not `LANDMARK-5`: `LANDMARK-4` requires one file to mark, `LANDMARK-5` forbids
other files from marking. Two halves of one idea, over different sets of files. Two kinds of layout are
not asked, and not out of favouritism: the ROOT layout draws the document shell and mounts providers,
and a PASS-THROUGH layout delegates its chrome to another. Requiring either to mark would put a second
landmark in the document by hand.

## `LANDMARK-5` — one `main` per document

**Situation.** A key named `dashboard-main`, `profile-main`, `explore-main`. The name says "main", and
whoever reads the key believes it is a landmark. It is not. It is the READING COLUMN beside the rail,
inside a page whose landmark was already opened one tier above.

**What it emits in source.** The landmark stays with whoever owns a whole screen — a route file, or the
page surface — and the carrier decides which of the two. Keys named for reading columns declare no
`host` at all; only the entry that declares `host: "main"` is a promise.

**Boundary.** Against `LANDMARK-4`, see above. Two carriers, two different sets of files — and merging
them was once a real defect. The landmark BRANCH is the thing somebody imports to wrap a screen: it
stays in route files, because a page reaching for it is exactly the trap this law was written to block.
An entry that DECLARES a host is not that: nobody imports a landmark, the registry says which element
this key opens and the frame obeys. That entry is rendered by whoever draws the screen's outermost
node, and the file-layout law says emphatically that this is not the route file — a route binds a page
to a URL and draws nothing itself. Hold both carriers to route files and the two laws refuse each
other: every page moved out of the route tree to obey the file-layout law reports as a misplaced
landmark, and the only way to satisfy both is to leave the page owner inside the route tree, which is
the defect the file-layout law exists to prevent. A law that can only be obeyed by breaking another law
is a finding about that law.

## Layer held

Which tier actually holds each code, as opposed to which one a reader would like to believe holds it.

| Code | Tier | What holds it |
|---|---|---|
| `LANDMARK-1` | `documented` | Nothing mechanical. The lint's `LANDMARK_BRANCHES` set records WHICH names are landmark branches; it never asks whether a branch exists per element, nor refuses a second one |
| `LANDMARK-2` | `documented` | Nothing mechanical. No rule reads the branch's own props for a class |
| `LANDMARK-3` | `unrepresentable` | The node branch's props interface is closed — exactly the key and the content. An `as` attribute is an excess property and fails to typecheck; the element comes from the entry's closed `host` union |
| `LANDMARK-4` | `enforced` | `routed-page-is-a-main-landmark` — a route `layout.tsx` that both composes chrome and renders `children` must reach a landmark |
| `LANDMARK-5` | `enforced` | `main-landmark-belongs-to-a-route-file` — a landmark drawn outside the files that own a whole screen reports |

Two codes are held only by a reader, and that is the honest shape of this module rather than a gap to
be papered over. Both are about the SHAPE of the branch, and a rule that read shape from a folder would
fire on the ordinary node branch too. What the lint can see — which FILE opened a landmark — is exactly
what the two rules do see.

## Inputs

| Input | Evidence required |
|---|---|
| file | Path and tier: route file, page surface, or a tier below either |
| composer | Whether this file draws the screen's chrome and hands it the routed children |
| carrier | How the element is claimed: an imported landmark branch, or the entry's declared host |
| key | The key's name, and whether it names a whole screen or a reading column inside one |
| document | Which landmark elements the finished route ends up containing, and how many of each |

## Rules

1. One `main` per document.
2. A name in a key is not an element in a document.
3. The element is declared beside the classes and the children, never at the call site.
4. The landmark branch supplies the element and nothing else.
5. A hand-written landmark element carries no key, so nothing records its classes, its children or why
   it exists.
6. Adding a landmark element is a one-file change, which is what stops the cheaper wrong answer from
   winning.
7. A key whose name ends in the element's name is still a name; only the declared host is a promise.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The landmark branch's own file.** `LANDMARK-1` lets that one file write the element by hand, exactly
  as the ordinary node branch is the one place a `div` is written.
- **Root layout.** `LANDMARK-4` does not reach it. It draws the document shell and mounts providers; a
  landmark there would be a second one.
- **Pass-through layout.** `LANDMARK-4` does not reach a layout that delegates its chrome to another.
  Requiring it would put a second landmark in the document that `LANDMARK-5` refuses.
- **Page surface under `LANDMARK-5`.** The two carriers are held to different sets of files. The
  landmark BRANCH stays in route files, because a page reaching for it is the trap. An entry that
  declares the host is rendered by whoever renders the screen's outermost node, and the file-layout law
  says that is emphatically not the route file — so the page surface may carry that one.
- **The cross-file case is not held.** A file-at-a-time rule cannot see that a layout and a page beneath
  it both opened a landmark. That remains a review question, and saying so is cheaper than a gate
  implying a guarantee it does not have.

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
