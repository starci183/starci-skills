# uat.verify

## Job

Verify one product flow end to end on the running product at the pinned commit, and publish one
append-only run record with three independently judged lanes, or stop at the exact unavailability
instead of manufacturing a verdict.

## UAT runs only when a person asked for it

`requestedBy` names the person who asked; without it the operator has nothing to run for and stops at
the gate. Nothing about this operator is routine: it signs in as a real user, writes real records into
a shared runtime and leaves a permanent run record behind, so the trigger is a person and never a
schedule, a chain default or another agent's convenience. `runId` and `lease` are not questions for a
person either: the orchestrator generates the run identifier and grants the exclusive lease on the
flow directory before the branch starts, and an invocation that arrives without them is
`INVALID_INPUT` at step 1 rather than a prompt. Their Default is therefore `—`: a Default that reads
"the orchestrator's run id" is prose, not a value the gate can use, and a gate that accepts prose
accepts an empty field. `LEASE_INVALID` is a different failure and keeps its own place: it is the
lease that exists and is expired, foreign, or bound to another run, noticed at step 6 against the
flow directory this run holds.

## The endpoint is the bound one, never a re-derived one

The flow is driven against the endpoint the `route` Input carries, the one the `workspace.bind` branch
of this chain observed and closed. This operator does not re-derive readiness from the runtime
registry: a registry that advertises `ready` while nothing listens is exactly the source that sends a
browser at a dead port, and the bind step already refused a merely listening port on this chain's
behalf. When the bound endpoint does not answer, the stop is `RUNTIME_UNAVAILABLE` against a named
endpoint rather than a guess about which origin was meant.

## A missing record is created, not reported

A flow nobody has run yet has no folder, no flow document, no seed, no account and no approved
reference, and none of that is a stop. The flow document and the seed are drafted from the shipped
template and named in the receipt as drafts; the account is provisioned by the operator that owns
identity and this branch is re-entered with it; and the first run becomes the candidate baseline that
only a person promotes. `IDENTITY_MISSING` is that hand-off and not a verdict — it names the flow
whose account does not exist yet, and the identity operator answers it. The honest stops on this path
are the two dependencies nobody here can conjure: a provider, a sealed file or a store that cannot be
reached at all is `PROVISIONING_UNAVAILABLE`, and a request that names no flow to run is
`INVALID_INPUT`. Stopping at "a person must create an account" is neither of them.

## The flow folder has one shape

`flow.md` states the goal, the role, the preconditions, the budget in steps and seconds, and the
steps with their expected result, evidence and scored criteria, each naming the alias it acts as.
`accounts.<env>.json` carries names only, one account per alias, per environment.
`seed/` holds what must exist before the run, said once and idempotently. `snapshots/` is the golden
reference and changes only when a person approves it. `runs/<runId>/` is the append-only history,
`runId` being the run's timestamp and the short commit it verified, so two runs of the same flow at
the same commit are still distinguishable and neither can overwrite the other. `latest.json` names the
newest run — a file holding a run id, never a symlink — and `history.md` gains one line per run. The
shape is enforced rather than described, because a run record whose folder nobody can predict is a
record nobody reads.

## The password is a name, never a value

Every UAT account shares one password, sealed at `.stacks/<env>/secrets/uat.enc` with the shared
master identity, and each flow owns its own dedicated username. The operator resolves the credential
by name through `@workspaces/device-state` at the moment of login and at no other moment; it never
copies the value into a variable it writes, a fixture, a command it records, or a sentence it
publishes. The password is never plaintext anywhere this operator writes: not in `response/`, not in
the run record under `runs/<runId>/`, not in a log. The login field is masked in every screenshot,
including the ones taken before submission and the ones taken after a failed attempt, because a
capture is published evidence and a password that reached a picture has already left custody. Capture
begins only after the sign-in redirect has landed, and every capture record says so: the frames before
that moment are the frames a credential can be standing in. An
account record therefore carries a username, a role, a credential name and the sealed file's path,
and nothing that could hold a secret.

## Freeze precedes execution

The snapshot is written before any product action and never edited afterwards. It states the commit,
the cases in their frozen order with their named assertions, the account record, the seed
fingerprint and the fixture namespace. That ordering turns three invisible failures into detectable
ones: a case that was never frozen cannot appear in a result, a run cannot be re-explained after the
fact by editing what it claimed to test, and an admission cannot be back-dated onto a commit it
never saw. Both admissions — the `frontend-surface-audit` receipt and the `quality-verification` receipt —
must name the same commit as the pinned head; either one absent, or either one taken at another
commit, is `ADMISSION_MISSING`, because a clean surface and a green gate at some other commit say
nothing about the product this run drives.

## The experience lane is scored, not asserted

