---
title: Typography
---

# Typography

The input is a shape already accepted — a layout, a block, a card, a feed section whose content and
arrangement are settled. This pattern does not reopen that decision. It takes each rendered line of
that shape and lands it in source: which element writes it, which component owns it, which prop
carries its rank, and which size, weight and tone the code ends up holding. The design question was
"what does this surface show". The question here is "what does the file say".

## Law

Type carries rank. How large a line is, how heavy, and what tone it takes are not independent
choices — together they say which of the things on screen matters most, and a reader decides where to
look before reading a word.

So the scale is small, and the steps are paired rather than free. A heading is not a size and a
weight chosen together; it is a LEVEL, and the level decides both, including the tag a screen reader
builds the outline from.

Headings are four levels:

| Level | Size | Weight |
|---|---|---|
| 1 | 20px | semibold |
| 2 | 16px | semibold |
| 3 | 14px | medium |
| 4 | 12px | medium |

Body text uses 14px and 16px. A third, restricted 12px step exists only for supporting copy beneath
or beside a primary line or joined surface; it is not another general-purpose body size, and because
it already means "supporting", every 12px line is muted. Size and tone are one rank there: no
default-tone or foreground-coloured 12px exception exists. The scale has three weights and two tones,
and callers do not invent further steps from nearby pixels.

Notice what the heading table does NOT do: it never pairs the largest size with the heaviest weight.
Rank comes from the STEP, not from shouting one line as loudly as the type system allows — which is
also why the ceiling is low enough that raising a line is rarely the move available.

**This is binding, not advisory.** Every rendered line of text falls under exactly one code below.
There is no line too small to have one: a three-word category above a card title is `TYPESET-5` for
the same reason a page name is `TYPESET-1`. "It is only a label" is not an exemption — it is the most
common place the rule gets skipped, because a single short line is exactly where a writer reaches for
whatever size looks right.

## Situation codes

Every situation this module governs carries a code, `TYPESET-<n>`. The code names the SITUATION; the
third column names what the source must then look like, including what it may not contain.

| Code | Situation | What the source must look like |
|---|---|---|
| `TYPESET-1` | A line is the NAME of a page or of a section | A heading is rendered by the heading component from a `level`, which decides tag and set together. Forbids: a heading tag written by hand; a size and a weight assembled into something that looks like a heading |
| `TYPESET-2` | A fifth heading level is wanted | Four levels; a fifth means the section nested further than a reader can hold, so flatten instead. Forbids: a fifth heading level, or a smaller step invented to stand in for one |
| `TYPESET-3` | A line is wanted to draw more attention | Rank expressed through size, weight and tone. Forbids: a border, background or chip drawn to make a line important |
| `TYPESET-4` | Several things on one surface compete for attention | Competing attention resolved by quietening the neighbours. Forbids: raising the contested line, which raises the floor for the next author too |
| `TYPESET-5` | An eyebrow, count, category or meta line accompanies a title | A secondary line — eyebrow, count, category, meta — set below the rank of the title it belongs to. Forbids: a secondary line the same size as, larger than, or heavier than its title; tone alone as the whole difference |
| `TYPESET-6` | A heading is wanted heavier | Weight chosen on body text only; a heading's weight comes from its level. Forbids: a weight prop or weight class pushed onto a heading |
| `TYPESET-7` | Supporting copy at 12px | The 12px step always paired with muted tone, for supporting copy only. Forbids: 12px in foreground tone; 12px used as compact primary copy |
| `TYPESET-8` | "Today", "Yesterday" partition a result set | A temporal result marker rendered as a 14px muted subtitle outside the surface it partitions. Forbids: a heading level, or the joined surface's own label treatment, given to a time bucket |
| `TYPESET-9` | Choosing 16px or 14px for a title inside body | Body title rank read from the content owner: dominant object title at 16px medium, compact or repeated titles at 14px medium, ordinary values at 14px normal. Forbids: rank chosen because a card hovers, a value is numeric, or space was available |

The scale stops at nine and stays at nine. A code names a situation somebody can be shown to have got
wrong; renumbering one silently breaks a citation already made elsewhere.

## Reading an accepted shape

1. Read what the shape states. It states which lines exist on the surface, what each line says, what
   it belongs to, and where it sits relative to the others.
