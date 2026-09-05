# api.verify

## Job

Run the repository's own end-to-end suite as a client against the served runtime, on the namespace the
seed placed, and publish one append-only run record whose cases are the runner's and whose three lanes
are judged apart, or stop at the exact unavailability instead of manufacturing a verdict.

## Done when

Done when the `api-cases` carry every case the repository's own suite reported with its status and its
evidence, none of them authored by this branch, the `api-verdicts` judge the contract, data and
lifecycle lanes apart on that evidence, the run namespace was read back through the API and then
deleted and nothing else was, the append-only run record exists under the flow's API history with its
pointer and its history line, and the `api-verification` names the served head that answered, the
commit it contains, the command that was run and the lane table it printed to the person.

## A suite run as a gate proves the code; run as a client it proves the product

The same end-to-end suite means two different things depending on where it is run from. Run inside the
delivery's own checkout, wired to whatever the test harness stands up, it is a gate: it proves the code
compiles into behaviour the author expected, and that is the job of the operator that runs gates. Run
from outside, against the endpoint a runtime is actually serving, on rows a person could have entered,
signed in as an account a person could hold, it is a walk: it proves the product answers a client the
way it promises to. A backend delivery whose only evidence is the gate has never been exercised as a
client, and the difference between the two is invisible in the receipt unless one operator owns each.
This one owns the walk. It starts no server, repairs no source, and writes nothing into the delivery.

## The suite is the repository's; a case this branch writes is a source write

The cases are not this operator's to invent. It takes the command the route's gate plan declares for
the end-to-end gate — or the command reference that plan names — and runs that, never a script composed
for this branch, because a bespoke script proves whatever its author wanted to see and is not the suite
the delivery is checked against. Every row of the case record is copied from the runner's output with
its identifier as the runner printed it, and a case identifier that stands in no runner output is
refused rather than judged. A case the product needs and the suite does not have is a gap in the
source, and closing it is a source write that belongs to the operator that owns backend source; it
never happens here, where nothing may write into the delivery at all.

## The endpoint is the attested one, never a re-derived one

The suite is pointed at the entry the `platform-operation-receipt` attests, and this operator does not
re-derive readiness from the runtime registry: a registry that advertises ready while nothing listens
is exactly the source that sends a client at a dead port. When the attested entry does not answer, the
stop is `RUNTIME_UNAVAILABLE` against a named endpoint rather than a guess about which origin was
meant, and it hands to whoever serves the route; this operator never starts one.

That endpoint serves one integration branch carrying the work of every session that asked for it, so
the head it runs is almost never the commit this run verifies. The record therefore carries both: the
commit pinned and the head served, with the ancestry test between them. A served head that does not
contain the pinned commit is drift, and drift is a stop with nothing run — but a served head that
contains it and other work besides is exactly what a shared integration branch looks like, and is no
finding at all.

## The password is a name, never a value

The account the suite signs in as is the flow's own, and the shared credential is resolved by name
where the suite consumes it and at no other moment. It is never copied into a variable this operator
writes, a fixture, a command it records, an environment line it publishes, or a sentence it prints.
The runner's own output is published evidence and is held to the same law: a value that reached the
output has already left custody, and the record is refused. The account record therefore carries a
username, a role, a credential name and the sealed file's reference, and nothing that could hold a
secret.

## The namespace owns everything this run wrote

Every record the suite creates carries the namespace the seed placed, so what this run wrote is
separable from what the product already had. The data lane reads those records back the way a client
reads them — through the API, never by asking the store directly — because a row that only a direct
query can see is a row the product does not actually serve. A record the run wrote outside that
namespace is `API_NAMESPACE_LEAK`: the suite reached a row the flow does not own, and no cleanup this
operator may perform takes it back. Cleanup then deletes exactly that namespace and nothing else: not
another run's namespace, not a record that merely carries the same flag, and never a run record.
Verification itself reads and does not write.

