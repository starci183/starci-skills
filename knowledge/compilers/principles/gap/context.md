# Gap

## LOADS

None.

## Record

You are given a plain request in prose — "a login form with three fields" — and you return, for
every parent that request implies, one situation code and one className. The request never states a
distance and you never estimate one: the distance follows from the relationship between the things
that sit next to each other.

## Law

The seam between two things states how strongly they belong together. Choose it from that
relationship, never from how the spacing looks.

The immediate parent owns the seam. One parent expresses one relationship; mixed relationships need
nested parents.

**This is binding, not advisory.** Anything rendered with two or more siblings has a gap situation,
and that situation has a code below. There is no size at which a composition is too small to have
one: a label above a field is `GAP-3` for the same reason a rail beside a result region is `GAP-8`.
"It is only two elements" is not an exemption — it is the most common place the rule gets skipped.

## Situation codes

Every situation this module governs carries a code, `GAP-<rung>`. The code names the SITUATION; the
className column names what that situation emits. They are not the same thing, and one of them
emits nothing.

| Code | Situation | className |
|---|---|---|
| `GAP-0` | A divided or joined list already owns its rhythm | *no gap class* |
| `GAP-1` | One identity or value; one child qualifies the other | `gap-1` |
| `GAP-2` | One compact action, record, sentence or ordered run | `gap-2` |
| `GAP-3` | A label, heading or toolbar owns the local block that follows | `gap-3` |
| `GAP-4` | Peer groups; each group owns internal structure | `gap-4` |
| `GAP-6` | Peer page sections in one content flow | `gap-6` |
| `GAP-8` | Peer layout regions with independent geometry | `gap-8` |

`GAP-0` IS A SITUATION, NOT A RUNG. There is no `gap-0` class, and adding one is a rule change rather
than a shortcut: the absence of a seam is a different fact from a seam of size zero. Writing `gap-0`
claims the parent decided a distance when it decided not to own one. The code exists because "no
gap" is a case a reader must be able to recognise, cite and be corrected against — a situation with
no name is a situation nobody can be shown to have got wrong.

The scale skips `5` and `7` deliberately. A closed scale with holes in it forces a relationship
decision; a continuous one invites splitting the difference, which is taste re-entering through
arithmetic.

## Reading a request

1. **List the parents the request states.** "A login form with three fields" states two: the form
   body that holds the fields, and each field that holds its own label and input.
2. **Do not invent a parent the request never mentions.** A submit button, a heading or a card is
   not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested parent. Every parent gets its own answer; a parent
   never inherits its child's code.
4. **For each parent, name the direct children and ask the relationship question** in the section
   for each code. The first code whose situation matches is the answer.
5. **If a parent mixes relationships, nest before choosing.** If two adjacent codes both match,
   choose the smaller rung.

## `GAP-0` — the rhythm is already in the row and the divider

**Situation.** A joined list: each row carries its own padding, and a divider already states the
boundary between rows. The parent of the rows owns no sibling seam at all.

**Recognition signs**

- Each row is clickable, or carries its own internal padding.
- A rule is already drawn between rows.
- Adding whitespace would break the rules into detached segments and the list would stop reading as
  one joined surface.

**Ask yourself.** If whitespace were added here, would the dividers turn into disconnected strokes?

**Boundary**

- `GAP-2`: two buttons side by side are not a list; they are one action cluster.
- `GAP-4`: if the rows are groups with their own structure and there is no divider, they are no
  longer a joined list.

**Never write `gap-0`.** No seam is the ABSENCE of a sibling seam, not a new rung on the scale.
`GAP-0` is a situation code, not a CSS class name.

## `GAP-1` — two lines are still one identity

**Situation.** The second line only qualifies or identifies the first. Read alone, it is no longer
an independent object.

**Recognition signs**

- Both lines answer one question: "who is this?", "how many?", "what does it cost?".
- Remove the second and the first is still true, only less precise.
- Neither side is an action.

**Ask yourself.** Read the lower part alone: is it still an independent object? If not — `GAP-1`.

**Boundary**

- `GAP-2`: `GAP-1` is one part qualifying another; `GAP-2` is several parts forming one block. Name
  and username are `GAP-1`; Save and Preview are `GAP-2`.
- `GAP-3`: a label above an input is `GAP-3`, not `GAP-1`, because the label owns an interactive
  block rather than annotating a value.

## `GAP-2` — several parts form one compact block

**Situation.** The parts together form one operation, one record, one sentence or one ordered run.
Pull one out and the block breaks.

**Recognition signs**

- They share a boundary, a state or an action.
- They read as one cluster, not as two errands.
- The horizontal or vertical axis is NOT a criterion.

**Ask yourself.** If the parts were separated from the shared boundary or state, would the operation
or the record break?

