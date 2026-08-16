---
id: fe-principles-divider-index
title: INDEX.md
slug: /fe/principles/divider
sidebar_label: divider
sidebar_position: 0
description: Binding rules for deciding when a boundary is drawn as a line, which element owns that line, and along which axis it runs.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `divider`

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

## Situation Codes

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

## Inputs

| Input | Evidence required |
|---|---|
| seam | What sits on each side of the boundary |
| adjacency | Whether the two sides touch, or whether a parent already spends space across the seam |
| membership | Members of one set · band and the content it governs · peer regions · one enclosed object · a two-axis matrix |
| owner | Which single element can carry the rule: the set parent, the band, the later region, or none |
| host edge | Whether a real, uninterrupted edge exists for the rule to run along |
| repetition | Whether the boundary occurs once or between every member |

## Invariants

- A boundary is stated once. A seam that already carries a gap does not also carry a rule.
- One rule has one owner. Two adjacent elements never each draw their facing edge.
- A set draws rules with `divide-*` on the parent, never with a bottom border on every member — the
  latter draws a trailing line under the last member, which is an outer boundary nobody asked for.
- A rule needs an edge to run along. A line cannot span a gap, and a rule declared on a side that is
  not adjacent to anything is a decoration.
- Axis follows the set's own axis. Vertical or horizontal is a consequence, never a criterion.
- The rule ends where its host ends. A rounded host must clip its content for the line to stop at
  the corner instead of running past it.
- `divide-*` describes the set, not the count. A set that currently renders one member keeps the
  class; the class states a rule about members, and one member has no seam to draw.
- This module never emits a colour token choice, an inset, a radius or a distance.
- Every rendered adjacency resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Sticky band.** A band that stays put while content moves under it keeps `DIVIDER-2` in every
  state, including the state where nothing has scrolled yet. The rule is what tells a reader the band
  is above the content rather than in it; making it appear on scroll makes the boundary a
  side effect of position.
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

```text
seam: <what lies on each side>
adjacency: <touching | separated by a parent gap>
owner: <set parent | band | later region | matrix + rows | standalone break | none>
situation: <DIVIDER-0 | DIVIDER-1 | DIVIDER-2 | DIVIDER-3 | DIVIDER-4 | DIVIDER-5 | DIVIDER-6>
className: <no class | divide-y divide-border | border-b border-border | border-l border-border | divide-y+divide-x | border-t border-border>
reason: <business fact that excludes the adjacent code, plus proof the boundary is not already stated by space>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
