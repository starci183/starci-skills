---
title: Responsive
---

# Responsive

## LOADS

None.


## Record

You are given a plain request in prose — "a filter rail beside the results, and the results are
cards" — and you return, for every region that request implies, one situation code and one className.
The request never states a breakpoint and you never estimate one: the transformation follows from the
content failure that was actually observed, and the threshold is the width at which it was observed.

## Law

A layout changes geometry at the first point its content fails, and it changes by the smallest
transformation that repairs that failure. Choose the transformation from the observed failure, never
from a screen name, a device photograph or a wish for the layout to "look more mobile".

The component that owns the geometry owns the responsive classes. Callers do not reach in and patch a
child's breakpoints, because a breakpoint written from outside is a breakpoint written without the
measurement that justifies it.

Across every width the render keeps **one** source order, **one** reading order, **one** focus order
and **one** set of reachable tasks. Responsive changes where things sit. It does not change what the
screen is for, what it says, or what a person can do on it.

**This is binding, not advisory.** Every rendered region falls under exactly one code below,
including the regions that need no class at all — those are `RESPONSIVE-1`, and `RESPONSIVE-1` is a
decision that must be defensible, not a place where the rule was skipped. There is no composition too
small to have a responsive situation: a two-button action row has one for the same reason a page
shell with a filter rail has one. "It is only a couple of buttons" is the most common place this law
gets dropped.

## Situation codes

Every situation this module governs carries a code, `RESPONSIVE-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and one
of them emits nothing.

The codes are ordered by how invasive the repair is, which is also the order a reader meets them: a
reader first asks whether anything is broken, then reaches for the cheapest repair and stops at the
first one that works.

| Code | Situation | className |
|---|---|---|
| `RESPONSIVE-1` | Nothing fails at any supported width; the base layout already holds | *no responsive class* |
| `RESPONSIVE-2` | Inline peers still belong on one run but need more than one line | `flex flex-wrap` |
| `RESPONSIVE-3` | A row stops being usable, and the same participants in the same order work as a vertical sequence | `flex flex-col sm:flex-row` at the tested threshold |
| `RESPONSIVE-4` | Repeated peer items need fewer tracks as width falls | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` at tested thresholds |
| `RESPONSIVE-5` | Content whose meaning IS its horizontal arrangement cannot reflow at all | owner `max-w-full overflow-x-auto`; child `min-w-max` |
| `RESPONSIVE-6` | A persistent region becomes an equivalent, reachable compact control | paired `hidden md:block` and `md:hidden`, one state, one focus path |

`RESPONSIVE-1` IS A SITUATION, NOT A TRANSFORMATION. It emits no class, and it must not be expressed
by writing a breakpoint that restates the base — `sm:flex-row` on something that is already a row,
`lg:grid-cols-3` on a grid already at three, `md:block` on a visible block. Those claim a width
mattered when no width mattered. The code exists because "nothing fails here" is a case a reader must
be able to recognise, cite and be corrected against; a situation with no name is a situation nobody
can be shown to have got wrong.

The breakpoint prefixes in the table (`sm:`, `md:`, `lg:`) are placeholders for a MEASURED threshold,
not part of the answer. The prefix that ships is the one at which the content was observed to stop
working. A prefix chosen because a device is called a tablet is a fabricated number wearing a utility
class.

## Reading a request

1. **List the regions the request states.** "A filter rail beside the results, and the results are
   cards" states three: the page shell holding rail and results, the results column, and the card
   list inside it.
2. **Do not invent a region the request never mentions.** A card interior, a footer or a table is not
   in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested owner. Every owner gets its own answer; an owner
   never inherits its child's code, and a threshold belongs to the container, not to the viewport.
4. **For each owner, name the direct participants and the observed failure**, then ask the question
   in the section for each code, starting at `RESPONSIVE-1` and stopping at the first code whose
   situation matches. The cheapest repair that removes the failure is the answer.
5. **If no failure was observed, the answer is `RESPONSIVE-1`.** A missing measurement is not a
   licence to guess: a grid with no tested minimum item width falls back to one column.
6. **If one owner mixes situations, nest before choosing.** If two adjacent codes both match, choose
   the smaller index.

## `RESPONSIVE-1` — nothing fails

**Situation.** At every supported width there is no collision, no clipping, no control below its
usable hit size, no text pushed outside its box. The base layout — already written for the narrowest
state — is correct on its own. This region owns no transformation.

**Recognition signs**

- Narrow the viewport to the narrowest supported width and nothing breaks.
- The content already wraps on its own, or is already a single column.
- The only request heard is "make it responsive" or "make it look more mobile", and nobody can name
  what fails.
- The reported cramping is actually a long line of text inside a flex child, repaired by `min-w-0`
  rather than by a breakpoint.

