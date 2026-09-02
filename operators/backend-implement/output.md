# Output of `backend.implement`

The operator returns one closed envelope with `outcome` equal to `implemented` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Implemented receipt

An implemented receipt contains:

- exact project, source, outcome, contract, authority, input, and progress bindings;
- the operations that were filled, each restating the facets, proof kinds, and approved decisions it
  was bound to, so the receipt can be read without the input beside it;
- one change record per touched file, with its kind, before hash, after hash, and owning operation;
- one conformance record per declared facet, naming the evidence that measured it;
- one proof record per declared proof kind, naming the command that ran and the result it produced;
- findings for bound patterns, refused conventions, revalidated snapshots, and shipped migrations.

The receipt shows that the frozen contract was filled. It does not prove that the delivery is
production-ready, and it carries no quality, visual, or UAT verdict.

## Changes

| Kind | Before hash | After hash |
| --- | --- | --- |
| `added` | Null | Required |
| `modified` | Required | Required, and different |
| `deleted` | Required | Null |

A `modified` record whose two hashes agree describes a mutation that never happened, which is why the
pair is compared rather than merely present. Every change names the operation it serves, and no file
appears twice.

## Conformance

Each declared facet has exactly one record and one verdict:

| Verdict | Meaning | Allowed in an implemented receipt |
| --- | --- | --- |
| `conforms` | The code does exactly what the contract says for this facet | Yes |
| `widened` | The code reaches past the contract | No |
| `narrowed` | The code delivers less than the contract | No |

Every record carries an `evidenceRef`, including a passing one. A record without evidence is an
assertion, and an assertion cannot be contradicted by a later reader, which defeats the purpose of
recording it at all.

A declared facet with no record is rejected. Silence about a facet reads exactly like a pass and is
the cheapest way for a contract to be quietly unfilled.

## Proofs

Every declared proof kind produces one record with its command reference, its result reference, and
its result. Both references are required: the command says what was run and the result says what came
back, and either one alone can be written by someone who ran nothing.

An implemented receipt requires every proof to have passed, and `artifactRefs` registers every proof
result so an auditor can open them without asking.

## Blocked receipt

A blocked receipt has no implementation. It contains one typed failure, the exact operations, files,
and references involved, the owning domain, retryability, and, only when retryable, a single-use
resume token with the required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `CONTRACT_UNFROZEN` | The contract is not frozen or its fingerprint is stale. | The frozen contract. |
| `CONTRACT_WIDENED` | The outcome needs a boundary the contract does not carry. | A reopened and refrozen contract. |
| `BUSINESS_AUTHORITY_MISSING` | A business question is open and no approved decision settles it. | The approved decision, and a rebound authority fingerprint. |
| `OWNER_CONFLICT` | A file needing mutation lies outside the mutable ceiling. | Corrected file authority. |
| `PATTERN_UNBOUND` | A touched aspect has no sibling family bound for it. | The missing pattern binding. |
| `PROOF_UNAVAILABLE` | A declared proof could not be executed here. | A working proof environment. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new authority, contract, pattern, or scope. |

`BUSINESS_AUTHORITY_MISSING` and `CONTRACT_WIDENED` are the two expected exits, not defects. The first
belongs to the business owner and the second to the contract owner, and in both cases implementing the
same outcome again after the decision is published is the correct next step.

## Cross-field invariants

- `outcome="implemented"` requires `receipt.status="implemented"`, non-null `implementation`, null
  `failure`, and null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `implementation`, and non-null
  `failure`. A retryable failure requires a resume; a non-retryable failure forbids one.
- Operation identifiers are unique, and `appliedOperationIds` is exactly the set of declared
  operations.
- Every change names a declared operation, every file appears once, and the hash pair matches the
  change kind.
- Every declared facet has exactly one conformance record, every record targets a declared facet, and
  every verdict in an implemented receipt is `conforms`.
- Every declared proof kind has exactly one proof record, every record targets a declared kind, and
  every proof in an implemented receipt has passed.
- `artifactRefs` registers every proof result.
- An implemented receipt carries no `BUSINESS_QUESTION_RAISED` finding, and every finding that names
  an operation names a declared one.
- `handoff` is always `null`.

## Practical outcomes

Implement a course enrolment gateway route: the mutation handler validates the payment-type capability
matrix and refuses an unsupported installment or voucher combination loudly before any row is created,
the conformance records cover transport, writer, transaction, idempotency, exception identity, and
authorization, and the unit and integration proofs both run and pass.

Implement the same outcome where the approved authority never decided whether a flat voucher applies
on a foreign-currency gateway: the invocation returns `BUSINESS_AUTHORITY_MISSING` naming that
question, nothing is written, and no branch is chosen.
