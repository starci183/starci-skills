---
title: Loading
module: loading
kind: pattern
codes: [LOADING-1, LOADING-2, LOADING-3, LOADING-4, LOADING-5, LOADING-6, LOADING-7]
---

# Loading

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input is a shape that has already been accepted — a layout, a block, a capability or a contract
somebody signed off on. This pattern does not re-open that decision. Its output is source
architecture: which file draws the waiting, which tier owns the situation and which owns the look,
what the file exports, what it may receive, and what it is forbidden to hand in from outside. The
shape says what the surface looks like when the data is there; this pattern lands what the source
must look like for the second before that.

## Law

A surface waiting for data draws **the same shape it will draw when the data arrives**, with the
values taken out. Not a different tree, not a stack of grey bars that happens to look similar — the
same components, in the same arrangement, resting.

The reason is drift, and it is not hypothetical. A second tree describing the first is a description
that nobody updates: it is correct on the day it is written, and wrong the first time the real shape
changes. Nothing turns red, because a resting shape has no assertion to fail — it is simply wrong on
screen, and only for the second somebody happens to be watching.

The question that settles it: **if this component changes shape tomorrow, does the waiting version
change with it?** If it does not, it is a second description and it will drift.

**This is binding, not advisory.** Anything that renders before its data has arrived is in one of the
seven situations below. There is no surface too small to be in one: a single line of copy is
`LOADING-2` for the same reason a whole dashboard column is `LOADING-6`. "It is only a spinner" is
not an exemption — it is the most common place the rule gets skipped.

How the two halves meet is the seam most often got wrong, so it is written down rather than inferred.
A block and a leaf express waiting differently, and the translation between them is one line:

| Tier | How waiting is expressed |
|---|---|
| block | `pending` is a member of the state union — a real situation, beside `ready`, `empty`, `failed` |
| leaf, composite | `isLoading`, a flag received and never decided |
| the seam | `const isLoading = input.state === "pending"` in the presentational half |

The block owns the SITUATION because only it knows whether the answer has arrived. The leaf owns the
LOOK of resting because only it knows its own anatomy. Neither can do the other's half, and the one
line between them is where they meet.

## Situation codes

Every situation this module governs carries a code, `LOADING-<n>`. The code names the SITUATION; the
requirement column names what the source of a surface in that situation must look like.

| Code | Situation | What the source must look like |
|---|---|---|
| `LOADING-1` | A second component is being built to draw the waiting | The component that draws the data draws the waiting. No twin whose job is to mirror another's shape; no ready-made placeholder handed in as a prop |
| `LOADING-2` | The waiting element is a different element from the real one | Same tag, same arrangement, same measure — values gone, a resting surface in their place. No ternary at a call site choosing between two DIFFERENT components |
| `LOADING-3` | A whole region collapses while it waits | The resting region stands at the height of a real one; the repeat count is a declared decision. No region that draws nothing while waiting |
| `LOADING-4` | Resting markup is still in the accessibility tree | A resting element is hidden from assistive technology. No shimmer, and no emptied value, announced as if it were content |
| `LOADING-5` | A control is drawn before it has a destination | A control appears only once it has somewhere to go. No pressable target drawn over a destination that does not exist yet |
| `LOADING-6` | Independent regions wait on one flag | Each region resolves on its own request and lands when it lands. No one waiting flag shared across independent requests |
| `LOADING-7` | Waiting is modelled as the absence of data | `pending` is a member of the state union and carries what the frame needs. No treating waiting as `undefined`, `null` or "no data yet" |

The numbering runs `1`–`7` with no holes and no reserved rungs. Unlike a scale, these are not degrees
of one thing: `LOADING-3` is not more of `LOADING-2`. They are seven distinct ways the same surface
can lie about what it knows, and a surface can be in several of them at once.

## Reading an accepted shape

1. **Read what the shape states.** It states the tree once the answer lands: which tags, which
   arrangement, which measure, which controls, which regions repeat.
2. **Name what it does not state, and therefore does not resolve.** An accepted shape says nothing
   about which request feeds which region, how many rows a repeating region rests as, whether a
   control's destination exists yet, or whether `pending` is a member of the state union. Those are
   resolved here, not there — and where the shape is silent, the silence is recorded, not filled in
   by guess.
