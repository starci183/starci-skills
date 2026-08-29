# UAT evidence, sequential execution, and finality

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.uat-protocol` |
| Operators | `test/uat-snapshot-freeze, test/uat-case-freeze, test/uat-behavior-proof, test/uat-ux-proof, test/uat-ui-proof, test/uat-result-prove, test/uat-result-publish` |
| Search tags | `uat, evidence, screenshot, result, fixture, sequential, visible browser, feedback, suspense, retest` |
| Dependencies | `fe.ui, fe.customer-journey` |

## Durable authority

The backend Source selected by the project's verified `be` workspace route owns UAT evidence at
`.worktrees/uat/`. The exact FE checkout and runtime remain evidence identities, not write owners.
The runtime `.claude/templates/uat/` directory supplies schemas and seed templates. Reject
checkout-local `<role>/.uat` writes, a UAT root from another backend route, and dual writes during
migration.

## Evidence unit

One feature/flow owns exactly `.worktrees/uat/<feature>/<flow>/snapshot.json` and `result.json`. The snapshot freezes intent, cases, isolation, authority/source heads and proof requirements before execution; the result is published last and cannot manufacture success. UAT covers each material product-level decision branch exactly once. A new flow requires a material difference in actor/entry, outcome/terminal, semantic owner/side effect, or recovery topology. Presentation and validation permutations remain cases, checkpoints, or delegated tests. Every screenshot proves a named assertion and is paired with the most direct runtime evidence available. Full-viewport screenshots are required at entry, material commitment, material pending/failure feedback, recovery, and terminal checkpoints, plus each viewport where ownership, order, overlay behavior, or reachability changes. Crops are supplementary only.

## Declared sequential execution

Before any product action, publish the case ID, run ID, account or anonymous identity, fixture namespace, precondition, expected outcome, Browser session, and execution order. Each case-run provisions a new logical account when applicable and owns a unique agent, authenticated browser context, origin, mailbox/query namespace, mutable fixture namespace, artifact directory, and resource locks. Reruns never reuse accounts. Anonymous entry explicitly records no account; a registration journey creates its own outcome account. Execute one case at a time on the user-visible Browser in the declared order. A browser tab is not authenticated isolation unless the run proves clean storage, cookies and autofill. Resource classes remain coordination metadata; they never authorize simultaneous visible-browser cases.

## Fixture law

Lifecycle is `constraint preflight → prepare → product execute → verify → cleanup`. Constraint preflight validates account and fixture identities against every physical store before the first external identity is created. Prepare may seed the smallest run-namespaced set of related records across multiple tables or services needed for a meaningful render, but it finishes before Browser execution and cannot create the outcome under test. Product execution alone creates that outcome. Verify is read-only. Cleanup requires both `is_uat=true` and the exact case namespace. A case selector is mandatory. Post-journey UPSERT, finalization, or any operation that can manufacture the expected result invalidates Behavior evidence.

## Feedback and finality

User feedback is append-only and bound to source plus authority revision. Behavior and UX may be proved even when UI detail is incomplete. UI evaluates `fe.ui` and Grammar Common plus the selected Grammar independently. A contradiction to either authority is `FAIL` even when the other authority is incomplete. `SUSPENSE` belongs only to UI and only when neither authority is violated but a finite render choice remains missing or conflicting. It closes only after user decision, smallest authority promotion, source repair when needed, and a fresh run. `REQUIRE_USER_ACTION` is a non-pass pause for one exact manual action with completion evidence and a resume command; it is neither a defect nor authority uncertainty. Resumption appends to the same resumable leased run, or starts a fresh immutable run when continuity is lost.

Root causes deduplicate only when authority, semantic owner, causal mechanism, corrective action, and source boundary match. One writer repairs a root cause. Retest the discovering checkpoint, complete recovery path, all known occurrences, and canonical happy smoke. Final pass requires read-only result verification, scoped cleanup, no open hard findings, no open feedback correction, and no SUSPENSE.
