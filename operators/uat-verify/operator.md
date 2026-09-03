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
`INVALID_INPUT` rather than a prompt.

## The password is a name, never a value

Every UAT account shares one password, sealed at `.stacks/<env>/secrets/uat.enc` with the shared
master identity, and each flow owns its own dedicated username. The operator resolves the credential
by name through `@workspaces/device-state` at the moment of login and at no other moment; it never
copies the value into a variable it writes, a fixture, a command it records, or a sentence it
publishes. The password is never plaintext anywhere this operator writes: not in `response/`, not in
the run record under `runs/<runId>/`, not in a log. The login field is masked in every screenshot,
including the ones taken before submission and the ones taken after a failed attempt, because a
capture is published evidence and a password that reached a picture has already left custody. An
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

`runs/<runId>/` is written once, at the end, under the exclusive lease, and `latest` is moved to point
at it. A run folder that already exists is never rewritten, never trimmed and never corrected: a
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
| `@worktrees/uat/<flow>/<case>` | the flow directory: `flow.md`, `account.json`, `seed/`, the append-only `runs/<runId>/` history and the `latest` pointer, bound by fingerprint per file and written only under the exclusive lease | yes |
| `@worktrees/_templates` | the UAT flow template a new flow directory is created from; consumed, never modified | yes |
| `@worktrees/sessions/central-runtime` | the ready runtime owner, its generation and its exact origins; readiness is proved, not assumed | yes |
| `@workspaces/device-state` | the sealed credential roster; the shared UAT password is resolved by name here at login and read nowhere else | yes |
| `@workspaces/be` | the routed backend checkout at the pinned commit, whose behaviour the flow verifies and whose store holds the namespaced records | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-surface-audit` | the surface audit that found the frontend clean, taken at the pinned commit | yes |
| `quality-verification` | the quality gate that passed, taken at the same pinned commit | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `requestedBy` | id | — | Who asked for this UAT run; UAT never starts without a person behind it |
| `feature` | id | — | The feature key that addresses the flow directory |
| `flow` | id | — | The one product flow this invocation verifies |
| `cases` | list of `caseId` | every case of the flow | Which frozen cases to run; the default is every case `flow.md` declares, in its order |
| `runId` | id | the orchestrator's run id | Not asked of a person: the orchestrator generates it and it namespaces every record this run writes |
| `lease` | token | the orchestrator's lease | Not asked of a person: the orchestrator grants the exclusive lease on the flow directory before the branch starts |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the resume, the exclusive lease and the person who asked | `requestedBy`, `lease`, `resume` | `request/request.json`, @worktrees/uat/<flow>/<case> for `latest` and the prior run record, @workspaces/be at the pinned commit, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Confirm admission: the surface audit is clean and the quality gate is green at the same pinned commit | — | input `frontend-surface-audit`, input `quality-verification` | — | `ADMISSION_MISSING` |
| 3 | Preflight the runtime: the sealed credential resolves by name, the account exists, the store answers | — | @workspaces/device-state for the credential named by `account.json`, @worktrees/sessions/central-runtime for the generation and origins, @tools/secrets, @tools/http | — | `PROVISIONING_UNAVAILABLE` |
| 4 | Freeze the snapshot from `flow.md`, `account.json` and `seed/` | `feature`, `flow`, `cases` | @worktrees/uat/<flow>/<case>, @worktrees/_templates for the flow template | @worktrees/uat/<flow>/<case> (snapshot), `response/data/snapshot.json`, @tools/sourcewrite | `CANONICAL_WRITE_DENIED` |
| 5 | Seed the frozen records into the run namespace | `runId` | `response/data/snapshot.json`, @workspaces/be | @tools/database | `FIXTURE_VIOLATION` |
| 6 | Execute the frozen cases in order on the session worktree at the pinned commit | — | `response/data/snapshot.json`, @worktrees/sessions/central-runtime for the origin and generation, @workspaces/device-state for the credential at login only, @tools/browsercontrol, @tools/websearch | — | `LEASE_INVALID`, `RUNTIME_UNAVAILABLE` |
| 7 | Capture at each named assertion with the login field masked, and stitch the sheet | — | `response/data/snapshot.json`, @worktrees/sessions/central-runtime for the most direct runtime evidence | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png`, @tools/visualize | `EVIDENCE_UNAVAILABLE` |
| 8 | Judge the three lanes apart | — | `response/data/captures/<case>.json` | `response/data/verdicts.json` | — |
| 9 | Verify read-only, then delete the run namespace and nothing else | `runId` | @workspaces/be for the records carrying `is_uat=true` and this namespace, `response/data/verdicts.json` | @tools/database | — |
| 10 | Append `runs/<runId>/`, move `latest`, and emit | `runId` | everything above | @worktrees/uat/<flow>/<case> (runs/<runId>/ and latest), `response/response.md`, `response/response.json`, @tools/sourcewrite | — |

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
| `LEASE_INVALID` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `EVIDENCE_UNAVAILABLE` | terminate |
| `FIXTURE_VIOLATION` | terminate |
| `CANONICAL_WRITE_DENIED` | terminate |

## Next

| When | Operator |
| --- | --- |
| all three lanes pass | `git.publish` |
| the UI lane fails on an application-owned node | `frontend.presentation.resolve` |
| the behaviour lane fails | `backend.source.apply` |
| the UX lane fails: a person decides what the experience should be, and the flow is verified again only after that decision | `user` |
