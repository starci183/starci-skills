# Operation granularity: one operation, one thing

An operation does exactly one thing: one implementation slice, one UAT flow, one verification of one
node, one gate. The power of a workflow comes from many small operations running at once, not from
one large agent. Four guardrails keep small operations from costing more than they return.

## 1. Cut by acceptance, never by file
An operation is one observable behavior (one acceptance group), with the files that behavior needs.
Two operations that would both touch a shared interface are wrong cuts: the interface becomes its own
operation, scheduled first (a decision or a contract node), and the two depend on it.
Size limits the planner enforces: allowlist ≤ 10 files, one acceptance group, one session budget.

## 2. Context pack, prepared by the kernel
The kernel, not the operation, assembles what the operation reads: the exact SRS/SDS sections of its
node, the code files in its allowlist and their direct imports, the conventions of the module
(naming, error unions, validation style), the checks and their scopes. The contract embeds the pack as
references with line ranges; the operation is told not to explore beyond it. Token usage per operation
is recorded in the launch record so the planner can adjust the cut size from data.

## 3. Resource locks in the contract
Every operation declares `resources: [ ]` (e.g. `postgres`, `keycloak`, `e2e-runtime`, `docker`).
The scheduler never runs two operations that share a resource at the same time; global gates are run
only by the kernel between rounds; unit checks inside an operation are scoped to its node's test
pattern. UAT operations declare `e2e-runtime` and therefore run one at a time; each flow keeps its own
seed/cleanup so a flow never depends on another flow's state.

## 4. Two-tier verification
- Node tier: every implementation node gets its own `review.verify` operation on a runtime that did
  not implement it; it verifies the node's acceptance statements one by one.
- Module tier: when all nodes of a module are done, one `review.verify` operation checks consistency
  across them (naming, error unions, contracts between nodes, dead code) without re-verifying each
  acceptance. Findings become small repair operations.

## Working order per kind
An operation is cut small, but the agent still needs the order of work inside it: without one, some
wrote a green spec first, some skipped the design, some edited outside the allowlist. So every contract
carries a mandatory numbered section, `## Working order (mandatory, in this order)`, rendered by
`execution/contract-steps.mjs` (`stepsFor`, `sequenceFor`) from the operation's own values - its
allowlist, its `name: command` checks, its acceptance ids, references, resources, requesters and
findings - never from generic wording. The sequence is chosen from the op kind and origin, then from
the Work node kind it closes, then from its allowlist; an unknown kind falls back to `generic`.

| Sequence | Chosen when | Order |
| --- | --- | --- |
| `implement.ledger` | `backend.implement` / `interface.implement` from a ledger `implementation` or `ui` node | read SDS/SRS + assertions -> spec red -> smallest change -> checks -> self-audit -> report once |
| `implement.shared` | origin `shared` | read the requester's paths -> minimal change, no refactor -> requester's checks -> report |
| `implement.repair` | origin `repair` | map each finding -> confirm the check fails -> fix each -> re-run -> report with a finding -> fix map |
| `implement.gate` | origin `gate` | read the failing gate -> re-run it -> fix exactly what it names -> re-run -> report |
| `review.verify` | kind `review.verify` | read-only: run every check yourself -> compare against assertions and SDS -> findings name file+line+assertion -> never fix -> `done` with findings (empty when clean) |
| `uat` | `uat.verify` or a ledger `uat` node | read the flow folder (flow, seed, accounts) -> e2e spec at the allowlisted path -> run on the `resources` runtime -> report with the output; a runtime that cannot start is `failed`, never `done` |
| `migration` | allowlist contains `migrations/` | new migration only -> apply on a real container -> roll back -> re-apply (idempotence) -> checks -> report |
| `operations` | `runtime.operate` or a ledger `operations` node | apply on a real container -> roll back -> re-apply -> checks -> report |
| `decide` | `architecture.decide` / `business.decide` | closed options only -> weigh -> write the decision with rationale into the node -> no code |
| `generic` | anything else | read -> prove failing -> change -> checks -> self-audit -> report once |

Why the order matters:
- Spec red before code: a spec written after the code is green by construction and proves nothing; the
  kernel verifies fail-before/pass-after itself (`verify-proof`), so a green-first spec is caught as a weak
  proof and the operation is wasted.
- Smallest change inside the allowlist: other operations run in the same worktree; a path outside the
  allowlist is a `blocked` with `shared-change` and the exact paths, never an edit.
- Report once, with the real vocabulary: `done|partial|failed|ask|blocked`, blockers `shared-change`,
  `sds-gap`, `environment`, `authority`. A second report or a `done` on an unrun spec is a downgrade to
  `failed`.
- Verify is read-only: a reviewer that fixes what it reviews leaves nothing for the repair operation and
  hides the finding from the ledger.

## Consequences for the planner and the kernel
- The goal planner emits operations that satisfy §1 or splits the node into child nodes.
- `renderContract` embeds the context pack (§2), the resource list (§3) and the working order of the kind (`stepsFor`).
- The scheduler checks allowlist disjointness and resource disjointness before launching.
- `planVerifyOps` creates node-tier reviews per node and one module-tier review per module.
