# Operation kinds, lanes and routes: the workflow brain as data

`profiles/kinds.yaml` is the catalog, `execution/kind-graph.mjs` is the pure module that reads it, and
together they own the process of a workflow: which operation kinds exist, which sequence a ledger node must
walk, and where an outcome may go. The kernel calls the module; nothing here runs an agent.

## Why data, not an agent

A language model is good at filling one operation's content and at picking among options that were put in
front of it. It is bad at being the control loop: asked twice, it answers twice differently, skips the step
that felt redundant, invents a repair kind nobody defined, and retries until the budget is gone. 5.0 already
moved scheduling, acceptance and allocation into code ([v5-plan.md](v5-plan.md) §1 F5); this profile moves the
last piece, the *shape of the process*, with it.

So the division is explicit. The graph decides **what kind of operation comes next, with what origin, and how
many times** - from a file anyone can diff and a validator anyone can run. The model decides **what goes
inside that operation** and answers the closed options its report offers. An operation that wants a different
process has exactly one move: report a blocker the vocabulary names, and let the graph route it. There is no
prompt that widens the lane, and a process change is a reviewable commit rather than a better-worded brief.

The same property makes the workflow explainable before it runs: `describeLane` prints the mandatory sequence
into an operation contract or a status view, so the agent doing step two can see that step three exists and
that skipping it is not available.

## The catalog

Nine kinds, and the list is closed in both directions: `validateGraph` reports `catalog-drift` when the
profile and the `KINDS` constant of `execution/kind-graph.mjs` disagree, so a tenth kind cannot appear by
accident. `family` says what an operation is for, `role` is the allocator role of
[`profiles/runtimes.yaml`](runtime-allocation.md) (and must equal its `roleOfKind` entry), `mutates` is what it
may change, and `operator` is the launchable operator contract in `ops/` that carries it.

| kind | family | role | read-only | mutates | operator | purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `business.decide` | design | decide | no | srs, decision | `business.decide` | Settle what the product must do, before anything is designed against it. |
| `architecture.decide` | design | decide | no | sds, decision | `architecture.decide` | Settle how the product realises a requirement. |
| `architecture.revise` | repair | decide | no | sds | `architecture.decide` | Repair a design record a builder found silent or wrong; bump its `rev`. |
| `interface.draw` | design | write | no | design | `interface.draw` | Draw screens, contracts and states before any interface code exists. |
| `frontend.implement` | build | implement | no | code | `interface.implement` | Build the interface the drawing settled. |
| `backend.implement` | build | implement | no | code | `backend.implement` | Build one slice of behind-the-interface behaviour. |
| `runtime.operate` | build | implement | no | runtime, code | `runtime.operate` | Migrations, environment, deployment, infrastructure. |
| `e2e.verify` | prove | verify | no | code | `e2e.verify` | Prove one delivered slice through its public API on the real stack, never a screen, and leave the scenario spec with its run output. |
| `uat.verify` | prove | verify | no | code | `uat.verify` | Walk one end-to-end scenario on the rendered surface and leave it with its evidence. |
| `review.verify` | prove | verify | **yes** | - | `review.verify` | Read the slice against its acceptance and report findings, repairing nothing. |

Each kind also declares `reports`: the outcomes it may end with and the blocker kinds it may raise. That is
what makes a route reachable or not - `review.verify` may not raise `shared-change`, because a kind that
changes nothing cannot need a path it is not allowed to write.

## The lanes

One ledger node, one lane, walked in order. `match` is the node shape (`kind`, plus the `backend`/`frontend`
side from the node's layout or from its repository binding); the first lane whose match fits wins, so the
list runs from the most specific to the least.

| lane | node shape | mandatory sequence |
| --- | --- | --- |
| `implementation/frontend` | `implementation` + frontend side, or `ui` | `interface.draw` (optional when `node.hasInterfaceDesign`) -> `frontend.implement` -> `uat.verify` |
| `implementation/backend` | `implementation` + backend side, or no side named | `backend.implement` -> `e2e.verify` -> `review.verify` |
| `e2e` | `e2e` (API scenario node; completion profile `e2e`: assertions only) | `e2e.verify` |
| `uat/frontend` | `uat` + frontend side | `uat.verify` |
| `uat` | `uat` | `e2e.verify` |
| `operations` | `operations` | `runtime.operate` -> `review.verify` |
| `architecture` | `architecture` | `architecture.decide` |
| `business` | `business`, `business-overview` | `business.decide` |

`nextKind(lane, doneKinds)` answers the one step that may run now. The order is mandatory in the strong
sense: a step that is neither done nor a satisfied optional is returned *even when a later step already ran*,
so a frontend node whose code exists but whose drawing does not is sent back to `interface.draw` rather than
waved through. A step is optional only through a named predicate - `optionalWhen: node.hasInterfaceDesign`
- which the kernel evaluates; a predicate that is absent or false is false, so the default is always to run
the step.

Two invariants the validator enforces on every lane: a lane that builds must prove afterwards
(`lane-build-without-proof`), and no design step may stand after a build step (`lane-design-after-build`).
A node kind no lane claims gets `[]`, not a default lane: the kernel must ask the user instead of guessing.

## The routes

`routeFor({outcome, blocker, verdict, kind, lane})` gives the one bounded answer: the kind to create, the
origin to create it with, what happens to the reporter (`then`), and how many times this route may fire for
the same node group (`limit`). A clean result routes nothing - the lane simply advances.

Two targets are symbolic so the routes stay product-agnostic: `same` is the reporter's own kind (a shared
change a frontend op needs is a frontend op) and `lane.build` is the build step of the reporter's lane (a red
walk repairs what that lane builds). Both need the reporter's context; an unresolvable symbol comes back as
`unresolved`, never as a default kind.

