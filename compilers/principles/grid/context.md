# Grid

## LOADS

None.

## Record

You are given a plain request in prose — "filters on the left, results on the right" — and you return,
for every element that request implies, one situation code and one className. The request never states
a column count you may invent: the count follows from what the page has already promised, and from
whether the element you are naming is the field, a track container, or a child inside the tracks.

## Law

Columns are a promise the page makes once and then keeps everywhere: content lands on shared vertical
edges, so a reader can predict where the next thing begins before it has loaded. A column count is
therefore a property of the FIELD the page agreed on, not a preference a section may re-invent.

Two elements carry two different decisions and must not be the same element. The **field** owns the
measure and the outer margin — where content is allowed to exist. The **track container** owns how
many columns exist inside that measure. A **child** owns only what it claims from those tracks: one
column, several, or a deliberate escape.

**This is binding, not advisory.** Any region that lays out repeated peer items has a grid situation,
every child of a track container has a grid situation, and the page shell that bounds them has one
too. There is no size at which a layout is too small to be exempt: a two-up pair of summary tiles is
`GRID-1` for the same reason a catalogue is, and a hero image touching the viewport edge is `GRID-7`
whether it appears once or on every page. "It is only two boxes" is not an exemption — it is the
single most common place this rule gets skipped, and skipping it is how a codebase ends up with a
dozen unrelated column counts and no field at all.

## Situation codes

Every situation this module governs carries a code, `GRID-<index>`. The code names the SITUATION; the
className column names what that situation emits. They are not the same thing, and two of them emit
nothing.

| Code | Situation | className |
|---|---|---|
| `GRID-0` | Repeated peers that read along one direction; no column system is claimed | *no grid class* |
| `GRID-1` | A container fixing how many columns exist, per breakpoint | `grid grid-cols-2 lg:grid-cols-3` |
| `GRID-2` | A container letting the count fall out of a minimum item width | `grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]` |
| `GRID-3` | A container assigning fixed roles to named tracks | `grid grid-cols-[16rem_minmax(0,1fr)]` |
| `GRID-4` | The field: the outer margin and the measure the columns live inside | `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` |
| `GRID-5` | A child occupying exactly one column | *no placement class* |
| `GRID-6` | A child spanning several columns, or all of them | `col-span-2 lg:col-span-3` |
| `GRID-7` | A deliberate break-out past the field's margin | `col-span-full -mx-4 sm:-mx-6 lg:-mx-8` |

Codes `GRID-0` to `GRID-4` describe a CONTAINER or the field. Codes `GRID-5` to `GRID-7` describe a
CHILD placed in tracks. Read the axis first — "am I naming a container, the field, or a child?" — and
the set answers in one step.

`GRID-0` AND `GRID-5` ARE SITUATIONS THAT EMIT NOTHING. There is no `grid-cols-1`-by-default class for
a stacked list, and no `col-span-1` on an ordinary cell. Both codes exist because the absence of a
declaration is a decision someone made, and a decision with no name is a decision nobody can be shown
to have got wrong. Writing `col-span-1` claims a child negotiated with the grid when it accepted the
default; writing `grid grid-cols-1` claims a field has one column when it has none.

The field carries one column count per breakpoint, and a `GRID-1` count must divide it:

| Breakpoint | Field columns | Counts a container may declare |
|---|---|---|
| base | 4 | 1, 2, 4 |
| `sm` / `md` | 8 | 1, 2, 4, 8 |
| `lg` and above | 12 | 1, 2, 3, 4, 6, 12 |

The ladder is 4 / 8 / 12, following the Material layout grid rather than the Carbon 2x grid's
4 / 8 / 16, for one reason that is checkable rather than aesthetic: 12 divides by 2, 3, 4 and 6, so a
three-up row lands on field edges; 16 does not divide by 3, so every three-up row inside it is either
fractional or off-field. A count outside its row of this table — `grid-cols-5`, `grid-cols-7`,
`lg:grid-cols-9` — is a rule change, not a layout choice.

## Reading a request

1. **List the elements the request states.** "Filters on the left, results on the right, each result a
   card no narrower than 16rem" states the region holding the two roles, the region holding the cards,
   and one card.
2. **Do not invent an element the request never mentions.** A page header, a pagination row or a hero
   band is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first** — the field, then each track container, then each child. An element
   never inherits its parent's code, and a container never inherits its child's.
4. **For each element, read the axis, then ask that code's question.** Am I naming a container, the
   field, or a child? Inside the axis, the first code whose situation matches is the answer.
