# Alignment

## LOADS

None.

## Record

You are given a plain request in prose — "a settings row with a label and a toggle" — and you return,
for every container that request implies, one situation code per axis and one className. The request
never states an alignment and you never estimate one: alignment follows from what the children ARE,
never from where they should appear to sit.

## Law

Children of unequal measure must hang from something. Alignment states WHAT — a shared cross measure,
a middle, a leading edge, a trailing edge, or a writing line — and it is chosen from the nature of the
children, never from where they should appear to sit.

A container answers two independent questions. Across the direction the run flows, the **cross axis**
decides what the children hang from. Along the direction the run flows, the **main axis** decides
where the run sits and who receives the space nobody claimed. Neither answer implies the other, and
neither is optional: a container that declares nothing has answered both with the defaults, and the
defaults are decisions with consequences — stretch makes a bordered child grow a boundary it did not
earn, and start-packing hands every surplus pixel to the trailing edge.

**This is binding, not advisory.** Every flex and grid container falls under exactly one cross-axis
code and exactly one main-axis code below, including the containers that emit nothing. There is no row
too small to have both: an icon beside a label is `ALIGN-1` for the same reason a page shell beside a
rail is `ALIGN-0`. "It already looks right" is not an exemption — it is the most common place this
rule gets skipped, because alignment is the one decision whose breach is invisible until the data
changes. Two children of equal height align identically under every code in this module. They stop
doing so the day one of them wraps to a second line.

## Situation codes

Every situation this module governs carries a code, `ALIGN-<index>`. The code names the SITUATION; the
className column names what that situation emits. They are not the same thing, and two of them emit
nothing.

The codes are numbered in the order a reader meets them: the cross axis first, because it is the
question this module takes over; the per-child departure immediately after the rule it departs from;
the main axis next; and the wrapped-line case last, because it only exists once a container has been
given a cross size it must justify.

**Cross axis — what the children hang from.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-0` | The children share one cross measure; each fills the line | *no alignment class* |
| `ALIGN-1` | Children of unequal cross measure must read as one line | `items-center` |
| `ALIGN-2` | Each child owns its own cross length and they must begin together | `items-start` |
| `ALIGN-3` | Each child owns its own cross length and they must end together | `items-end` |
| `ALIGN-4` | Text of different sizes must sit on one writing line | `items-baseline` |
| `ALIGN-5` | One child departs from the rule its parent declared | `self-*` |

**Main axis — where the run sits and who receives the leftover space.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-6` | The run begins at the content edge; surplus falls after it | *no alignment class* |
| `ALIGN-7` | The whole run belongs at the far end of its own direction | `justify-end` |
| `ALIGN-8` | The run belongs to no edge and sits in the middle of the surplus | `justify-center` |
| `ALIGN-9` | The surplus belongs BETWEEN the children, by opposed or equal claim | `justify-between` · `justify-around` · `justify-evenly` |