2. Read what the shape does not state, and therefore does not resolve. A shape does not state a
   heading level, a pixel size, a weight, a tone, or whether a line belongs to the document outline.
   Those are not free afterwards; they are decided here, by the codes, from the content owner.
3. Resolve outermost first. Take the page name, then section names, then the title of each object,
   then that title's secondary lines, then values and qualifiers. An inner line's rank is only
   readable once the rank above it is fixed, because `TYPESET-5` constrains a RELATIONSHIP.
4. Ask each code's question of every line, in code order. Is this line in the document outline
   (`TYPESET-1`)? Does answering it require a level the scale does not have (`TYPESET-2`)? Is a box
   being used to do the work of rank (`TYPESET-3`)? Is the fix a raise rather than a quietening
   (`TYPESET-4`)? Does this line say more about another line (`TYPESET-5`)? Is a weight being pushed
   onto a heading (`TYPESET-6`)? Is 12px being used as compact primary copy (`TYPESET-7`)? Is this a
   data-generated time bucket (`TYPESET-8`)? And for what is left, which content owner sets the body
   title rank (`TYPESET-9`)?
5. When two codes both match, they are almost never in conflict — one names the medium and the other
   names the direction, or one fixes a level and the other constrains the pair. `TYPESET-3` and
   `TYPESET-4` are the medium and the direction of the same wish. `TYPESET-9` chooses the step for a
   title; `TYPESET-5` only constrains the relation between that title and its secondary lines, so
   both may apply to the same cluster and neither overrides the other. `TYPESET-8` outranks
   `TYPESET-7` for a time bucket: it stays at 14px muted. And a line that is in the outline is
   `TYPESET-1` before it is anything else — no body step is chosen for it.

## `TYPESET-1` — a heading is a level, and the level decides tag and set

**Situation.** A line NAMES the page or a section. The tag a screen reader uses to build the outline
and the size the reader's eye sees are two facts of the same thing.

**What it emits in source.** A call to the heading component with a `level` prop. That one prop is
passed to the outline tag AND used to select the class set — one prop, two facts, in one expression.
No `h*` tag is written at the call site, and no size-plus-weight pair is assembled to imitate one.

**Recognition signs.**

- Remove the line and the part below it loses its name, not its content.
- It appears in the page's table of contents if the page has one.
- People tend to write it as a hand-typed `h*` tag with a few size classes.
- Ask: if a blind user hears this page's outline, is this line in it? If yes, it is a heading, and a
  prop must decide its level.

**Boundary.** Not `TYPESET-9`: a card title is not necessarily a heading — the deciding question is
the outline, not the size. Not `TYPESET-8`: a time label is not a heading even though it stands above
a whole group of results. Writing the tag in one place and the size in another lets them drift apart:
the third-largest line on screen becomes the document's first heading, and the outline stops
describing the page. One prop deciding both makes contradiction impossible.

**Common business situations.** Page name · dashboard section name · catalog card name · panel title ·
dialog title · settings group name.

## `TYPESET-2` — four levels, and a fifth means the page nested too deep

**Situation.** Somebody needs a heading smaller than level four, because a section already contains a
section, and inside that there is one more group.

**What it emits in source.** Nothing new. The level union stays closed at `1 | 2 | 3 | 4`, and the
shape's nesting is flattened in the source until the title can be set with a level the scale has. No
smaller step is invented, and no bold body line is written to stand in for a level five.

**Recognition signs.**

- The request arrives as "give me one more small step".
- The DOM tree already has three heading tiers before the real content.
- The writer plans to substitute a bold body line to look "like a level five heading".
- Ask: is this a SIZE problem, or a STRUCTURE problem wearing a size problem's clothes?

**Boundary.** Not `TYPESET-1`: `TYPESET-1` says a heading must come from a level; `TYPESET-2` says the
set of levels is closed. Not `TYPESET-6`: do not solve it by giving a level 4 heading a different
weight — that is a different violation. The answer is NOT a smaller step. The answer is that the
section nested further than a reader can hold, so flatten it and then name it.

**Common business situations.** Settings pages with nested groups · documentation with sub-items of
sub-items · long forms grouped in several tiers · course pages with chapters inside chapters.

