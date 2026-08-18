# Divider

## LOADS

None.

## Record

You are given a plain request in prose — "a dialog with a header, a list of invitations and a footer"
— and you return, for every adjacency that request implies, one situation code and one className. The
request never asks for a line and you never add one to make a region look defined: whether a line
exists follows from whether the two sides are adjacent and whether space has already stated the
boundary.

## Law

A divider is a boundary drawn as a **line**. Empty space is the same boundary drawn as **absence**.
They are two renderings of one fact, and one fact is stated once.

A line is therefore never chosen because a region "needs definition". It is chosen when the boundary
must hold while the two sides stay **adjacent** — when density, alignment or one continuous surface
has already spent the space that boundary would otherwise have used. Where space is available and
already doing the work, a line is a second claim about a seam that has already been settled.

Exactly one element owns each rule. A set owns the rules **between its members**; a band owns **the
edge where it ends**; a seam between two regions is declared **once, by the later side**. Two
elements that each draw their own edge across one seam produce two lines and a rule nobody owns.

This module emits three facts and no others: whether a line exists, which element owns it, and along
which axis it runs. Which token colours the line belongs to the colour rule. How far content sits
from it belongs to the padding rule. How much space a seam is worth belongs to the gap rule. A
boundary that **encloses** rather than separates is a membership claim and belongs to the
surface-in-surface rule.

**This is binding, not advisory.** Every rendered adjacency has a divider situation, and that
situation has a code below — including the overwhelming majority that draw nothing. There is no size
at which a composition is too small to have one: two stacked cards separated by space are
`DIVIDER-0` for the same reason a settings list is `DIVIDER-1`. "It is only a hairline" is not an
exemption — it is the most common place this rule gets skipped, because a duplicated boundary costs
nothing to add and is invisible in review until a page has eleven of them.

## Situation codes

