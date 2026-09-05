# uat.verify

## Job

Verify one product flow end to end on the running product at the pinned commit, and publish one
append-only run record with three independently judged lanes, or stop at the exact unavailability
instead of manufacturing a verdict.

## Done when

Done when the `uat-snapshot` was frozen before any product action, naming the pinned commit, the
served head that contains it, the cases in order with their assertions, the account record of names
and the seed fingerprint, every frozen case has its `uat-capture` and masked `screenshot` taken
after the sign-in redirect landed through the rendered controls alone, the `uat-verdicts` judge the
behaviour, experience and interface lanes on their own evidence with the experience lane scored
criterion by criterion, the exact rollback handoff for the run namespace was emitted to `data.seed`, the append-only run record
exists with its pointer and history line, and the `uat-flow-verification` lists the `sheet` and the
verdict table it printed to the person, carrying the `audit-scope` unchanged when the admitted audit
had one.

## A run is triggered by need; its authority is the environment's

Reaching this operator is the need: a chain that walks straight into it once a surface is built and
proved, or a session deciding a flow must be walked before anything is trusted, is the routine case
this operator exists to serve, not an exception to police. What keeps a run honest is not a name in a
requirements field but the trace it cannot avoid leaving: the append-only run directory
(`runs/<runId>/`), the `latest.json` pointer, the `history.md` line and the printed step-capture
summary. `runId` and `lease` are not questions for a person: the orchestrator generates the run
identifier and grants the exclusive lease on the flow directory before the branch starts, and an
invocation that arrives without them is `INVALID_INPUT` at step 1 rather than a prompt. Their Default
is therefore `—`: a Default that reads "the orchestrator's run id" is prose, not a value the gate can
use, and a gate that accepts prose accepts an empty field. `LEASE_INVALID` is a different failure and
keeps its own place: it is the lease that exists and is expired, foreign, or bound to another run,
noticed at step 6 against the flow directory this run holds.

What this run touches beyond its own reading — signing in as the flow's dedicated account — is authorised the way every platform operation
in this installation is: by the environment's own declaration, and by a person only where that
declaration says a person is needed. `.stacks/<env>/environment.json` marks the
`identity-provisioning` class `declared` or `person` for `env`, and
`readiness/initialization/stacks/environment.schema.json` states the shape, the reference format and
the production default once, read from there and never copied here. A non-production environment
that has not tightened that class needs nothing further: `approval` carries that declaration's
reference — its path and the hash of its bytes — and the run proceeds with no person in the loop. An
environment that marks that class `person`, which production always does, needs an approval id
instead, and `approval` has no default: silence is not consent, whatever reached this operator.

## The endpoint is the bound one, never a re-derived one

The flow is driven against the endpoint the `route` Input carries, the one the `workspace.bind` branch
of this chain observed and closed. This operator does not re-derive readiness from the runtime
registry: a registry that advertises `ready` while nothing listens is exactly the source that sends a
browser at a dead port, and the bind step already refused a merely listening port on this chain's
behalf. When the bound endpoint does not answer, the stop is `RUNTIME_UNAVAILABLE` against a named
endpoint rather than a guess about which origin was meant.

That endpoint serves one integration branch carrying the work of every session that asked for it, so
the head it runs is almost never the commit this run verifies. The snapshot therefore freezes both:
the commit pinned and the head served, with the record of the ancestry test between them. A served
head that does not contain the pinned commit is drift, and drift is a stop with nothing driven — but
a served head that contains it and other work besides is exactly what a shared integration branch
looks like, and is no finding at all.

## Two sessions on one product

The isolation law is published once, by the operator that owns the runtime, and this operator works
inside it rather than restating it. Three of its clauses are things only this receipt can carry, so
the snapshot states them and they are checked: this run belongs to the session the request names and
writes no other session's folder; it drives its own browser profile, because two runs sharing one
profile share a sign-in and then each proves the other's; and it accepts only a `data.seed` receipt
whose identifiers and rollback set stay under this run's namespace.

## Missing prerequisites are routed to their owners

This verifier does not draft a flow, case sheet or seed. Missing or invalid flow material returns a
typed handoff to `uat.plan`; missing or invalid seed material returns one to `data.plan` and then
`data.seed`. A missing or invalid account returns `IDENTITY_MISSING` to `identity.provision`, which
must return a real product-login proof before a new attempt begins. An unreachable provider, sealed
file or store is `PROVISIONING_UNAVAILABLE`; a request naming no flow is `INVALID_INPUT`.

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
and nothing that could hold a secret. The preflight check that the credential resolves (step 3) is a
diagnostic under the same law `identity.provision` states for its own job: it reports that
the store answered, never what it answered with, so proving readiness never becomes the second way a
value leaves custody.

