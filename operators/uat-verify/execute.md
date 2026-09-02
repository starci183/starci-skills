# Execute `uat.verify`

## Single job

Verify one product-decision flow against inputs frozen before execution, and publish its canonical
snapshot and result pair. This is one linear operator invocation. It does not call another operator,
route a workflow, pause internally, or return a free-form control instruction.

The flow, its cases, its identity, and its fixtures arrive decided. This operator answers one
question: does the running product do what the frozen snapshot says it should, on evidence gathered
after the freeze.

## Freeze precedes execution

The snapshot is written first and never edited afterwards. It states the intent, the cases, the
required checkpoints, the fixture namespace, and the non-secret account record. The result is written
last, and it binds the fingerprint of the parsed sibling snapshot.

That ordering is the whole point. Three failures become detectable instead of invisible:

1. A case executed at or before the freeze cannot claim the snapshot framed it.
2. A case that never appears in the frozen list cannot appear in the result.
3. A post-journey upsert or finalization cannot manufacture the expected outcome, because a case whose
   run recorded such a mutation cannot pass.

The operator never repairs the product to make a case pass, and it never rewrites the snapshot to
match what happened.

## Authentication is provisioned, never requested

For an authenticated flow, the control plane has already created one fresh run-scoped learner in both
Keycloak and the application database, authenticated a brokered Browser context, and returned opaque
references. This invocation consumes them.

Asking the user to sign in, lend an account, or paste a credential is forbidden in every branch,
including the branch where provisioning failed. Unavailable provisioning, an unavailable provisioner,
or unavailable broker authentication returns `PROVISIONING_UNAVAILABLE` as `BLOCKED`.

The account record frozen into the snapshot is a closed set of non-secret fields. A password, cookie,
token, or OTP has nowhere to go, so custody is a shape rather than a discipline.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input (the lease), `@worktrees/uat/<flow>/<case>` (the prior result), `@workspaces/be` (the frozen source head) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Confirm admission | input (the final blind visual PASS, the final quality PASS) | — | `ADMISSION_MISSING` |
| 3 | Run the constraint preflight | `@worktrees/sessions/central-runtime` (account and fixture identities, every physical store) | — | `PROVISIONING_UNAVAILABLE` |
| 4 | Freeze the snapshot | input (the flow definition), `@worktrees/_templates` (the snapshot template schema) | `@worktrees/uat/<flow>/<case>` (`snapshot.json`) | `CANONICAL_WRITE_DENIED` |
| 5 | Prepare fixtures | `@worktrees/uat/<flow>/<case>` (the frozen snapshot), input (the run namespace) | — | `FIXTURE_VIOLATION` |
| 6 | Execute the frozen cases in the declared order | `@worktrees/uat/<flow>/<case>` (the frozen case order), `@worktrees/sessions/central-runtime` (the runtime generation), input (lease origin, principal fingerprint, expiry) | — | `LEASE_INVALID`, `RUNTIME_UNAVAILABLE` |
| 7 | Capture against named assertions | `@worktrees/uat/<flow>/<case>` (the named assertion), `@worktrees/sessions/central-runtime` (the most direct runtime evidence available) | `@worktrees/uat/<flow>/<case>` (the captures) | `EVIDENCE_UNAVAILABLE` |
| 8 | Judge the three lanes independently | `@worktrees/uat/<flow>/<case>` (behavior, UX, and UI evidence, each kept apart) | — | — |
| 9 | Verify read-only, then clean up | `@workspaces/be` (the persisted records carrying `is_uat=true`), `@worktrees/uat/<flow>/<case>` (the frozen namespace) | — | — |
| 10 | Publish and stop | everything above | `@worktrees/uat/<flow>/<case>` (`result.json`), `@dynamic/uat-flow-verification.json` | — |

Validation rejects a stale source head, an authenticated identity with no lease, a lease bound to
another principal, mission, generation, origin, or flow, a non-contiguous case order, and an unchanged
resume. Product UAT begins only after both admissions are bound: earlier capture or preflight prepared
reusable visual evidence, but it was not an execution and it is not a verdict. The preflight runs
before the first external identity exists.

The snapshot is written at `.worktrees/uat/<feature>/<flow>/snapshot.json` under the routed backend
Source, validated against the template schema, reparsed, and content-fingerprinted; a path string
without a valid reparsed file is not a frozen snapshot. Fixtures seed the smallest run-namespaced set
needed for a meaningful render and stop before Browser execution — never creating the outcome under
test.

One authenticated lease acts at a time on the user-visible Browser. Before each authenticated capture
the lease origin, principal fingerprint, runtime generation, and expiry are verified; on mismatch only
the affected evidence is invalidated and the lease is reacquired, and neither the API nor the frontend
is ever restarted to repair identity. Every capture proves one named assertion and is paired with the
most direct runtime evidence available; entry, material commitment, material pending or failure
feedback, recovery, and terminal checkpoints require a full-viewport capture, and a crop is
supplementary and never satisfies a required checkpoint.

Behavior, UX, and UI are never allowed to borrow each other's conclusions: a contradiction between
them is `FAIL`, and an unavailable runtime or evidence lane is `BLOCKED`. Verification reads and does
not write, and cleanup deletes only records carrying both `is_uat=true` and the exact frozen
namespace. Publication writes `result.json` beside the validated snapshot, binds its snapshot
fingerprint, reparses it, and records its content fingerprint. Blocking publishes no result at all.

## The result is a verdict about a flow, not a repair order

A published result records what the running product did against a frozen intention. It never opens a
writer on the source, never reranks the evidence lanes, and never converts a UI observation into
authority over Behavior. A root cause is recorded; it is not fixed here.

Root causes deduplicate only when authority, semantic owner, causal mechanism, required correction,
and source boundary all match.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no admission, lease, evidence, or case change returns
`NO_PROGRESS`. Resumption appends to the same leased run; a fresh immutable run starts only when
continuity is proven lost.

## Mandatory attacks

The operator cannot publish a pass while any applicable item remains unresolved:

- a case executed at or before the freeze, or a case the snapshot never froze;
- a required checkpoint covered only by a crop, or a capture that names no assertion;
- a run whose fixtures were mutated after the journey;
- a lane that disagrees with another lane, or a lane with no evidence at all;
- a cleanup selector missing either the UAT flag or the exact namespace;
- an open hard finding;
- a result whose snapshot binding does not equal the parsed sibling snapshot.