5. **If one element carries two decisions, split it before choosing.** A node that owns both
   `mx-auto max-w-*` and `grid-cols-*` is a field and a container fused together; make it two nodes and
   resolve each. If two adjacent codes both match, choose the one that declares less: `GRID-0` over
   `GRID-1`, `GRID-5` over `GRID-6`, `GRID-6` over `GRID-7`.

## `GRID-0` — no column system; flow is enough

**Situation.** Items repeat, but they are read along ONE direction only. Nobody needs the item in the
lower row to align with the item above it, because "row" is not a concept this block has.

**Recognition signs**

- A stacked list, an activity feed, a timeline, a navigation menu.
- A row of chips or tags that wraps when it runs out of room: there are lines, but no columns, because
  each item is as wide as its own content.
- Adding or removing one item does not disturb the layout of the others.
- Item width is a consequence of content or of the parent, not a decision.

**Ask yourself.** Must an item in a later row line up on a vertical edge with an item in the row
above? If not — `GRID-0`.

**Boundary**

- `GRID-1`: `flex flex-wrap` produces lines but not columns. Three cards of differing widths that wrap
  are `GRID-0`; three cards forced to be equal and aligned are `GRID-1`.
- `GRID-2`: `GRID-2` also lets the count fall out, but it HAS columns: every item shares an equal
  track and the lower row aligns with the upper one.
- `GRID-4`: a list still sits inside the field. `GRID-0` speaks about the inside of the list, not
  about the outer margin.

**Never write `grid grid-cols-1`.** One column is not a column system — it is flow. Declaring
`grid-cols-1` claims the field has one column when it has none.

## `GRID-1` — fix the column count

**Situation.** The design PROMISES a number: two-up on mobile, three-up on desktop. The number of
items is known in advance, or has been cut to fit that number, and the reader is allowed to rely on
that rhythm.

**Recognition signs**

- The count is spoken aloud in the request: "three cards in a row".
- The items are interchangeable — same kind, same role.
- Item width is a CONSEQUENCE of the count, not its cause.
- Adding a fourth item wraps to the next line, and that is acceptable.

**Ask yourself.** Is the count a promise the design made, or a consequence of an item not being
allowed below some width? A promise — `GRID-1`.

**Boundary**

- `GRID-0`: see above. No alignment requirement means no columns.
- `GRID-2`: if nobody can state the number, only "do not let the card get narrower than 16rem", the
  number is derived — `GRID-2`. Fixing a count there is a guess.
- `GRID-3`: if the children are NOT interchangeable — the first track is always filters, the second
  always results — the tracks have fixed roles, `GRID-3`.

**The count must divide the field.** `grid-cols-5` and `lg:grid-cols-7` are not on the ladder; they
push every item off the field's edges and turn the field into decoration.

## `GRID-2` — the count falls out of a minimum item width

**Situation.** The number of items comes from DATA, and the only thing the design can state is that an
item below some width stops being readable. The count is what drops out afterwards, not what is chosen
first.

**Recognition signs**

- The number of items changes by account, by filter, by page.
- The request speaks in WIDTH, not in COUNT.
- The same block is embedded in several places of differing width without being re-authored.
- A last row with fewer items must still look right.

**Ask yourself.** If tomorrow the data returns seventeen items instead of six, does anyone have to
edit a class? If not — `GRID-2`.

**Boundary**

- `GRID-1`: see above. This is the most frequently mis-chosen boundary, because `grid-cols-3` LOOKS
  right on the screen of the person who wrote it.
- `GRID-0`: `GRID-2` still aligns on vertical edges; `flex flex-wrap` does not.
- `GRID-3`: `GRID-2` has identical tracks; `GRID-3` has tracks with different roles.

**`auto-fill` or `auto-fit`.** `auto-fill` keeps the tracks even when items are missing, so the last
row does not stretch. `auto-fit` collapses empty tracks, so a single item swells to the full width.
Choose `auto-fill` when the grid must keep its rhythm on thin data, `auto-fit` when one item is allowed
to take the whole row.

## `GRID-3` — tracks with fixed roles

**Situation.** The tracks are NOT interchangeable. One side is a rail, the other is content; one side
is a canvas, the other an inspector. A track's width is a layout decision, not a division.

**Recognition signs**

- At least one track has a fixed or bounded width (`16rem`, `minmax(0,1fr)`).
- Adding a third child to this container is WRONG, not "wrapping".
- Each side can be pinned, scrolled on its own, or disappear on a narrow screen.
- Swapping the two children makes the page read wrongly, not merely look worse.

**Ask yourself.** If the two children swapped places, would the page still mean what it means? If not
— `GRID-3`.

**Boundary**

