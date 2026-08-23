# Padding

## LOADS

None.

## Record

You are given a plain request in prose — "a billing card with a list of invoices inside it" — and you
return, for every element that request implies, one situation code and one className. The request
never states an inset and you never estimate one: the inset follows from what boundary owns the
element and what that boundary is responsible for.

## Law

Padding is the inset a **boundary** owns around its own direct content. A boundary is an element that
draws one — background, border, elevation, ruled cell — or owns one semantically, such as the plane a
route dedicates to its single task.

Choose the inset from what that boundary is responsible for, never from how much room the result
appears to have. Size, screenshots and the words "roomy", "cramped", "big" are not evidence.

Padding never pushes a sibling. Distance between siblings belongs to the parent's gap; an element
that grows its own inset to move a neighbour has answered a question that was not asked.

**This is binding, not advisory.** Every rendered element is either a boundary or not, and both
answers have a code below. There is no size at which a composition is too small to have one: a
two-line cell in a divided strip is `PADDING-2` for the same reason a document plane is `PADDING-6`.
"It is just a wrapper" is not an exemption — it is the most common place the rule gets skipped, and
it has its own code precisely so that skipping it can be named.

## Situation codes

Every situation this module governs carries a code, `PADDING-<rung>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one code emits
two different things for one reason stated below.

| Code | Situation | className |
|---|---|---|
| `PADDING-0` | The element owns no inset of its own | *no padding class*, or `p-0` when a real boundary delegates |
| `PADDING-2` | Compact repeated cell holding one short datum or one action | `p-2` |
| `PADDING-3` | Regular repeated or ruled cell holding a small content group | `p-3` |
| `PADDING-4` | Ordinary surface, composed row or nested callout | `p-4` |
| `PADDING-6` | Primary focused reading or task plane | `p-6` |

`PADDING-0` IS A SITUATION, NOT A RUNG, and it is the one code with two emissions. The situation is
"this element owns no inset". The two emissions answer a second, closed question — *is there a real
boundary here at all?*

- **No boundary.** A transparent arranger only establishes a stack, a grid or a row. It owns nothing
  to inset, so it emits **no padding class**. Writing `p-0` on it claims a boundary made a decision
  where no boundary exists.
- **A boundary that delegates.** A real boundary hands its whole inset to its direct rows, cells or
  to one content child — so that dividers reach the edge, or so that media bleeds to the border. It
  emits **`p-0`**, out loud, because the delegation is a decision and a reader must be able to see
  that it was taken rather than forgotten.

Absence of a class and `p-0` are therefore not interchangeable, and this distinction is the oldest
decision in the module. Both remain under one code because both describe the same inset — zero — and
splitting them into two codes would suggest the scale has two zero rungs, which it does not.

The scale skips `1`, `5` and every value above `6`. A closed scale with holes forces a boundary-role
decision; a continuous one invites splitting the difference, which is taste re-entering through
arithmetic. Adding a rung is a rule change, never a local choice.

## Reading a request

1. **List the elements the request states.** "A billing card with a list of invoices inside it"
   states three: the card, the list, and each invoice row.
2. **Do not invent an element the request never mentions.** A page header, a filter bar or a modal is
   not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested element. Every element gets its own answer; a
   boundary never inherits its child's code, and a child never inherits its boundary's code.
4. **For each element, ask whether it draws or semantically owns a boundary.** If it does not, it is
   `PADDING-0` in the no-class form and nothing further is decided about it.
5. **If it is a boundary, name its direct content and ask each code's question** in the section for
   that code. The first code whose situation matches is the answer. A boundary that hands its whole
   inset to its rows, cells or one content child is `PADDING-0` in the `p-0` form.
6. **If one element mixes roles, split the boundary first.** A wrapper that is asked to be both an
   arranger and a surface has no correct single answer. If two adjacent rungs both match, choose the
   smaller rung.
7. **If the request does not establish who owns the boundary or what role it plays, emit no caller
   padding** and ask one concrete question only when the requester explicitly requires a non-default
   inset. The answer is a className or a question, never both.

## `PADDING-0` — the element owns no inset

**Situation.** The element owns no inset of its own. Two different things stand behind that one
situation. In the first form there is no boundary at all: a wrapper exists only to arrange — to
establish a stack, a grid, a row — and it draws no background, no border, no semantic boundary, so it
has nothing to inset and emits no padding class. In the second form there is a real boundary, and it
deliberately hands its whole inset to its direct rows or cells, or to one content child, so that
dividers reach the edge or media bleeds to the border; it emits `p-0`.

**Recognition signs**

- *No boundary:* removing the element makes no boundary disappear, only the layout collapse; its
  classes are only `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `min-w-0`; the content inside
  already carries its own surface, or already sits inside a parent surface.
