# interface.plan

## Job

Name every page and modal of one feature once, decide the shared shell once, and give every unit its
own goal line, so that the blind generators that follow each build one unit inside one shell instead
of each inventing a shell of their own.

## Done when

Done when the `surface-map` names every page and modal the reference or the source shows, each with
its route or host, one goal line and its tier, decides the shared shell once, and the `units` file
carries one page or modal unit per Map row with the same id, goal and tier.

## The unit of a blind agent is one page or one modal

An agent that starts with an empty context can hold one page or one modal whole: its route, its
goal, what it reads and writes, and the shell it sits in. It cannot hold a feature, and a feature
handed to one agent becomes the eighteen-hour session in which every page is half built and the
shell is drawn three times. This operator is the only place the whole feature is seen at once. It
reads the person's reference, the source that already exists and the promise when one is bound, and
turns them into a closed list: one row per page, one row per modal, each with the route it answers
or the unit that hosts it. The list is written twice on purpose — as the Map a person reads and as
the `units` data the orchestrator fans out — and the two are one list: the validator refuses a Map
row without its entry, an entry without its row, and a goal that differs between them, because a
generator that reads two goals for one page builds neither.

## The shell is decided here and nowhere else

The sidebar, the header, the breadcrumb and the navigation order are decided once, in the Shell
table, before any unit exists. Each row names the element, the owner that renders it — the feature
layout, or the one unit that carries it — and what was decided, in terms of the compositions the
family publishes under `@grammar/core`. A generator binds that shell and never redraws it; a unit
that needs a shell element the table does not carry is a defect of this map, not a licence for the
generator to invent one. The table has at least one row, because a feature with no shared shell is
a feature that has not been looked at as a whole.

## A map is complete or it is not a map

A route or host the reference or the source shows that no Map row names is `MAP_INCOMPLETE`. The
stop is this operator's own and routes to itself: the same map runs again with the missing unit
named, or with a recorded reason why the route lies outside the feature. It is never the caller's
defect and never becomes `INVALID_INPUT`, because the caller supplied the reference and the source
and it was this operator that failed to read them. A route the source serves that the map calls new,
or a page the map describes that the checkout does not carry, is `EVIDENCE_MISSING`: a claim about
the system with no file behind it.

## Goals and data contracts travel with the unit

Every unit carries one goal line of at most the length the `units` schema allows, which is the whole
of what the execute branch is checked against; a unit without a goal is refused by the schema before
any validator reads it. Every unit also has exactly one Data contracts row saying what it reads and
what it writes, in the names the promise or the source gives the operations, so a blind generator
learns the operations its page binds from this table or from nothing. Dependencies between units —
a modal that needs its host page, a detail page that needs its list — are recorded in `dependsOn`
so the orchestrator orders the fan-out from the plan alone.

## The journey is audited, and everything else is unchecked

A map names every page and modal the feature has; the mission's "done when" lines name a journey
through some of them. Those are the `journey` units, and they are the ones the audit that follows is
dispatched over. Every other unit is `secondary`, carries the one sentence saying why the journey does
not pass through it, and is written down as unchecked in the audit lane under `@worktrees/unchecked`
instead of being verified — so a narrowed run is narrowed on record, and no run measures every screen
it can find because nobody said which ones mattered. A unit the feature already carries an open entry on is
either taken back into the journey by this map, which covers it when the audit runs, or extended by a
secondary row with a reason of this map's own; a map that simply leaves it out defers it a second time
with nobody's agreement, and is refused. Generation is not narrowed this way: every unit the map names
is built, because what to build is the person's goal and only what to prove is the journey's.

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: the map, the unit list
and `response.json`. It makes no decision inside a unit — no composition, no presentation value, no
copy — writes no source, renders no candidate, starts no server and generates no image; the design of
a unit belongs to the generator that receives it. It publishes no shared Grammar and carries no
verdict about the source.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@grammar/core` | the published Grammar as the bound app resolves it: the shell and navigation compositions a Shell row may name, and the compositions a unit may later bind | yes |
| `@workspaces/fe` | the routed frontend checkout at the frozen head: the routes, layouts, modals and drawers that already exist, read as evidence of what the map must name and never as the map itself | yes |
| `@worktrees/unchecked/<product>` | the unchecked coverage this feature already carries in the audit lane: every unit an earlier mission deferred, so this map covers it or extends it rather than deferring it again in silence | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; the promise whose journeys, states and operations the units must cover, when the feature has one | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `feature` | id | — | The feature whose pages and modals the map names; it titles the map and is the key every unit belongs to |
| `reference` | text | — | The person's reference: a screenshot path or prose describing the surface; every route or host it shows is one the map must name |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json`, the blocked map when resuming | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Read the reference: every route, host and modal the screenshot or the prose shows under the feature | `reference`, `feature` | the reference the request carries | — | — |
| 3 | Read the source: every route, layout, modal and drawer the checkout already serves under the feature, at the frozen head | — | @workspaces/fe, @tools/git | — | `EVIDENCE_MISSING` |
| 4 | Read the promise when bound: the journeys, states and operations the units must cover | — | input `business-promise-authority` | — | — |
| 5 | Decide the shell once: sidebar, header, breadcrumb and navigation order, each with the owner that renders it | — | @grammar/core for the shell and navigation compositions the family publishes, the reference, the source | — | — |
| 6 | Name every unit: one row per page and per modal, with its route or host and one goal line | — | the reference, the source, the promise | — | `MAP_INCOMPLETE` |
| 7 | Tier every unit against the mission's done-when lines: `journey` where the journey passes through it, `secondary` with one sentence of reason where it does not, and every open entry of this feature taken back or extended | — | the mission's done-when lines, the units, @worktrees/unchecked/<product> | — | — |
| 8 | Declare each unit's data contract: what it reads and what it writes | — | the units, input `business-promise-authority` | — | — |
| 9 | Write the unit list: one entry per Map row with the same id, goal and tier, its deferral reason where it has one, and the units each depends on | — | the map | `units` | — |
| 10 | Emit the map and the receipt | — | everything above | `surface-map`, `response/response.json` | — |

Step 6 is the only step that stops on the map itself: a route or host that steps 2 and 3 found and
no row names is `MAP_INCOMPLETE`, with the reason naming it in one paragraph, and nothing is emitted.
A resume begins again at step 1 and reads the reference and the source again; a re-entry whose map
names the same units as the branch it resumes is `NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `surface-map` | `response/response.md` | md | yes |
| `units` | `response/data/units.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `MAP_INCOMPLETE` | terminate |

## Next

| When | Operator |
| --- | --- |
| the map is complete: every unit is generated on its own branch, one page or modal each, carrying its unit id | `interface.generate` |
| a route the reference shows is one the person did not ask for, so the person says whether it belongs to the feature | `user` |