| on | from | to | origin | limit | then |
| --- | --- | --- | --- | --- | --- |
| outcome `failed` | `uat.verify` | `lane.build` | repair | 3 | reopen |
| outcome `failed` | `e2e.verify` | `lane.build` | repair | 3 | reopen |
| verdict `findings` | `review.verify` | `lane.build` | repair | 3 | settle |
| verdict `rejected` | any | `same` | - | 2 | retry |
| verdict `gate-failed` | any | `lane.build` | gate | 3 | settle |
| blocker `sds-gap` | any | `architecture.revise` | architecture | 2 | reopen |
| blocker `interface-gap` | any | `interface.draw` | architecture | 2 | reopen |
| blocker `shared-change` | any | `same` | shared | 3 | pause |
| blocker `environment` | any | *the user* | - | 1 | needUser |
| blocker `authority` | any | *the user* | - | 1 | needUser |
| outcome `ask` | any | *the user* | - | 1 | needUser |
| outcome `partial` | any | `same` | - | 5 | retry |
| outcome `failed` | any | `same` | - | 3 | retry |

`then` is what happens to the operation that reported: `retry` runs the same op again (no new op), `reopen`
returns it to pending behind the routed op, `pause` parks it until the routed op is done, `settle` finishes it
and lets the routed op carry the work forward, `needUser` stops the workflow.

The first matching route wins, so the ordered list is the specificity order, and `validateGraph` refuses a
route an earlier one already shadows (`route-shadowed`), a blocker no route answers (`unrouted-blocker`), a
route without a limit, a route from a prove kind into a design kind (`prove-to-design`: a prover asks for a
redesign, it never is one), a design target that does not pause or reopen its requester, and a cycle between
two named kinds (`route-cycle`).

## The module

`execution/kind-graph.mjs` is pure apart from `loadKinds`, which reads the compiled
`.dist/profiles/kinds.json` exactly as `loadRuntimes` reads the allocator profile (or an authored
`profiles/kinds.yaml` when given a `profileDir`).

| export | signature | answers |
| --- | --- | --- |
| `loadKinds` | `({profileDir?}) -> profile` | the catalog, compiled or authored |
| `validateGraph` | `(profile?, {runtimes?, operators?}) -> errors[]` | every named way the process can be wrong; `[]` is valid |
| `assertGraph` | `(profile?, {runtimes?, operators?}) -> profile` | the same, as a throw |
| `laneFor` | `(node, {profile?}) -> kind[]` | the mandatory sequence of one ledger node |
| `laneRecordFor`, `laneById` | `-> lane \| null` | the lane with its matches and optional steps |
| `nextKind` | `(lane, doneKinds, {predicates?, profile?}) -> kind \| null` | the one step that may run now |
| `describeLane` | `(lane, {profile?}) -> string` | a markdown one-liner for a contract or a status view |
| `routeFor` | `({outcome, blocker, verdict, kind, lane}, {profile?}) -> route \| null` | where one report goes, bounded |
| `routeList`, `kindList`, `kindRecord` | `({profile?})` | the catalog for a status view |
| `roleOf`, `familyOf`, `isReadOnly`, `mutationsOf`, `operatorOf`, `reportsOf`, `predicatesOf` | `(kind, {profile?})` | one property of one kind |
| `KINDS`, `FAMILIES`, `ROLES`, `MUTATIONS`, `ORIGINS`, `OUTCOMES`, `BLOCKERS`, `VERDICTS`, `THEN`, `SAME`, `LANE_BUILD` | constants | the closed vocabularies |

`tests/kind-graph.spec.mjs` holds the shipped profile to all of it: it validates against the real runtime
profile and the real operator catalog, every lane's kinds exist, the frontend lane cannot be entered in the
middle, `optionalWhen` skips a step only for a satisfied named predicate, every route resolves with a limit,
and every invalid profile is rejected with its named error code.