**Boundary**

- `GAP-1`: see above.
- `GAP-3`: if ONE part names or governs the rest, it is `GAP-3`. A Save/Preview button group is
  `GAP-2`; the word "Actions" above that group is `GAP-3`.

## `GAP-3` — one part owns the part that follows

**Situation.** The first part names, controls or explains the second. The relationship is ownership,
not peerage.

**Recognition signs**

- The first part is short; the second is the real content.
- Remove the first and the second still works, only unnamed.
- Remove the second and the first becomes meaningless.

**Ask yourself.** Is the first part naming, controlling or explaining the second?

**Boundary**

- `GAP-2`: `GAP-2` shares a boundary; `GAP-3` has one side governing the other.
- `GAP-4`: if BOTH sides are already groups with their own structure, there is no ownership left —
  that is `GAP-4`.

## `GAP-4` — both sides are already a group

**Situation.** Each side already owns its internal seam. The two are peers; neither owns the other.

**Recognition signs**

- Each side can be named as a complete group on its own.
- Inside each side, `GAP-1`, `GAP-2` or `GAP-3` is already in use.
- Neither side is large enough to be a page section.

**Ask yourself.** Can both sides be named as a complete group on their own?

**Boundary**

- `GAP-3`: see above.
- `GAP-6`: if each side has its own heading, its own purpose and its own loading state, it has
  risen to `GAP-6`.

## `GAP-6` — two page sections of one page

**Situation.** Each section has its own heading, content and purpose, yet both still belong to one
page and run in one content flow.

**Recognition signs**

- Each section can stand alone as an independent section.
- Each has its own loading state and can be empty on its own.
- They still scroll together in one flow; they are not yet two layout regions.

**Ask yourself.** Pulled out on its own, could this section stand as an independent section?

**Boundary**

- `GAP-4`: see above.
- `GAP-8`: if each side decides its own width and arrangement when the screen changes size, they
  are layout regions — `GAP-8`.

**Unacceptable example.** A section with only a heading and a number does NOT demonstrate `GAP-6`:
it has not proven it can stand alone. Every section in an example must carry real content matching
its purpose.

## `GAP-8` — two layout regions

**Situation.** The two sides govern how the whole page area is organised. Each owns its own
geometry: width, position, behaviour when the screen changes size.

**Recognition signs**

- One side can be pinned, scrolled independently, or disappear on mobile.
- The width of each side is a layout decision, not a consequence of content.

**Ask yourself.** Do both sides govern how the whole page area is organised?

**Boundary**

- `GAP-6`: see above. The size of a component does NOT make it a layout region — a large card is
  still a card.

## Inputs

| Input | Evidence required |
|---|---|
| parent | Immediate common parent |
| siblings | Direct children only |
| relationship | identity, compact cluster, owned block, peer groups, sections, regions or joined list |
| behavior | Whether action, state and boundary are shared or independent |

## Rules

1. Consider only the DIRECT children of one parent.
2. The parent owns `gap`; children do NOT push siblings with `margin`.
3. One parent expresses ONE relationship. A different relationship must become a nested parent.
4. Turning a row into a column, changing the viewport or changing the loading state does NOT by
   itself change the rung.
5. A divider and a gap do not express the same boundary twice.
6. If two adjacent rungs both remain reasonable, default to the SMALLER rung; ask only when the
   request requires the larger relationship.

Beyond these: a situation code maps to exactly one className, no className serves two codes, and
every rendered sibling set resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **State parity.** A skeleton and the real content share one code. Changing the seam while loading
  lies about the relationship.
- **Chronology.** A timestamp beside its event is `GAP-2` ONLY when the two form one ordered record.
  A timestamp that merely dates a separate block is not part of that record.
- **Flat parent with mixed relationships.** Split the hierarchy FIRST, then choose. A container
  holding an identity, a metric and a section heading has no correct single answer, and averaging
  them is how the wrong one gets chosen.
- **Two adjacent codes both match.** Choose the smaller rung. Ask ONE discriminator question only
  when the requester explicitly requires the larger relationship.
- **Divider present.** A list that draws separators and pads its own rows is `GAP-0`, even when the
  rows would otherwise read as peers.
- **Responsive.** Change the rung only when the parent or the layout role ACTUALLY changes, not
  because the viewport narrowed.

## Output

One block per parent, outermost first:

```text
parent: <immediate parent>
siblings: <direct children>
situation: <GAP-0 | GAP-1 | GAP-2 | GAP-3 | GAP-4 | GAP-6 | GAP-8>
className: <no class | gap-1 | gap-2 | gap-3 | gap-4 | gap-6 | gap-8>
reason: <business fact that excludes the adjacent code>
```