## Three lanes, judged apart

Contract, data and lifecycle are judged on their own evidence and never borrow each other's
conclusions. Contract is every case the runner named holding; data is every write landing inside the
namespace and nothing outside it, read back through the API; lifecycle is the namespace being
verifiable read-only and then removed, and nothing else with it. Exactly three lanes are published,
each with its own verdict and its own evidence. A run whose lanes do not all pass is not done: a case
that failed, or that the runner named and never ran, stops with `API_CASE_FAILED` and hands the answer
to the delivery owner, and a record outside the namespace stops with `API_NAMESPACE_LEAK` and hands the
fixture boundary to the caller who declared it.

## Runs are append-only

The run record is written once, at the end, under `runs/<runId>/` of the API flow's own home,
`@worktrees/e2e/<flow>`, beside the browser flow's home under `@worktrees/uat` and never inside it; the pointer is aimed at it and the history gains its line. A run folder
that already exists is never rewritten, never trimmed and never corrected: a second attempt is a new
`runId`, and the old record stays as the evidence of what was observed then. A run that reached
per-case results publishes its record whether they passed or not, because the case rows are what the
delivery owner reads; a run that never reached the suite publishes none, because a half-written record
is the artifact a later reader mistakes for a decision.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| suite, endpoint, account and seed current | reuse declarations; open fresh append-only run | prove generation contains commit and prerequisites share namespace | run suite as client |
| prerequisite missing/invalid | run no case | name exact suite, identity, data or runtime delta | owner handoff then changed-evidence attempt |
| cases execute | record every printed case and response observation | judge contract/data/lifecycle; absent output inconclusive | append pass, fail and incomplete run ids |
| case fails | edit no product or suite source | route behavior to source owner and prerequisites to their owner | new head/prerequisite creates new attempt |
| cleanup required | use only seed receipt ownership | read no owned records remain | outside row is `API_NAMESPACE_LEAK`, never guessed deletion |

## Boundary