The `ux` lane is not a sentence about how the run felt. `UX-1` to `UX-11` are each carried in the run
receipt with the run step or the capture that measured them, a score from 1 to 5 and a verdict, and
`UX-12` computes the lane from them; the arithmetic lives in that rule and is not repeated here. The
result is the one row this operator publishes under `## Verdict`, as `experience`, and nothing
downstream rescores it — `quality.verify` copies the row and combines it with the audit's topics. A
criterion whose only evidence is a screenshot, for a rule that this file assigns to a run, is
`EVIDENCE_UNAVAILABLE` rather than a pass or a fail, and the lane is incomplete until the attempt
exists.

## Three lanes, judged apart

Behaviour, UX and UI are judged on their own evidence and never borrow each other's conclusions.
Exactly three lanes are published, each with its own pass or fail and its own evidence references; a
lane with no evidence is not a fail but `EVIDENCE_UNAVAILABLE`, because charging unavailability as a
failure blames a product nobody observed. A UI defect on an application-owned node routes to
presentation, a behaviour defect routes to the backend, and a UX defect routes to a person: nobody
resolves a question of intent by re-running the flow harder.

## The namespace owns everything this run wrote

Every record this run writes carries `is_uat=true` and the `runId` namespace, so what the run created
is separable from what the product already had. Cleanup deletes exactly that namespace and nothing
else: not another run's namespace, not a record that merely carries the UAT flag, and never a run
record. Verification itself reads and does not write, and a seed may never create the outcome under
test.

## Runs are append-only

`runs/<runId>/` is written once, at the end, under the exclusive lease; `latest.json` is pointed at it
and `history.md` gains its line. A run folder that already exists is never rewritten, never trimmed and never corrected: a
second attempt is a new `runId`, and the old record stays as the evidence of what was observed then.
History that can be edited is not history.

## Boundary