- *Delegating boundary:* there is a `border`, a `bg-*` or a `rounded-*` on the element; its direct
  children add their own padding and are their own hit areas; if the parent kept the inset, the
  dividers would fall short at both ends and the list would look truncated.

**Ask yourself.** If every decorative class were stripped, would this element still draw a boundary?
If it would not, it is the no-class form. If it would, is the boundary real and is it *deliberately*
handing its inset to its children? Then it is the `p-0` form.

**Boundary**

- Between the two forms: `p-0` is a decision made by a real boundary. A transparent wrapper has no
  right to make it, because it owns no boundary to delegate. This is the oldest distinction in the
  module and the one most often written wrong.
- `PADDING-4`: a wrapper that is given a `border` or a `bg-*` has just BECOME a boundary — and it
  must then receive an inset, not be left blank. A list whose root keeps `p-4` *and* still draws
  `divide-y` is stating the boundary twice, in two contradicting ways.

**Write `p-0` out loud, never leave it blank.** Delegation is a decision; a later reader must be able
to tell "decided to hand it over" from "forgot to set it".

## `PADDING-2` — compact repeated cell

**Situation.** A repeated cell inside a set of identical cells, holding one short datum or one
action. The cell exists to be counted and scanned, not read.

**Recognition signs**

- The content is a number, a label, a date, a shortcut, a status.
- Every cell in the set has the same structure; reading one cell explains the whole set.
- The cell sits inside a parent that has already delegated its inset (`PADDING-0`, `p-0` form).

**Ask yourself.** Does this cell hold ONE datum, or a GROUP of data?

**Boundary**

- `PADDING-3`: once there is a group — a label plus a value plus a status — it rises to `PADDING-3`.
  A number with its own unit is still ONE datum.
- `PADDING-4`: a repeated cell is not a reusable surface. If the element would still read correctly
  standing alone somewhere else, it is a surface, not a cell.

**Never use `PADDING-2` to "make it tighter".** Tightness is a consequence of the cell holding one
datum, not a criterion for choosing.

## `PADDING-3` — repeated cell with a small group

**Situation.** Still a repeated or ruled cell, but the inside is now a small content group: a label
and a value, a title and a sub-line, a name and a status.

**Recognition signs**

- The inside of the cell already needs a `gap` to organise its parts.
- The cell still belongs to a uniform set and still cannot stand on its own.
- Rules or a grid still separate the cells; whitespace does not.

**Ask yourself.** Does this cell already need internal structure, and does it still depend on its
set?

**Boundary**

- `PADDING-2`: see above.
- `PADDING-4`: the deciding question is whether it stands alone. A row in a ruled list is
  `PADDING-3`; the same content wrapped in a card with its own border, still correct outside the
  list, is `PADDING-4`.

## `PADDING-4` — ordinary surface

**Situation.** A reusable surface: it draws its own boundary, holds a composed cluster of content,
and carries its whole meaning if moved elsewhere. This is the default rung for every card, frame and
nested callout.

**Recognition signs**

- There is a real boundary and several kinds of content inside it: heading, description, metric,
  action.
- Other peer surfaces sit beside it.
- It is NOT the reason the route exists.

**Ask yourself.** Is this a reusable surface among other surfaces, or the primary plane of the route?

**Boundary**

- `PADDING-3`: see above.
- `PADDING-6`: rise to `PADDING-6` only when the route exists ONLY for this plane. A large card is
  still a card; size does not raise the rung.

**A nested callout is also `PADDING-4`.** It adds its own background or border, so it is a real
boundary, so it must have an inset. But the stack between the card and the callout does NOT — that
stack is `PADDING-0` in the no-class form.

## `PADDING-6` — primary plane

