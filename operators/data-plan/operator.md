# data.plan

## Job

Name every seed the mission needs once — one unit per flow the UAT plan names and per data family
the goal names — each with its goal, its own namespace, its target stores, its representative volume
and its rollback, so that the blind seeders that follow each place one unit and no two of them ever
share a row.

## Done when

Done when the `seed-plan` names one unit per flow or data family the goal, the UAT plan or the surface
map names, each with its own namespace and at least one target carrying its attribution, its volume
and its rollback, and the `units` file carries one unit per Units row with the same id and goal.

## The unit of a blind seeder is one attributable set of rows

A seeder that starts with an empty context can hold one seed whole: which rows must already stand
before a flow starts or a surface is judged, whose they are, how many there are and what removes
them. It cannot hold a mission's worth of seeds, and a mission handed to one seeder becomes the run
that fills every store under one namespace, so that one flow's rollback is another flow's failure.
This operator is the only place the mission is read for its data at once. Every flow the UAT plan
names becomes one unit carrying the namespace the flow's row declared, and every data family the
goal names that no flow covers — the catalogue a list page must show at density, the rows a check
must find standing — becomes one unit of its own. In the `units` vocabulary a seed unit is the
`table` kind: one set of rows placed together and rolled back together, keyed by the flow or the
family it serves. The list is written twice on purpose — as the Units table a person reads and as
the `units` data the orchestrator fans out — and the two are one list: the validator refuses a row
without its entry, an entry without its row, and a goal that differs between them.

## A namespace is owned by one unit

The isolation law the runtime owner publishes under
[Two sessions, one product](../runtime-serve/operator.md#two-sessions-one-product) says what makes
a row attributable, and this operator does not restate it; it decides, per target, which of the
law's two attributions the unit takes — the unit's provisioned account where the store has an owner
column, the unit's prefix where an identifier can carry it — and records a store with neither as a
`limitation` of that target, never as a column to be added. A namespace belongs to exactly one unit
of the plan, and the validator refuses two rows that share one, because two seeders on one
namespace share a cleanup. A flow whose folder already carries a seed keeps the namespace it has,
and a namespace a folder already holds is one no new unit may claim.

## Volume is the density the audit judges against

Every target row states its representative volume: the count of rows the surface is meant to carry,
not the one row that lets a flow pass. The audit measures its data-bound criteria at that volume and
routes to the seeder when it finds less, so a volume understated here is an audit that passes on an
empty page. The rollback cell says what removes exactly those rows and nothing else — the rows the
account owns, the rows whose identifier carries the prefix — so the seeder's rollback set can be
checked against the plan before a row is placed.

## A seed nobody can place is not a unit

A flow or a family that step 2 or 3 found and no store at the frozen head can hold — no entity, table
or collection that its rows would land in — is `SEED_UNDEFINED`. The stop is this operator's own and
routes to itself: the same plan runs again with the store named in the goal, or with a surface map
whose data contract names it. It is never the caller's defect and never becomes `INVALID_INPUT`,
because a goal is allowed to name a family in a person's words and it is this operator that turns
words into a store. A target the plan would name that the checkout does not declare is
`EVIDENCE_MISSING`: a claim about the stores with no file behind it.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| plan matches schema, cases and namespace | reuse unit id, JSON ref, optional SQL ref and cleanup | each precondition maps once; fixture does not create asserted outcome | emit plan unchanged |
| plan missing | create unit with JSON; SQL only for bound runner | case sheet has actor, precondition, input, actions, expected, verification, cleanup before seed | emit seed-plan and units |
| plan invalid | update affected refs/volume/attribution/cleanup | validate JSON/SQL and disjoint namespaces | undefined store hands to `architecture.decide` |
| seed effect requested | write no data | record `data.seed` as sole effect owner | typed handoff |

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: the plan, the unit list
and `response.json`. It drafts no seed directory, places no row, removes none, provisions no account,
reaches no store and changes no schema; the placing belongs to the seeder that receives one unit. It
names accounts by alias only and has no field that could hold a credential.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/be` | the routed backend checkout at the frozen head: the entities, tables and collections its stores declare, read to name each unit's targets and to tell whether a target has an owner column or a prefixable identifier; never written | yes |
| `@worktrees/_templates` | the seed template the tree ships: the shape a seed directory takes, its records, its expectation and its rollback set, so every planned unit is one a seeder can draft | yes |
| `@worktrees/uat/<flow>` | the flow folders that already exist under the feature: a flow with a seed keeps its namespace, and a namespace a folder already holds is one no new unit may claim | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `uat-plan` | `uat.plan`; the flows the mission walks, each with the seed namespace its unit takes, when the mission plans a walk | no |
| `surface-map` | `interface.plan`; the pages whose data contracts say what each reads, so a family the goal names has its stores, when the mission built a surface | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `goal` | text | — | The mission goal in the person's words; every data family it names that no flow covers becomes one unit |
| `feature` | id | — | The feature key that addresses the flow folders and titles the plan |
| `env` | id | dev | The environment whose stores and flow folders the units are planned for |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json`, the blocked plan when resuming | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Read the goal: every data family it names, the rows a surface or a check must find already standing | `goal` | the goal the request carries | — | — |
| 3 | Read the UAT plan when bound: one unit per flow, with the namespace the flow's row declares | — | input `uat-plan` | — | — |
| 4 | Read the surface map when bound: the stores each page's data contract reads, so a family has its targets | — | input `surface-map` | — | — |
| 5 | Read the stores at the frozen head: every entity, table and collection, and for each whether it has an owner column or a prefixable identifier | `env` | @workspaces/be, @tools/git | — | — |
| 6 | Inspect existing plans and fixtures, retaining reusable namespaces and classifying missing or invalid JSON, optional SQL, expected-state and cleanup refs | `feature` | @worktrees/uat/<flow>, @worktrees/_templates for the shape a seed directory takes | — | — |
| 7 | Reuse valid units, create missing units and update invalid ones with disjoint namespaces and no fixture that pre-creates a tested outcome | — | the families, the flows, the existing folders | — | `SEED_UNDEFINED` |
| 8 | Declare each unit's JSON fixture, optional SQL input, stores, attribution, volume, expected read-back and exact cleanup; verify them against schema | — | the units, the stores | — | `EVIDENCE_MISSING` |
| 9 | Write the unit list: one entry per Units row with the same id and goal, and the units each depends on | — | the plan | `units` | — |
| 10 | Emit the plan and the receipt | — | everything above | `seed-plan`, `response/response.json` | — |

Step 7 is the only step that stops on the plan itself: a flow or a family that steps 2 and 3 found and
no store can hold is `SEED_UNDEFINED`, with the reason naming it in one paragraph, and nothing is
emitted. A resume begins again at step 1 and reads the goal, the plan and the stores again; a re-entry
whose plan names the same units as the branch it resumes is `NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `seed-plan` | `response/response.md` | md | yes |
| `units` | `response/data/units.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `SEED_UNDEFINED` | terminate |

## Next

| When | Operator |
| --- | --- |
| every unit has its namespace and its targets: each unit is placed on its own branch by the seeder, carrying its unit id | `data.seed` |
| a data family the goal names is one the person may not want seeded, so the person says whether it belongs to the mission | `user` |
