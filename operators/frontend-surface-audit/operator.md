# frontend.surface.audit

## Job

Observe the committed surface at the served route across the matrix the direction's coverage implies,
measure every node that carries a claim, and judge each measurement against the published proof rules
by the owner of the node it stands on.

## Readiness, capture and judgement are one job

Splitting them produced a familiar failure: a capture taken before the surface was ready, judged by a
step that could no longer tell, against evidence it had not itself collected. One operator that
waits, measures and judges under one receipt cannot lose that connection.

## A guarded route is reached, not declared unavailable

A route that answers with a sign-in screen is serving perfectly well; what is missing is an identity,
and an identity is something the runtime has. Readiness therefore includes signing in as the flow's
own account when the route requires one: the credential is resolved by name, it is typed into the form
and nowhere else, and capture begins only once the redirect has landed, so no frame this operator
publishes can hold it. Reporting a guarded route as an unavailable runtime is a false negative that
sends a person to restart a service that was never down. The one honest stop here is that no account
exists for this flow yet, which is `IDENTITY_MISSING`: a hand-off to the operator that provisions one,
never a verdict about the surface, and never a request that a person go and make an account.

## Readiness reads the entry of this route

The runtime registry holds one entry per project route, and this audit reads the entry of the route it
was bound to. A registry consulted as a single block answers for whichever route happens to be
recorded in it, which is how an audit comes to report that nothing is serving while the surface it
needs is on screen.

## The surface must contain the committed surface

The applied receipt names the commit it wrote, and the runtime serves one integration branch per
product carrying the work of every session that asked for it. So the test is not equality — that
would fail the moment a second session existed, and fail on arithmetic rather than on evidence — it
is ancestry: the applied commit must be an ancestor of the served head, and present among the commits
the bound route records as contained. A served head that fails that test is `SOURCE_DRIFT` with
nothing captured, because a measurement of another tree proves nothing about this one. The receipt
states both commits under `## Served surface`, since ancestry a reader cannot see is a claim.

The endpoint is the one the bound route carries, never one this operator derived: the route names the
port its entry serves, and readiness is reached there. When the served head does not contain the
applied commit, or nothing is serving at all, `RUNTIME_UNAVAILABLE` names the commit that must be
served and the operation that would serve it, and the runtime owner is the one that acts.

## A served surface can also drift in the family it renders

Clean ancestry proves the source is right; it proves nothing about the family the served head renders
the source through. The integration branch also merges from the mainline, so a Grammar or other
dependency version the session never resolved against can already be on the served head by the time
this audit runs, and a presentation verdict that flips over that has nothing to do with the source
this session wrote. `## Served surface` therefore always names the family version this served head
actually renders and the version the delivery was resolved against, side by side; when they differ,
the drift is not left implicit in the ancestry check that already passed. Wherever a verdict's own
measured evidence is the one a version drift could have flipped rather than the source, that node's
own measured text names both versions again, so a reader is never left guessing which of the two
possible causes produced the verdict. This is evidence, not a new gate: it names no scope question and
stops at nothing the surface's own proof rules did not already stop at.

## Two sessions on one product

The isolation law is published once, by the operator that owns the runtime, and this audit works
inside it rather than restating it: one product serves one integration branch on one port, and what
keeps two concurrent audits from reading each other's state is that each drives its own browser
profile. That profile is recorded under `## Served surface`, so a receipt whose sign-in state came
from somewhere else is visible instead of merely suspected.

## Measurement beats claim, always

Each node carries the identifiers it claims to satisfy, and the audit measures what the surface
actually renders. A claim is never evidence of passing: a node claiming `GAP-4` while the computed
gap measures `1.5rem` is a failure, and no amount of claiming changes the measurement. That is the
whole mechanic, and it is why the claim exists.

## The owner decides where a failure goes

