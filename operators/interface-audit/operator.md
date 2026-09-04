# interface.audit

## Job

Observe the selected primary surfaces at the served route across their frozen audit matrix,
measure every node that carries a claim, and judge each measurement against the published proof rules
by the owner of the node it stands on.

## Done when

Done when every selected matrix entry has its `capture`, its `screenshot` and its row in `verdicts`,
every claim inside a selected surface was measured on a served head that contains the applied commit
and judged by the owner of its node, each proof topic has closed by its own rule into one row of the
`frontend-surface-audit` verdict table with the route a failure carries, and the sheet was served
over `host` and printed to the person with the worst capture of each topic.

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
the runtime owner's entry for this route records as contained. A served head that fails that test is `SOURCE_DRIFT` with
nothing captured, because a measurement of another tree proves nothing about this one. The receipt
states both commits under `## Served surface`, since ancestry a reader cannot see is a claim.

The endpoint is the one the runtime owner's entry for this route carries, never one this operator
derived: the entry names the port it serves this route on, and readiness is reached there; the route
receipt binds the checkout and its head, and nothing about a runtime. When the served head does not contain the
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

## Two kinds of lane, two ways of judging

The topics this audit closes are not all judged the same way. Presentation, composition, responsive,
motion, accessibility, contrast and render-truth are measurable: a computed gap, a contrast ratio,
the element that holds focus, a claim traced to its authority. They are judged blind, per unit — one
page or one modal, one matrix entry at a time — because a measurement needs no other sheet to be
true, and an auditor who has seen the neighbouring page brings nothing to a ruler. The taste lens is
not a measurement of one sheet; it is a placement on a scale, and a scale drifts between sheets when
every sheet is scored alone. So taste — and the experience lens wherever a receipt scores it from a
capture — is scored once per feature by one auditor, across every selected surface of the frozen
scope in the same round, relatively: the sheets are ranked against each other, and the receipt says
under `## Ranked against` which sheets it ranked, so a score reads as a position on a scale and not
as a mood.

What makes that scale the same one from one round to the next, and from one auditor to the next, is
the calibration set `@knowledge/ui/proof` carries under `calibration/`: three anchor sheets, the band
each is expected to land in with its one-line reason, and the tolerance, stated once in
`calibration.json`. The auditor scores the three anchors in the same round it scores the surface,
records them under `## Calibration` and in `verdicts.calibration`, and only then places the surface;
a lens scored with no anchors, or with an anchor landing further outside its band than the
tolerance, is `CALIBRATION_OFF` (`TASTE-13` Case 9): the round's scale is unproved, no score it
produced is comparable, and the same auditor re-enters and scores the anchors again. A unit branch
that scores taste for a feature split across branches ranks against the anchors alone, which is what
lets two branches' scores be compared at all.

## The owner decides where a failure goes

A failing claim on an application-owned node is a value the resolution has to publish again, so it
routes back as one finding to `interface.fix`, which repairs it inside the orchestrator's fix size
from the same resolution inventory; a finding larger than that stops there with `FIX_TOO_LARGE` and
resumes as `interface.generate`, which is the operator that caps the rounds. A failing claim
on a Grammar component's existing published behavior is a `grammar-gap`: record the evidence in the
family gap table and route to `workspace.bind` for the library owner. Once bound, an already-authorized
repair continues to `library.update` under its bounded owner plan and regression gates; routine
confirmation is not a prerequisite. A genuinely new presentation direction or tier is `direction`
and goes to `interface.generate`, which preserves the user's choice. Neither route permits an
application CSS workaround for the component's own behavior. The interior
of an application-owned node carries no claim and is not audited at all; only that node's own measure
rules are.

## The walk is written, never coded

