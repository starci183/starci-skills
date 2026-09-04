# backend.source.apply

## Job

Implement one backend outcome inside a frozen mutation contract, following the observed sibling
family, and return the measured conformance and proof receipt that shows the boundary was not widened.

## The contract is frozen before the first write

The contract arrives as the Input `architecture-decision`, fingerprinted and closed. The operations,
writers, stores, transaction boundaries, idempotency kinds, and migrations it lists are the complete
set the implementation may touch, and this operator answers only one question per operation: does the
code that now exists do exactly what the contract says, and what measurement shows it. The operations
are not a Requirement, because a person retyping a contract into a request is how the contract and
the implementation quietly diverge; step 3 reads them from the frozen input's `operations` — one row of the
architecture decision's `## Operations` table, one object of its `stack-model.json`, per write the
decision commits to — and restates them in `response/data/mutations.json`, carrying each operation's
`writerRef`, `transactionBoundary`, `idempotencyKind`, `migrationRefs` and dimension ids across
unchanged. Three prohibitions carry that, and each is enforced rather than
advised. An operation, writer, store, transaction, migration, or event outside the contract is
`CONTRACT_WIDENED`, returned to the contract owner before any product write. A file outside the
mutable ceiling is `OWNER_CONFLICT`, even when the change there would be one line. A convention no
bound sibling pattern publishes is refused and recorded as `NEW_CONVENTION_REFUSED`, while an aspect
with no pattern at all is `PATTERN_UNBOUND`. Discovering mid-implementation that the outcome needs a
wider boundary is the expected way this operator ends, not a failure of nerve: the contract is
reopened by its owner and the same outcome is implemented again against the new fingerprint. Reaching
outside the list is not a smaller change than reopening the contract; it is the same change made
without a record.