**Wrapped lines — what the lines hang from, once there are several.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-10` | The container wraps into several lines and owns cross space they do not fill | `content-*` |

`ALIGN-0` AND `ALIGN-6` ARE SITUATIONS, NOT ABSENCES. There is no `items-stretch` or `justify-start`
to write in ordinary work, and adding one states nothing the default did not already state. The codes
exist because a default that nobody named is a default nobody can be shown to have chosen wrongly —
and stretching is the single most consequential default in this module, because it silently resizes
children that own a background, a border or a fill.

`ALIGN-5` is the only code carried by a child rather than by the container. It exists so that a
departure is legible as a departure: the container keeps its declared rule, and exactly one child says
out loud that it is not bound by it.

## Reading a request

1. **List the containers the request states.** "A settings row with a label and a toggle" states one:
   the row that holds the label and the toggle.
2. **Do not invent a container the request never mentions.** A card around the row, a heading above it
   or a second row is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **For each container, decide whether it is a container at all.** An alignment class is legal only
   on an element that declares `flex`, `inline-flex` or `grid`. If the request implies no such
   element, this module emits nothing for it.
4. **Name the direction the run flows**, because that decides which axis is cross. A row flowing
   horizontally has a vertical cross axis; a column flowing vertically has a horizontal one. The same
   class name means two different things depending on the flow direction.
5. **Resolve outermost first**, then each nested container. Every container gets its own two answers;
   a container never inherits its child's code.
6. **Answer the cross axis once by asking each cross code's question**, in order. The first code whose
   situation matches is the answer. Then name any single child that departs, `ALIGN-5`.
7. **Answer the main axis once the same way**, then ask whether the container wraps and owns surplus
   cross space, which is `ALIGN-10`.
8. **If two codes both match, decide from what the children ARE, not from what today's data renders.**
   If one container mixes situations — some children must stretch and others must not — the container
   has one rule and one departing child, or the rule itself is wrong and the children must be nested.

## `ALIGN-0` — one shared cross measure, nothing declared

**Situation.** The children do NOT own a cross measure of their own, or they must all take the measure
of the longest one. This is the default of flex and grid, and the great majority of containers are
correct here.

**Ask yourself.** If the tallest child grew taller, SHOULD the rest grow with it?

**Boundary**

- `ALIGN-2`: when the children happen to be equally tall, the two codes render identically.
  Distinguish by BOUNDARY OWNERSHIP: a child with a background, a border or a shadow that gets
  stretched becomes a box larger than its content — at that point it is no longer `ALIGN-0`.
- `ALIGN-1`: a 16px icon stretched to the height of a two-line paragraph is the sign that `ALIGN-0`
  was used by mistake. An icon owns its own size and must not be stretched.

**Never write `items-stretch`.** It states nothing the default did not already state. `ALIGN-0` is a
SITUATION code, not a CSS class name.

## `ALIGN-1` — unequal measures reading as one line

**Situation.** The children own their own cross measure and NONE of them should be stretched. Together
they form ONE line the eye reads in a single pass.

**Ask yourself.** Is any child a drawing or a fixed box that stretching would make wrong?

**Boundary**

- `ALIGN-4`: `ALIGN-1` hangs from the MIDDLE OF THE BOX; `ALIGN-4` hangs from the WRITING LINE. If
  EVERY child is text and the reader reads them as one value or one sentence — use `ALIGN-4`. One
  drawing among them sends it back to `ALIGN-1`.
- `ALIGN-2`: `ALIGN-1` holds only when the text is CERTAIN to be one line. If a name, a title or a
  description can reach a second line — that is `ALIGN-2`, even while today's data is short.
- `ALIGN-0`: `ALIGN-0` is children TAKING one measure; `ALIGN-1` is children KEEPING their own measure
  and meeting in the middle.

## `ALIGN-2` — each child owns its length and they begin together

**Situation.** At least one child can GROW along the cross axis, and the beginning of the children is
where the eye anchors. Hanging from the middle makes the fixed children DRIFT every time the long one
changes length.

**Ask yourself.** If the longest child doubled in length, may the fixed child DRIFT DOWN with it? If
not — `ALIGN-2`.

**Boundary**

- `ALIGN-1`: decide by the ABILITY TO GROW, not by today's data. A person's name that is one line
  today and one and a half lines tomorrow is `ALIGN-2` from the start.
- `ALIGN-0`: `ALIGN-2` KEEPS each child's natural measure; `ALIGN-0` ERASES it. On a child with a
  border or a background the difference is visible at once.
- `ALIGN-3`: both are "one edge", but `ALIGN-2` anchors where the content BEGINS and `ALIGN-3` anchors
  where it ENDS.

## `ALIGN-3` — each child owns its length and they end together

**Situation.** The TRAILING edge is the edge that carries meaning. In a COLUMN this is how a cluster
packs toward the end of reading order. In a ROW this is children standing on one shared floor.

**Ask yourself.** Is what the reader compares between children where they END, or where they BEGIN?

**Boundary**

- `ALIGN-4`: in a ROW, `items-end` is almost always `items-baseline` written by mistake. Descenders
  (`g`, `y`, `p`) and the padding of the text box mean "same box bottom" is NOT "same writing line".
  If the children are text — use `ALIGN-4`.
- `ALIGN-2`: in a COLUMN the two codes are opposite edges. Choose by which edge carries the
  comparison.
- `ALIGN-7`: `ALIGN-3` is the CROSS axis, `ALIGN-7` is the MAIN axis. In a column, packing the
  children to the trailing edge is `ALIGN-3`; pushing the whole run to the bottom is `ALIGN-7`.

## `ALIGN-4` — text of different sizes on one writing line

**Situation.** Two or more pieces of text of DIFFERENT SIZES must be read as ONE VALUE or ONE SENTENCE.
This is the code that makes a number and its unit read as one thing rather than two.

**Ask yourself.** Read the whole row aloud: is it ONE phrase, or two separate pieces of information?

**Why not `ALIGN-1`.** `items-center` hangs the children from the CENTRE OF THEIR TEXT BOXES. The text
box of the smaller size is shorter than that of the larger, so when the two centres meet, THE TWO
BASELINES DO NOT. The eye follows the baseline, not the box centre — so the cluster reads as two
things. `items-baseline` puts them on one foot, and the cluster becomes one value again.

**Boundary**

- `ALIGN-1`: if ANY child is an icon, an avatar, a filled status pill or a colour swatch — go back to
  `ALIGN-1`. The only exception is when the "icon" is in fact a text character.
- `ALIGN-3`: same box bottom is not the same writing line. See above.
- `ALIGN-2`: if one child is a multi-line passage, the shared writing line is only its FIRST line —
  right when it is a continuing sentence, wrong when it is a block of its own.

## `ALIGN-5` — one child departs from its parent's rule

**Situation.** The parent declared a rule that is right for MOST of its children, and EXACTLY ONE
child has a business reason not to follow it.

**Ask yourself.** With this child removed, is the parent's rule still right for ALL the rest? If yes —
`ALIGN-5`. If no — fix the parent's rule.

**Boundary**

- every cross-axis code: `ALIGN-5` does NOT replace the parent's answer; it exempts one child. The
  parent still carries its own code, legible and declared.
- `ALIGN-7`: one child pushing ITSELF to the far end on the MAIN axis is not this module's business.
  That is a child using auto margin to push itself, and it belongs to the margin rule.

## `ALIGN-6` — the run begins at the content edge, nothing declared

**Situation.** The content belongs to the LEADING edge of the reading flow, and the surplus falls
behind it. This is the default and the right answer for the great majority of rows.

**Ask yourself.** Does the surplus space MEAN anything? If not — let it fall behind and declare
nothing.

**Boundary**

- `ALIGN-9`: see `ALIGN-9`. This is the most frequently crossed boundary in the whole module.
- `ALIGN-8`: content that belongs to the reading edge stays at the reading edge. Only content that
  belongs to NO edge goes to the middle.

**Never write `justify-start`.** It states nothing the default did not already state.

## `ALIGN-7` — the whole run belongs at the far end

**Situation.** The container's ENTIRE content belongs at the trailing end of the flow direction. It is
not one child being pushed — the whole cluster lives there.

**Ask yourself.** If one more child were added to this container, would it stand BESIDE the current
cluster at the trailing end, or split off to the opposite edge?

**Boundary**

- `ALIGN-9`: `ALIGN-7` is ONE cluster at the trailing end; `ALIGN-9` is TWO opposed sides. A footer
  holding only buttons is `ALIGN-7`; a header with a title on one side and a button on the other is
  `ALIGN-9`.
- the margin rule: if the container holds several things starting at the leading edge and ONE child
  must jump to the end, that child is pushing itself with auto margin — the container has not changed
  how it packs.
- `ALIGN-3`: `ALIGN-3` is the cross axis. In a row, pushing the run to the trailing edge is `ALIGN-7`;
  standing the children on one shared floor is `ALIGN-3`.

## `ALIGN-8` — the run belongs to no edge

**Situation.** The content is a message ABOUT the container itself: it does not continue the reading
flow from any edge, so it sits in the middle of the surplus.

**Ask yourself.** Does this content CONTINUE the reading flow from an edge, or does it speak about the
WHOLE empty region?

**Boundary**

- `ALIGN-6`: content that continues the reading flow stays at the reading edge, however wide the
  region.
- the margin rule: centring a WIDTH-CONSTRAINED BLOCK inside a parent that is NOT flex belongs to
  margin. `ALIGN-8` applies only when the parent really is flex or grid.
- the typography rule: centring the TEXT INSIDE a box is text alignment, not box alignment. The two
  get written for each other, and often BOTH are needed to get the intended result.

## `ALIGN-9` — the surplus belongs between the children

**Situation.** The two ends of the container have OPPOSED CLAIMS on those two edges, or every child has
an EQUAL claim on the whole length. The surplus belongs to neither side, so it sits BETWEEN.

**Ask yourself.** If a third child were added, would it have a LEGITIMATE PLACE IN THE MIDDLE? If not —
these two are not opposed, and the right code is `ALIGN-6` with the last child pushing itself.

**Why that question decides it.** `justify-between` states that EVERY child has a claim on the surplus.
When the writer only wanted to push one child to the end, that statement is false, and the falsehood
surfaces exactly when the number of children changes: a conditionally rendered child disappears, the
two remaining ones FLY APART to the two edges, and the layout changes shape with nobody editing it.

**Boundary**

- `ALIGN-6`: see above.
- `ALIGN-7`: `ALIGN-7` is one cluster at the trailing end, `ALIGN-9` is two opposed sides.
- the gap rule: `justify-between` SPENDS existing surplus, `gap` CREATES distance. In a container no
  wider than its content, `justify-between` does nothing at all — it "works" in a wide mock and breaks
  in a narrow column.
- `justify-around` and `justify-evenly` hold only when the children are EQUAL IN RANK. `around` gives
  each child its own margin, so the outer edges are narrower than the middles; `evenly` divides every
  space equally. If you cannot say why the outer edges should be narrower, use `evenly`.

## `ALIGN-10` — what the wrapped lines hang from

**Situation.** The container allows wrapping, has in fact produced SEVERAL LINES, and OWNS a cross
measure larger than the lines together. It must then state what the lines hang from inside that
surplus.

**Ask yourself.** Does this container REALLY own a cross measure larger than its content? If not —
there is no surplus to divide, and this code emits nothing.

**Boundary**

- `ALIGN-0` … `ALIGN-4`: those codes say what THE CHILDREN WITHIN ONE LINE hang from; `ALIGN-10` says
  what THE LINES WITHIN THE CONTAINER hang from. A wrapping container may carry both, and they answer
  two different questions.
- **The right answer is usually to remove the height.** Most cases that call for `content-*` are cases
  where the container was given a height it did not earn. Declare it only when that height has a real
  business reason.

## Rules

1. An alignment class is legal only on an element that declares `flex`, `inline-flex` or `grid`. On
   anything else it renders nothing and states nothing.
2. Each container answers the cross axis once and the main axis once. The two answers are independent
   and may both be declared on the same node.
3. Alignment spends space that already exists. It never creates distance between children; that is the
   parent's gap.
4. Alignment moves boxes. It never aligns glyphs inside a box.
5. Alignment never changes what a child measures. A child that must match a sibling's measure is a
   sizing decision, not an alignment one.
6. `start` and `end` are logical. No rule in this module refers to left or right.
7. A code is chosen from what the children ARE, not from what the current data happens to render.
8. One child moving alone to the far end is not the container's main-axis answer.

Beyond these: every rendered flex or grid container resolves to exactly one code per axis. No
container is out of scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it applies
to.

- **Icon beside text.** `ALIGN-1`, never `ALIGN-4`. An icon's baseline is an accident of its box, not a
  writing line, and hanging a drawing from a writing line puts it below where a reader expects it.
- **Text that can wrap.** A row whose text may reach a second line is `ALIGN-2`, not `ALIGN-1`, even
  while today's data is one line. Centring against a growing block moves the fixed child every time the
  sentence changes length.
- **Equal-measure children.** `ALIGN-0` and `ALIGN-2` render identically until a child owns a boundary
  or grows. Choose from boundary ownership, not from the render.
- **Two children with an optional third.** `ALIGN-9` holds only when the two ends are opposed by role.
  If a third child would belong in the middle of neither end, the trailing child is departing alone and
  the main axis stays `ALIGN-6`.
- **Not a flex or grid container.** This module emits nothing. Centring one width-constrained block
  inside its parent's free inline space is a margin decision, not an alignment one.
- **No surplus on the main axis.** `ALIGN-7`, `ALIGN-8` and `ALIGN-9` do nothing when the content
  already fills the container. Declaring one is still correct; relying on it to produce distance is not.
- **State parity.** Keep the same codes across viewport, axis direction and loading state unless the
  container itself changes. A skeleton and its loaded content hang from the same thing.
- **Row turning into a column.** When `flex-row` becomes `flex-col` at a narrow screen, THE CROSS AXIS
  ROTATES, so `items-center`, which meant "equally tall", now means "packed to the horizontal middle".
  This is not permission to change the code at will — it is the reason the code must be stated again at
  every breakpoint where the flow direction changes.

## Output

One block per element, outermost first:

```text
container: <flex | inline-flex | grid | none>
axis:      <row | column>
children:  <direct children and the cross measure each owns>
cross:     <ALIGN-0 | ALIGN-1 | ALIGN-2 | ALIGN-3 | ALIGN-4>
departure: <ALIGN-5 on the named child, or none>
main:      <ALIGN-6 | ALIGN-7 | ALIGN-8 | ALIGN-9>
lines:     <ALIGN-10 when the container wraps and owns surplus cross space, or none>
className: <no alignment class | items-* | self-* | justify-* | content-*>
reason:    <business fact that excludes the adjacent code>
```