Every situation this module governs carries a code, `DIVIDER-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two of them
emit nothing.

| Code | Situation | className |
|---|---|---|
| `DIVIDER-0` | Space already states the boundary; the sides are not adjacent | *no divider class* |
| `DIVIDER-1` | One set of comparable members needs a repeating rule between them | `divide-y divide-border` (`divide-x divide-border` when the set runs across) |
| `DIVIDER-2` | A band that names or controls what follows closes its own edge | `border-b border-border` (`border-t border-border` when the band sits after) |
| `DIVIDER-3` | Two adjacent peer regions share one seam | `border-l border-border` on the later region (`border-t border-border` when stacked) |
| `DIVIDER-4` | The line encloses one object instead of separating siblings | *no class from this module* |
| `DIVIDER-5` | A matrix of cells comparable on two axes | `divide-y divide-border` on the matrix + `divide-x divide-border` on each row |
| `DIVIDER-6` | The rule is itself a member of the flow, not the edge of anything | `border-t border-border` on a standalone break element |

The index is an ORDER OF ENCOUNTER, not a scale. `DIVIDER-5` is not "more" than `DIVIDER-2`, and
there is nothing between `DIVIDER-2` and `DIVIDER-3` to split the difference with. `0` is the
absence, `1`–`3` are ordered by how often the rule repeats — many rules inside a set, one edge under
a band, one seam between two regions — `4` is the boundary that is not a separator at all, `5` is
`DIVIDER-1` taken to a second axis, and `6` is the rule that is nobody's edge.

`DIVIDER-0` IS A SITUATION, NOT A CLASS. There is no "divider: none" to write, and reaching for a
transparent or zero-width border to record the decision is the same mistake in a different colour.
The code exists because "no line here" is the answer a reader must be able to recognise, cite and be
corrected against — and because it is the answer in most compositions. A situation with no name is a
situation nobody can be shown to have got wrong.

`DIVIDER-4` EMITS NOTHING **FROM THIS MODULE**, WHICH IS NOT THE SAME AS EMITTING NOTHING. An
enclosing outline is a real, visible line, and it is frequently correct — but the question it answers
is *are these things one nameable group, distinct from the group around them?* That is a membership
claim, decided by the surface-in-surface rule, which weighs the outline against elevation and against
staying flat. Answering it here would state one boundary twice at the level of the canon itself,
which is precisely the failure this module exists to prevent. The code is present so that an
enclosing line is **classified and routed**, not so that it can be quietly treated as a separator.

## Reading a request

1. **List the adjacencies the request states.** "A dialog with a header, a list of invitations and a
   footer" states three: header against list, member against member inside the list, and list against
   footer.
2. **Do not invent an adjacency the request never mentions.** A sidebar, a search toolbar or a
   comparison table is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested seam. Every adjacency gets its own answer; a parent
   never inherits its child's code, and a set with a header carries two codes, not one.
4. **For each seam, name what sits on each side and ask the question** in the section for each code.
   The first code whose situation matches is the answer. Ask first whether a parent already spends
   space across this seam — if it does, the answer is `DIVIDER-0` and no further question is needed.
5. **If one parent mixes situations, split the hierarchy before choosing.** A header and its members
   are not one set. If two codes both match, choose `DIVIDER-0`.

## `DIVIDER-0` — space has already said it

**Situation.** Two things sit next to each other and the parent has already put space between them.
The boundary is stated. Adding a line says the same sentence a second time.

**Ask yourself.** If this line were removed, would anyone read the two sides as one thing? If not —
`DIVIDER-0`.

**Boundary**

- `DIVIDER-1`: `DIVIDER-1` holds only when the members are **touching** on one continuous surface.
  Three detached cards, each with its own background, are not a joined list.
- `DIVIDER-2`: if a heading stands a distance away from its content, the heading needs no bottom
  edge. A band closes its edge only when content runs **flush** into it.
- `DIVIDER-3`: two regions with space between them have no seam to draw on. A line cannot span a gap.

**There is no class for this situation.** Do not draw a transparent border and do not set `border-0`
"to record that it was considered". Absence is the answer, and it is the answer in most compositions.

## `DIVIDER-1` — one set of comparable members, ruled repeatedly

**Situation.** Several items of the **same kind** sit flush on one surface: each item carries its own
internal padding and there is no space between them. The boundary between one item and the next has
only a line left to state it.

**Ask yourself.** Are these items versions of the **same kind**, sitting flush on one continuous
surface?

**Boundary**

- `DIVIDER-0`: if the items are separated by space, the set has no seam. This is the most common
  error of the whole module — `gap` and `divide-y` at once.
- `DIVIDER-2`: a list header is **not** a member of the list. Its bottom edge is `DIVIDER-2`; the
  rules below it are `DIVIDER-1`. Two codes, two owners, one tree.
- `DIVIDER-3`: `DIVIDER-3` is **two** regions of **different kinds**; `DIVIDER-1` is **N** members
  of the **same kind**.
- `DIVIDER-5`: if the cells are comparable along rows **and** columns, it is a matrix.

**The owner is the parent.** Never put `border-b` on each member: the last member grows a trailing
line, and that line is an outer boundary nobody asked for.

## `DIVIDER-2` — a band closes its own edge

**Situation.** A band **names or controls** what follows it — a header, a toolbar, a tab strip, an
action footer — and the content runs **flush** into that band. The line says: this band is **above**
the content, not **inside** it.

**Ask yourself.** Is this band controlling or naming what follows, and does what follows run flush
into it?

**Boundary**

- `DIVIDER-0`: if there is real space between the band and the content, ownership is already stated
  by that space. Do not state it again.
- `DIVIDER-1`: the band is **not** a member of the set. This is why a list with a header carries
  **two** codes rather than one `divide-y` covering everything.
- `DIVIDER-3`: `DIVIDER-2` is an **ownership** relationship (the band governs the content);
  `DIVIDER-3` is a **peer** relationship.
- `DIVIDER-6`: `DIVIDER-2` is the edge of an element **that has content**; `DIVIDER-6` is an element
  that is **only** a line.

**Sticky state.** A pinned band keeps `DIVIDER-2` in **every** state, including before anything has
scrolled. Making the line appear on scroll turns the boundary into a consequence of scroll position.

## `DIVIDER-3` — two peer regions share one seam

**Situation.** Two regions of **different kinds**, neither owning the other, sit flush because they
share one continuous surface or because the layout leaves no room for space. There is exactly **one**
seam, and it is declared **once**.

**Ask yourself.** Are the two sides peers, and do they actually **touch**, or is there already space
between them?

**Boundary**

- `DIVIDER-0`: this is the most important boundary of this code. Two regions separated by a `gap` get
  **no** line. A line cannot span a gap.
- `DIVIDER-1`: two regions of different kinds are `DIVIDER-3`; N members of one kind are `DIVIDER-1`.
  Using `divide-x` for two unlike regions borrows a set's mechanism to state something that is not a
  set.
- `DIVIDER-2`: if one side **governs** the other, it rises to `DIVIDER-2`.

**Declared once, by the later side.** The earlier side does not grow a `border-r`; the later side
carries `border-l`. If both declare, two lines land side by side, and on a high-density screen they
read twice as heavy as every other rule.

## `DIVIDER-4` — the line encloses instead of separating

**Situation.** The line runs **all the way around** an object. It does not say "this side differs
from that side"; it says "the things inside me are **one nameable group**, distinct from the group
around them".

**Ask yourself.** Is this line **separating** two things, or **gathering** one group?

**Boundary**

- `DIVIDER-1`, `DIVIDER-2`, `DIVIDER-3`: all three are **one edge between two sides**. This code is
  **four edges around one side**.
- `DIVIDER-5`: the outer frame of a matrix is `DIVIDER-4`; the rules **inside** the matrix are
  `DIVIDER-5`. A matrix usually carries both, and they have two different owners.

**This module does not answer it.** The question "does this group deserve to be named by an outline?"
is a question about **membership**, and it must be weighed against two alternatives this module
cannot see: raising the group onto its own surface, or leaving it flat. Answering it here would be
the canon itself stating one boundary twice — precisely the failure this module exists to prevent.
The code is present so that an enclosing line is **classified and routed**, not so that it can be
quietly treated as a separator.

## `DIVIDER-5` — a matrix of cells on two axes

**Situation.** The cells are comparable **down a column** and also comparable **across a row**. A cell
means what it means because of its position on both axes, so both axes must be stated.

**Ask yourself.** Does a cell here mean what it means because of **both its row and its column**, or
only because of its order in a list?

**Boundary**

- `DIVIDER-1`: a list has only **one** axis. A row with several columns whose columns are not
  comparable with each other is still `DIVIDER-1` — the columns are just layout inside the row.
- `DIVIDER-4`: the outer frame does not belong to this code.
- `DIVIDER-0`: a card grid with a `gap` is **not** a matrix in this sense. It has already stated its
  boundaries with space.

**Rules inside only.** The first and last cells grow no outer edges. If an outer frame is needed, it
belongs to the surface holding the matrix, not to the cells.

## `DIVIDER-6` — the rule is itself an element

**Situation.** The line is **nobody's edge**. It stands in the flow as an element of its own, because
what lies on either side are arbitrary blocks and neither has standing to own the seam — or because
the line must also **carry a label**.

**Ask yourself.** Is there any element here that could own this edge? If nobody can — `DIVIDER-6`.

**Boundary**

- `DIVIDER-2`: `DIVIDER-2` is the edge of a band **with content**. `DIVIDER-6` is an element that is
  **only** a line.
- `DIVIDER-3`: if both sides are regions with their own containers, the seam has an owner, and the
  owner is the later side.
- `DIVIDER-1`: a marker inside a list ("Today") is **not** a member of the list; it is a `DIVIDER-6`
  standing between members.

**The meaning is part of the code.** A thematic break in long text is a meaningful event, not a
decorative stroke; it must be written with the element that carries that meaning.

## Rules

1. A boundary is stated once. A seam that already carries a gap does not also carry a rule.
2. One rule has one owner. Two adjacent elements never each draw their facing edge.
3. A set draws rules with `divide-*` on the parent, never with a bottom border on every member — the
   latter draws a trailing line under the last member, which is an outer boundary nobody asked for.
4. A rule needs an edge to run along. A line cannot span a gap, and a rule declared on a side that is
   not adjacent to anything is a decoration.
5. Axis follows the set's own axis. Vertical or horizontal is a consequence, never a criterion.
6. The rule ends where its host ends. A rounded host must clip its content for the line to stop at
   the corner instead of running past it.
7. `divide-*` describes the set, not the count. A set that currently renders one member keeps the
   class; the class states a rule about members, and one member has no seam to draw.
8. This module never emits a colour token choice, an inset, a radius or a distance.
9. Every rendered adjacency resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Sticky band.** A band that stays put while content moves under it keeps `DIVIDER-2` in every
  state, including the state where nothing has scrolled yet. The rule is what tells a reader the band
  is above the content rather than in it; making it appear on scroll makes the boundary a side effect
  of position.
- **Breakpoint that changes the owner.** A two-region seam that stacks moves its rule from the
  vertical edge to the horizontal one and stays `DIVIDER-3`. It may drop to `DIVIDER-0` at that same
  breakpoint **only** when the stacked layout introduces the space that now states the boundary. The
  boundary is still stated exactly once on both sides of the breakpoint.
- **State parity.** A placeholder state carries the same rules the loaded state will carry. A list
  that gains its lines when data arrives reflows, and the reflow is caused by the canon, not by the
  data.
- **Matrix edges.** `DIVIDER-5` draws only the rules **between** cells. The outer frame of the matrix
  is the host's boundary and belongs to the surface-in-surface rule, not to a first and last cell
  each growing an edge.
- **Two codes both match.** Prefer `DIVIDER-0`. A line is added only when the requester states the
  adjacency that makes space unavailable; "it looks undefined" is not that statement.
- **A line that carries meaning other than boundary** — a progress track, an underline that marks a
  selected tab, a strikethrough, a chart axis — is not a divider and is not governed here. It is
  named by whatever states that meaning.

## Output

One block per element, outermost first:

```text
seam: <what lies on each side>
adjacency: <touching | separated by a parent gap>
owner: <set parent | band | later region | matrix + rows | standalone break | none>
situation: <DIVIDER-0 | DIVIDER-1 | DIVIDER-2 | DIVIDER-3 | DIVIDER-4 | DIVIDER-5 | DIVIDER-6>
className: <no class | divide-y divide-border | border-b border-border | border-l border-border | divide-y+divide-x | border-t border-border>
reason: <business fact that excludes the adjacent code, plus proof the boundary is not already stated by space>
```