**Situation.** The route exists to serve exactly one task, and this is the plane holding that task: a
reading, a working flow, a document, a long form. No peer surface competes with it for attention.

**Recognition signs**

- There is only one such plane on the route.
- The content inside is a long flow that needs a resting margin to be read continuously.
- Remove this plane and the route loses its reason to exist.

**Ask yourself.** If this plane were removed, would the route still mean anything?

**Boundary**

- `PADDING-4`: see above. "Bigger", "airier" and a screenshot are NOT evidence. The only evidence is
  the role on the route. Two primary planes on one route is a contradiction: either one of them is
  `PADDING-4`, or the route is doing two jobs, which is the route's problem and not padding's.

## Inputs

| Input | Evidence required |
|---|---|
| boundary owner | The element drawing or semantically owning the boundary |
| direct content | One datum, one small group, a composed surface, or a route's primary task |
| delegation | Whether direct rows, cells or one content child own the inset instead |
| nesting | Whether an inner element is a transparent wrapper or a second real boundary |
| role | Ordinary reusable surface, or the plane the route exists for |

## Rules

1. Find the element that draws or semantically owns the boundary first. It is the owner of the
   inset, and nothing else may add one on its behalf.
2. Only the DIRECT content of that boundary decides the rung.
3. One boundary receives exactly one inset decision.
4. A transparent arranger receives no padding class at all — not `p-0`.
5. A surface inside a surface earns its own inset only when it really adds a background, a border or
   a semantic boundary.
6. Padding is not used to separate siblings; that distance belongs to the parent's gap.
7. Loading, empty, error and ready render the same padding tree.
8. Axis and viewport changes do not change the inset unless the boundary's role itself changes.
9. An interactive control owns its internal inset where the control is defined; callers do not patch
   it with `px-*` or `py-*` from outside.
10. An element positioned at another element's edge needs an explicit slot or geometry rule, not
    guessed extra inset on the neighbour.
11. If two adjacent rungs both remain reasonable, default to the SMALLER rung; ask only when the
    requester explicitly requires the larger role.

Beyond these: a situation code maps to exactly one inset value — `PADDING-0` maps to zero, expressed
two ways for the boundary-existence reason above — and every rendered element resolves to exactly one
code. No wrapper, cell or plane is out of scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Explicit delegation.** `p-0` is a decision by a real boundary, under `PADDING-0`. It is never a
  tidier way of writing "no padding here" on a wrapper — that case is the no-class emission of
  `PADDING-0`. Choosing the wrong form is an error, not an alternative spelling.
- **Nested surface.** An inner element earns its own inset — `PADDING-4` — only when it introduces a
  real boundary of its own. Two backgrounds, two insets. One background and one stack, one inset.
- **Interactive control inset.** Established control padding is left alone. A caller who believes it
  is wrong proposes a change where the control is defined; patching it at one call site makes the
  same control two shapes.
- **Words are not evidence.** "Big", "airy", "cramped" and a screenshot do not separate `PADDING-4`
  from `PADDING-6`.
- **Unknown ownership.** When the request does not establish who owns the boundary or what role it
  plays, emit no caller padding. Ask one concrete question only when the requester explicitly
  requires a non-default inset.
- **Two adjacent rungs both match.** Choose the smaller rung. Ask one discriminating question only
  when the requester explicitly requires the larger role.
- **State parity.** Skeleton, empty, error and ready share one padding tree. Changing the inset while
  loading makes the layout jump at the moment the user is watching.
- **Responsive.** Change the rung only when the boundary's role ACTUALLY changes, not because the
  screen got wider.
- **Edge participant.** Reserving inset for a control placed over another element's edge is allowed
  only once the slot and its geometry are stated. Until then, no inset is invented.

## Output

One block per element, outermost first:

```text
boundary owner: <element, or "none — transparent arranger">
direct content role: pass-through | delegated | compact-cell | regular-cell |
                     ordinary-surface | primary-plane
situation: <PADDING-0 | PADDING-2 | PADDING-3 | PADDING-4 | PADDING-6>
className: <no class | p-0 | p-2 | p-3 | p-4 | p-6>
nested boundaries: <none | owner tree with one code each>
reason: <business fact that excludes the adjacent code>
```
