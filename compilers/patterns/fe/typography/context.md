# Typography

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

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

**Boundary.** Not `TYPESET-9`: a card title is not necessarily a heading — the deciding question is
the outline, not the size. Not `TYPESET-8`: a time label is not a heading even though it stands above
a whole group of results. Writing the tag in one place and the size in another lets them drift apart:
the third-largest line on screen becomes the document's first heading, and the outline stops
describing the page. One prop deciding both makes contradiction impossible.

## `TYPESET-2` — four levels, and a fifth means the page nested too deep

**Situation.** Somebody needs a heading smaller than level four, because a section already contains a
section, and inside that there is one more group.

**What it emits in source.** Nothing new. The level union stays closed at `1 | 2 | 3 | 4`, and the
shape's nesting is flattened in the source until the title can be set with a level the scale has. No
smaller step is invented, and no bold body line is written to stand in for a level five.

**Boundary.** Not `TYPESET-1`: `TYPESET-1` says a heading must come from a level; `TYPESET-2` says the
set of levels is closed. Not `TYPESET-6`: do not solve it by giving a level 4 heading a different
weight — that is a different violation. The answer is NOT a smaller step. The answer is that the
section nested further than a reader can hold, so flatten it and then name it.

## `TYPESET-3` — rank comes from size, weight and tone; never from a box

**Situation.** A line needs attention, and the first reflex is to draw a border around it, a
background behind it, or to put it in a chip.

**What it emits in source.** Size, weight and tone classes only. The text leaf draws no border and no
background, so the box is always somebody else's element; the class list of the line that carries copy
has no `border-*` and no `bg-*` entry.

**Boundary.** Not `TYPESET-4`: `TYPESET-3` forbids a medium; `TYPESET-4` names the right direction when
both sides want prominence. Not a state: a chip saying "completed" or "3 days left" is not this code —
it draws a fact, not a rank. Once a surface has taught the reader that boxes here mean nothing, the box
that really does mean something becomes invisible too. That is the cost the first box-drawer never
pays.

## `TYPESET-4` — whatever is contested, quieten its neighbours

**Situation.** Two or three things on the same surface all want to be seen first, and the habitual fix
is to raise the most important one by a step.

**What it emits in source.** A diff that lowers the surrounding lines — into muted tone, a lighter
weight or a smaller step — while the contested line keeps the set it already had. The scale's ceiling
stays where it is; level 1 is `text-xl font-semibold`, not `text-3xl font-bold`.

**Boundary.** Not `TYPESET-3`: if the raise is being done with a box, that is `TYPESET-3`. Not
`TYPESET-5`: if the thing competing is the title's own secondary line, that is `TYPESET-5`, and lowering
it is mandatory rather than a choice. Emphasis is RELATIVE. Raising the important thing raises the
floor for everything, and the next author raises again. Most rank errors are solved one step earlier,
by lowering everything around. The scale here deliberately has a LOW CEILING so that climbing is not
cheap.

## `TYPESET-5` — a secondary line always sits below the title it belongs to

**Situation.** An eyebrow, a count, a category, a meta line stands beside or under a title. It says
MORE ABOUT the title; it is not a peer object.

**What it emits in source.** Two lines whose sets differ by size or by weight, with the secondary line
strictly below: the title stays at its rank while the facts around it stay at the lower step and muted
tone. It is never emitted at the same size and the same weight as its title with only the tone changed.

**Boundary.** Not `TYPESET-7`: if the secondary line drops to the 12px step, muted tone becomes
mandatory — that is `TYPESET-7`. Not `TYPESET-9`: `TYPESET-9` picks the step for the TITLE;
`TYPESET-5` only constrains the RELATION between a title and its secondary line. Changing tone alone
is NOT enough: two lines at the same size still claim the same rank even when one has gone grey. A
card whose largest element is the category label is a card whose name nobody reads, and that is an
error, not a successful emphasis.

## `TYPESET-6` — weight is body text's axis; a heading takes no second axis

**Situation.** A heading does not look strong enough, so the writer adds a weight class, or wishes the
heading component had a `weight` prop.

**What it emits in source.** A heading call with exactly two fields, `content` and `level`. There is no
weight field to pass and no `font-*` class beside the heading; the weight lives in the level class set.

**Boundary.** Not `TYPESET-9`: body text DOES have a weight axis, and that is the only legal place to
use it. Not `TYPESET-1` — or rather, a "heading" assembled from a large size and a heavy weight is not a
heading at all: the outline does not contain it, so it belongs to `TYPESET-1`. A heading already carries
its weight as part of its level. Pushing another weight in makes TWO SYSTEMS decide one thing, and the
loser is whatever the reader sees second.

## `TYPESET-7` — the 12px step always means supporting copy, and is always muted

**Situation.** A small line is needed. The writer treats 12px as "the compact version of normal text"
and keeps the foreground tone.

**What it emits in source.** The union branch `{ size: "xs"; tone?: "muted" }` — a foreground 12px line
is impossible to write, and the component re-derives the tone at runtime, ignoring a caller's tone when
the size is `xs`. Copy the user MUST read to get their work done is emitted at 14px or larger instead.

**Boundary.** Not `TYPESET-8`: a time label partitioning results STAYS at 14px even though it is also
muted — it partitions a scan region rather than explaining any line. Not `TYPESET-5`: `TYPESET-5` says a
secondary line must sit below; `TYPESET-7` says the PRICE of going down to 12px is muted tone,
non-negotiable. Size and tone at this step are ONE rank, not two choices. A narrow space is not a
semantic reason: if the text must keep the primary tone, it is important enough to stay a step up.

## `TYPESET-8` — a time marker is a muted subtitle, not a heading

**Situation.** Results are partitioned by day: "Today", "Yesterday", "16/08/2026". That label
QUALIFIES the group of results directly beneath it.

**What it emits in source.** A 14px muted subtitle rendered OUTSIDE the list surface, with the surface
below told to hide its own label — so one group of results is never named twice at two different ranks.
No heading level, and not the joined surface's own label treatment.

**Boundary.** Not `TYPESET-1`: giving it a heading level WRONGLY PROMOTES every time marker into a
section of the page, and the page's outline grows with the data. Not `TYPESET-7`: it is muted but does
NOT drop to 12px, because it explains no line — it partitions a scan region.

## `TYPESET-9` — a body title's step follows the content owner

**Situation.** A choice between 16px medium and 14px medium for a title line that sits in the body, not
in the outline.

**What it emits in source.** 16px medium for a SHORT, DOMINANT title standing for an important object or
a large card; 14px medium for compact, repeated or long titles; 14px normal for their descriptions,
metadata and ordinary values. The evidence for the split is the ratio on the surface — one dominant
prompt at 16px medium against roughly thirty compact titles at 14px medium.

**Boundary.** Not `TYPESET-1`: if it is in the outline, do not pick a body step — it is a heading. Not
`TYPESET-5`: descriptions, meta and ordinary values of that same object sit at 14px normal, not medium.
Hover may confirm a surface is clickable but does NOT promote the text inside it. A number can still be
just an ordinary value, and available space is not a semantic rank.

## Layer held

Which tier actually holds each code — a closed type, a lint rule, or only a reader.

| Code | Tier | What holds it |
|---|---|---|
| `TYPESET-1` | `enforced` | `no-heading-tag-outside-heading-component` in `@canon-fe` reports any `h1`–`h6` in a source file that is not the heading component itself |
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