## The walk is written, never coded

Under `@tools/browsercontrol` mode `playwright` the operator writes the walk and executes nothing
itself: a `uat-walk` names each step by the role and accessible name of the control it presses, the
entry route once at its first step, and a credential by name where a field reads as a secret, and the
tree's runner drives it in a fresh browser context, copies every control from the walk into the
capture, stops at the first failed step and writes the `walk-result` beside the walk. A step the
accessibility tree cannot name cannot be pressed, and no step navigates by address bar after the
first, which is what keeps a walk from reaching the product past its surface. A receipt that records
this mode is held to it: every capture names its walk and the walk step that produced each assertion,
the result stands beside the walk at the digest that ran, the assertion's control equals the walk's
own target and its outcome the runner's, and a capture with no walk beside it is refused. What the
runner did not reach is `EVIDENCE_UNAVAILABLE`, never a pass.

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

When frontend and backend are separate deliveries, bind both @workspaces/fe and @workspaces/be. snapshot.provenance and verdicts.provenance freeze {fe, be} from those exact contexts; commit and the run-id suffix identify the frontend. Both admission entries carry role fe and the frontend commit. Their actual owning requests must pin that frontend head, and their emitted receipts must identify it; a quality request may also pin backend context without turning its frontend admission into a backend one. The Snapshot table prints Frontend commit and Backend commit, and the appended result retains both. A frontend route or admission with a head distinct from the backend requires this explicit form even if a caller omits frontend context. Backend-only legacy records remain valid when no split-role evidence exists. No frontend SHA is relabeled as a backend SHA.

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

Every seed record this run consumes carries `is_uat=true` and the `runId` namespace, so it is
separable from product data. Verification never mutates that data. It hands the exact receipt-owned
rollback set to `data.seed`, which deletes only that namespace and returns cleanup evidence; run
records remain append-only. A seed may never create the outcome under test.

## Runs are append-only

`runs/<runId>/` is written once, at the end, under the exclusive lease; `latest.json` is pointed at it
and `history.md` gains its line. A run folder that already exists is never rewritten, never trimmed and never corrected: a
second attempt is a new `runId`, and the old record stays as the evidence of what was observed then.
History that can be edited is not history.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| plan, real-login account and seed receipt valid for env/namespace/revisions | reuse prerequisites; open fresh run/browser profile; freeze before action | snapshot fingerprints plan, actors, seed, FE/BE heads, endpoint, cases and expected | drive product |
| prerequisite missing or invalid | no browser action and no seed effect | name exact UAT, identity, data, runtime or admission delta | typed owner handoff then new UAT attempt |
| walk runs | record actual/evidence for every assertion, including unreached/inconclusive | append complete attempt under new runId; preserve fail/incomplete | advance only when all required assertions match |
| owned defect found | edit no owner source and overwrite no run | classify owner and affected cases | owner repairs; new run reruns failed and affected cases |
| cleanup due | hand exact rollback set to `data.seed` | cleanup receipt proves only owned namespace removed | this verifier performs no database mutation |

## Boundary

