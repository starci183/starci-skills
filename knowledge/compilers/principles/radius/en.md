---
title: Radius
---

# Radius

## LOADS

None.


## Record

You are given a plain request in prose — "a course card with a thin edge around its cover image" —
and you return, for every boundary that request implies, one situation code and one className. The
request never states a corner and you never estimate one: the corner follows from what kind of
boundary the element is, and from the measured distance between its edge and the edge around it.

## Law

A corner states what kind of boundary an element is, and — when that element sits inside another
boundary — how the two corners are geometrically related. Choose it from the boundary and from the
measured inset, never from how round the result appears.

The module has **one root value**, `R`, the surface step. Everything else is obtained from it, not
picked next to it. Only three values are ever *chosen*: `R / 2` for a control, `R` for a surface, and
the degenerate limit for a shape that is a capsule or a circle. Every other value that appears in the
markup is a **result** — `outer − inset` — and a result is arrived at by subtraction, not by taste.

A nested box that keeps the corner of the box around it is the defect this module exists to stop. Its
arc no longer runs parallel to the arc outside it, the two curves cross, and the inner box stops
reading as a nested surface and starts reading as a sticker laid on top of one.

**This is binding, not advisory.** Every rendered element either owns a boundary or does not, and both
answers have a code below. There is no size at which an element is too small to have one: a 2px inner
corner on a bleeding thumbnail is `RADIUS-4` for the same reason a dialog plane is `RADIUS-2`. "It is
only a couple of pixels, nobody will see it" is not an exemption — it is the single most common place
this rule is skipped, and pixels are exactly the scale at which a wrong corner is felt before it is
seen.

## Situation codes