3. **Resolve outermost first.** Start at the region that owns a request (`LOADING-6`, `LOADING-7`),
   then the region's height and repeat count (`LOADING-3`), then the element inside it
   (`LOADING-1`, `LOADING-2`), then its accessibility (`LOADING-4`) and its controls (`LOADING-5`).
   An inner element resting correctly inside a region that collapses to zero is still wrong.
4. **Ask each code's question in turn.** Who draws the waiting? Is it the same element? Does the
   region keep its height, and is the row count declared? Is the resting markup silent? Does the
   control have a destination? Does each request own its own flag? Is `pending` in the union, and
   does it carry the frame?
5. **When two codes both match, both are recorded.** A surface can be in several situations at once,
   and these are not degrees of one thing. Record every code that matches, each with its own output
   block; do not collapse them into the one that feels largest.

## `LOADING-1` — one shape, two states; never two trees

**Situation.** The data has not arrived and somebody wants to build a second component to draw the
waiting: a `…Skeleton` file, or a prop that receives ready-made resting markup from outside. The real
component sits there knowing nothing about it.

**What it emits in source.** One file. The component that draws the data accepts the waiting as a
state of itself and rests as itself. No sibling file whose only job is to mirror it, and no prop
named `skeleton`, `placeholder` or `fallback` that takes an element.

**Recognition signs.** A file whose only job is to imitate the shape of another file. A prop named
`skeleton`, `placeholder` or `fallback` receiving an element. Finishing an edit to the real component
and having to remember a second place — with nothing to remind you. Ask: if this component gains a
line tomorrow, does the waiting version gain that line by itself?

**Boundary.** Not `LOADING-2`: `LOADING-1` is the EXISTENCE of a second tree — a file, a prop.
`LOADING-2` is a second tree written AT THE CALL SITE with a ternary. Same mistake, different place.
Not `LOADING-7`: `LOADING-1` says WHO DRAWS; `LOADING-7` says WHETHER THE SITUATION HAS A NAME. A
block with `pending` in its union can still break `LOADING-1` if the `pending` arm renders a twin.
And a shared resting primitive — the thing a component rests WITH — is not a twin: it describes no
particular shape, so it cannot drift from one.

**Common business situations.** Course card · invoice row · dashboard stat tile · notification line ·
profile card · leaderboard · product card in the cart.

## `LOADING-2` — the same element, hollowed out

**Situation.** There is only one component, but while waiting it is swapped for a different element —
usually by a ternary at the call site: `isLoading ? <A/> : <B/>` where `A` and `B` are two different
things.

**What it emits in source.** One element on both paths. The class set and the character swap may
change; the tag and the arrangement do not. The measure lives in the component, not rewritten by hand
at the call site.

**Recognition signs.** The two arms of a ternary name different elements. The resting version's size,
spacing or corner radius is written by hand at the call site. When the data lands, the text shifts a
little, because the two elements do not share a measure. Ask: are both arms the same element? If not,
which one is lying about its measure?

**Boundary.** Not `LOADING-1`: see above — that is a second tree that exists as a file or a prop, this
one is written inline. Not `LOADING-3`: `LOADING-2` is ONE ELEMENT preserving its shape; `LOADING-3`
is A WHOLE REGION preserving its height. A line of copy can rest lawfully inside a section that
collapses to zero pixels. Not `LOADING-5`: a ternary whose other arm is `null` does not belong to
this code — that is `LOADING-5`, and it is correct.

**Common business situations.** Display name · balance · rank label · course title · avatar · status
badge · the figure inside a stat tile · caption under an image.

## `LOADING-3` — the resting region keeps the section's height

**Situation.** The waiting region draws nothing, so it collapses; when the answer lands the whole
column below it jumps down. The reader was in the middle of something and loses their place.

**What it emits in source.** A resting region that stands at the height of a real one, and a repeat
count that is a declared decision — a named constant of resting rows substituted for the real rows,
not a number scattered through JSX and not an accident. In the child-spec union, `repeats: true`
cannot be written without `restingCount: number`, and `repeats: false` cannot carry one.