Under `@tools/browsercontrol` mode `playwright` the auditor writes one `uat-walk` per matrix entry —
the entry's viewport and colour scheme as the walk's own context, role-and-name targets to reach the
state, the entry route once at step 1, a credential by name where the route is guarded, and a
capture named after the matrix entry — and the tree's runner drives it, so the screenshot, the
accessibility snapshot and the DOM record the audit measures came from a browser nobody scripted.
A capture that records this mode names its walk, the runner's `walk-result` beside it at the digest
that ran, the capture step of that walk whose name is the matrix id, and the control that step
followed as the walk states it; its viewport and scheme are the walk's; and a capture with no walk
beside it, or a walk with a capture the runner did not produce, is refused. The nodes, their claims
and their measurements stay the auditor's, read from the record the runner wrote.

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
| `@knowledge/grammars/<family>` | how the family the bound route names (`context.grammarId`) is meant to realize Common, and where its gaps are recorded | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-source-application` | `interface.generate`, or the `interface.fix` that repaired one finding on it; the commit under observation and the claims it wrote | yes |
| `frontend-presentation-resolution` | `interface.generate`, the owner of every node | yes |
| `frontend-direction-decision` | `interface.generate`, the route and the coverage the matrix is derived from | yes |
| `route` | `workspace.bind`, the bound route: the verified checkout and the source head the applied commit descends from; the endpoint comes from the runtime owner's entry, never from here | yes |
| `uat-account` | `identity.provision`, the account the guarded route is reached as; absent on the first pass, which is what `IDENTITY_MISSING` hands over | no |
| `platform-operation-receipt` | `runtime.serve`, the serve that put the commit under observation on the product port; absent when the surface is already served | no |
| `seed-receipt` | `data.seed`, the rows placed at the flow's representative volume so density is judged against data, not against an empty store | no |
| `units` | `interface.plan`; the surface map whose one page or modal this branch measures, named by `request.unit` | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `auditScope` | object | — | Freeze the surface inventory and selected matrix entries from the mission; mode defaults to primary-surfaces under audit-scope.schema.json |
| `matrix` | list | selected surface entries | Optional narrowing within the frozen audit scope; it cannot omit an entry required by a selected surface |
| `readinessProbe` | choice | route-served | The floor for readiness; a state that needs data rises to `route-and-data-served` on its own |
| `account` | id | null | The account record the route is signed in as when it requires an identity; the value is a reference to a record of names, never a credential |
| `env` | id | dev | The stack whose registry entry and accounts this audit reads; a surface observed in one stack says nothing about another |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and confirm the applied commit is inside the head the route is serving | `resume` | `request/request.json`, input `frontend-source-application` (the commit it wrote), input `route` (the verified checkout and its source head), @worktrees/sessions/central-runtime (the entry of this route: the served branch, the served head and the commits it contains), @workspaces/fe at the frozen head, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the authority | — | @knowledge/ui/proof (every topic with its fingerprint and inventory), input `frontend-source-application` (the claims), input `frontend-presentation-resolution` (the owner of every node), @worktrees/sessions/central-runtime | — | — |
| 3 | Bind the primary-surface scope, selected matrix entries and declared surface class | `auditScope`, `matrix` | input `frontend-direction-decision` (its `response/data/coverage.json`: state by viewport by colour scheme, and the `surfaceClass` that decision declared) | — | `SURFACE_CLASS_MISSING` |
| 4 | Reach readiness for each entry on the port the runtime owner's entry for this route carries, in this session's own browser profile, signing in as the flow's account when the route requires an identity | `readinessProbe`, `account`, `env` | @worktrees/sessions/central-runtime for the entry of this project route and the endpoint it serves, input `uat-account` for the account of names, @tools/http, @tools/secrets, @tools/browsercontrol | — | `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING` |
| 5 | Write one walk per matrix entry: the entry's viewport and scheme as the context, role-and-name targets to the state, the entry route once at step 1, a credential by name where the route is guarded, a capture named after the entry | — | input `frontend-direction-decision` (the matrix entries), input `route`, input `uat-account` for the account of names | `uat-walk` | — |
| 6 | Run each walk through the tree's runner under @tools/browsercontrol mode `playwright` — a fresh browser context per walk at the endpoint the runtime owner's entry carries — or drive the entry through the browser under mode `required` when no walk was written | — | `uat-walk`, @worktrees/sessions/central-runtime for the endpoint, @tools/browsercontrol, @tools/secrets | `walk-result`, `response/artifacts/<matrixId>.png` | `RUNTIME_UNAVAILABLE` |
| 7 | Capture and measure each entry, reading the nodes, their claims and their values off the record the runner wrote or the driven browser shows | — | @worktrees/sessions/central-runtime, @workspaces/fe (the observed owners and the identifiers each node carries), `walk-result`, @tools/browsercontrol | `response/artifacts/<matrixId>.png`, `response/data/captures/<matrixId>.json` | `EVIDENCE_MISSING` |
| 8 | Judge the measurable lanes per entry: compare against the claims and the proof rules, judge by owner, and let each measurable topic close itself | — | @knowledge/ui/proof, @knowledge/grammars/<family>, the captures | — | `UNKNOWN_RULE` |
| 9 | Score the taste lens once over every sheet of the scope, calibrated on the three anchors and ranked relatively, then emit | — | @knowledge/ui/proof (the calibration set under `calibration/`: the anchors, their bands and the tolerance), the captures of every selected surface | `verdicts`, `frontend-surface-audit`, `findings`, `response/response.json`, `host` | `CALIBRATION_OFF`, `NO_PROGRESS` |

Step 8 judges every claim and lets each measurable proof topic close itself. The canon judgement is
the one above: every claim measured, judged against the published rule, routed by the owner of the
node it stands on; bounded search (`@tools/websearch`) resolves a referent a rule names and settles
nothing else. Each bound topic computes its own verdict by its own closing rule — the arithmetic
lives there and is not repeated here — and step 9 publishes one row per topic under `## Verdict`:
presentation, composition, responsive, motion, accessibility, contrast, render-truth and taste, each
with the verdict that topic's rule produced and the route a failure carries. A topic whose evidence
never arrived is `blocked`, which is never reported as a pass and never as a failure. The taste row
is scored per matrix entry on the calibrated scale and rolled up across them, lowest score and
failing verdict winning, because a surface is only as good as its worst captured viewport; a
`fix-first` there stands even when every canon rule passed, and the checkout's own gates wait for a
`ship`.