## `TYPESET-3` — rank comes from size, weight and tone; never from a box

**Situation.** A line needs attention, and the first reflex is to draw a border around it, a
background behind it, or to put it in a chip.

**What it emits in source.** Size, weight and tone classes only. The text leaf draws no border and no
background, so the box is always somebody else's element; the class list of the line that carries copy
has no `border-*` and no `bg-*` entry.

**Recognition signs.**

- The box does not correspond to any state — it is there only to stand out.
- The same surface already carries several similar boxes.
- Remove the box and no information is lost, only prominence.
- Ask: what TRUTH is this box stating that size, weight and tone cannot state?

**Boundary.** Not `TYPESET-4`: `TYPESET-3` forbids a medium; `TYPESET-4` names the right direction when
both sides want prominence. Not a state: a chip saying "completed" or "3 days left" is not this code —
it draws a fact, not a rank. Once a surface has taught the reader that boxes here mean nothing, the box
that really does mean something becomes invisible too. That is the cost the first box-drawer never
pays.

**Common business situations.** Category badge on a card · border around a price · coloured background
for a metric line · chip wrapping an author name · box around a description sentence.

## `TYPESET-4` — whatever is contested, quieten its neighbours

**Situation.** Two or three things on the same surface all want to be seen first, and the habitual fix
is to raise the most important one by a step.

**What it emits in source.** A diff that lowers the surrounding lines — into muted tone, a lighter
weight or a smaller step — while the contested line keeps the set it already had. The scale's ceiling
stays where it is; level 1 is `text-xl font-semibold`, not `text-3xl font-bold`.

**Recognition signs.**

- The diff only increases a size or a weight and lowers nothing.
- On that surface, more lines sit in default tone than in muted.
- The previous change also raised something a step, for the same reason.
- Ask: am I making this BIGGER, or making the things around it QUIETER?

**Boundary.** Not `TYPESET-3`: if the raise is being done with a box, that is `TYPESET-3`. Not
`TYPESET-5`: if the thing competing is the title's own secondary line, that is `TYPESET-5`, and lowering
it is mandatory rather than a choice. Emphasis is RELATIVE. Raising the important thing raises the
floor for everything, and the next author raises again. Most rank errors are solved one step earlier,
by lowering everything around. The scale here deliberately has a LOW CEILING so that climbing is not
cheap.

**Common business situations.** A card carrying name, price, learner count and a promo label · a list
row with four facts · a toolbar with three buttons all wanting to be primary · a dashboard full of
metric tiles.

## `TYPESET-5` — a secondary line always sits below the title it belongs to

**Situation.** An eyebrow, a count, a category, a meta line stands beside or under a title. It says
MORE ABOUT the title; it is not a peer object.

**What it emits in source.** Two lines whose sets differ by size or by weight, with the secondary line
strictly below: the title stays at its rank while the facts around it stay at the lower step and muted
tone. It is never emitted at the same size and the same weight as its title with only the tone changed.

**Recognition signs.**

- Read the secondary line alone and you cannot tell what it is about.
- It is shorter than the title but currently the same size as the title.
- It is being made prominent "for rhythm".
- Ask: if the user could read only ONE line in this cluster, which one do they need? The other must
  sit below.

**Boundary.** Not `TYPESET-7`: if the secondary line drops to the 12px step, muted tone becomes
mandatory — that is `TYPESET-7`. Not `TYPESET-9`: `TYPESET-9` picks the step for the TITLE;
`TYPESET-5` only constrains the RELATION between a title and its secondary line. Changing tone alone
is NOT enough: two lines at the same size still claim the same rank even when one has gone grey. A
card whose largest element is the category label is a card whose name nobody reads, and that is an
error, not a successful emphasis.

**Common business situations.** Category above a course name · "12 lessons" under a chapter name ·
author name under an article title · "3 days left" beside a task name · a unit under a number.

## `TYPESET-6` — weight is body text's axis; a heading takes no second axis

**Situation.** A heading does not look strong enough, so the writer adds a weight class, or wishes the
heading component had a `weight` prop.

**What it emits in source.** A heading call with exactly two fields, `content` and `level`. There is no
weight field to pass and no `font-*` class beside the heading; the weight lives in the level class set.

