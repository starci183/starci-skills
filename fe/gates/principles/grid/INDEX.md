---
id: fe-principles-grid-index
title: INDEX.md
slug: /gates/principles/grid
sidebar_label: grid
sidebar_position: 0
description: Binding rules for the column field, how many columns a container may declare, and what may break out of it.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `grid`

## Law

Columns are a promise the page makes once and then keeps everywhere: content lands on shared
vertical edges, so a reader can predict where the next thing begins before it has loaded. A column
count is therefore a property of the FIELD the page agreed on, not a preference a section may
re-invent.

Two elements carry two different decisions and must not be the same element. The **field** owns the
measure and the outer margin — where content is allowed to exist. The **track container** owns how
many columns exist inside that measure. A **child** owns only what it claims from those tracks:
one column, several, or a deliberate escape.

**This is binding, not advisory.** Any region that lays out repeated peer items has a grid
situation, every child of a track container has a grid situation, and the page shell that bounds
them has one too. There is no size at which a layout is too small to be exempt: a two-up pair of
summary tiles is `GRID-1` for the same reason a catalogue is, and a hero image touching the viewport
edge is `GRID-7` whether it appears once or on every page. "It is only two boxes" is not an
exemption — it is the single most common place this rule gets skipped, and skipping it is how a
codebase ends up with a dozen unrelated column counts and no field at all.

## Situation Codes

Every situation this module governs carries a code, `GRID-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two of them
emit nothing.

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
CHILD placed in tracks. Read the axis first — "am I naming a container, the field, or a child?" —
and the set answers in one step.

`GRID-0` AND `GRID-5` ARE SITUATIONS THAT EMIT NOTHING. There is no `grid-cols-1`-by-default class
for a stacked list, and no `col-span-1` on an ordinary cell. Both codes exist because the absence of
a declaration is a decision someone made, and a decision with no name is a decision nobody can be
shown to have got wrong. Writing `col-span-1` claims a child negotiated with the grid when it
accepted the default; writing `grid grid-cols-1` claims a field has one column when it has none.

The field carries one column count per breakpoint, and a `GRID-1` count must divide it:

| Breakpoint | Field columns | Counts a container may declare |
|---|---|---|
| base | 4 | 1, 2, 4 |
| `sm` / `md` | 8 | 1, 2, 4, 8 |
| `lg` and above | 12 | 1, 2, 3, 4, 6, 12 |

The ladder is 4 / 8 / 12, following the Material layout grid rather than the Carbon 2x grid's
4 / 8 / 16, for one reason that is checkable rather than aesthetic: 12 divides by 2, 3, 4 and 6, so
a three-up row lands on field edges; 16 does not divide by 3, so every three-up row inside it is
either fractional or off-field. A count outside its row of this table — `grid-cols-5`,
`grid-cols-7`, `lg:grid-cols-9` — is a rule change, not a layout choice.

## Inputs

| Input | Evidence required |
|---|---|
| field | The element owning the measure and the outer margin, and its column count per breakpoint |
| container | The element declaring tracks, and whether it is the field itself |
| item source | Whether the number of items is authored or comes from data |
| item role | Whether children are interchangeable or each track has a named role |
| alignment | Whether items in successive rows must share a vertical edge |
| geometry | Which element decides width, and which merely fills what it is given |

## Invariants

- The field owns the measure and the outer margin. The track container owns the tracks. One element
  does not own both.
- A declared column count divides the field's count at that breakpoint.
- The gutter is the only horizontal space between columns. A column adds no horizontal margin of its
  own to create separation.
- Gutter width is not chosen here. The seam module owns the value; this module owns the fact that
  one field carries one gutter per breakpoint.
- The outer margin is never smaller than the gutter.
- Every child of a track container resolves to exactly one of `GRID-5`, `GRID-6`, `GRID-7`.
- A child never sets its own `width` or `basis` to imitate a span.
- Changing the count at a breakpoint does not change the code.
- A situation code maps to exactly one className shape, and no className shape serves two codes.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Tables.** A `<table>` runs its own column algorithm. It is a single child of a track container —
  `GRID-5` or `GRID-6` — and its internal columns are outside this module.
- **Reading measure.** Long-form prose is capped by legibility, not by the field count. A narrower
  measure nested inside the field is a second `GRID-4`, and it is the only nested field allowed.
- **Exactly one item, forever.** A container that renders one thing and always will is `GRID-0`, not
  `GRID-1` with a count of one.
- **Unknown item count.** When the number of items comes from data and the design states only how
  narrow an item may get, the situation is `GRID-2` and declaring a fixed count is a guess.
- **Scrolling rail.** A horizontally scrolled row is `GRID-2` along its scroll axis; if it also
  reaches past the field's margin it carries `GRID-7` as a child at the same time. Two codes, two
  elements, never two codes on one element.
- **Two adjacent codes both match.** Choose the one that declares less: `GRID-0` over `GRID-1`,
  `GRID-5` over `GRID-6`, `GRID-6` over `GRID-7`. Ask one discriminating question only when the
  requester explicitly requires the stronger claim.

## Output

```text
field: <measure owner, outer margin, field count at this breakpoint>
container: <track owner>
child: <the element being placed, when the situation is a child>
situation: <GRID-0 | GRID-1 | GRID-2 | GRID-3 | GRID-4 | GRID-5 | GRID-6 | GRID-7>
className: <no class | grid-cols-* | named tracks | measure | col-span-* | break-out>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