**Ask yourself.** At the narrowest supported width, WHAT is failing? If it cannot be named — stop,
this is `RESPONSIVE-1`.

**Boundary**

- `RESPONSIVE-2`: rise to `2` only after peers have been SEEN to collide or overflow, not on a
  prediction that one day they will.
- `RESPONSIVE-3`: a tight row is not yet a broken row. Broken means a participant has fallen below
  its usable width, or is being clipped.
- Every other code: absent evidence, this code is the answer. It is the safe default of the whole
  module.

**Never write an empty breakpoint.** `sm:flex-row` on something already a row, `lg:grid-cols-3` on a
grid already at three, `md:block` on a visible block — each claims a width mattered when none did.
`RESPONSIVE-1` is a situation code, not a class name.

**Common business situations.** A single reading column · a one-column form · a block of prose · a
lone card · an empty state with one line and one button · short dialog content · a status label
cluster · a short breadcrumb · a dashboard holding one already-fluid chart.

## `RESPONSIVE-2` — still one run, it just needs more lines

**Situation.** The participants are inline peers: nothing requires them to share one line, their
count may be unknown in advance, and the last one falling to the next line costs no meaning. The run
is still one run; it simply grows downward.

**Recognition signs**

- The count is decided by data: tags, filter chips, labels, authors, skills.
- Label length changes with language or with user-entered data.
- Moving one item off the first line makes nobody misread anything.
- No participant is the "left side" or the "right side" of a two-sided relationship.

**Ask yourself.** If the last item drops to the next line, does anyone misread anything? If not —
`RESPONSIVE-2`.

**Boundary**

- `RESPONSIVE-1`: `2` requires an OBSERVED overflow, not a forecast.
- `RESPONSIVE-3`: `3` is a two-sided relationship (a heading and its actions, an input and its
  button) where both sides change axis at once. `2` is many equal peers finding their own place. If
  you have to ask which side drops first, it is `3`.
- `RESPONSIVE-4`: `4` is for repeated items with a measured minimum width that must stay in aligned
  tracks. Where alignment does not matter, `2` is cheaper and truer.
- `RESPONSIVE-5`: if the horizontal position of the items IS the information — chronology,
  comparison columns — wrapping destroys meaning, and that is `5`.

**Common business situations.** A tag list · active filter chips · a secondary button group in a
toolbar · metadata under a title (author · date · duration · level) · a skills list on a profile · an
order's status labels · share buttons · a participant list of avatar plus name · a cluster of
certificate status labels.

## `RESPONSIVE-3` — the row stops working, the stack still reads right

**Situation.** Two (or a few) groups form a two-sided relationship on one row. As width falls, at
least one side drops below its usable width — text clipped, an input down to a few characters,
buttons overlapping. The same sides, in the same order, still read correctly stacked.

**Recognition signs**

- Each side can be named: "the heading cluster" and "the action cluster"; "the input" and "the submit
  button".
- In the narrow state, reading top to bottom tells the same story as reading left to right when wide.
- No side disappears, and no side changes priority.
- Only the AXIS changes. Gap between the sides, padding and hierarchy all stay as they were.

**Ask yourself.** Is it still the same sides in the same order once stacked? If the order has to be
reversed to make sense — STOP: that is a task redesign, not a responsive change.

**Boundary**

- `RESPONSIVE-2`: see above. `2` has no concept of a "side".
- `RESPONSIVE-4`: `3` is DIFFERENT sides changing axis; `4` is IDENTICAL items changing track count.
  A heading beside its actions is `3`; twelve course cards are `4`.
- `RESPONSIVE-6`: `3` keeps both sides visible and only changes axis. If one side DISAPPEARS and is
  replaced by another control, that is `6`, and `6` must pay its own conditions.

**Common business situations.** A page header with title and description on the left and buttons on
the right · a discount code input plus its apply button · a search bar plus a filter button · a
dialog footer with Cancel and Confirm · an invoice summary row with the plan name on the left and the
price on the right · a price block plus an enrol button · an avatar, name and follow button cluster.

## `RESPONSIVE-4` — repeated items need fewer tracks

**Situation.** A set of same-kind, peer, repeated items, each with a MEASURED minimum width below
which it stops being readable or usable. As the container narrows, the track count falls. The order
of the items does not change; only the number of tracks does.

**Recognition signs**

- The items are rendered from a loop over one kind of data.
- Every item has the same internal structure and the same role.
- Column and row alignment between items means something to the reader — it is what makes comparison
  and scanning possible.
- You have a real number for "narrower than this and the item is unreadable".

**Ask yourself.** Are these repeated identical items, and do you have a measured minimum width for
one item? Without that number, do not invent a threshold — stay at one column.

**Boundary**