**Recognition signs.**

- A `font-*` class sits next to a heading.
- A request arrives for "level 3 headings bolder, just on this screen".
- Two screens use the same heading level but look different.
- Ask: if the level already decided the weight, what is the weight I am about to add DECIDING AGAIN?

**Boundary.** Not `TYPESET-9`: body text DOES have a weight axis, and that is the only legal place to
use it. Not `TYPESET-1` — or rather, a "heading" assembled from a large size and a heavy weight is not a
heading at all: the outline does not contain it, so it belongs to `TYPESET-1`. A heading already carries
its weight as part of its level. Pushing another weight in makes TWO SYSTEMS decide one thing, and the
loser is whatever the reader sees second.

**Common business situations.** Headings in a dialog · a section heading that wants to be "as strong as
the home page" · a card title that wants to be bolder than the one next to it.

## `TYPESET-7` — the 12px step always means supporting copy, and is always muted

**Situation.** A small line is needed. The writer treats 12px as "the compact version of normal text"
and keeps the foreground tone.

**What it emits in source.** The union branch `{ size: "xs"; tone?: "muted" }` — a foreground 12px line
is impossible to write, and the component re-derives the tone at runtime, ignoring a caller's tone when
the size is `xs`. Copy the user MUST read to get their work done is emitted at 14px or larger instead.

**Recognition signs.**

- The 12px line carries information the user MUST read in order to act.
- It was set to 12px because the space was narrow, not because it is supporting.
- It stands alone, with no primary line for it to qualify.
- Ask: if this line must keep the primary tone, is it still supporting copy? If not, it stays at 14px
  or above.

**Boundary.** Not `TYPESET-8`: a time label partitioning results STAYS at 14px even though it is also
muted — it partitions a scan region rather than explaining any line. Not `TYPESET-5`: `TYPESET-5` says a
secondary line must sit below; `TYPESET-7` says the PRICE of going down to 12px is muted tone,
non-negotiable. Size and tone at this step are ONE rank, not two choices. A narrow space is not a
semantic reason: if the text must keep the primary tone, it is important enough to stay a step up.

**Common business situations.** "55 minutes ago" · a caption under an image · "PDF · 2.4 MB" · the
explanatory line under an input · a fact to the right of a 14px label · a quota note.

## `TYPESET-8` — a time marker is a muted subtitle, not a heading

**Situation.** Results are partitioned by day: "Today", "Yesterday", "16/08/2026". That label
QUALIFIES the group of results directly beneath it.

**What it emits in source.** A 14px muted subtitle rendered OUTSIDE the list surface, with the surface
below told to hide its own label — so one group of results is never named twice at two different ranks.
No heading level, and not the joined surface's own label treatment.

**Recognition signs.**

- The label is generated from data, not from the page's structure.
- The number of labels varies with the data; three today, one tomorrow.
- Below it sits a list surface that already has a label of its own.
- Ask: if the data went empty, would this line disappear? If yes, it is not a section of the page.

**Boundary.** Not `TYPESET-1`: giving it a heading level WRONGLY PROMOTES every time marker into a
section of the page, and the page's outline grows with the data. Not `TYPESET-7`: it is muted but does
NOT drop to 12px, because it explains no line — it partitions a scan region.

**Common business situations.** An activity feed grouped by day · transaction history by month · an
inbox split into "Today / This week" · a study log · notifications grouped by marker.

## `TYPESET-9` — a body title's step follows the content owner

**Situation.** A choice between 16px medium and 14px medium for a title line that sits in the body, not
in the outline.

**What it emits in source.** 16px medium for a SHORT, DOMINANT title standing for an important object or
a large card; 14px medium for compact, repeated or long titles; 14px normal for their descriptions,
metadata and ordinary values. The evidence for the split is the ratio on the surface — one dominant
prompt at 16px medium against roughly thirty compact titles at 14px medium.

**Recognition signs.**

- The reason about to be used is "this card has hover", "this is a number", or "there was room here".
- The same kind of title repeats dozens of times inside one list.
- The title is long enough to wrap to two lines at the larger step.
- Ask: does this line STAND FOR AN IMPORTANT OBJECT on display, or is it a repeated row in a list?