Every situation this module governs carries a code, `RADIUS-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one of them
computes its emission rather than choosing it.

| Code | Situation | className |
|---|---|---|
| `RADIUS-0` | The element carries no corner of its own | *no radius class*, or `rounded-none` when a real boundary refuses a corner it would otherwise carry |
| `RADIUS-1` | A control-sized boundary with its corner free of any outer arc | `rounded-md` |
| `RADIUS-2` | A surface: the boundary that owns a region of content | `rounded-xl` |
| `RADIUS-3` | The shape itself is a circle or a capsule | `rounded-full` |
| `RADIUS-4` | A boundary whose corner sits inside another boundary's arc — the radius is derived | `outer − inset`, snapped down: `rounded-lg` · `rounded-md` · `rounded` · `rounded-sm` |
| `RADIUS-5` | Not every corner is free: the boundary is cut by a screen edge or joined to a neighbour | side- or corner-scoped form of the step that owns the magnitude: `rounded-t-xl`, `rounded-l-md`, `first:rounded-t-md`, … |

`RADIUS-0` IS A SITUATION, NOT A RUNG, and it is the one code with two emissions. The situation is
"this element carries no corner". The two emissions answer a second, closed question — *is there a
real boundary here at all?*

- **No boundary.** A transparent arranger, a ruled cell, or a row inside a parent that already clips.
  It has nothing whose corner could be rounded, so it emits **no radius class**. Writing
  `rounded-none` on it claims a boundary refused something, where no boundary exists to refuse.
- **A boundary that refuses.** A real surface that goes edge-to-edge — a strip that touches both
  screen edges, a panel that becomes full-bleed at a narrow viewport, an element overriding a corner
  it inherits from a shared class. It emits **`rounded-none`**, out loud, because the refusal is a
  decision and a reader must be able to see that it was taken rather than forgotten.

`RADIUS-4` is the load-bearing code. It is not a rung on the ladder and it holds no value of its own:
it is the rule that a corner inside another corner is **computed**. Every other code answers *how
round*; this one answers *how round relative to what*, and it takes precedence over every step code
whenever it applies. Derivation beats selection.

The scale prints `rounded-sm`, `rounded`, `rounded-lg` only as results, never as choices. That is the
whole anti-drift mechanism: a value that exists only as an output of subtraction cannot be reached by
eye, so an ad-hoc corner has nowhere to hide. Seeing `rounded-lg` in a diff is a claim that an
arithmetic was performed, and the inset is the evidence.

With the scale these codes are written against, `R = 0.75rem` (`rounded-xl` = 12px), the control step
is exactly `R / 2` = `0.375rem` (`rounded-md` = 6px), and the derived values fall on `rounded-lg` =
8px, `rounded-md` = 6px, `rounded` = 4px and `rounded-sm` = 2px. The subtraction table, so nobody has
to do it in their head:

| Outer corner | Inset (padding + border) | Result | className |
|---|---|---|---|
| `rounded-xl` (12px) | 4px (`p-1`) | 8px | `rounded-lg` |
| `rounded-xl` (12px) | 6px (`p-1.5`, or `p-1` + a 2px border) | 6px | `rounded-md` |
| `rounded-xl` (12px) | 8px (`p-2`) | 4px | `rounded` |
| `rounded-xl` (12px) | 10px (`p-2.5`) | 2px | `rounded-sm` |
| `rounded-xl` (12px) | ≥ 12px (`p-3` and up) | — | **constraint is over**, the inner box takes its own code |
| `rounded-lg` (8px) | 4px (`p-1`) | 4px | `rounded` |
| `rounded-md` (6px) | 4px (`p-1`) | 2px | `rounded-sm` |

## Reading a request

1. **List the boundaries the request states.** "A course card with a thin edge around its cover image"
   states two: the card, and the cover image inside it.
2. **Do not invent a boundary the request never mentions.** A badge, an avatar, a bottom sheet or a
   full-bleed mobile variant is not in that request. Resolve what is stated; resolve the rest when it
   arrives.
3. **Resolve outermost first**, then each nested boundary. Every boundary gets its own answer, and the
   outer answer is what the next one subtracts from; a boundary never inherits the corner of the box
   around it.
4. **For each boundary, ask the questions in this order.** Is there a drawn boundary at all — no means
   `RADIUS-0`. Is the shape itself a circle or a capsule — yes means `RADIUS-3`, and it stops there.
   Is the inset to the nearest boundary above smaller than that boundary's radius — yes means
   `RADIUS-4` and the value is computed. Otherwise choose the step by role: an operation is `RADIUS-1`,
   a region of content is `RADIUS-2`. Finally, ask whether every corner still exists; if an edge is cut
   or joined, `RADIUS-5` scopes the answer to the corners that remain.
5. **If two codes both match, prefer `RADIUS-4`.** `RADIUS-5` does not compete with the others — it
   layers on top, deciding *which* corners while the step or the subtraction decides *how round*. If
   one decisive fact is missing — the outer radius or the inset — ask one specific question and stop.

## `RADIUS-0` — no corner of its own

**Situation.** Either the element is **not** a boundary, or it is a real boundary that **refuses** a
corner. Two different facts, so two different emissions.

**Recognition signs**

- No background, no border, no shadow, no clipping — it only arranges its children into a row, a
  column or a grid.
- Or: it is a row or a cell inside a parent that already has `overflow-hidden` and already rounds.
- Or: it is a real plane that touches both screen edges, so there is no corner left to round.

**Ask yourself.** Is there a real boundary here? No means **write no class at all**. Yes, and it
deliberately does not round, means **write `rounded-none`**.

**Boundary**

- `RADIUS-1` and `RADIUS-2`: both of those need a boundary that is actually **drawn**. A `div` that
  only lays things out with `flex` is not a boundary, whatever it wraps.
- `RADIUS-4`: a row inside a card that clips is `RADIUS-0`, **not** `RADIUS-4`. It has no corner of
  its own to derive; the parent is cutting it.
- `RADIUS-5`: `RADIUS-5` still rounds, only on one side. `RADIUS-0` rounds nothing.

**Why the two emissions differ.** `rounded-none` is a **declaration**: somebody looked at this
boundary, saw that it would otherwise round, and decided not to. No class is an **absence**: nobody
had to decide anything. Writing `rounded-none` on a layout `div` is a lie that a decision was once
taken there.

**Common business situations.** A `flex`/`grid` wrapper · a data table cell · a row in a divided list
whose parent already clips · a notice strip running the full screen width · a header pinned to the top
of the page · a panel that becomes full-bleed on mobile · a full-bleed background image · an element
overriding a shared class that already rounds.

## `RADIUS-1` — the control step

**Situation.** A boundary the size of **one operation**: the user clicks it, types into it, or selects
it. It stands on its own, and its corner is not inside anybody's arc.

**Recognition signs**

- Its height is roughly one line of text plus padding, not a region of content.
- It has interactive states: hover, focus, disabled, checked.
- It contains no structure — inside is text, an icon, or both.

**Ask yourself.** Is this a single operation, and is its corner clear of every other arc?

**Boundary**

- `RADIUS-2`: a control **does one thing**; a surface **contains many things**. A button is `RADIUS-1`;
  the card holding that button is `RADIUS-2`. Size is not a criterion — a very wide button is still a
  control.
- `RADIUS-3`: if the shape is a capsule, it is `RADIUS-3`. The question is "is this a rounded rectangle,
  or is the shape itself round?".
- `RADIUS-4`: if the control sits close inside a surface with an inset **smaller** than that surface's
  radius, its radius is derived. `RADIUS-4` wins.

**`R / 2`, not a new number.** The control step is not an independent value somebody found pleasing; it
is **half** the surface step. That is why the scale leaves nothing to argue about: move `R` and the
control step moves with it, automatically, in proportion.

**Common business situations.** Primary and secondary buttons · inputs, textareas, selects · a square
icon button · an item in a dropdown menu · a tooltip · a small square tag or label · a large checkbox
· a calendar day cell · a pagination button · an OTP input.

## `RADIUS-2` — the surface step

**Situation.** A boundary that **owns a whole region of content**: it has its own background or border,
and what sits inside it is a structure rather than a line of text.

**Recognition signs**

- Inside there are several groups, its own heading, or both controls and content.
- It has its own padding — and that very number feeds the subtraction of a `RADIUS-4` one level down.
- Remove it and the content inside loses its support, not just its decoration.

**Ask yourself.** Is this box **containing a region**, or is it **being an operation**?

**Boundary**

- `RADIUS-1`: see above.
- `RADIUS-4`: a surface nested in a surface with an inset smaller than the outer radius does **not**
  take `rounded-xl` again. That is exactly the sticker this module exists to stop.
- `RADIUS-0`: a surface touching both screen edges has no corners left — `rounded-none`.

**Bigger is not rounder.** A dialog does not round more than a card because it is larger. Size is not
an argument; if it were, every screen would have its own radius and the system would lose its root.
Same role, same step.

**Common business situations.** A course card · a confirmation dialog · popovers and floating menus ·
an alert callout · a code block · an empty state · a standalone thumbnail · a right-hand panel · a
toast · a chart block · a login form floating on the page background.

## `RADIUS-3` — the shape is itself round

**Situation.** Not "a rectangle rounded a lot", but **a circle or a capsule**. The arc is not at the
corner; the arc **is** both ends.

**Recognition signs**

- Height and width are equal (circle), or both ends are half-circles (capsule).
- The content inside is short and always short: one letter, one number, one or two words.
- Change the radius by one step and the shape **loses its identity**, rather than looking slightly
  different.

**Ask yourself.** Rounded one step less, is this still itself?

**Boundary**

- `RADIUS-1`: a capsule button is `RADIUS-3`; a rectangular button is `RADIUS-1`. Within one screen, do
  not mix the two for the same class of button — they are two different identities.
- `RADIUS-4`: `RADIUS-3` is **exempt** from the subtraction. An avatar inside a card derives nothing.

**Why it is exempt.** Concentric subtraction acts on a **corner**. A capsule has no corner; its arc is
bounded by its height, not by a radius anyone could choose. Forcing it into the arithmetic produces a
meaningless number, and so does forcing it to **supply** one to a child — a small circle inside a large
circle is still a circle.

**Common business situations.** Avatars · a notification count badge · a filter pill · a round icon
button · the track and fill of a progress bar · a switch and its knob · a status dot · a loading
spinner · a floating action button · a rank medal · pagination dots.

## `RADIUS-4` — an inner corner inside an outer arc

**Situation.** A boundary sitting inside an already-rounded boundary where **the distance between the
two edges is smaller than the outer radius**. The inner corner then falls inside the outer arc, and it
**no longer gets to choose**:

> `inner radius = outer radius − inset`, snapped **down** to the nearest rung.

The inset is the **measured distance between the two edges**: the parent's padding, plus its border
width if the parent draws a border.

**Recognition signs**

- The inner box reaches nearly to three or four of the outer box's inner edges, separated only by a
  thin band of padding.
- The four corners of the inner box sit just inside the four corners of the outer box.
- Looking at one corner you see **two curves**, and the question is whether they run parallel.

**Ask yourself.** Is the distance between the two edges **smaller** than the outer radius? If it is,
the radius is derived, and every step code loses.

**Boundary**

- `RADIUS-1` and `RADIUS-2`: those two **choose**; this one **computes**. If it can be computed it must
  be, because a derived corner survives the next change of padding and a hand-picked one does not.
- When the inset is **equal to or greater than** the outer radius, the constraint is over. The inner
  corner has left the outer arc, the two curves can no longer see each other, and the inner box returns
  to `RADIUS-1` or `RADIUS-2` on its own merits. This is the **edge of the law**, not a way out of it:
  it is geometry, not permission to round by eye.
- `RADIUS-0`: if the inner box touches the outer edge **directly**, the inset is 0, and the answer is
  not "the radius equals the outer radius" but **the parent clips and the child stays bare**. Two
  elements rounding the same corner is the same corner declared twice, and the two declarations drift
  apart at the first change.
- `RADIUS-3`: capsules are exempt.

**Why it snaps down.** If the result falls between two rungs, take the rung **below**. An inner radius
larger than `outer − inset` is precisely what makes the two arcs cross — the sticker. A little smaller
is only slightly squarer than necessary, and nobody can read that error. Erring safely has a direction,
and its name is "down".

**The code names how a value was obtained, not what it equals.** `rounded-md` chosen for a button is
`RADIUS-1`. The same `rounded-md`, arrived at from `12 − 6`, is `RADIUS-4`. The two codes print the
same string but never make the same decision: change the parent's padding and the second must change,
while the first sits still and is wrong.

**Common business situations.** A cover image bleeding inside a card with thin padding · a summary well
inside a card · an input sitting close inside a rounded frame · a square avatar frame in a card · the
selected row of a rounded menu · a thumbnail in a rounded list item · a preview region inside a dialog
· a full-width button pinned to the bottom of a sheet · a code block inside a callout · the selected
segment inside a rounded track · a photo in a bordered frame.

## `RADIUS-5` — not every corner is free

**Situation.** The boundary is **cut** or **joined**. One or more of its edges do not terminate on
screen, or they meet another element flush, so on that side there is no corner to round.

**Recognition signs**

- The plane is anchored to a screen edge and runs off past it.
- Several elements are stacked flush, and only the first and the last touch the outside of the shared
  block.
- An element is glued to its neighbour, with no sibling seam between them.

**Ask yourself.** Does a corner still exist on this side, or does the edge continue out of view / meet
a neighbour?

**Boundary**

- `RADIUS-0`: if **no** side has a corner left, that is `RADIUS-0`, not `RADIUS-5`.
- `RADIUS-1` / `RADIUS-2`: if all four corners are free, use a step code, not a side-scoped form.
- `RADIUS-4`: these two **can overlap**, and when they do, `RADIUS-4` decides the **magnitude** and
  `RADIUS-5` decides **which corners**. An image bleeding across the top of a card with thin padding
  takes the derived value, in `rounded-t-*` form.

**Being cut does not change the magnitude.** A bottom sheet does not round more at its two top corners
because its two bottom corners disappeared. This code says only **which corners exist**; **how round
they are** is still answered by a step code or by the subtraction. Merging those two questions is how a
system ends up with two surface radii and nobody remembers why.

**Common business situations.** A bottom sheet on mobile · a drawer sliding in from an edge · a joined
segmented control · a glued button group · the first and last items of a joined vertical cluster · a
selected tab rounded at its two top corners · a cover image at the top of a card with no padding · a
table header · a search bar glued to its button · a banner anchored to the bottom of the screen.

## Inputs

| Input | Evidence required |
|---|---|
| boundary | Whether the element draws one — background, border, elevation, clip — or owns one semantically |
| role | control, surface, shape, cell, or arranger |
| outer corner | The radius of the nearest ancestor that draws a boundary, if any |
| inset | The measured distance between the two edges: the outer's padding plus any border it draws |
| edge continuity | Whether all four corners terminate on screen, or an edge is cut or joined |

## Rules

1. Consider **one real boundary** at a time. No boundary, no radius.
2. Only three values are **chosen**: `R / 2`, `R`, and the capsule limit. Every other value must be a
   **result**.
3. If a corner sits inside another corner's arc, the radius is **computed**: `outer − inset`, snapped
   down. Derivation beats selection.
4. The inset is **measured**: the outer box's padding plus its border. Never estimated from a
   screenshot.
5. An inset equal to or greater than the outer radius ends the constraint; the inner box takes its own
   code.
6. An inset of 0 means **the parent clips** and the child stays bare. Never round the same corner in
   two places.
7. A capsule takes part in no arithmetic, neither receiving a value nor supplying one.
8. Radius does **not** change with viewport, hover, focus, loading state or content length. Only a
   change of boundary changes a corner.
9. An arbitrary value (`rounded-[10px]`) is a proposed rule change, not a different choice.
10. Side- and corner-scoped classes belong to `RADIUS-5` and to no other code.

Beyond these: the code names how a value was OBTAINED, not what it equals — two codes may print the
same string but may never make the same decision — and every rendered boundary resolves to exactly one
code. No element is out of scope. `R` is the module's single tunable; moving it moves every code with
it and requires re-deriving the table, which is a rule change rather than a local decision.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it applies
to.

- **Border counts into the inset.** If the outer draws a border, the two edges are further apart than
  the padding alone says. `RADIUS-4` uses `padding + border-width`, because the arithmetic is about
  distance between edges, not about which property produced it.
- **Clip instead of derive.** When a child must reach the outer edge with no inset at all, the outer
  clips (`overflow-hidden`) and the child stays at `RADIUS-0`. This is the one exception that lets an
  element appear rounded without declaring a radius of its own.
- **Capsules are exempt.** `RADIUS-3` inside a rounded surface is still `RADIUS-3`. A capsule has no
  corner to make concentric — its arc is its entire end — so subtraction has nothing to act on.
- **Inset at or past the outer radius.** Not an exception to concentricity but the edge of it: the
  inner corner is outside the outer arc and free. It takes `RADIUS-1` or `RADIUS-2` on its own merits,
  and that freedom is geometric, not permission to round by eye.
- **Two codes both plausible.** Prefer `RADIUS-4`. If a corner can be derived it must be, because a
  derived corner survives a change of padding and a chosen one does not.
- **State parity.** Skeleton, loading, error and empty renders keep the code of the boundary they stand
  in for. A corner that changes while content loads is claiming the boundary changed.
- **Responsive.** Change the code only when the boundary **actually** changes — a panel that becomes
  full-bleed on mobile moves to `RADIUS-0` with `rounded-none`. A narrower screen with an unchanged
  boundary leaves the code unchanged.
- **Cut or joined edges.** `RADIUS-5` changes which corners are free, never the magnitude. A sheet
  anchored to the bottom of the screen is as round at the top as the same surface would be all round.
- **Focus rings and outlines.** They follow the radius of the box they trace and need no restatement.
  Restating one creates a second source of truth for the same corner.

## Output

One block per element, outermost first:

```text
element: <the boundary being decided>
role: <control | surface | shape | cell | arranger>
outer: <nearest ancestor boundary radius, or none>
inset: <measured padding + border, or none>
situation: <RADIUS-0 | RADIUS-1 | RADIUS-2 | RADIUS-3 | RADIUS-4 | RADIUS-5>
className: <no class | rounded-none | rounded-md | rounded-xl | rounded-full | derived value | side form>
reason: <the fact that excludes the adjacent code, and for RADIUS-4 the arithmetic>
```

## Worked example

**Request.** "A course card that leaves a 4px edge around its cover image, with the title and a Start
button underneath in a body padded by 12px."

The request states three boundaries — the card, the cover image, the Start button — plus one element
that draws nothing, the body that arranges the title and the button. It states no avatar, no badge, no
bottom sheet and no full-bleed mobile variant, so none of those are resolved.

```text
element: course card
role: surface
outer: none
inset: none
situation: RADIUS-2
className: rounded-xl
reason: it owns a region holding an image, a title and an action rather than being one operation, which excludes RADIUS-1
```

```text
element: cover image
role: surface
outer: rounded-xl (12px)
inset: 4px (card padding, no border stated)
situation: RADIUS-4
className: rounded-lg
reason: 4px is smaller than the 12px outer radius, so 12 − 4 = 8 is computed rather than chosen, which excludes RADIUS-2
```

```text
element: card body
role: arranger
outer: rounded-xl (12px)
inset: 4px
situation: RADIUS-0
className: no class
reason: it draws no background, border, shadow or clip, so there is no boundary to round and none to refuse, which excludes rounded-none
```

```text
element: Start button
role: control
outer: rounded-xl (12px)
inset: 16px (4px card padding + 12px body padding)
situation: RADIUS-1
className: rounded-md
reason: 16px is past the 12px outer radius so the corner has left the arc and nothing is derived, which excludes RADIUS-4
```

The request does not state whether the card draws a border. It does not have to: the card's own corner
is chosen, not derived. Had it stated a 2px border, the cover image would resolve at `12 − (4 + 2) = 6`
and print `rounded-md` instead — still `RADIUS-4`, still by subtraction. Had it asked for the cover to
touch the card edge outright, the inset would be 0 and the answer would move to the card clipping with
`overflow-hidden` and the image staying bare at `RADIUS-0`.

## Scope

This module decides corners. It does not decide the inset that feeds the arithmetic — that belongs to
the padding module, and this module only measures what that one already decided. It does not decide
whether a surface may sit inside another surface at all, nor the seam between siblings, nor borders,
shadow or colour.

It states a rule true of any front end. It names no product, no component library, no registry key and
no repository. Every example is an ordinary `className` on ordinary markup.
