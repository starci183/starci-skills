# uat.plan

## Job

Enumerate the user journeys the mission goal names, one flow per journey with its entry route, its
step budget, its own account alias and its own seed namespace, so that the blind walkers that follow
each walk one flow and no two of them ever share a row.

## Done when

Done when the `uat-plan` names one flow per journey the goal names, each with its entry route, its
step budget, its own account alias and its own seed namespace, and the `units` file carries one flow
unit per Flows row with the same id.

## The unit of a blind walker is one flow

A walker that starts with an empty context can hold one journey whole: where it enters, which
controls it presses in order, who it signs in as and what it must find seeded. It cannot hold a
mission's worth of journeys, and a mission handed to one walker becomes the run that seeds
everything, signs in as everybody and proves nothing about any of them. This operator is the only
place the goal is read for its journeys: every journey the goal names — an actor doing one thing
that ends in one observable state — becomes one Flows row and one `units` entry with the journey as
its goal line, and the two are one list. The Flows table carries what a walker needs before it
drafts anything: the route the journey enters at, its budget in steps, its account alias and its
seed namespace.

## Every flow owns its rows

Two walkers that share an account share a sign-in, and then each proves the other's session; two
walkers that share a seed namespace share a cleanup, and one run's rollback becomes the other's
failure. The plan therefore gives every flow its own account alias and its own namespace, disjoint
from every other flow of the plan, and the validator refuses a plan in which two rows carry the same
alias or the same namespace. A flow folder that already exists keeps the name, the aliases and the
namespace it has, because a record nobody can predict is a record nobody reads; the plan reuses it
and never renames it.

## A journey without an entry is not a flow

A journey the goal names that starts nowhere the surface map or an existing flow shows is
`FLOW_UNDEFINED`. The stop is this operator's own and routes to itself: the same plan runs again
with a surface map that names the entry, or with the entry route named in the goal. It is never the
caller's defect and never becomes `INVALID_INPUT`, because a goal is allowed to name a journey in a
person's words and it is this operator that turns words into an entry route.

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: the plan, the unit list
and `response.json`. It drafts no flow document, seeds nothing, provisions no account, signs in
nowhere, opens no browser and walks nothing; the walk belongs to the operator that receives one flow.
It names credentials by alias only and has no field that could hold one.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/_templates` | the UAT flow template the tree ships: the shape a flow folder takes, its cases, the aliases they act as and its seed, so every planned flow is one a walker can draft | yes |
| `@worktrees/uat/<flow>` | the flow folders that already exist under the feature: a flow that exists keeps its name, its account aliases and its seed namespace | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `surface-map` | `interface.plan`; the pages and modals the journeys cross, with the routes they enter at, when the mission built a surface | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `goal` | text | — | The mission goal in the person's words; every journey it names becomes one flow |
| `feature` | id | — | The feature key that addresses the flow directories and titles the plan |
| `env` | id | dev | The environment whose flow folders, accounts and seed the flows are planned for |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json`, the blocked plan when resuming | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Read the goal: every user journey it names, each as one sentence with the actor that walks it | `goal` | the goal the request carries | — | — |
| 3 | Read the surface map when bound: the entry route each journey starts at and the pages and modals it crosses | — | input `surface-map` | — | — |
| 4 | Read the flow folders that exist under the feature: a flow that exists keeps its name, its aliases and its namespace | `feature`, `env` | @worktrees/uat/<flow>, @worktrees/_templates for the shape a flow folder takes | — | — |
| 5 | Name one flow per journey with its entry route and its budget in steps | — | the journeys, the map, the existing flows | — | `FLOW_UNDEFINED` |
| 6 | Give every flow its own account alias and its own seed namespace, disjoint from every other flow of the plan | `env` | the flows, @worktrees/uat/<flow> for the aliases already provisioned | — | — |
| 7 | Write the unit list: one flow unit per Flows row with the same id and the journey as its goal | — | the plan | `units` | — |
| 8 | Emit the plan and the receipt | — | everything above | `uat-plan`, `response/response.json` | — |

Step 5 is the only step that stops on the plan itself: a journey that step 2 found and no map or
folder gives an entry to is `FLOW_UNDEFINED`, with the reason naming it in one paragraph, and
nothing is emitted. A resume begins again at step 1 and reads the goal and the map again; a re-entry
whose plan names the same flows as the branch it resumes is `NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `uat-plan` | `response/response.md` | md | yes |
| `units` | `response/data/units.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `FLOW_UNDEFINED` | terminate |

## Next

| When | Operator |
| --- | --- |
| every flow has its entry, its account alias and its namespace: each flow is walked on its own branch carrying its unit id | `uat.verify` |
| a journey the goal names is one the person may not want walked, so the person says whether it belongs to the mission | `user` |