- `GRID-1`: `GRID-1` has children that substitute for one another; `GRID-3` does not.
- `GRID-2`: `GRID-2` has uniform tracks generated in bulk; `GRID-3` has tracks named one by one.
- `GRID-0`: a rail that stacks below the content on mobile is STILL `GRID-3`. Responsive behaviour
  does not change the code.

**`minmax(0,1fr)`, not `1fr`.** A `1fr` track has a default min-width of `auto`, so content that
cannot shrink — a wide table, a code block — swells the track and eats the rail. This is a runtime
fault, not an aesthetic one.

## `GRID-4` — the field: outer margin and measure

**Situation.** One element decides WHERE CONTENT IS ALLOWED TO EXIST: it centres, caps the maximum
width, and sets the outer margin. It says nothing about how many columns there are.

**Recognition signs**

- `mx-auto` plus a `max-w-*`.
- Horizontal padding that changes by breakpoint — that padding IS the outer margin.
- Every section of the page sits inside it and does not re-declare a `max-w` of its own.
- Remove it and the text runs the full width of a 27-inch screen.

**Ask yourself.** Is this element deciding WHERE CONTENT ENDS, or HOW MANY COLUMNS there are? Where it
ends — `GRID-4`.

**Boundary**

- `GRID-1`, `GRID-2`, `GRID-3`: the field declares no tracks. One node carrying both
  `max-w-6xl mx-auto px-4` and `grid grid-cols-3` is carrying two decisions; split it into two nodes.
- `GRID-7`: a break-out is one step outside and back again. A wider field is still a field.

**The outer margin is never smaller than the gutter.** With `gap-6` and only `px-4`, the outermost
column sits closer to the screen edge than the columns sit to each other, and the reader sees the grid
as crooked without being able to say why.

**The gutter value is not chosen here.** It belongs to the seam module. What this module owns is: ONE
field, ONE gutter per breakpoint, and the gutter is the only horizontal space between columns.

## `GRID-5` — one child, exactly one column

**Situation.** A child ACCEPTS the track the container hands it. It negotiates nothing. This is the
most common situation in the whole module, and the one most often over-declared.

**Recognition signs**

- No placement class on the child at all.
- Its width is decided by the container, not by itself.
- Move it into another container and it fits without edits.

**Ask yourself.** Does this child CLAIM anything from the grid? If not — `GRID-5`, and write nothing.

**Boundary**

- `GRID-6`: `GRID-6` claims more than one column. A claim must be spoken with `col-span-*`.
- `GRID-7`: `GRID-7` leaves the field's margin. `GRID-5` never leaves its track.

**Never write `col-span-1`.** Claiming nothing is the ABSENCE of a claim, not a claim of one.
`GRID-5` is a situation code, not a CSS class name. The one exception is a real rung: `col-span-1` at a
breakpoint that cancels a span declared at another, as in `col-span-2 lg:col-span-1`, which is part of
a `GRID-6` ladder.

**`min-w-0` is not a placement class.** It stops non-shrinking content — tables, code blocks, long
strings — from swelling the track. A `GRID-5` with `min-w-0` is still `GRID-5`.

## `GRID-6` — one child spanning several columns

**Situation.** A child is MORE IMPORTANT or WIDER than the rest, and it says so with the number of
columns it takes — not with a width of its own.

**Recognition signs**

- The first item of the grid is the featured item and the rest are ordinary.
- A chart needs horizontal room to be readable while the tiles beside it do not.
- A heading row or an empty state must occupy the full width of the grid.
- The number of columns claimed changes by breakpoint, but the role does not.

**Ask yourself.** Does this child claim MORE THAN ONE column of the grid that contains it?

**Boundary**

- `GRID-5`: see above.
- `GRID-7`: `col-span-full` still stays INSIDE the field's margin. Only when it continues past that
  margin is it `GRID-7`.
- `GRID-3`: if EVERY child has its own fixed span, what you are building is role-bearing tracks —
  declare `GRID-3` on the container instead of scattering spans across the children.

**Never fake a span with width.** `w-2/3` or `basis-2/3` on a grid child does not give it two columns;
it gives it two thirds of ONE column, and everything below it goes off-edge. A span must also not
exceed the count at that breakpoint: `col-span-3` inside a two-column base is silently clamped to two,
so a responsive span needs every rung — `col-span-2 lg:col-span-3`.

## `GRID-7` — a deliberate break-out past the field

**Situation.** A block MUST touch an edge — either the field's margin or the viewport's — while
everything before and after it still respects the margin. This is a DECLARED exception, not a
work-around.

**Recognition signs**

- The block has a coloured or image background, and the gap on either side of that background reads as
  a bug.
