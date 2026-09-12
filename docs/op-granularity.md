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
the Work node kind and layout it closes, then from its allowlist; an unknown kind falls back to `generic`.

| Sequence | Chosen when | Order |
| --- | --- | --- |
| `implement.ledger` | `backend.implement` / `interface.implement` from a ledger `implementation` or `ui` node | read SDS/SRS + assertions -> spec red -> smallest change -> checks -> self-audit -> report once |
| `implement.shared` | origin `shared` | read the requester's paths -> minimal change, no refactor -> requester's checks -> report |
| `implement.repair` | origin `repair` | map each finding -> confirm the check fails -> fix each -> re-run -> report with a finding -> fix map |
| `implement.gate` | origin `gate` | read the failing gate -> re-run it -> fix exactly what it names -> re-run -> report |
| `interface.draw` | kind `interface.draw` | read SRS/SDS + assertions -> enumerate every screen and every state -> draw inside the installed design grammar -> write the interface design record (blueprint, states, contract slots, copy) -> one rendered candidate per state where rendering is supported -> report; a missing business rule is `blocked` `sds-gap` |
| `frontend.implement` | kind `frontend.implement`, or any implementing kind on an `implementation/frontend/**` node | read the interface design record first (a screen or state it lacks is `blocked` `interface-gap`) -> story/spec red per state -> implement with the typed components only -> update stories and skeletons -> lint/typecheck/unit -> report |
| `review.verify` | kind `review.verify` | read-only: run every check yourself -> compare against assertions and SDS -> findings name file+line+assertion -> never fix -> `done` with findings (empty when clean) |
| `uat` | a ledger `uat` node without an explicit `uat.verify` kind | read the flow folder (flow, seed, accounts) -> e2e spec at the allowlisted path -> run on the `resources` runtime -> report with the output; a runtime that cannot start is `failed`, never `done` |
| `uat.verify` | kind `uat.verify` | read the flow folder, seed and accounts -> start the named runtime -> walk the rendered surface as a person does, never the API -> a screenshot per step -> compare each step against the interface design record and the assertions -> write the run record under the flow folder -> `done` only on a complete passing walk |
| `migration` | allowlist contains `migrations/` | new migration only -> apply on a real container -> roll back -> re-apply (idempotence) -> checks -> report |
| `operations` | `runtime.operate` or a ledger `operations` node | apply on a real container -> roll back -> re-apply -> checks -> report |
| `architecture.revise` | kind `architecture.revise` | read the gap report -> edit only the named SDS section -> bump its `rev` and append one decision-log entry -> run the validator check -> report the rev and the sections; no code |
| `decide` | `business.decide` (what the product must do) / `architecture.decide` (how the system satisfies it) | closed options only -> weigh against the requirement and the layer it must stay inside -> write the decision with rationale into the node -> no code, and no decision belonging to the other layer |
| `generic` | anything else | read -> prove failing -> change -> checks -> self-audit -> report once |

### The frontend lane
A frontend node is not one operation. Its sequences run in order - `interface.draw` -> `frontend.implement`
-> `uat.verify` - and each one says so in its definition of done ("the node is done only after
`uat.verify`"), so no single operation of the lane can report the node finished:
- `interface.draw` is design before code: it enumerates the screens and every state (loading, empty,
  error, populated, permission-denied) and records the blueprint, contract slots and copy. A state nobody
  enumerated is a state nobody builds, and an implementer that has to guess one is the cost.
- `frontend.implement` may only build what that record describes. A screen or state the record lacks is
  `blocked` with blocker `interface-gap`, which routes back to `interface.draw` - never an improvised
  layout. Stories and skeletons move with every layout change, so each state stays renderable alone.
- `uat.verify` walks the rendered surface with a screenshot per step and compares what is on screen to
  the design record. A walk through the API proves the server, not the surface; a walk that stopped early
  is `partial`/`failed`, never `done`.
- A design (SDS) gap found anywhere in the lane is `blocked` with `sds-gap` and routes to
  `architecture.revise`, which edits the named section, bumps its `rev` and writes no code.

Why the order matters:
- Spec red before code: a spec written after the code is green by construction and proves nothing; the
  kernel verifies fail-before/pass-after itself (`verify-proof`), so a green-first spec is caught as a weak
  proof and the operation is wasted.
- Smallest change inside the allowlist: other operations run in the same worktree; a path outside the
  allowlist is a `blocked` with `shared-change` and the exact paths, never an edit.
- Report once, with the real vocabulary: `done|partial|failed|ask|blocked`, blockers `shared-change`,
  `sds-gap`, `interface-gap`, `environment`, `authority`. A second report, a `done` on an unrun spec or a
  `done` on a partial walk is a downgrade to `failed`.
- Design before code, in both directions: the red spec proves the behavior, the interface design record
  proves the surface. An operation that invents the screen it implements leaves nothing for review to
  compare against, which is why `interface-gap` routes back instead of being improvised.
- Verify is read-only: a reviewer that fixes what it reviews leaves nothing for the repair operation and
  hides the finding from the ledger.

## Consequences for the planner and the kernel
- The goal planner emits operations that satisfy §1 or splits the node into child nodes.
- `renderContract` embeds the context pack (§2), the resource list (§3) and the working order of the kind (`stepsFor`).
- The scheduler checks allowlist disjointness and resource disjointness before launching.
- `planVerifyOps` creates node-tier reviews per node and one module-tier review per module.
