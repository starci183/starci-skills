# StarCi UAT protocol

UAT proves one approved business flow through browser-observable Behavior, UX, and UI evidence. It does not replace unit, contract, integration, accessibility, or component tests. `Flow Audit` compiles coverage; only Behavior, UX, and UI issue product verdicts.

## Canonical backend-owned UAT worktree

```text
.worktrees/uat/
├── registry.json
└── reviews/
    └── <feature>/
        ├── INDEX.md
        ├── feature.json
        ├── shared/
        │   ├── fixtures.md
        │   └── resources.md
        └── <flow>/
            ├── review.md
            ├── review.json
            ├── cases/
            │   └── <case-id>.md
            └── runs/
                └── <run-id>/
                    ├── result.json
                    ├── events/
                    │   └── <sequence>-require-user-action.json
                    ├── screenshots/
                    │   ├── 01-entry.full.png
                    │   ├── 02-commit.full.png
                    │   ├── 03-feedback.full.png
                    │   ├── 04-recovery.full.png
                    │   └── 05-terminal.full.png
                    ├── regions/
                    │   └── <checkpoint>.<assertion>.png
                    ├── dom/
                    ├── accessibility/
                    ├── traces/
                    └── logs/
```

The backend Source selected by the project's verified `.workspaces` `be` route owns this durable
worktree alongside `.worktrees/businesses`, `.worktrees/debts`, and `.worktrees/coding-context`.
The routed frontend checkout provides the source revision and browser runtime under test but never
owns or receives a v7 `.uat` journal. The runtime Source's `.claude/uat/` contains only reusable
protocol, schemas, templates, and validators.

An existing `<fe>/.uat` is a legacy migration input. Migration copies one closed journal into the
backend-owned UAT worktree, validates every canonical ref and content hash, then makes the legacy tree
read-only until cutover proof is accepted. New runs never dual-write both locations.

`INDEX.md` is the user-readable feature rollup and follows `feature-index.template.md`; `feature.json` is the machine-readable flow inventory. `review.md` is one user-readable flow review and follows `review.template.md`. `review.json` is its machine-readable identity, coverage, resource, verdict, feedback, and root-cause index. Case Markdown records intent and steps; immutable run directories record observations. `events/` appends non-terminal transitions such as `REQUIRE_USER_ACTION`; terminal `result.json` is written once after the run finishes. A rerun always creates a new `run-id`; it never overwrites prior evidence.

`registry.json`, `feature.json`, `review.json`, and every run `result.json` validate against `registry.schema.json`, `feature.schema.json`, `review.schema.json`, and `result.schema.json`. Use `validate-feature.mjs`, `validate-review.mjs`, and `validate-result.mjs`; a Markdown claim without the matching valid machine record is incomplete.

## Minimal product-decision flow set

Coverage is complete when every product-level decision branch and material risk is either executed by one representative UAT case or delegated to an exact lower-level proof receipt. Coverage is not improved by multiplying component states or equivalent flows.

Create another flow only when at least one identity dimension materially changes:

1. actor or user-recognizable entry condition;
2. business outcome or allowed terminal;
3. semantic owner or side-effect boundary;
4. recovery topology, including a different irreversible or exclusive-resource path.

A route, screen, viewport, copy variant, field, validation message, or data permutation is not automatically a new flow. Keep it as a checkpoint, one equivalence-safe case, or a delegated lower-level test when the four identity dimensions remain equal.

Use one canonical happy case per flow. Loading/skeleton and ordinary refresh are normally checkpoints inside it. Add an unhappy case only when outcome or next action changes, auth/permission is crossed, durable state or FE–BE wiring is at risk, the user must recover, or refresh/resume continuity is material. Ordinary validation and component-local empty/error/render states delegate when exact lower-level proof exists. The normal review target is one to five representative cases total. More than five cases is allowed only when every excess case cites a distinct signature or high-risk transition in `coverage.overflowReasons`; otherwise merge or delegate it. `uncoveredTransitionCount` must be zero before the flow can be ready.

## Case classification

The canonical happy case is always separate. An unhappy case covers one recoverable failure class or one explicit safe terminal. Two unhappy examples may share one UAT case only when all six merge-signature fields are equal:

1. start or pre-failure state;
2. semantic owner;
3. side effect;
4. recovery action;
5. terminal state;
6. fault scope.

Client validation permutations may merge only when they share the same form/state, issue no request, create no side effect, use the same correction action, end in the same terminal, and every omitted permutation has lower-level schema/component proof. Business refusal, auth/security, stale or expired state, concurrency/idempotency, rate limiting, transport/infrastructure, realtime failure, or a different recovery action must split.

An error rendering is not a terminal. A recoverable unhappy case must prove `failure → understandable feedback → correction/retry → success`. Use an explicit safe non-success terminal only when product authority forbids continuation and the UI states the next available action.

## Screenshot contract

Every required checkpoint has a full-viewport screenshot. Add a region crop only as supplementary proof for a precise assertion; a crop cannot replace the full viewport because it hides hierarchy, overlays, scroll ownership, and responsive context.

Capture:

- `entry`: the user-recognizable starting state;
- `commit`: the state immediately before the primary or irreversible commitment, when distinct from entry;
- `feedback`: the first visible pending, validation, refusal, or failure state when that state is material;
- `recovery`: the corrected/resumed state that proves the user is no longer trapped;
- `terminal`: the final destination and business-visible outcome;
- every viewport where ownership, order, navigation, overlay behavior, or reachability changes;
- before/after pairs for refresh, resume, async, realtime, optimistic, or destructive behavior.

Do not capture every keystroke, duplicate frames with no new assertion, secret fields, tokens, raw mail links, personal data, browser dev chrome, or screenshots that are not referenced by an assertion. Redact at capture time. Each screenshot row in `review.md` names case, checkpoint, viewport, state, assertion, file, and linked DOM/accessibility/trace evidence.

## Browser execution ownership

Before Browser work, the coordinator publishes case ID, run ID, account or anonymous identity, fixture, precondition, expected outcome, Browser session and execution order. A browser broker creates an isolated browser context and returns one `browserSessionRef` plus lease receipt to exactly one case-runner agent. That agent may navigate, click, type, inspect, and capture evidence only through its leased session. One case runner owns the fresh account, agent identity, browser context, origin, and artifact directory for that run. It executes the baseline journey at native 100% scale. UI Audit assigns the smallest additional browser-profile matrix needed by the affected surface. Behavior and UX consume the same immutable evidence; missing UI detail does not block those two verdicts.

Do not make every agent repeat every zoom level. Record `agent`, `browserSessionRef`, `viewport`, `scaleMode`, and `scalePercent` at each checkpoint. A changed viewport is not proof of browser zoom, and browser zoom is not a substitute for text-only scaling. Store profile screenshots under the same `runs/<run-id>/screenshots/` tree and accessibility evidence under `runs/<run-id>/accessibility/`. Parallel profile execution still requires separate browser contexts and distinct leases; profiles sharing one context serialize. Multiple tabs in one browser profile are not parallel isolation.

## Sequential isolation

Each `case-id + run-id` owns one newly provisioned account when applicable, agent, browser context, hostname/origin, mailbox/query namespace, mutable fixture namespace, artifact directory, and declared resource locks. Accounts are never shared across cases or reused by reruns. Execute one visible Browser case at a time in contiguous `executionOrder`. When the required entry is anonymous, record `accountProvisioning: none` and `account: none`; if account creation is the product outcome, the journey rather than fixture preparation creates it. A browser tab alone is not authenticated isolation without clean cookie/storage/autofill proof. Resource classes are coordination metadata only:

- `safe`: read-only or independently namespaced access with no shared mutation risk;
- `partitioned`: mutation is safe only inside the proven distinct namespace;
- `exclusive`: one case at a time.

Stopping a shared server, changing a shared clock, global rate-limit state, unscoped cleanup, or a shared external inbox is exclusive. Prefer a case-local fault proxy over stopping a shared backend.

## Fixture finality

Fixture lifecycle is exactly `constraint preflight → prepare → product execute → verify → cleanup`.

- constraint preflight validates identities and fixture values against every physical-store constraint before external creation;
- prepare establishes initial state only;
- prepare may seed run-namespaced related tables/services needed for meaningful rendering before Browser execution;
- product execution alone may create the business outcome under test;
- verify is read-only and cannot repair or manufacture the result;
- cleanup deletes only rows/identities marked `is_uat=true` and matching the exact case namespace;
- a case selector is mandatory for fixture mutation;
- post-journey UPSERT, `finalize-created`, or equivalent outcome manufacturing is forbidden.

## Verdict and feedback

Every executed case records all three verdicts: Behavior, UX, UI. Behavior and UX are `PASS | FAIL | REQUIRE_USER_ACTION | BLOCKED`. UI is `PASS | FAIL | SUSPENSE | REQUIRE_USER_ACTION | BLOCKED`. `REQUIRE_USER_ACTION` means automation knows the exact next step but the user must perform it directly; it requires an action ID, exact instruction, control channel/reference, completion evidence, and `USER ACTION COMPLETE <action-id>` resume command. For an in-browser action, the broker temporarily transfers control of the same leased session to the user, then returns it to the same case runner so the in-progress run and account retain continuity. Evidence is appended, never overwritten. If the lease or session expires, mark that run abandoned/blocked and start a new run with a new account. It is a non-pass pause, not a defect and not authority uncertainty. UI records `fe.ui` and Grammar verdicts separately. A failure in either authority makes the UI aggregate `FAIL`, even if the other authority is incomplete. UI `SUSPENSE` is legal only when neither authority fails and a finite render question remains unresolved or conflicting. It requires an owner and exact user question; it never counts as pass. `BLOCKED` is reserved for missing authority/runtime/isolation where no executable user action can currently resume the case.

User feedback uses `USER APPROVE UAT <review-hash>`, `USER CORRECT UAT <finding-id>: <decision>`, or `USER ANSWER SUSPENSE <question-id>: <answer>`. A correction is closed only by authority promotion when applicable, source repair, a fresh run of the discovering checkpoint and recovery path, all known occurrences, and the canonical happy smoke.

Root causes deduplicate only when authority, semantic owner, causal mechanism, corrective action, and source boundary match. One repair owner writes a root cause; sequential case runners only append occurrence evidence.