- A horizontally scrolled rail must "run off" the edge so the reader knows there is more to the right.
- Before and after the block, content returns to exactly the old margin.

**Ask yourself.** Must this block touch the edge to say what it means, or does it just want to be a bit
wider? Just a bit wider is a mis-sized `GRID-4`, not a `GRID-7`.

**Boundary**

- `GRID-6`: `col-span-full` spans all the COLUMNS; `GRID-7` leaves the MARGIN.
- `GRID-4`: if the whole page needs to be wider, fix the field; do not let individual blocks break out.

**The break-out is granted by the field, not taken by the child.** A `-mx-*` is correct only when it
cancels EXACTLY the field's padding at the SAME breakpoint. A child three levels down writing `-mx-8`
is guessing its ancestor's padding. A break-out must be a direct child of the field, or must take
`col-span-full` first and only then leave the margin.

**A full-viewport break-out has a price.** `w-screen` is `100vw`, and `100vw` COUNTS THE SCROLLBAR, so
on a browser where the scrollbar takes space it creates horizontal overflow. To use it, an ancestor
must accept `overflow-x-clip`, and that is a decision of the page, not of the block. Inside the
break-out, the field is re-declared so the text stays on the measure: the break-out belongs to the
background, not to the content.

## Inputs

| Input | Evidence required |
|---|---|
| field | The element owning the measure and the outer margin, and its column count per breakpoint |
| container | The element declaring tracks, and whether it is the field itself |
| item source | Whether the number of items is authored or comes from data |
| item role | Whether children are interchangeable or each track has a named role |
| alignment | Whether items in successive rows must share a vertical edge |
| geometry | Which element decides width, and which merely fills what it is given |

## Rules

1. The field owns the measure and the outer margin; the container owns the tracks. **One node does not
   hold both.**
2. A declared column count divides the field's count at that breakpoint.
3. The gutter is the only horizontal space between columns; a column adds no horizontal margin of its
   own to create separation.
4. The gutter value belongs to the seam module; this module holds only the rule of ONE field, ONE
   gutter per breakpoint.
5. The outer margin is never smaller than the gutter.
6. Every child of a track container resolves to exactly one of `GRID-5`, `GRID-6`, `GRID-7`.
7. A child never sets its own `width` or `basis` to imitate a span.
8. Changing the count at a breakpoint does NOT change the code.
9. When two adjacent codes both remain reasonable, choose the one that declares less: `GRID-0` over
   `GRID-1`, `GRID-5` over `GRID-6`, `GRID-6` over `GRID-7`.

Beyond these: a situation code maps to exactly one className shape, and no className shape serves two
codes.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it applies
to.

- **Tables.** A `<table>` runs its own column algorithm. To this module it is a SINGLE child —
  `GRID-5` or `GRID-6` — and its internal columns are outside scope.
- **Reading measure.** Long-form prose is capped by legibility, not by the field count. A narrower
  measure nested inside the field is a second `GRID-4`, and it is the only nested field allowed.
- **Exactly one item, forever.** A container that renders one thing and always will is `GRID-0`, not
  `GRID-1` with a count of one.
- **Unknown item count.** When the number of items comes from data and the design states only how
  narrow an item may get, the situation is `GRID-2`, and declaring a fixed count is a guess.
- **Scrolling rail.** A horizontally scrolled row is `GRID-2` along its scroll axis; if it also reaches
  past the field's margin it carries `GRID-7` as a child at the same time. Two codes, two elements,
  never two codes on one element.
- **State parity.** Skeleton, empty state and real content share one code. A grid that changes its
  count while empty lies about the column system, and the user sees the layout jump exactly when the
  data arrives.
- **Responsive.** Change the code only when the layout ROLE actually changes, not because the screen
  narrowed. A rail that stacks on mobile is still `GRID-3`.
- **Print and email.** The field still exists; only the measure differs. Dropping the field in a print
  stylesheet is dropping the rule, not adapting to the medium.
- **Two adjacent codes both match.** Choose the one that declares less. Ask ONE discriminating question
  only when the requester explicitly requires the stronger claim.

## Output

One block per element, outermost first. The `child` key appears only when the situation is a child
situation:

```text
field: <measure owner, outer margin, field count at this breakpoint>
container: <track owner>
child: <the element being placed, when the situation is a child>
situation: <GRID-0 | GRID-1 | GRID-2 | GRID-3 | GRID-4 | GRID-5 | GRID-6 | GRID-7>
className: <no class | grid-cols-* | named tracks | measure | col-span-* | break-out>
reason: <business fact that excludes the adjacent code>
```
