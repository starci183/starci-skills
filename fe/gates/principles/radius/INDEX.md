---
id: fe-principles-radius-index
title: INDEX.md
slug: /gates/principles/radius
sidebar_label: radius
sidebar_position: 0
description: Binding rules for choosing a radius className, and for deriving a nested corner from the one around it.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `radius`

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

## Situation Codes

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

## Inputs

| Input | Evidence required |
|---|---|
| boundary | Whether the element draws one — background, border, elevation, clip — or owns one semantically |
| role | control, surface, shape, cell, or arranger |
| outer corner | The radius of the nearest ancestor that draws a boundary, if any |
| inset | The measured distance between the two edges: the outer's padding plus any border it draws |
| edge continuity | Whether all four corners terminate on screen, or an edge is cut or joined |

`R` is the module's single tunable. With the scale these codes are written against, `R = 0.75rem`
(`rounded-xl`), the control step is exactly `R / 2` = `0.375rem` (`rounded-md`), and the derived
values fall on `0.5rem`, `0.375rem`, `0.25rem` and `0.125rem`. Moving `R` moves every code with it and
requires re-deriving the table — which is a rule change with a changelog entry, not a local decision.

## Invariants

- One root. Only `R / 2`, `R` and the capsule limit are chosen; every other value is `outer − inset`.
- A derived radius is computed from a **measured** inset, never estimated from a screenshot.
- Concentric binds only while `inset < outer radius`. At or beyond that distance the inner corner has
  left the outer arc entirely, the outer no longer constrains it, and the inner takes its own code.
- When the arithmetic lands between two rungs, take the rung **below**. Never the rung above: a corner
  larger than `outer − inset` is the sticker this module forbids.
- The code names how a value was OBTAINED, not what it equals. Two codes may print the same string —
  `rounded-md` chosen for a control is `RADIUS-1`, `rounded-md` reached by subtraction is `RADIUS-4` —
  but they may never make the same decision.
- An element that owns no boundary owns no radius.
- Clipping is the outer boundary's job. Rows and cells do not re-state the corner their parent clips.
- A capsule takes part in no arithmetic: it neither derives from an outer corner nor supplies one.
- Radius does not change with viewport, hover, focus, loading or content length. Only a change of
  boundary changes a corner.
- Arbitrary values — `rounded-[10px]`, a one-off token, a corner copied from a mock — are a rule
  change, not a choice.
- Side- and corner-scoped classes belong to `RADIUS-5` and to no other code.
- Every rendered boundary resolves to exactly one code. No element is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Border counts into the inset.** If the outer draws a border, the two edges are further apart than
  the padding alone says. `RADIUS-4` uses `padding + border-width`, because the arithmetic is about
  distance between edges, not about which property produced it.
- **Clip instead of derive.** When a child must reach the outer edge with no inset at all, the outer
  clips (`overflow-hidden`) and the child stays at `RADIUS-0`. Two elements rounding the same corner
  is the same corner declared twice, and the two declarations drift apart at the first change.
- **Capsules are exempt.** `RADIUS-3` inside a rounded surface is still `RADIUS-3`. A capsule has no
  corner to make concentric — its arc is its entire end — so subtraction has nothing to act on.
- **Inset at or past the outer radius.** Not an exception to concentricity but the edge of it: the
  inner corner is outside the outer arc and free. It takes `RADIUS-1` or `RADIUS-2` on its own merits,
  and that freedom is geometric, not permission to round by eye.
- **Two codes both plausible.** Prefer `RADIUS-4`. If a corner can be derived it must be, because a
  derived corner survives a change of padding and a chosen one does not.
- **State parity.** Skeleton, loading, error and empty renders keep the code of the boundary they
  stand in for. A corner that changes while content loads is claiming the boundary changed.
- **Cut or joined edges.** `RADIUS-5` changes which corners are free, never the magnitude. A sheet
  anchored to the bottom of the screen is as round at the top as the same surface would be all round.

## Output

```text
element: <the boundary being decided>
role: <control | surface | shape | cell | arranger>
outer: <nearest ancestor boundary radius, or none>
inset: <measured padding + border, or none>
situation: <RADIUS-0 | RADIUS-1 | RADIUS-2 | RADIUS-3 | RADIUS-4 | RADIUS-5>
className: <no class | rounded-none | rounded-md | rounded-xl | rounded-full | derived value | side form>
reason: <the fact that excludes the adjacent code, and for RADIUS-4 the arithmetic>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module decides corners. It does not decide the inset that feeds the arithmetic — that belongs to
the padding module, and this module only measures what that one already decided. It does not decide
whether a surface may sit inside another surface at all, nor the seam between siblings, nor borders,
shadow or colour.

It states a rule true of any front end. It names no product, no component library, no registry key and
no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