Context is read-only apart from the flow directory. The operator writes the snapshot and the run
record under `@worktrees/uat/<flow>/<case>` while it holds the exclusive lease, and writes only
`response/` of its own branch: `data/snapshot.json`, `data/captures/<case>.json`,
`data/verdicts.json`, the screenshots and the sheet under `response/artifacts/`, `response.md` and
`response.json`. It does not read or write the password as a value, does not ask a person to sign in
or paste a credential, does not repair the product to make a case pass, does not edit the frozen
snapshot after execution begins, does not rewrite or delete a run record, and does not delete
anything outside its own fixture namespace.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/uat/<flow>/<case>` | the flow directory in its one shape: `flow.md`, `accounts.<env>.json`, `seed/`, the approved `snapshots/`, the append-only `runs/<runId>/` history, the `latest.json` pointer and `history.md`, bound by fingerprint per file and written only under the exclusive lease | yes |
| `@worktrees/_templates` | the UAT flow template a missing flow folder is drafted from, which the tree ships at `templates/uat/` with `README.md` as the contract for the whole folder: `flow.md` with the cases, the aliases they act as and their named assertions, `accounts.json.example` with names only and no field that could hold a secret, and `seed/` with the records a run namespaces; consumed, never modified | yes |
| `@worktrees/sessions/central-runtime` | the runtime owner's generation behind the bound endpoint; readiness is proved by the `route` Input, never re-derived from this registry | yes |
| `@workspaces/device-state` | the sealed credential roster; the shared UAT password is resolved by name here at login and read nowhere else | yes |
| `@workspaces/be` | the routed backend checkout at the pinned commit, whose behaviour the flow verifies and whose store holds the namespaced records | yes |
| `@knowledge/ui/proof` | the UX topic: the criteria the experience lane scores and the rule that turns them into its verdict | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-surface-audit` | the surface audit that found the frontend clean, taken at the pinned commit | yes |
| `quality-verification` | the quality gate that passed, taken at the same pinned commit | yes |
| `route` | `workspace.bind` on the fe role; the bound route whose endpoint this run drives | yes |
| `uat-account` | `platform.operate`, the dedicated account it provisioned for this flow; absent on the first pass, which is what `IDENTITY_MISSING` hands over | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `requestedBy` | id | — | Who asked for this UAT run; UAT never starts without a person behind it |
| `feature` | id | — | The feature key that addresses the flow directory |
| `flow` | id | — | The one product flow this invocation verifies |
| `env` | id | dev | The stack this run drives: it selects the accounts file, the sealed secret, the runtime registry entry, the seed target and the approved reference |
| `cases` | list of `caseId` | every case of the flow | Which frozen cases to run; the default is every case `flow.md` declares, in its order |
| `runId` | id | — | Not asked of a person: the orchestrator fills it, and it namespaces every record this run writes |
| `lease` | token | — | Not asked of a person: the orchestrator fills it, granting the exclusive lease on the flow directory before the branch starts |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the resume, the exclusive lease and the person who asked | `requestedBy`, `lease`, `resume` | `request/request.json`, @worktrees/uat/<flow>/<case> for `latest` and the prior run record, @workspaces/be at the pinned commit, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Confirm admission: the surface audit is clean and the quality gate is green at the same pinned commit | — | input `frontend-surface-audit`, input `quality-verification` | — | `ADMISSION_MISSING` |
| 3 | Preflight the runtime and the flow's identity: the sealed credential resolves by name, the store answers, and a flow with no account hands over instead of stopping | `env` | @workspaces/device-state for the credential named by `accounts.<env>.json`, @worktrees/sessions/central-runtime for the entry of the bound route, its generation and origins, input `uat-account` when the identity was provisioned, @tools/secrets, @tools/http | — | `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING` |
| 4 | Draft from the template whatever the flow folder lacks, then freeze the snapshot from `flow.md`, `accounts.<env>.json` and `seed/` | `feature`, `flow`, `env`, `cases` | @worktrees/uat/<flow>/<case>, @worktrees/_templates for the flow template | @worktrees/uat/<flow>/<case> (snapshot), `response/data/snapshot.json`, @tools/sourcewrite | `CANONICAL_WRITE_DENIED` |
| 5 | Seed the frozen records into the run namespace | `runId` | `response/data/snapshot.json`, @workspaces/be | @tools/database | `FIXTURE_VIOLATION` |
| 6 | Execute the frozen cases in order against the endpoint the bound route carries, at the pinned commit | — | `response/data/snapshot.json`, input `route` for the endpoint this run drives, @worktrees/sessions/central-runtime for the generation behind that endpoint, @workspaces/device-state for the credential at login only, @tools/browsercontrol, @tools/websearch | — | `LEASE_INVALID`, `RUNTIME_UNAVAILABLE` |
| 7 | Capture at each named assertion with the login field masked, and stitch the sheet | — | `response/data/snapshot.json`, @worktrees/sessions/central-runtime for the most direct runtime evidence | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png`, @tools/visualize, @tools/print | `EVIDENCE_UNAVAILABLE` |
| 8 | Judge the three lanes apart, and score the experience lane criterion by criterion | — | @knowledge/ui/proof (the UX topic and its closing rule), `response/data/captures/<case>.json` | `response/data/verdicts.json` | — |
| 9 | Verify read-only, then delete the run namespace and nothing else | `runId` | @workspaces/be for the records carrying `is_uat=true` and this namespace, `response/data/verdicts.json` | @tools/database | — |
| 10 | Append `runs/<runId>/`, point `latest.json` at it, add the history line, and emit | `runId` | everything above | @worktrees/uat/<flow>/<case> (runs/<runId>/, latest.json and history.md), `response/response.md`, `response/response.json`, @tools/sourcewrite, @tools/print | — |

A verdict nobody was shown is a verdict nobody read. Step 7 prints the run's step-capture summary and
step 10 prints the `## Verdict` table over `@tools/print`, into the conversation the person who asked
for this run is reading, and the receipt lists both under `## Printed` with why each was printed; the
login field stays masked in every frame that is printed, exactly as in every frame that is written.

A blocked run publishes no run record at all, because a half-written record is the artifact a later
reader would mistake for a decision. A resume begins again at validation, reuses only observations
whose fingerprints are unchanged, and writes under the same lease; a resume that adds no admission,
lease, evidence or case change is `NO_PROGRESS`. A second attempt after a published run is a new
`runId`, never an edit of the old one.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `uat-flow-verification` | `response/response.md` | md | yes |
| `uat-snapshot` | `response/data/snapshot.json` | data | yes |
| `uat-capture` | `response/data/captures/<case>.json` | data | yes |
| `uat-verdicts` | `response/data/verdicts.json` | data | yes |
| `screenshot` | `response/artifacts/<case>.png` | artifact | yes |
| `sheet` | `response/artifacts/sheet.png` | artifact | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `ADMISSION_MISSING` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `IDENTITY_MISSING` | terminate |
| `LEASE_INVALID` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `EVIDENCE_UNAVAILABLE` | terminate |
| `FIXTURE_VIOLATION` | terminate |
| `CANONICAL_WRITE_DENIED` | terminate |

## Next

| When | Operator |
| --- | --- |
| all three lanes pass | `git.publish` |
| all three lanes pass and the promise must be reconciled against the journey that was actually walked | `business.decide` |
| the UI lane fails on an application-owned node | `frontend.presentation.resolve` |
| the behaviour lane fails | `backend.source.apply` |
| the flow has no dedicated account yet, so the identity is provisioned before the run continues | `platform.operate` |
| the UX lane fails: a person decides what the experience should be, and the flow is verified again only after that decision | `user` |
| the run produced the first baseline of this flow, so a person promotes the candidate before it is a reference | `user` |