**Recognition signs.** `isLoading ? null : …` at REGION level rather than control level. A list that
draws 0 rows while waiting and 6 rows once it lands. Nowhere declaring "this region rests as N rows" —
the number is scattered through JSX or missing entirely. Ask: if the data landed now, would anything
on screen move? And is the resting row count a NAMED DECISION or an accidental consequence?

**Boundary.** Not `LOADING-2`: see above. Not `LOADING-5`: dropping a CONTROL because it has no
destination yet is lawful; dropping a WHOLE REGION because the data has not arrived is not. The
difference is that a missing control costs nobody their place, and a missing region does. Not
`LOADING-6`: `LOADING-3` is the height of ONE region; `LOADING-6` is SEVERAL regions waiting on each
other.

**Common business situations.** Lesson list · activity feed · transaction table · course grid ·
weekly-goal list · search results · comment rows.

## `LOADING-4` — resting markup is hidden from assistive technology

**Situation.** A shimmer, or a value that has been hollowed out, is still in the accessibility tree.
The screen reader reads noise, or reads an empty string, at exactly the moment the user is waiting to
be told something.

**What it emits in source.** `aria-hidden` present on the resting element for exactly as long as it
rests, and absent the moment it carries content. No per-cell `aria-label` describing the shimmer
itself.

**Recognition signs.** A resting element with no `aria-hidden`. An `aria-label` describing the shimmer
itself ("loading…") attached to every cell. Turning on a screen reader and hearing a run of
whitespace, or the same sentence ten times over. Ask: is there any CONTENT to read at this second? If
not, why is it still in the accessibility tree?

**Boundary.** Not `LOADING-2`: `LOADING-2` governs what is SEEN keeping its shape; `LOADING-4` governs
what is HEARD staying silent. An element can satisfy `LOADING-2` and still break `LOADING-4`. Not
`LOADING-7`: announcing ONCE at region level that something is loading is the frame's business — that
is `LOADING-7`, where `pending` carries the region's name. Announcing it at EVERY resting cell is
noise.

**Common business situations.** Resting avatar · resting title line · resting icon · resting figure
tile · resting chart legend · resting contribution grid.

## `LOADING-5` — no destination yet, no control drawn

**Situation.** A resting card still draws its button, or draws a link as a shimmer. The reader presses
it and nothing happens — or worse, something wrong happens.

**What it emits in source.** The slot holding the way out is omitted from the record entirely while
the item is unresolved — not rendered disabled, not rendered resting. A ternary with a `null` arm is
the correct shape here.

**Recognition signs.** A control whose `href`, target `id` or handler is currently `undefined`. A
control drawn `disabled` "so it does not look empty". A control frame already on screen while its
label is still untranslated. Ask: if the reader pressed this RIGHT NOW, what would they learn? If the
answer is "that this surface cannot be trusted" — do not draw it.

**Boundary.** Not `LOADING-3`: see above — dropping a control costs nobody their place, dropping a
region does. Not `LOADING-2`: this is the CLOSED exception to `LOADING-2` — a ternary with a `null`
arm is not a second tree. And absent, not `disabled`: a greyed-out button is still a promise, it says
"you will be able to press this soon" while the truth is "we do not yet know there is anywhere to go".

**Common business situations.** "Continue" button on a course card · "See more" link · invoice
download button · profile share button · open-exam-room button · checkout button with no cart yet.

## `LOADING-6` — each region owns its own waiting

**Situation.** One `isLoading` flag is threaded through four independent regions. Every region waits
for the slowest one, and four real situations are merged into one.

**What it emits in source.** One waiting flag per request. Each region resolves on its own request and
lands when it lands, and each block is asserted resting against its OWN unresolved request, one at a
time.

**Recognition signs.** `const isLoading = a.isLoading || b.isLoading || c.isLoading`. A `Promise.all`
gathering unrelated requests purely to produce one state. The whole page blank for three seconds and
then appearing all at once, instead of filling in over a second. Ask: do these two regions have THE
SAME ANSWER? If not, why do they share a flag?

**Boundary.** Not `LOADING-3`: see above. Not `LOADING-7`: `LOADING-7` says ONE region must have a
named `pending` situation; `LOADING-6` says EACH region must have its OWN. A page can satisfy
`LOADING-7` in every block and still break `LOADING-6` if they all receive one flag from above. And
the same request is not several regions: two parts reading from one answer are right to wait
together — they have only one answer to wait for.