Standalone migrations follow
[`stack-model.schema.json#/$defs/migrationOperation`](../../templates/kinds/stack-model.schema.json#/$defs/migrationOperation).
For a contract containing one, the orchestrator sets `contractFingerprint` to the SHA-256 of the exact
producer `stack-model.json` bytes before the request is frozen. The request gate verifies the completed
architecture producer, its critique, the fingerprint and the declared writer and migration file ceiling.
The result gate compares every operation field to that same producer; the output cannot replace its
own authority. An imported contract is checked against its verified original producer, including the
original critique. Migration conformance and replay proof still apply, and implementing source does
not grant authority to apply the migration to a shared environment.

## Nothing is written outside a session

Before a single byte of routed source is read for change or written, the branch this operator runs in
exists: a session folder with `state.json` and this branch's own `step-N/parallel-M/request/request.json`,
green under `validate-request`. That order is the whole point of the session — the request states what
may be touched before anything is touched, and every later receipt hangs off it. An invocation that
finds itself about to edit routed source with no `step-N/parallel-M` under a session stops with
`SESSION_MISSING` and reports it; it does not create the folder retroactively, because a session
written after the work is a record of the work, not a gate on it, and nothing it contains was ever
validated against what was actually done.

## The person's branch is never written

This operator never writes on the branch a person has checked out. The orchestrator prepares a
dedicated git worktree of the routed checkout on the session branch `session/<sessionId>`, cut from
the frozen head, and step 3 writes there and nowhere else, under an exclusive lease on
`@workspaces/be`. The final step commits the whole declared write set once, records that sha in
`response.json.commits`, and names the same sha in `response/data/mutations.json` as `commit` beside
the `base` it started from and the `branch` it lives on; `response/changes.md` states the same move in
its Binding row, `@workspaces/be` at `<base>` → `<sha>` on `session/<sessionId>`. One commit, because
a step whose work arrives as several commits cannot be pinned by the next step's request, and an
uncommitted write cannot be pinned at all. Nothing is pushed and nothing is merged here: `git.publish`
merges the session branch into the target branch, and it is the only operator that talks to a remote.

## Dry mode writes the plan, not the tree

`mode` decides whether this run touches the checkout at all. Under `apply` the operator fills the
contract, commits once, and everything below holds as written. Under `dry` it does the same reading,
the same binding and the same projection, then stops after the plan: `response/data/mutations.json`
carries the operations it would fill and the files it would touch with `commit` null and no after
hash, `response.json` records no commit, and not one byte reaches `@workspaces/be`. The branch still
ends `done`, because a plan honestly produced is a finished answer to a question about a plan; its
`changes.md` lists every planned path as `unchanged`, which is what the working tree actually shows,
and names the change it would have made in `Why`. A dry run measures nothing, so it carries no
conformance record and no proof record: a facet cannot be measured on code that was never written,
and a plan that shipped verdicts would be indistinguishable from an implementation. A dry run is also granted neither `@tools/sourcewrite` nor `@tools/git`, because a
mode that writes nothing needs no tool that can write; the grant and this paragraph say the same
thing so neither can drift. That is also why
a dry run can never be the run that satisfies the contract — it is a way to read the write set before
paying for it, not a cheaper way to apply it.

## The backend never invents business behaviour

Every operation cites the approved decisions it implements. An approved decision is not a number this
operator may coin: it is a coverage-matrix `dimension` of the bound business head, addressed by that
dimension's own kebab identifier, and the matrix fingerprint travels with the citation so a later
reader can tell which matrix approved it. A citation naming anything the bound matrix does not carry
is not an approval, it is a guess with a label. When the code reaches a point where the
answer depends on a business rule nobody approved, the branch stops with `BUSINESS_AUTHORITY_MISSING`
and names the open question. It does not pick the lenient reading, mirror what a neighbouring feature
happens to do, or choose whichever branch makes the test go green. This is the most load-bearing rule
in the operator, because a guessed business rule that passes its own test is indistinguishable from an
approved one once it ships. An implemented receipt therefore cannot carry a `BUSINESS_QUESTION_RAISED`
finding: raising the question and implementing anyway is the exact contradiction the check exists to
catch.

## Sibling patterns are the only source of convention

The bound patterns name one family per aspect, and the implementation mirrors the family the codebase
already publishes rather than the one it remembers: command handlers in the family the mutation layer
already uses, exceptions derived from the published exception identity, entity access through the
injected primary entity manager, migrations under the primary datasource. Two families bound for one
aspect means no family is bound, and guessing the family from memory is how a second house style
enters a codebase unnoticed.

## Conformance is measured, not asserted

A conformance record without evidence is a sentence about the code, and a sentence cannot contradict
the code. Each declared facet of each operation gets its own file,
`response/data/conformance/<operationId>.<facet>.json`, so a facet nobody measured is a missing file
rather than a missing line inside a file that still looks complete. The evidence is what a later
reader uses to disagree with this receipt, so it is required for every facet including the ones that
passed. The same reasoning makes a proof carry its command, its exit code and its output in
`response/data/proofs/<operationId>.<kind>.json`: the command says what was run and the result says
what came back, and either one alone can be written by someone who ran nothing. A proof that could not
run never becomes an assertion that the behaviour is fine, and a failed proof blocks the receipt
rather than being reclassified. Each touched file carries one change record with its kind and its
before and after hashes, because a modified file whose two hashes agree records a mutation that did
not happen.

## Boundary

The operator writes product source only inside the mutable file ceiling, only inside the session
branch worktree of `@workspaces/be`, and writes everything else into `response/` of its own branch:
`response.md`, `response/changes.md`, `response/data/mutations.json`, one conformance record per
declared facet, one proof record per declared proof, and `response.json`. It never adds an operation,
writer, store, transaction, migration, or event the frozen contract does not carry, decides a business
rule the approved authority does not state, introduces a convention no bound sibling pattern
publishes, weakens, skips, suppresses, or substitutes a declared proof to make a run go green, edits
the contract, the business authority, or a file outside the mutable ceiling, commits more than once,
writes on the person's checked-out branch, pushes, merges, or tags anything, claims conformance
without naming the evidence that measured it, or records a quality, visual, or UAT verdict; those are
other jobs with their own gates.

When the `model` Input is present it is the authority for this run and the published head is lineage
only: a chain that has just modelled a head must not decide against an older promise merely because
the publication was withheld. When it is absent the published head is the authority.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | the published business head, the only source of business behaviour; evidence when the session carries a `model` Input | yes |
| `@knowledge/patterns/be` | the sibling families this change mirrors, one per aspect; the only source of valid conventions | yes |
| `@workspaces/be` | the routed backend checkout at the frozen head, written only on its session branch worktree | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `architecture-decision` | `architecture.decide`; the frozen mutation contract the implementation fills and may not widen, and the source of every operation this run restates | yes |
| `model` | `business.decide`; the head that branch modelled, when it has not been published yet | no |
| `backend-source-application` | a prior run of `backend.source.apply` for the same outcome; regression history, absent on the first run | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `featureId` | id | — | The feature whose published business head decides this behaviour |
| `outcome` | prompt | — | The one thing being implemented, in the person's words |
| `mutableFileRefs` | list | — | The only files product source may be written into |
| `contractFingerprint` | id | null | SHA-256 of the producer stack-model bytes; the orchestrator binds it for a standalone migration contract |
| `mode` | choice | apply | `apply` fills the contract and commits, `dry` emits the plan and writes nothing |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and confirm the session | `resume`, `mode` | `request/request.json`, the session's `state.json` and this branch's `step-N/parallel-M`, input `backend-source-application` when present, @workspaces/be at the frozen head | — | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority, contract and patterns | `featureId`, `contractFingerprint` | input `model` when present, otherwise @worktrees/businesses/<featureId> at its published head, input `architecture-decision` as the frozen contract and the source of its `operations`, @knowledge/patterns/be one pattern per aspect | — | `CONTRACT_UNFROZEN`, `BUSINESS_AUTHORITY_MISSING`, `PATTERN_UNBOUND` |
| 3 | Fill one contract operation at a time, on the session branch | `mutableFileRefs` | @knowledge/patterns/be for each aspect, @workspaces/be inside the mutable ceiling | @workspaces/be/branch/session inside the mutable ceiling, under an exclusive lease, @tools/sourcewrite | `CONTRACT_WIDENED`, `OWNER_CONFLICT` |
| 4 | Check every mutation against the frozen contract and record it with its before and after hash | `mode` | @workspaces/be, the touched files and the frozen contract | `response/data/mutations.json` | — |
| 5 | Revalidate persisted snapshots on read | — | @workspaces/be, the persisted snapshot, @knowledge/patterns/be for the rules that drift after it | — | — |
| 6 | Prove each declared facet | — | @workspaces/be, the measurement behind each facet | `response/data/conformance/<operationId>.<facet>.json` | — |
| 7 | Run each declared proof | — | @workspaces/be, the pinned command of each declared proof kind | `response/data/proofs/<operationId>.<proofKind>.json`, @tools/shell | `PROOF_UNAVAILABLE` |
| 8 | Commit the write set once, write the receipt and emit | `outcome` | everything above | @workspaces/be/branch/session as one commit, `response/changes.md`, `response/response.md`, `response/response.json`, @tools/git | — |

Under `mode = dry` step 3 projects the fill onto the declared paths without writing one of them, step
4 records that projection as the plan with a null commit and no after hash, steps 5 to 7 have nothing
to measure and produce nothing, and step 8 emits the receipt and the change record without a commit.
Under `apply` every step runs as written. The routed head is reverified immediately before the first
product write, so drift found there stops the branch before anything is written. Filling an operation writes the transport, the validation, the
authorization check, the data access, and the failure paths into the declared writer and the files the
change genuinely requires; it refuses loudly and early rather than dropping a case silently, raising
the exception the exception-identity pattern publishes before any row or external checkout is created.
When the outcome persists a workflow, session, cart, draft, or other snapshot, usability is enforced
again where it is read, reconciled server side, in stable order, with indexes remapped atomically and
an explicit terminal state when nothing actionable remains, and recorded as `SNAPSHOT_REVALIDATED`. A
resume begins again at step 1, reuses only unchanged fingerprinted observations, and consumes the exact
delta; an approved business decision arrives as a new authority fingerprint, because the same
fingerprint cannot yield a different answer.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `backend-source-application` | `response/response.md` | md | yes |
| `changes` | `response/changes.md` | md | yes |
| `mutations` | `response/data/mutations.json` | data | yes |
| `conformance` | `response/data/conformance/<operationId>.<facet>.json` | data | no |
| `proof` | `response/data/proofs/<operationId>.<proofKind>.json` | data | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SESSION_MISSING` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `CONTRACT_UNFROZEN` | terminate |
| `CONTRACT_WIDENED` | terminate |
| `BUSINESS_AUTHORITY_MISSING` | terminate |
| `OWNER_CONFLICT` | terminate |
| `PATTERN_UNBOUND` | terminate |
| `PROOF_UNAVAILABLE` | terminate |

## Next

| When | Operator |
| --- | --- |
| the contract is filled and the gates the change record names must run | `quality.verify` |
| the promise must be reconciled against the source that was delivered | `business.decide` |
| the contract is filled and a frontend surface must consume it | `frontend.direction.decide` |
| a file needing mutation lies outside the routed write ceiling | `workspace.bind` |
| a declared proof cannot be executed in this environment | `platform.operate` |
| the plan was produced under mode dry and a person decides whether to pay for it | `user` |
