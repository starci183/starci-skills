# UAT evidence, sequential execution, and finality

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.uat-protocol` |
| Contract revision | `7.6.0` |
| Operators | `test/uat-snapshot-freeze, test/uat-case-freeze, test/uat-behavior-proof, test/uat-ux-proof, test/uat-ui-proof, test/uat-result-prove, test/uat-result-publish` |
| Search tags | `uat, evidence, screenshot, result, fixture, sequential, visible browser, feedback, suspense, retest` |
| Dependencies | `fe.ui, fe.customer-journey, fe.product-proof` |

## Durable authority

The backend Source selected by the project's verified `be` workspace route owns UAT evidence at
`.worktrees/uat/`. The exact FE checkout and runtime remain evidence identities, not write owners.
The runtime `.claude/templates/uat/` directory supplies schemas and seed templates. Reject
checkout-local `<role>/.uat` writes, a UAT root from another backend route, and dual writes during
migration.

## Evidence unit

One feature/flow owns exactly `.worktrees/uat/<feature>/<flow>/snapshot.json` and `result.json`. The snapshot freezes intent, cases, isolation, authority/source heads and proof requirements before execution; the result is published last and cannot manufacture success. For frontend delivery, product UAT begins only after latest-source blind UI PASS and final quality PASS. Earlier capture/preflight may prepare reusable visual evidence, but it is not a UAT execution or verdict. UAT covers each material product-level decision branch exactly once. A new flow requires a material difference in actor/entry, outcome/terminal, semantic owner/side effect, or recovery topology. Presentation and validation permutations remain cases, checkpoints, or delegated tests. Every screenshot proves a named assertion and is paired with the most direct runtime evidence available. Full-viewport screenshots are required at entry, material commitment, material pending/failure feedback, recovery, and terminal checkpoints, plus each viewport where ownership, order, overlay behavior, or reachability changes. Crops are supplementary only.

## Declared sequential execution

Before any UAT product action, publish the case ID, run ID, account or anonymous identity, fixture namespace, precondition, expected outcome, Browser session lease, final blind/quality receipts, and execution order. For an authenticated local case, the Control Panel automatically creates one fresh run-scoped identity in both Keycloak and the application database, authenticates the brokered Browser context, and returns opaque provisioning evidence. The canonical `.worktrees/uat/<feature>/<flow>/snapshot.json` stores the non-secret account record: `accountRef`, Keycloak and database record refs, principal fingerprint, fixture namespace, provisioning owner/mode, credential-custody mode, and authenticated state. It never stores a password, cookie, token, OTP, or recoverable secret. One canonical mission owns that account and an exclusive authenticated Browser context, origin, principal fingerprint, runtime generation, mailbox/query namespace, mutable fixture namespace, artifact directory, and resource locks. Capture/preflight may reuse a compatible read-only context, but product UAT and every state-mutating or reset-sensitive case use the declared run-scoped identity only after the final gates admit it. A new account is required for a new product case whose precondition requires reset or after proven continuity loss; a visual recapture is not a UAT case-run. Anonymous entry explicitly records no account; a registration journey creates its own outcome account. Execute one authenticated Browser lease at a time on the user-visible Browser in the declared order. Resource classes remain coordination metadata; they never authorize simultaneous visible-browser cases.

The lease also declares `executionMode`. `consumer-materialized` requires a fresh consumer-side tab
discovery proof in the active turn. Cross-task handoff refs and remembered tab IDs never satisfy this
proof. If the task cannot discover the tab, use the same lease in `broker-executed` mode: the central
Browser owner performs typed actions/captures and publishes opaque evidence with exact mission,
source, runtime, principal, state and viewport bindings. Broker execution must not leak credentials
or transfer implementation/review authority to the broker.

For an authenticated feature, request the mission-scoped account and Browser lease from the Control
Panel before any Browser authentication action. Provisioning and broker authentication are routine
parts of the declared local UAT mutation boundary and do not open a manual-login branch. The feature
task consumes the opaque lease and never owns raw credentials, cookies, OTPs,
tabs, or authentication storage. The Control Panel uses the declared environment's local provisioner,
creates both identity-store and application-database records, holds generated credentials only in
ephemeral custody, authenticates the Browser, and exposes only opaque `account://fresh/...`,
`keycloak-user://...`, `database-user://...`, and `browser-lease://...` references. A personal/owner
account, a deterministic account reused from an earlier run, an inherited signed-in browser, or a
signed-out skeleton is not UAT identity evidence. If provisioning authority, the local provisioner,
or broker authentication is unavailable, return the exact `BLOCKED` result; never ask the user to
sign in, lend credentials, or paste a secret as a substitute. Anonymous proof is valid only when the
frozen case explicitly declares `anonymous://explicit/...`.