**Common business situations.** Multi-tile dashboard · profile page with progress and activity ·
course page with content and reviews · checkout page with cart and address · navigation sidebar beside
content.

## `LOADING-7` — waiting is a real situation, not the absence of one

**Situation.** The component treats waiting as "no data yet": `data === undefined` returns `null`, or
returns exactly the empty-state interface. From then on it cannot tell NOT ARRIVED from NOT THERE, and
those two need two different sentences.

**What it emits in source.** `pending` standing in the state union beside `ready`, `empty` and
`failed`, carrying the frame rather than nothing: the region's label, its heading — everything already
known before the request went out. Only the content is unknown.

**Recognition signs.** A union with only `ready`, `empty`, `failed` — `pending` missing. The waiting
arm returning `null`, or returning the empty state. The waiting arm carrying no `props`, so the
region's name disappears while its content is on the way. Ask: looking at this surface while it waits,
does the reader still know WHICH REGION THEY ARE IN?

**Boundary.** Not `LOADING-1`: see above — having `pending` in the union saves nothing if that arm
draws a twin. Not `LOADING-3`: `LOADING-7` is HAVING A NAME for the situation; `LOADING-3` is HAVING A
SIZE. Without the name the resting arm cannot be written at all; with the name it can still be written
empty.

**Common business situations.** "Continue learning" section · AI credit tile · transaction history ·
weekly challenge list · community feed · search results · shopping cart.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule from `@canon-fe` reports it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `LOADING-1` | `enforced` | `no-resting-twin-component` and `no-placeholder-prop` |
| `LOADING-2` | `enforced` | `no-resting-branch-at-call-site` |
| `LOADING-3` | `unrepresentable` | The child-spec union: `repeats: true` cannot be written without `restingCount: number`, and `repeats: false` cannot carry one |
| `LOADING-4` | `documented` | Nothing. A missing `aria-hidden` on a resting element compiles, passes lint and renders |
| `LOADING-5` | `documented` | Nothing. The branch rule EXEMPTS a `null` arm rather than requiring one — an exemption is not an enforcement |
| `LOADING-6` | `documented` | Nothing. One flag threaded through four regions is ordinary, well-typed code |
| `LOADING-7` | `documented` | Nothing. A union may legally omit `pending`; the type system cannot know a member is missing |

Four codes rest on a reader alone. That is the point of stating the tier rather than the rule: a law
whose tier is unwritten is read as if enforcement existed, and the first person to trust that reading
ships the defect the law was written to prevent.

`LOADING-3`'s tier holds the DECLARATION, not the render. A repeating region cannot be declared
without stating how many rows it rests as; nothing forces those rows onto the screen.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at in real code is a proposal,
not a law. Paths are relative to the front-end component tree.

| Code | Anchor | What to look for |
|---|---|---|
| `LOADING-1` | `components/leaves/Text/index.tsx` | The leaf accepts `isLoading` and rests as itself. There is no second file beside it describing the same line |
| `LOADING-2` | `components/leaves/Text/index.tsx` (~133–160) | One element on both paths: the class set and the character swap change, the tag and the arrangement do not |
| `LOADING-3` | `components/contracts/index.ts` (~146–147) and `components/blocks/dashboard/WeeklyGoals/component.tsx` (~60, ~109) | The union that pairs `repeats` with `restingCount`; and a named constant of resting rows substituted for the real rows |
| `LOADING-4` | `components/leaves/Avatar/index.tsx` (~67) | `aria-hidden` present only while the leaf rests, and absent once it carries a name |
| `LOADING-5` | `components/blocks/dashboard/ContinueLearning/component.tsx` (~145–147) | The slot holding the way out is omitted from the record entirely while the item is unresolved — not rendered disabled, not rendered resting |
| `LOADING-6` | `components/blocks/dashboard/pending-gate.test.tsx` | Each block is asserted resting against its OWN unresolved request, one at a time |
| `LOADING-7` | `components/blocks/dashboard/ContinueLearning/component.tsx` (~68–73) | `pending` standing in the union beside `onboarding`, `empty`, `failed` and `ready`, carrying the frame rather than nothing |