Context is read-only apart from the flow's API history. The operator writes the run record under
`@worktrees/e2e/<flow>` and writes only `response/` of its own branch: `data/cases.json`,
`data/verdicts.json`, the runner's output under `response/artifacts/`, `response.md` and
`response.json`. It does not read or write the credential as a value, does not ask a person to sign in
or paste one, does not start, restart or stop a server, does not repair the delivery to make a case
pass, does not write a case, a fixture or a script into the source, does not rewrite or delete a run
record, and does not delete anything outside the run namespace the seed named.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/e2e/<flow>` | the API flow directory: `flow.md` naming the suite, the served route and the namespace it walks on, and the append-only `runs/<runId>/` history with its `latest.json` pointer and `history.md`, written only at the end of the run | yes |
| `@worktrees/uat/<flow>` | the browser flow of the same name, read only: the account record the suite signs in as and the seed the rows come from, when the API flow shares them | no |
| `@worktrees/sessions/central-runtime` | the runtime owner's generation behind the attested entry; readiness is proved by the `platform-operation-receipt`, never re-derived from this registry | yes |
| `@workspaces/device-state` | the sealed credential roster; the shared UAT credential is resolved by name where the suite consumes it and read nowhere else | yes |
| `@workspaces/be` | the routed backend checkout at the pinned commit, whose own end-to-end suite and gate plan this run executes and never edits | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `platform-operation-receipt` | `runtime.serve`; the attested entry this suite is pointed at, and the head it serves | yes |
| `uat-account` | `identity.provision`; the account the suite signs in as, carried by name | no |
| `seed-receipt` | `data.seed`; the rows the suite runs on and the namespace they carry | no |
| `quality-verification` | `quality.verify`; the gates that passed at the same head, so the walk is read against what the gates already said | no |
| `units` | `uat.plan`; the flow list whose one API flow this branch runs, named by `request.unit` | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `approval` | id | — | The authority covering this run's own writes — running the suite against the environment's data and signing in as the flow's account: an approval id, or the environment declaration's reference, its path and content hash, when that declaration marks `seed` and `identity-provisioning` `declared` for `env`; no default, because silence is not consent |
| `flow` | id | — | The one API flow this invocation runs: it addresses the flow directory and names the suite the gate plan declares |
| `env` | id | dev | The stack this run drives: it selects the account record, the sealed secret, the runtime registry entry and the namespace the seed placed |
| `runId` | id | — | Not asked of a person: the orchestrator fills it, and it names the run record every observation is written under |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the resume and the run's authority | `approval`, `resume` | `request/request.json`, @worktrees/e2e/<flow> for the API history and the prior run record, @workspaces/be at the pinned commit, the environment's declaration when `approval` references it, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT` |
| 2 | Inspect the attested entry, suite, account and seed receipt, classifying each prerequisite reusable, missing or invalid at the pinned head and namespace before any case runs | — | input `platform-operation-receipt`, @worktrees/sessions/central-runtime for the generation behind that entry, @tools/http | — | `RUNTIME_UNAVAILABLE` |
| 3 | Bind the namespace the seed placed and the account the suite signs in as, resolving the credential by name | `env` | input `seed-receipt`, input `uat-account`, @worktrees/e2e/<flow> for the account record, @workspaces/device-state, @tools/secrets | — | `INVALID_INPUT` |
| 4 | Take the command the route's gate plan declares for the end-to-end gate; a case or a script this branch would write belongs to the operator that owns source | `flow` | @workspaces/be for the declared commands and the suite the flow names, input `quality-verification` for the gates already taken at this head | — | `INVALID_INPUT` |
| 5 | Run that command as a client against the bound entry and keep the runner's own output whole | `runId` | @workspaces/be, @tools/shell | `api-output` | `RUNTIME_UNAVAILABLE` |
| 6 | Copy every runner case and record missing, failed and incomplete output as actual evidence; never invent a case or turn absent output into pass | — | `api-output` | `api-cases` | `API_CASE_FAILED` |
| 7 | Read every record the suite wrote back through the API and judge the three lanes apart | — | `api-cases`, @tools/http | `api-verdicts` | `API_NAMESPACE_LEAK` |
| 8 | Verify the namespace read-only, then delete it through the API and nothing else | `runId` | `api-verdicts`, @tools/http | — | `API_NAMESPACE_LEAK` |
| 9 | Append pass, fail and incomplete attempts under distinct run ids, update the pointer to the immutable result, add history and emit | `runId` | everything above | @worktrees/e2e/<flow>, `response/response.md`, `response/response.json`, @tools/sourcewrite, @tools/print | — |

A verdict nobody was shown is a verdict nobody read. Step 6 prints the per-case results and step 9
prints the lane table over @tools/print, into the conversation the person is reading, and the receipt
lists both under `## Printed` with why each was printed.

A resume begins again at validation, reuses only observations whose command and served head are
unchanged, and a re-entry that adds no served head, no command and no case change is `NO_PROGRESS`. A
second attempt after a published run is a new `runId`, never an edit of the old one.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `api-verification` | `response/response.md` | md | yes |
| `api-cases` | `response/data/cases.json` | data | yes |
| `api-verdicts` | `response/data/verdicts.json` | data | yes |
| `api-output` | `response/artifacts/api-output.txt` | artifact | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `RUNTIME_UNAVAILABLE` | terminate |
| `API_CASE_FAILED` | terminate |
| `API_NAMESPACE_LEAK` | terminate |

## Next

| When | Operator |
| --- | --- |
| all three lanes pass | `git.publish` |
| all three lanes pass and the promise must be reconciled against the journey a client actually took | `business.reconcile` |
| a case the runner named did not hold | `backend.generate` |
| the attested entry stopped answering, so the route is served again before the suite is run again | `runtime.serve` |