The `findings` output is not the agent's to write. Once this receipt is accepted, the orchestrator
appends every failure it recorded to the findings ledger and materializes the ledger's open lines for
the observed surfaces beside the receipt, under the law and the script
[the findings index](../../knowledge/findings/INDEX.md) states; the session gate refuses a done audit
whose failures the ledger does not hold.

The sheet is composed with `@tools/visualize` and served, not filed. `@tools/host` (the tool the registry ships) puts `response/artifacts/` on the loopback interface at
the first free port of the registry's range and records the URL, the port, the folder and the pid in
`response/artifacts/host.json`, stopping when the branch ends or is resumed; a person opens the sheet
and sees every matrix entry beside its verdicts. Nothing binds `0.0.0.0`.

Serving is not telling. Step 9 prints over `@tools/print`, into the conversation the person is
reading, the sheet's URL, the worst-scoring capture of each topic and the `## Verdict` table, and the
receipt lists each printed artifact under `## Printed` with why it was printed. A verdict a person
never saw sends nobody anywhere, and an audit that files its sheet and says nothing has audited only
itself.

A composition or taste verdict is never closed by asking. When such a topic closes as fail or
fix-first, its row routes to `direction` and the chain hands to `interface.generate`, which
scores the rendered candidates against the criteria this audit failed and applies its selection
policy and [interaction policy](../../resources/interaction.md). This audit composes nothing,
ranks nothing and offers nothing: the validator refuses a `user` route that leaves a composition or
taste topic open; direction owns the candidate comparison and any material choice. The caller stops
and `NO_PROGRESS` are operational here — the same
head measured again with no delta — so their `reason` says so and carries no candidate. A topic
`blocked` because an exhaustive matrix left out a required declared state is neither of those things: it is not the same
head measured again, and it is not a composition or taste finding, so it never counts toward
`NO_PROGRESS` and never closes a composition or taste topic as `fix-first`. A taste mean is
comparable across rounds only within the same frozen scope; a new primary scope can complete on its own evidence but is not compared with an exhaustive round to consume a progress budget.

A criterion that depends on data volume is measured at the flow's representative seeded volume, the
volume `TASTE-9` Case 5 defines, never at whatever the served workspace happened to hold. When the
served workspace is below it, the taste topic is `blocked` and routes to `seed`: the operator that
owns the data brings the workspace to volume and the entry is captured again — not a direction lap,
and not a yes/no for a person, because the tree already answers it by creating the data. Re-measured
at volume and still failing, the criterion is recorded `data-bound` in its Measured cell and
`TASTE-13` Case 6 keeps it out of the verdict, so it blocks neither quality nor UAT.