A failing claim on an application-owned node is a value the resolution has to publish again, so it
routes back to `frontend.presentation.resolve`, which is the operator that caps the rounds. A failing claim
on a Grammar component's own render is a Grammar gap: it goes to a person and into the family's own
gap table, never into a resolve loop, because no application value can fix a component. The interior
of an application-owned node carries no claim and is not audited at all; only that node's own measure
rules are.

## The audit changes nothing

No verdict is a repair, a workaround or an instruction. A failure stays a failure in the receipt
until a resolution publishes a new value and the applier writes it, and the same surface is audited
again. That separation is why the receipt is worth anything: an operator that could fix what it found
would always be able to report a clean surface.

## Boundary

Context is read-only, and the runtime is consumed, never owned. The operator writes only `response/`
of its own branch: the audit receipt, its captures, its screenshots and its verdicts. It does not
modify product source, the applied tree, knowledge or Grammar, repair, restyle or work around
anything it observes, start, stop, deploy or reconfigure a runtime service, cite a rule identifier
absent from the bound inventory, judge a node it did not measure, or accept a claim as evidence that
a node passes.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@knowledge/ui/proof` | what only becomes true once rendered; the audit's whole rule inventory | yes |
| `@workspaces/fe` | the routed checkout at the commit the application wrote; the owners and identifiers observed there | yes |
| `@worktrees/sessions/central-runtime` | the shared runtime owner: the preview serving the session worktree at that commit | yes |
| `@knowledge/grammars/starci` | how the Core family is meant to realize Common, and where its gaps are recorded | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-source-application` | `frontend.source.apply`, the commit under observation and the claims it wrote | yes |
| `frontend-presentation-resolution` | `frontend.presentation.resolve`, the owner of every node | yes |
| `frontend-direction-decision` | `frontend.direction.decide`, the route and the coverage the matrix is derived from | yes |
| `route` | `workspace.bind`, the bound route: the endpoint its entry serves and the commits the served head contains | yes |
| `uat-account` | `platform.operate`, the account the guarded route is reached as; absent on the first pass, which is what `IDENTITY_MISSING` hands over | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `matrix` | list | every coverage entry | The matrix entries to capture; the person may only narrow what the coverage implies |
| `readinessProbe` | choice | route-served | The floor for readiness; a state that needs data rises to `route-and-data-served` on its own |
| `account` | id | null | The account record the route is signed in as when it requires an identity; the value is a reference to a record of names, never a credential |
| `env` | id | dev | The stack whose registry entry and accounts this audit reads; a surface observed in one stack says nothing about another |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and confirm the applied commit is inside the head the route is serving | `resume` | `request/request.json`, input `frontend-source-application` (the commit it wrote), input `route` (the served branch, the served head and the commits it contains), @workspaces/fe at the frozen head, @worktrees/sessions/central-runtime, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the authority | — | @knowledge/ui/proof (every topic with its fingerprint and inventory), input `frontend-source-application` (the claims), input `frontend-presentation-resolution` (the owner of every node), @worktrees/sessions/central-runtime | — | — |
| 3 | Select the matrix entries and read the declared surface class | `matrix` | input `frontend-direction-decision` (its `response/data/coverage.json`: state by viewport by colour scheme, and the `surfaceClass` that decision declared) | — | `SURFACE_CLASS_MISSING` |
| 4 | Reach readiness for each entry on the port the bound route carries, in this session's own browser profile, signing in as the flow's account when the route requires an identity | `readinessProbe`, `account`, `env` | input `route` for the endpoint its entry serves, @worktrees/sessions/central-runtime for the entry of this project route, input `uat-account` for the account of names, @tools/http, @tools/secrets, @tools/browsercontrol | — | `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING` |
| 5 | Capture and measure each entry | — | @worktrees/sessions/central-runtime, @workspaces/fe (the observed owners and the identifiers each node carries), @tools/browsercontrol | `response/artifacts/<matrixId>.png`, `response/data/captures/<matrixId>.json` | `EVIDENCE_MISSING` |
| 6 | Compare against the claims and the proof rules, judge by owner, let each topic close itself, and emit | — | @knowledge/ui/proof, @knowledge/grammars/starci, the captures, @tools/websearch | `response/data/verdicts.json`, `response/response.md`, `response/response.json`, `response/artifacts/host.json`, @tools/visualize, @tools/host, @tools/print | `UNKNOWN_RULE` |