Every code is anchored. None is unanchored.

## Inputs

| Input | Evidence required |
|---|---|
| region | The component or section that is waiting, and the request it waits on |
| tier | block, composite or leaf — which half of the seam this file is on |
| situation | Whether the answer has not arrived, has arrived empty, or has failed |
| shape | The tree this surface draws once the answer lands |
| repeat count | For a repeating region, how many rows it rests as |
| destination | For each control, whether the thing it leads to exists yet |

## Rules

1. One component, two states. The waiting version and the real one are the same file — no second file,
   no prop handing resting markup in from outside.
2. The block owns the situation; the leaf owns the look of resting. Neither does the other's half, and
   the seam between them is exactly one line.
3. A resting element keeps its tag, its arrangement and its measure.
4. A resting region keeps the height of a real one, and the repeat count is a declared decision.
5. A resting element is hidden from assistive technology for exactly as long as it rests.
6. A control is absent, not disabled and not resting, until its destination exists.
7. One waiting flag per request. Independent requests do not share one.
8. `pending` is a member of the state union, and it carries what the frame needs to draw itself.
9. Layout does not move at the moment the data lands.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it applies
to.

- **A test may build a resting shape by hand.** A twin written inside a `.test.tsx` or `.spec.tsx`
  file is a fixture asserted against, not a second description shipped to a reader. `LOADING-1` does
  not reach it.
- **A shared resting primitive is not a twin.** One generic resting surface that a component rests
  WITH is the opposite of a twin: it describes no particular shape, so it cannot drift from one.
  `LOADING-1` refuses a mirror of a NAMED component, not a primitive.
- **A control whose width is its label cannot rest.** A line of copy has a declared measure and can
  rest without knowing what it will say. A control sized by its own text does not, which is why
  `LOADING-5` removes it rather than emptying it.
- **A cached answer is not a waiting situation.** A region re-fetching behind data it already shows
  stays `ready`; it is not `pending`, and blanking it would be `LOADING-2` inverted — a shape moving
  backwards.
- **A `null` arm is correct.** A ternary whose other side is `null` is `LOADING-5`, not a second tree,
  and `LOADING-2` does not apply to it.

## Output

One block per file the shape produces.

```text
region: <the component or section that waits>
tier: <block | composite | leaf>
situation: <LOADING-1 | LOADING-2 | LOADING-3 | LOADING-4 | LOADING-5 | LOADING-6 | LOADING-7>
expression: <state: "pending" | isLoading flag | const isLoading = input.state === "pending">
resting shape: <the same tree, named — and what is emptied out of it>
held by: <unrepresentable | enforced: <rule> | documented>
reason: <the business fact that excludes the adjacent code>
```

## Worked example

The accepted shape: a dashboard section headed "Continue learning" that shows a course title, a
progress row, and a "Continue" button leading into the current lesson.

The shape states the tree once the answer lands. It does not state which request feeds the section,
how many rows the section rests as, whether the lesson the button leads to exists yet, or whether
`pending` is a member of the section's state union — so it does not resolve any of those. They are
resolved here.

```text
region: ContinueLearning section
tier: block
situation: LOADING-7
expression: state: "pending"
resting shape: the same section — heading and region label kept, course title and progress emptied
held by: documented
reason: the section's heading is known before the request goes out, so waiting is a named situation carrying the frame — not LOADING-1, because nothing here builds a second component; the same file draws both states
```

```text
region: course title line
tier: leaf
situation: LOADING-2
expression: const isLoading = input.state === "pending"
resting shape: the same Text element — same tag, same arrangement, same measure, characters swapped out
held by: enforced: no-resting-branch-at-call-site
reason: the line has a declared measure and can rest without knowing what it will say — not LOADING-5, because removing it would cost the reader their place
```

```text
region: "Continue" button
tier: block
situation: LOADING-5
expression: state: "pending"
resting shape: absent — the slot holding the way out is omitted from the record entirely
held by: documented
reason: the lesson it leads to is not yet resolved, so there is no destination — not LOADING-2, because a ternary with a null arm is not a second tree
```

## Scope

This rule holds for any code of this kind in this stack. It names no product, no feature, no component
library, no registry key and no repository. Every example is ordinary TSX.