Context is read-only apart from the flow directory. The operator writes the snapshot and the run
record under `@worktrees/uat/<flow>/<case>` while it holds the exclusive lease, and writes only
`response/` of its own branch: `data/snapshot.json`, `data/captures/<case>.json`,
`data/verdicts.json`, the screenshots and the sheet under `response/artifacts/`, `response.md` and
`response.json`. It does not read or write the password as a value, does not ask a person to sign in
or paste a credential, does not repair the product to make a case pass, does not edit the frozen
snapshot after execution begins, does not rewrite or delete a run record, performs no seed or cleanup
effect, and does not make anything happen other than through the control
each capture names: a walk is evidence only for what it pressed, so a step that reaches the product by
any other means — an endpoint, a mutation, a console command in place of the rendered control (`UX-1`
Case 2) — is not a step of the walk, and a criterion scored from it is `EVIDENCE_UNAVAILABLE`, never a
pass.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/uat/<flow>/<case>` | the flow directory in its one shape: `flow.md`, `accounts.<env>.json`, `seed/`, the approved `snapshots/`, the append-only `runs/<runId>/` history, the `latest.json` pointer and `history.md`, bound by fingerprint per file and written only under the exclusive lease | yes |
| `@worktrees/_templates` | the UAT folder contract used only to validate the planned flow shape; canonical creation belongs to `uat.plan` and `data.plan`; consumed, never modified | yes |
| `@worktrees/sessions/central-runtime` | the runtime owner's generation behind the bound endpoint; readiness is proved by the `route` Input, never re-derived from this registry | yes |
| `@workspaces/device-state` | the sealed credential roster; the shared UAT password is resolved by name here at login and read nowhere else | yes |
| `@workspaces/be` | the routed backend checkout at the pinned commit, whose behaviour the flow verifies and whose store holds the namespaced records | yes |
| `@workspaces/fe` | the frontend delivery head when the browser surface and backend are distinct; required whenever route or admission evidence identifies a different frontend head | no |
| `@knowledge/ui/proof` | the UX topic: the criteria the experience lane scores and the rule that turns them into its verdict | yes |
| `@worktrees/unchecked/<product>` | the unchecked coverage of this feature in the walk lane: which flows earlier missions left unwalked, and which of them this run covers | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-surface-audit` | the surface audit that found the frontend clean, taken at the pinned commit | yes |
| `quality-verification` | the quality gate that passed, taken at the same pinned commit | yes |
| `route` | `workspace.bind` on the fe role; the bound route whose endpoint this run drives | yes |
| `uat-account` | `identity.provision`; every actor alias, provider account, role/membership observation and real product-login proof for this environment | yes |
| `units` | `uat.plan`; the flow list whose one flow this branch walks, named by `request.unit` | no |
| `uat-plan` | `uat.plan`; the flow entry, budget, actor aliases and namespace | yes |
| `uat-case-sheet` | `uat.plan`; the immutable machine table of actor, preconditions, actions, assertions, expected and fixture refs | yes |
| `seed-receipt` | `data.seed`; the rows this flow walks on, attributable to its namespace, with their rollback | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `approval` | id | — | The authority covering sign-in as the flow's account: an approval id, or the environment declaration's reference — its path and content hash — when `identity-provisioning` is `declared` for `env`; no default, because silence is not consent |
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
| 1 | Validate the gate, the resume, the exclusive lease and the run's authority | `approval`, `lease`, `resume` | `request/request.json`, @worktrees/uat/<flow>/<case> for `latest` and the prior run record, @workspaces/be at the pinned commit, the environment's declaration when `approval` references it, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT` |
| 2 | Confirm the clean surface and green quality admissions at the frontend head, preserving the backend head separately | — | input `frontend-surface-audit`, input `quality-verification` | — | `ADMISSION_MISSING` |
| 3 | Validate the runtime, real product login proof and `seed-receipt` for the exact environment, actor aliases, namespace and FE/BE revisions; hand every missing or invalid prerequisite to its owner before browser action | `env` | @workspaces/device-state for the credential named by `accounts.<env>.json`, @worktrees/sessions/central-runtime for the entry of the bound route, its generation and origins, input `uat-account` when the identity was provisioned, @tools/secrets, @tools/http | — | `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING` |
| 4 | Freeze the already planned machine case sheet, account refs, seed receipt, endpoint, revisions and expected assertions; this verifier neither drafts canonical flow data nor changes expected | `feature`, `flow`, `env`, `cases` | @worktrees/uat/<flow>/<case>, @worktrees/_templates for the flow template | @worktrees/uat/<flow>/<case> (snapshot), `response/data/snapshot.json`, @tools/sourcewrite | `CANONICAL_WRITE_DENIED` |
| 5 | Verify the seed receipt read-only against the run namespace and planned preconditions; perform no seed or cleanup effect in this operator | `runId` | input `seed-receipt`, `response/data/snapshot.json`, @workspaces/be | — | `FIXTURE_VIOLATION` |
| 6 | Write the walk of the frozen cases in their order: a role and a name per control, the entry route once at step 1, a credential by name where a field reads as a secret, one capture per case after the sign-in redirect landed | — | `response/data/snapshot.json`, input `route` for the endpoint this run drives, @worktrees/uat/<flow>/<case> for the steps `flow.md` declares | `uat-walk` | `LEASE_INVALID` |
| 7 | Run the walk through the tree's runner under @tools/browsercontrol mode `playwright` — a fresh browser context at the endpoint the bound route carries, at the pinned commit, the credential resolved by name at the fill and masked in every frame — or drive the frozen cases through the browser under mode `required` when no walk was written | — | `uat-walk`, input `route` for the endpoint this run drives, @worktrees/sessions/central-runtime for the generation behind that endpoint, @workspaces/device-state for the credential at login only, @tools/browsercontrol, @tools/secrets, @tools/websearch | `walk-result`, `response/data/captures/<case>.json`, `response/artifacts/<case>.png` | `RUNTIME_UNAVAILABLE` |
| 8 | Record actual and evidence for every assertion, including unreached and inconclusive assertions, and stitch the sheet without turning missing evidence into pass | — | `response/data/snapshot.json`, `walk-result`, @worktrees/sessions/central-runtime for the most direct runtime evidence | `response/data/captures/<case>.json`, `response/artifacts/<case>.png`, `response/artifacts/sheet.png`, @tools/visualize, @tools/print | `EVIDENCE_UNAVAILABLE` |
| 9 | Judge the three lanes apart, and score the experience lane criterion by criterion | — | @knowledge/ui/proof (the UX topic and its closing rule), `response/data/captures/<case>.json` | `response/data/verdicts.json` | — |
| 10 | Prepare the exact cleanup handoff from the seed receipt's rollback set to `data.seed`; perform no database mutation here | `runId` | input `seed-receipt`, `response/data/verdicts.json` | — | — |
| 11 | Append every completed, failed or incomplete attempt under its new `runId`, update the latest pointer to that immutable result, add history, and emit | `runId` | everything above | @worktrees/uat/<flow>/<case> (runs/<runId>/, latest.json and history.md), `response/response.md`, `response/response.json`, `audit-scope`, `findings`, @tools/sourcewrite, @tools/print | — |

A verdict nobody was shown is a verdict nobody read. Step 8 prints the run's step-capture summary and
step 11 prints the `## Verdict` table over `@tools/print`, into the conversation the person is
reading, and the receipt lists both under `## Printed` with why each was printed; the
login field stays masked in every frame that is printed, exactly as in every frame that is written.