- `RESPONSIVE-2`: wrapping would also fit them, but wrapping does not align columns. If the reader
  needs to compare across items, `4`; if they only need to read them all, `2` is cheaper.
- `RESPONSIVE-3`: see above.
- `RESPONSIVE-5`: if the HORIZONTAL ORDER of the items is information — timeline milestones, the
  columns of a comparison — then falling to the next line destroys meaning, and that is `5`.

**Common business situations.** A course card grid · a product grid · an image gallery · a grid of
metric tiles · an article list as cards · a team member grid · pricing plans side by side · an
exercise grid · a file list as tiles.

## `RESPONSIVE-5` — the meaning is in the horizontal arrangement

**Situation.** Content whose relationship between parts IS their horizontal position: the columns of
a table, the milestones on a timeline, the nodes and connectors of a diagram. Wrapping or stacking is
not a rearrangement, it is an erasure of information. So the region scrolls horizontally — but it
scrolls INSIDE ITS OWNER, and the page never scrolls horizontally.

**Recognition signs**

- You can point to a sentence the user reads BECAUSE of the alignment: "this column against that
  one".
- Dropping a column, or pushing it to the next line, loses a comparison.
- The content has an intrinsic width: a table, a diagram, a line of code, a musical stave, a Gantt
  chart.

**Ask yourself.** If this were reflowed onto another axis, would a comparison DISAPPEAR? The answer
must be yes, with a concrete example, before this code may be used.

**Boundary**

- `RESPONSIVE-2` and `RESPONSIVE-4`: this is the LAST code to be chosen, not the most convenient one.
  Horizontal scrolling makes the user do extra work; pay that price only when reflow genuinely
  destroys meaning.
- `RESPONSIVE-6`: if the plan is to HIDE some columns when narrow, this is no longer `5`. Hiding
  content must pass the conditions of `6`, and essential data columns may not be hidden at all.

**Intrinsic width, not a hard number.** The child inside the scroll region uses `min-w-max` — the
content declares its own width. A hard number (`min-w-[720px]`) or a project-private variable is a
guess, and it is wrong the moment the language changes or the data grows longer.

**Common business situations.** A many-column data table · a plan comparison table · a timeline with
milestones and connectors · an architecture diagram · a Gantt chart · a weekly calendar · a code
block with long lines · a benchmark results table.

## `RESPONSIVE-6` — a persistent region becomes an equivalent control

**Situation.** At large widths a persistent region is always visible (a filter rail, an expanded
navigation, a side pane). At narrow widths that region has no room, and it is replaced by ONE compact
control that reaches the same content. This is the most expensive code, because it is the only one
that gives the DOM two representations of one job.

**Recognition signs**

- The region is a LAYOUT REGION with its own geometry, not a cluster of text.
- The replacement control can be named — a button that opens a pane, a menu button — and it ALREADY
  EXISTS; it is not something to be built later.
- Both representations read the SAME state: the same active filters, the same selected item.

**Ask yourself.** Is there EXACTLY ONE replacement control reaching the same task with the same
state, and does focus return to the right place on close? Missing any of the three — refuse this code
and keep the content visible.

**Boundary**

- `RESPONSIVE-3`: `3` keeps both sides visible and only changes axis. Use `6` only when stacking is
  GENUINELY unusable, not because it looks cluttered.
- "hide it to tidy up": hiding without an alternate path is NOT a code. It is a defect. Essential
  content is never hidden.

**Two representations, one state.** If each side keeps its own state, the user's filters "vanish" when
the device is rotated. The state lives in the owner and both sides only read it.

**Common business situations.** A vertical filter rail replaced by a "Filters · 3" button · a
horizontal navigation collapsed into a menu button · a side table of contents replaced by a "Course
content" button · a detail pane beside a list becoming its own detail page · a cart summary becoming
a pinned total bar at the bottom.

## Inputs

| Input | Evidence required |
|---|---|
| owner | The single component that owns the changing geometry |
| participants | The direct children whose arrangement changes |
| failure | `none`, `wrap-needed`, `row-unusable`, `tracks-too-narrow`, `horizontal-meaning`, `region-to-control` |
| minimum usable width | A measured or tested threshold per participant, not a device width |
| essential | Whether the content or task is required for the page's purpose |
| alternate path | `none`, or one named control that reaches the same task with the same state |
| states | That loading, empty, error and ready are the same owner |

Anything absent from this list is not admissible as a reason. Aesthetic density, a screenshot of a
phone, and the sentence "it feels cramped" select nothing.

## Rules

1. Base classes describe the narrowest supported state; every breakpoint is a min-width override
   added on top. There is no max-width thinking in this module.
2. A breakpoint marks a content failure. It never marks a device.
3. One DOM order, one reading order, one focus order, at every width. Responsive `order-*` is
   forbidden: it tells a second story the DOM does not tell, and screen readers and keyboards only
   ever get the first one.