A choice the person took from a printed sheet closes the criteria that choice was known to fail. When
the direction decision this audit reads was approved by the person and its `## Scores` showed a
criterion failing for the selected candidate at choice time, this audit records that criterion
`person-accepted` in its Measured cell, naming the branch of that decision, instead of failing it back
to direction; `TASTE-13` Case 7 keeps it out of the verdict and the topic closes on the remaining
criteria. The rubric never overturns a decision the person took on its own evidence in the same
session, so a taste lens whose every failing criterion is `data-bound` or `person-accepted` ships, and
`next` names `quality.verify`. The validator refuses a `person-accepted` row that names no decision
branch, names a decision the operator took by itself, or covers a criterion the chosen candidate was
not shown failing.

The surface class is not this operator's to choose or to declare. It is read from the coverage of the
`frontend-direction-decision` this audit was given, where the direction declared it from the
vocabulary `COVERAGE-1` Case 7 publishes; every banded proof rule reads its threshold from that name,
and the audit only carries it into `## Surface class` and into the verdicts, unchanged. An input
decision that carries none — one written before the class was declared — or a name outside the
vocabulary, is `SURFACE_CLASS_MISSING`: no band, no threshold, nothing to judge, and the direction is
decided again before the surface is.

The scope is frozen before capture through `auditScope`, validated by
[the audit scope schema](../../templates/kinds/audit-scope.schema.json). Its default is
`primary-surfaces`: the mission's main screens and important layouts are audited first, while
secondary states and deferred surfaces remain visible as deferred work. The orchestrator derives the
inventory from the mission and existing direction without a routine confirmation. `exhaustive` is
an explicit opt-in to the full declared state matrix.

Each inventory item names its stable id, page/layout/modal/drawer type, route, and exact required
matrix ids. Primary items have entries; deferred items have none.
Every selected entry must have its capture, screenshot and verdict. Every claim measured inside a
selected surface is still judged. Deferring another surface or state does not excuse a failure or
missing assertion inside the chosen matrix. A missing selected entry is `EVIDENCE_MISSING`.

`verdicts.auditScope` copies the inventory and normalized mode, lists every declared secondary state
not captured as `deferredStates`, and states its `coverageClaim`. A primary audit claims only
`selected-surfaces`; its passing topics cannot be presented as full UI state coverage. An exhaustive
audit missing a declared state remains blocked with `## Coverage gaps`. `TASTE-13` Case 8 governs the
state-comparison criterion and comparability across rounds. Unit, integration and regression gates
keep their own coverage contracts unchanged.


## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-surface-audit` | `response/response.md` | md | yes |
| `capture` | `response/data/captures/<matrixId>.json` | data | yes |
| `screenshot` | `response/artifacts/<matrixId>.png` | artifact | yes |
| `verdicts` | `response/data/verdicts.json` | data | yes |
| `findings` | `response/data/findings.json` | data | no |
| `uat-walk` | `response/data/walks/<walk>/walk.json` | data | no |
| `walk-result` | `response/data/walks/<walk>/walk-result.json` | data | no |
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
| `CALIBRATION_OFF` | terminate |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| a claim fails on an application-owned node, so one finding is repaired from the same resolution inventory inside the orchestrator's fix size | `interface.fix` |
| a topic verdict is fix-first, or the direction declared no surface class, so the surface is generated again from a new direction before any value is | `interface.generate` |
| every topic ships or passes and the checkout's own gates must run | `quality.verify` |
| a grammar-gap identifies failed existing library behavior, so the authorized repair first binds the library owner's checkout | `workspace.bind` |
| a Grammar-owned finding needs a genuinely new presentation direction or tier, so the user's direction is decided before implementation | `interface.generate` |
| a state-reading topic is blocked because the exhaustive matrix leaves out a required declared state, so the surface is audited again once the matrix covers it | `interface.audit` |
| a density criterion was measured below the flow's representative seeded volume, so the data is seeded before the surface is judged again | `data.seed` |
| the route requires an identity and this flow has no account yet, so one is provisioned before the surface is observed | `identity.provision` |
