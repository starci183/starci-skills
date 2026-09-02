# Execute `backend.implement`

## Single job

Implement one backend outcome inside an already frozen mutation contract, following the sibling family
the codebase already publishes, and return the measured proof that the contract was filled rather than
widened. This is one linear operator invocation. It does not call another operator, route a workflow,
pause internally, or return free-form control instructions.

The boundary, the business decisions, and the required proofs arrive decided. This operator answers
only one question per operation: does the code that now exists do exactly what the contract says, and
what measurement shows it.

## The contract is frozen before the first write

`input.contract` is fingerprinted and closed. The operations, writers, stores, transaction boundaries,
idempotency kinds, and migrations it lists are the complete set the implementation may touch.

Three prohibitions carry this, and each is enforced rather than advised:

1. an operation, writer, store, transaction, migration, or event outside the contract is
   `CONTRACT_WIDENED`, returned to the contract owner before any product write;
2. a file outside `input.scope.mutableFileRefs` is `OWNER_CONFLICT`, even when the change there would
   be one line;
3. a convention no bound sibling pattern publishes is refused, recorded as `NEW_CONVENTION_REFUSED`,
   and the aspect with no pattern at all is `PATTERN_UNBOUND`.

Discovering mid-implementation that the outcome needs a wider boundary is the expected way this
operator ends, not a failure of nerve. The contract is reopened by its owner and the same outcome is
implemented again against the new fingerprint.

## The backend never invents business behaviour

Every operation cites the approved decisions it implements. When the code reaches a point where the
answer depends on a business rule nobody approved, the invocation stops with
`BUSINESS_AUTHORITY_MISSING` and names the open question. It does not pick the lenient reading, mirror
what a neighbouring feature happens to do, or choose whichever branch makes the test go green.

This is the single most load-bearing rule in the operator. A guessed business rule that passes its own
test is indistinguishable from an approved one once it ships, which is why an open question exits as a
typed failure addressed to the business owner and never as a default.

An implemented receipt therefore cannot carry a `BUSINESS_QUESTION_RAISED` finding. Raising the
question and implementing anyway is the exact contradiction the check exists to catch.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/backend-implementation/<invocationId>`, `@be` (the routed head) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@business/<featureId>`, `@receipt/architecture-decision/<invocationId>` (the frozen contract and every operation), `@knowledge/patterns/be` (each sibling pattern with its aspect) | — | `CONTRACT_UNFROZEN`, `BUSINESS_AUTHORITY_MISSING`, `PATTERN_UNBOUND` |
| 3 | Fill one operation at a time | `@receipt/architecture-decision/<invocationId>` (one contract operation), `@knowledge/patterns/be` (its bound patterns), `@be` (`input.scope.mutableFileRefs`) | `@be` | `CONTRACT_WIDENED`, `OWNER_CONFLICT` |
| 4 | Record every mutation | `@be` (the touched files, before and after hashes) | — | — |
| 5 | Revalidate persisted snapshots on read | `@be` (the persisted snapshot), `@knowledge/patterns/be` (the rules that drift after it) | — | — |
| 6 | Prove each declared facet | `@receipt/architecture-decision/<invocationId>` (the operation's declared facets), `@be` (their measurements) | `@artifacts/conformance/<operationId>.<facet>.json` | — |
| 7 | Run each declared proof | `@receipt/architecture-decision/<invocationId>` (the declared proof kinds and their pinned commands), `@be` | `@artifacts/proofs/<operationId>.<kind>.json` | `PROOF_UNAVAILABLE` |
| 8 | Emit and stop | everything above | `@artifacts/backend-implementation.json` | — |

Validation rejects a stale source binding, a writer outside the mutable ceiling, a migration with no
replay proof, a read-only operation carrying a migration, an event consumer with no idempotency, a
decision identifier no approved authority publishes, and an unchanged resume. The routed head is
reverified immediately before the first product write, so drift found there stops the invocation
before anything is written.

Filling an operation writes the transport, the validation, the authorization check, the data access,
and the failure paths into the declared writer and the files the change genuinely requires, mirroring
the bound pattern for each aspect. It refuses loudly and early rather than dropping a case silently:
an unsupported combination raises the exception the exception-identity pattern publishes, before any
row or external checkout is created, and a convention no bound pattern publishes is recorded as
`NEW_CONVENTION_REFUSED` rather than adopted.

Each touched file produces one change record with its kind, its before hash, its after hash, the
operation it serves, and what changed; a modified file whose two hashes agree recorded a mutation that
did not happen. When the outcome persists a workflow, session, cart, draft, or other snapshot,
usability is enforced again where it is read — reconciled server-side, in stable order, with indexes
remapped atomically and an explicit terminal state when nothing actionable remains — and recorded as
`SNAPSHOT_REVALIDATED`.

Every declared facet gets exactly one conformance record naming the evidence that measured it; a facet
with no record is conformance asserted rather than proved, and a facet whose verdict is `widened` or
`narrowed` blocks the receipt. A proof that could not run never becomes an assertion that the
behaviour is fine, and a failed proof blocks the receipt rather than being reclassified. Emission
writes the receipt under `input.project.artifactRootRef`, registers every proof result in
`artifactRefs`, returns one output conforming to `output.schema.json`, binds every fingerprint, and
claims no quality, visual, or UAT proof; those are other jobs with their own gates.

## Conformance is measured, not asserted

A conformance record without an `evidenceRef` is a sentence about the code, and a sentence cannot
contradict the code. The evidence is what a later reader uses to disagree with this receipt, so it is
required for every facet including the ones that passed.

The same reasoning makes a proof carry both its command and its result: the command says what was run,
and the result says what came back. Either one alone can be written by someone who ran nothing.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no authority, contract, pattern, or scope change returns
`NO_PROGRESS`. An approved business decision must arrive as a new authority fingerprint; the same
fingerprint cannot yield a different answer.

## Mandatory attacks

The operator cannot report an implementation while any applicable item remains unresolved:

- a behaviour in the code depends on a rule the approved authority does not state;
- an operation touches a store, event, or migration the contract does not list;
- a declared facet has no conformance record, or a record with no evidence;
- a declared proof did not run, or ran and failed;
- a change record claims a modification whose before and after hashes are equal;
- a convention appears that no bound pattern publishes;
- a persisted snapshot is returned without being revalidated at read time.
