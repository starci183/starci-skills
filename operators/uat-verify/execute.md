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

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a stale
   source head, an authenticated identity with no lease, a lease bound to another principal, mission,
   generation, origin, or flow, a non-contiguous case order, and an unchanged resume.
2. **Confirm admission.** Bind the final blind visual PASS and the final quality PASS. Product UAT
   begins only after both. Earlier capture or preflight prepared reusable visual evidence; it was not
   an execution and it is not a verdict.
3. **Run the constraint preflight.** Validate the account and fixture identities against every
   physical store before the first external identity exists.
4. **Freeze the snapshot.** Write `.worktrees/uat/<feature>/<flow>/snapshot.json` under the routed
   backend Source, validate it against the template schema, reparse it, and record its content
   fingerprint. A path string without a valid reparsed file is not a frozen snapshot.
5. **Prepare fixtures.** Seed the smallest run-namespaced set needed for a meaningful render and stop
   before Browser execution. Never create the outcome under test.
6. **Execute the frozen cases in the declared order.** One authenticated lease acts at a time on the
   user-visible Browser. Before each authenticated capture, verify the lease origin, principal
   fingerprint, runtime generation, and expiry; on mismatch invalidate only the affected evidence and
   reacquire the lease. Never restart the API or the frontend to repair identity.
7. **Capture against named assertions.** Every capture proves one named assertion and is paired with
   the most direct runtime evidence available. Entry, material commitment, material pending or failure
   feedback, recovery, and terminal checkpoints require a full-viewport capture; a crop is
   supplementary and never satisfies a required checkpoint.
8. **Judge the three lanes independently.** Behavior, UX, and UI keep separate evidence and are never
   allowed to borrow each other's conclusions. A contradiction between them is `FAIL`. An unavailable
   runtime or an unavailable evidence lane is `BLOCKED`.
9. **Verify read-only, then clean up.** Verification reads; it does not write. Cleanup deletes only
   records carrying both `is_uat=true` and the exact frozen namespace.
10. **Publish and stop.** Write `result.json` beside the validated snapshot, bind its snapshot
    fingerprint, reparse it, record its content fingerprint, emit one output conforming to
    `output.schema.json`, and stop. Blocking publishes no result at all.

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