4. Changing axis does not change gap, padding, hierarchy or meaning. A stack and a row of the same
   participants carry the same relationship, so they carry the same seam.
5. The geometry owner writes the responsive classes. Callers do not patch a child's internals.
6. Essential content is never hidden. Paired visibility is admissible only with an equivalent
   reachable path, shared state and a defined focus return.
7. Wrap or stack before shrinking anything. Text, hit targets and controls are never reduced below
   their usable size in order to preserve a line.
8. Loading, empty, error and ready use the same owner, the same tracks and the same anchors. A
   network state is not a layout.

Beyond these: a situation code maps to exactly one transformation, no transformation serves two
codes, and every rendered region resolves to exactly one code. No region is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies to.

- **No observed failure.** Without a collision, a clip or a demonstrated usability failure, the answer
  is `RESPONSIVE-1`: keep the base layout and add nothing. "Make it responsive" is not evidence.
- **No declared minimum item width.** Do not invent a grid threshold. `RESPONSIVE-4` without a tested
  minimum falls back to one column, which is the only track count that cannot be wrong.
- **Reflow not proven destructive.** `RESPONSIVE-5` requires proof that a new axis destroys the
  relationship. Where wrap or stack preserves meaning, `RESPONSIVE-2` or `RESPONSIVE-3` wins; bounded
  overflow is the last resort, not the convenient one.
- **No equivalent path.** Without one named control that reaches the same task with the same state,
  `RESPONSIVE-6` is refused and the content stays visible.
- **Overflowing text before overflowing layout.** A long title is repaired inside its own box first —
  `min-w-0`, wrapping, or truncation that keeps the full accessible value — before any code above
  `RESPONSIVE-1` is considered. Flex children default to a content-based minimum size, so a layout
  that "breaks at narrow widths" is very often one missing `min-w-0`, not one missing a breakpoint.
- **Two adjacent codes both match.** Choose the smaller index — the cheaper repair. Ask one
  discriminating question only when the requester explicitly demands the more invasive one without
  naming the failure that requires it.
- **State parity.** Skeleton, empty and error render inside the same owner with the same code as the
  loaded state. Changing the code while loading is a lie about the geometry.

## Output

One block per region, outermost first:

```text
owner: <component that owns the geometry>
participants: <direct children whose arrangement changes>
situation: <RESPONSIVE-1 | RESPONSIVE-2 | RESPONSIVE-3 | RESPONSIVE-4 | RESPONSIVE-5 | RESPONSIVE-6>
className: <no responsive class | exact base-first class string>
threshold: <measured failure width, or "none">
reason: <observed content failure that excludes the adjacent code>
```

## Worked example

**Request.** "A course catalogue: a filter rail beside the results. Above the results, a line saying
how many courses match and a sort control. Below that, the course cards. We measured that below `sm`
one card already fills the readable width, at `sm` two cards stay above their minimum, and inside the
results column three only fit from `xl`. When the rail has no room it becomes a Filters button that
opens the same filters, reads the same selection, and returns focus to the button on close."

The request states three owners: the page shell holding the rail and the results column, the summary
row above the results, and the card list. It states nothing about the interior of a card, nothing
about a footer and nothing about a table, so none of those are resolved.

```text
owner: catalogue page shell
participants: filter rail, results column
situation: RESPONSIVE-6
className: rail hidden lg:block; trigger lg:hidden
threshold: lg
reason: the rail disappears and one named button reaches the same filters with the same selection and a defined focus return, which excludes RESPONSIVE-3 — RESPONSIVE-3 would keep both sides visible
```

```text
owner: results summary row
participants: match count, sort control
situation: RESPONSIVE-3
className: flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
threshold: sm
reason: these are two different sides of one relationship changing axis together, not equal peers finding their own place, which excludes RESPONSIVE-2
```

```text
owner: results card list
participants: course card, course card, course card
situation: RESPONSIVE-4
className: grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3
threshold: sm and xl, measured inside the results column
reason: identical repeated items with a measured minimum width need aligned tracks for comparison, which excludes RESPONSIVE-2
```

Note the third block uses `xl:grid-cols-3` and not `lg:grid-cols-3`: inside the results column the
rail has already taken part of the available width, so the three-track threshold arrives later. The
threshold belongs to the container, not to the viewport.

The request states no failure inside a card, so a card interior is `RESPONSIVE-1` until one is
observed. If the request later adds a many-column progress table inside a card, that table is
`RESPONSIVE-5` — its owner takes `max-w-full overflow-x-auto` and the table takes `min-w-max`, which
is also what stops the scroll region from widening a grid track and pushing the whole page sideways.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