Browser safety remains authoritative. If the selected Browser mandates action-time confirmation before
the Control Panel transmits its synthetic UAT password to the declared local StarCi/Keycloak origins,
request one narrow confirmation for that agent-owned transmission immediately before typing. This is
not `REQUIRE_USER_ACTION`, does not ask the user to sign in, and never asks the user to view, supply, or
handle the credential. After confirmation the Control Panel completes the submission automatically.

Local UAT consumes the one Control-Panel-delegated owner generation. StarCi Academy retains the
default FE/API/identity ports `3000/3001/8080`; a routed project consumes only the closed endpoint
projection recorded by its canonical owner (for example Nivo core `3067/3068/8147`). Case freeze
rejects arbitrary localhost or remote origins and binds the lease to the ready owner's project,
application, generation, owner identity, authority fingerprint, and exact FE origin. It also requires
the lease to be authenticated, unexpired, and equal to the frozen mission and account.

A case owns its account, Browser context, fixtures, and artifacts; it never owns a listener or server
process. Do not restart API/FE, replace server
environment, or request a per-feature port merely to change authenticated identity. Concurrent UAT
identities use isolated Browser sessions against the same runtime. Before each authenticated capture,
verify the lease origin, principal fingerprint, runtime generation, and expiry. On mismatch,
invalidate only affected evidence and reacquire the lease; never restart FE or API to repair identity.
When runtime health fails, report the probe and request recovery from the centralized runtime task;
do not kill another task's PID.

## Fixture law

Lifecycle is `constraint preflight → prepare → product execute → verify → cleanup`. Constraint preflight validates account and fixture identities against every physical store before the first external identity is created. Prepare may seed the smallest run-namespaced set of related records across multiple tables or services needed for a meaningful render, but it finishes before Browser execution and cannot create the outcome under test. Product execution alone creates that outcome. Verify is read-only. Cleanup requires both `is_uat=true` and the exact case namespace. A case selector is mandatory. Post-journey UPSERT, finalization, or any operation that can manufacture the expected result invalidates Behavior evidence.

## Feedback and finality

User feedback is append-only and bound to source plus authority revision. Behavior, UX, and UI keep independent evidence, but product UAT publishes one final result only after its admitted blind/quality receipts. A contradiction is `FAIL`; runtime/evidence unavailability is `BLOCKED`. UAT never repairs source or promotes UI authority. Canonical PASS returns to frontend completion. Fresh frontend-owned counterevidence may return a single-use typed handoff to the exact frontend `reapply` resume state; the caller invalidates downstream proof and reruns capture/preflight, blind review, Quality, and UAT. Replayed/unchanged findings, boundary drift, or another owner return their exact typed exit rather than a hidden loop. `REQUIRE_USER_ACTION` is a non-pass pause for one exact manual product action with completion evidence and a resume command; it is neither a defect nor authority uncertainty. It is forbidden for routine local UAT authentication: the Control Panel must auto-provision and broker-login or return `BLOCKED`. A Browser-mandated action-time confirmation authorizes the Control Panel to transmit its synthetic credential; it is not a manual-login action and cannot request the credential from the user. Never end a turn while holding a temporary credential or OTP challenge. Resumption appends to the same resumable leased run, or starts a fresh immutable run only when continuity is proven lost.

Root causes deduplicate only when authority, semantic owner, causal mechanism, required correction, and source boundary match. UAT records them without opening a writer. Final pass requires read-only result verification, scoped cleanup, no open hard findings, no open feedback correction, and no unresolved authority/evidence gap.