**Boundary.** Not `TYPESET-1`: if it is in the outline, do not pick a body step — it is a heading. Not
`TYPESET-5`: descriptions, meta and ordinary values of that same object sit at 14px normal, not medium.
Hover may confirm a surface is clickable but does NOT promote the text inside it. A number can still be
just an ordinary value, and available space is not a semantic rank.

**Common business situations.** A course name on a large card · a lesson name in a chapter list · an
accordion label · a row title in a metrics table · a file name in a list · a metric value in a stat
tile.

## Layer held

Which tier actually holds each code — a closed type, a lint rule, or only a reader.

| Code | Tier | What holds it |
|---|---|---|
| `TYPESET-1` | `enforced` | `no-heading-tag-outside-heading-component` in `@starci/eslint-canon-fe` reports any `h1`–`h6` in a source file that is not the heading component itself |
| `TYPESET-2` | `unrepresentable` | The closed level union `1 \| 2 \| 3 \| 4` on the heading data type; the same lint rule's `tooDeep` branch is the backstop for a hand-written `<h5>` |
| `TYPESET-3` | `documented` | Nothing mechanical. The text leaf draws no border and no background, so the box is always somebody else's element |
| `TYPESET-4` | `documented` | Nothing mechanical. The scale's ceiling makes climbing expensive, but no tool sees which direction an author moved |
| `TYPESET-5` | `documented` | Nothing mechanical. Both lines are legal in isolation; only their pairing is wrong |
| `TYPESET-6` | `unrepresentable` | The heading data type is closed over `content` and `level`; there is no weight field to pass |
| `TYPESET-7` | `unrepresentable` | The text data type is a discriminated union: `{ size: "xs"; tone?: "muted" }` makes a foreground 12px line impossible to write, and the component re-derives the tone at runtime |
| `TYPESET-8` | `documented` | Nothing mechanical. Every ingredient is a legal call; only the meaning of the string makes it a partition |
| `TYPESET-9` | `documented` | Nothing mechanical. Both sizes are legal; the content owner is not a fact any type or rule can read |

One rule, three closed types, five codes held by a reader alone. That gap is the honest state of this
law, not a defect in the table: what a type can refuse is a VALUE, what a lint rule can see is a SHAPE,
and most of this law is about a relationship between two lines that are each individually fine.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative.

| Code | Path | What to look for |
|---|---|---|
| `TYPESET-1` | `components/leaves/Heading/index.tsx` | `level` is passed to the outline tag AND used to select the class set — one prop, two facts, in one expression |
| `TYPESET-2` | `components/leaves/Heading/index.tsx` · `@starci/eslint-canon-fe` | The level union stops at `4`; the rule's `DEEPEST_LEVEL` constant is the same `4` |
| `TYPESET-3` | `components/leaves/Text/index.tsx` | The class list has no `border-*` and no `bg-*` entry: the leaf that draws copy cannot draw a box around it |
| `TYPESET-4` | `components/leaves/Heading/index.tsx` | Level 1 is `text-xl font-semibold`, not `text-3xl font-bold` — the ceiling is low, so "louder" mostly does not exist |
| `TYPESET-5` | `components/blocks/courses/CourseCatalogCard/component.tsx` | The card's title is a heading at level 2 while its facts stay 14px muted — the secondary lines never reach the title's rank |
| `TYPESET-6` | `components/leaves/Heading/index.tsx` | The heading data type has exactly two fields; no weight is accepted, and the weight lives in the level class set |
| `TYPESET-7` | `components/leaves/Text/index.tsx` | The union branch `{ size: "xs"; tone?: "muted" }`, and the tone re-derivation that ignores a caller's tone when the size is `xs` |
| `TYPESET-8` | `components/blocks/dashboard/ActivityFeed/component.tsx` | The day label renders as 14px muted OUTSIDE the list surface, and the surface below is told to hide its own label |
| `TYPESET-9` | `components/pages/CourseFlashcardSessionPage/component.tsx` · `components/blocks/` | One dominant prompt at 16px medium against roughly thirty compact titles at 14px medium — the ratio is the evidence |

Every code is anchored; none is unanchored. Two anchors prove less than they look: the `TYPESET-4`
anchor proves the ceiling, not the practice, and the `TYPESET-9` anchor proves a distribution, not a
per-call-site decision.

