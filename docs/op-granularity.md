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

## Consequences for the planner and the kernel
- The goal planner emits operations that satisfy §1 or splits the node into child nodes.
- `renderContract` embeds the context pack (§2) and the resource list (§3).
- The scheduler checks allowlist disjointness and resource disjointness before launching.
- `planVerifyOps` creates node-tier reviews per node and one module-tier review per module.