Step 6 judges every claim and then lets each proof topic close itself. The canon judgement is the one
above: every claim measured, judged against the published rule, routed by the owner of the node it
stands on. On top of it, each bound topic computes its own verdict by its own closing rule — the
arithmetic lives there and is not repeated here — and the receipt publishes one row per topic under
`## Verdict`: presentation, composition, responsive, motion, accessibility, contrast, render-truth
and taste, each with the verdict that topic's rule produced and the route a failure carries. A topic
whose evidence never arrived is `blocked`, which is never reported as a pass and never as a failure.
The taste row is scored per matrix entry and rolled up across them, lowest score and failing verdict
winning, because a surface is only as good as its worst captured viewport; a `fix-first` there stands
even when every canon rule passed, and the checkout's own gates wait for a `ship`.

The sheet is served, not filed. `@tools/host` (the shipped `scripts/host-artifacts.mjs`) puts `response/artifacts/` on the loopback interface at
the first free port from 60000 up to 60100 and records the URL, the port, the folder and the pid in
`response/artifacts/host.json`, stopping when the branch ends or is resumed; a person opens the sheet
and sees every matrix entry beside its verdicts. Nothing binds `0.0.0.0`.

Serving is not telling. Step 6 prints over `@tools/print`, into the conversation the person is
reading, the sheet's URL, the worst-scoring capture of each topic and the `## Verdict` table, and the
receipt lists each printed artifact under `## Printed` with why it was printed. A verdict a person
never saw sends nobody anywhere, and an audit that files its sheet and says nothing has audited only
itself.

The surface class is not this operator's to choose or to declare. It is read from the coverage of the
`frontend-direction-decision` this audit was given, where the direction declared it from the
vocabulary `COVERAGE-1` Case 7 publishes; every banded proof rule reads its threshold from that name,
and the audit only carries it into `## Surface class` and into the verdicts, unchanged. An input
decision that carries none — one written before the class was declared — or a name outside the
vocabulary, is `SURFACE_CLASS_MISSING`: no band, no threshold, nothing to judge, and the direction is
decided again before the surface is.

The matrix is the direction's coverage, not a new decision: `matrix` may only narrow it, and the
orchestrator may split the entries across up to three parallel branches of the same step. Every entry
produces one screenshot and one capture, and an entry that produced neither is `EVIDENCE_MISSING`
rather than a quiet omission. Every node carrying a claim is measured; a verdict is never recorded
for a node that was not.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-surface-audit` | `response/response.md` | md | yes |
| `capture` | `response/data/captures/<matrixId>.json` | data | yes |
| `screenshot` | `response/artifacts/<matrixId>.png` | artifact | yes |
| `verdicts` | `response/data/verdicts.json` | data | yes |
| `host` | `response/artifacts/host.json` | artifact | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `IDENTITY_MISSING` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `UNKNOWN_RULE` | terminate |
| `SURFACE_CLASS_MISSING` | terminate |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| a claim fails on an application-owned node, so a value must be published again | `frontend.presentation.resolve` |
| a topic verdict is fix-first, or the direction declared no surface class, so the composition is decided again before any value is | `frontend.direction.decide` |
| every topic ships or passes and the checkout's own gates must run | `quality.verify` |
| a claim fails on a Grammar component's own render, so a person records the family gap and publishes | `frontend.surface.audit` |
| the route requires an identity and this flow has no account yet, so one is provisioned before the surface is observed | `platform.operate` |