## Inputs

| Input | Evidence required |
|---|---|
| outline rank | Whether this line is a rung of the document outline, and how deep the section already nests |
| content owner | The object the line names: a page, a section, one important object, a repeated row, a value, a qualifier |
| neighbours | What else on the same surface is competing, and at what rank it currently sits |
| surface ownership | Whether a joined surface already draws its own label for this text |
| partition role | Whether the line names a time bucket over results rather than a section of the page |

## Rules

1. A heading's tag and its set come from one prop.
2. The scale is four heading levels, two body sizes, one restricted supporting size.
3. Size, weight and tone are the only carriers of rank; boxes are not.
4. The 12px step and muted tone are one decision, never two.
5. A secondary line is strictly below its title in size or weight, not merely in tone.
6. A heading takes no weight of its own.
7. Rank follows the content owner, never interaction, data type or available space.
8. Every rendered line resolves to exactly one code. No line is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Temporal partitions keep 14px.** Under `TYPESET-8`, a time bucket stays at body size with muted
  tone rather than dropping to the supporting step, because it names a scan partition rather than
  explaining the line above it. This is the one muted-subtitle case that is NOT `TYPESET-7`.
- **Weight as the whole difference between peers.** Under `TYPESET-5` and `TYPESET-9`, two compact peer
  lines may share 14px when one takes medium and the other stays normal or muted. Same size, different
  weight, is a rank; same size, same weight, different tone, is not.
- **State parity.** A resting or loading line keeps the code and the metrics of the line it will become.
  A skeleton that changes size is a promise about rank that the loaded state breaks.
- **The heading component itself.** Under `TYPESET-1`, exactly one file writes heading tags: the one that
  owns the level. The lint rule exempts that path and test files that assert against raw markup.
- **A fifth level requested.** Under `TYPESET-2` there is no styling answer. Flatten the section, then set
  the title with a level the scale has.

## Output

One block per rendered line the shape produces.

```text
line: <the text and where it sits>
owner: <page | section | object | repeated row | value | qualifier | partition>
situation: <TYPESET-1 … TYPESET-9>
element: <heading level N | body line>
set: <size + weight + tone>
reason: <the ownership fact that excludes the adjacent code>
```

## Worked example

The accepted shape: an activity feed section on a dashboard, whose results are grouped by day, and
where each group is a list surface of rows carrying a row title and a relative timestamp.

The shape states that the section exists, that the groups are per-day, that each row has a title and a
timestamp. It does NOT state a heading level, a pixel size, a weight, a tone, or whether the day label
belongs to the document outline. Those are not left free afterwards — they are resolved here.

```text
line: "Recent activity", the section name above the feed
owner: section
situation: TYPESET-1
element: heading level 2
set: 16px + semibold + default tone
reason: the section keeps its name whether or not any activity exists, so it is a rung of the outline — which is exactly what excludes TYPESET-8
```

```text
line: "Today", above the first group of rows
owner: partition
situation: TYPESET-8
element: body line, outside the list surface, and the surface below hides its own label
set: 14px + normal + muted
reason: the label is generated from data and disappears when the data goes empty, so it is not a section of the page — that excludes TYPESET-1; and it partitions a scan region rather than explaining the line above it, which excludes TYPESET-7 and keeps it at 14px
```

```text
line: the row title inside a group
owner: repeated row
situation: TYPESET-9
element: body line
set: 14px + medium + default tone
reason: the same kind of title repeats down the whole list rather than standing for one dominant object on display, so it takes the compact step — the fact that the row hovers is not a rank, which is what excludes the 16px medium branch
```

```text
line: "55 minutes ago", beneath the row title
owner: qualifier
situation: TYPESET-7
element: body line
set: 12px + normal + muted
reason: it says more about the row title and cannot be read alone, and it drops to the supporting step, so muted tone comes with the size as one decision — it explains the line above it rather than partitioning results, which excludes TYPESET-8
```

## Scope

This rule holds for any code of this kind in this stack. It names no product, no component library, no
registry key and no repository, and no single feature. Examples are ordinary TSX: plain markup with
plain classes, plus a heading component wherever the component boundary IS the law.