A pre-action admission block may publish only its blocked attempt receipt. Once the snapshot is
frozen or any browser action starts, the attempt is appended as incomplete, failed or complete with
the evidence actually observed; it is never discarded. A resume begins again at validation, reuses
only observations whose fingerprints are unchanged, and writes under the same lease; a resume that
adds no admission, lease, evidence or case change is `NO_PROGRESS`. Every retry uses a new `runId`.


When the admitted audit carries scope, run `node scripts/audit-scope.mjs <branch>` to copy
`verdicts.auditScope` unchanged into `response/data/audit-scope.json` and list the `audit-scope`
output kind. The receipt includes `## Audit scope`, a `Field | Value` table preserving Mode,
Coverage claim and Deferred states. The verdict has only that scope; deferred states do not become
passed because quality gates or UAT pass. Quality thresholds and frozen UAT cases remain unchanged.
The frozen snapshot also retains the unchanged scope in `auditScope` before execution.

The `findings` output is not this run's to write. Once the receipt is accepted, the orchestrator
appends every failing lane, criterion, assertion and `## Findings` row to the findings ledger and
materializes the ledger's open lines for this flow beside the receipt, under the law and the script
[the findings index](../../knowledge/findings/INDEX.md) states; the session gate refuses a done run
whose failures the ledger does not hold.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `uat-flow-verification` | `response/response.md` | md | yes |
| `uat-snapshot` | `response/data/snapshot.json` | data | yes |
| `uat-capture` | `response/data/captures/<case>.json` | data | yes |
| `uat-verdicts` | `response/data/verdicts.json` | data | yes |
| `audit-scope` | `response/data/audit-scope.json` | data | no |
| `findings` | `response/data/findings.json` | data | no |
| `uat-walk` | `response/data/walks/<walk>/walk.json` | data | no |
| `walk-result` | `response/data/walks/<walk>/walk-result.json` | data | no |
| `screenshot` | `response/artifacts/<case>.png` | artifact | yes |
| `sheet` | `response/artifacts/sheet.png` | artifact | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
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
| all three lanes pass and the promise must be reconciled against the journey that was actually walked | `business.reconcile` |
| the walk passed and another routed checkout of the mission still awaits its gates | `quality.verify` |
| the UI lane fails on an application-owned node | `interface.generate` |
| the behaviour lane fails | `backend.generate` |
| the flow has no dedicated account yet, so the identity is provisioned before the run continues | `identity.provision` |
| the flow or machine case sheet is missing or invalid | `uat.plan` |
| the seed plan or receipt is missing or invalid | `data.plan` |
| a valid seed receipt must be created or its exact namespace rolled back after any completed, failed or incomplete action attempt | `data.seed` |
| the UX lane fails: a person decides what the experience should be, and the flow is verified again only after that decision | `user` |
| the run produced the first baseline of this flow, so a person promotes the candidate before it is a reference | `user` |
