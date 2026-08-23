# Capability orchestration maps

## LOADS

None.

## Record

This record maps every non-frontend-design StarCi capability to the common coordinator/worker contract. The
selected skill's `PIPELINE` table remains the exact step order and authority. This map decides only which work may
be isolated, delegated and joined; it never adds a step, changes an approval or turns a read-only skill into a
writer.

## Track ownership

| Pipeline track | Coordinator ownership | Delegable work | Join gate |
|---|---|---|---|
| `shared` | freeze envelope, routes, authority and boundary | independent evidence inventory | every observation has provenance and the same envelope |
| `top-down`, `bottom-up`, `declared`, `observed`, `reconciliation` | keep origins isolated and accept or reject their receipts | bounded reads and counterevidence | only accepted artifacts reach synthesis or reconciliation |
| `join` | decide the binding, discrepancy or approved revision | challenge completeness without selecting the decision | no unbound obligation, target, branch or proof |
| `execution` | consume approval, reserve shared targets and integrate | approved disjoint repository writes, tests and bounded materialization | one writer per target; authority/external mutations remain coordinator-only |
| `proof` | reproduce evidence and issue the final verdict | check-only gates, remote reads and proof capture | declared outcome holds with zero unresolved finding |

`linear` preserves one ordered authority. `dual-track` requires isolated origins before the coordinator join.
`reconciliation` measures declared and observed state independently. When safe task boundaries do not exist or
coordination overhead is not positive, the same map runs sequentially under the coordinator.

## Capability bindings

| Skill | Topology | Coordinator owns | Delegable work | Final gate |
|---|---|---|---|---|
| `starci-business-analyze` | reconciliation | evidence classification, lifecycle transition and publication | routed source evidence and contradiction inventory | feature head and implementation reconciliation validate |
| `starci-init` | reconciliation | four readiness approvals and shared records | identity-safe checks and route observations | identity, bootstrap, routes and worktrees are green |
| `starci-cloudflare-tunnel-set` | reconciliation | credential authority and external apply | tunnel/DNS read inventory and proof reads | declared tunnel and DNS state match |
| `starci-deploy` | reconciliation | release decision, external mutation and rollback | host/service observations and bounded proof | public steady state or proven rollback |
| `starci-setup-mcp` | reconciliation | read-only scope, credential authority and publication | route/index inventory and partition proof | every partition is isolated and read-only |
| `starci-setup-sonar` | reconciliation | shared service/project mutations and strict gate decision | project inventory, scan and API proof | all routed roles have measurable strict gates |
| `starci-stale-list` | reconciliation, read-only | expected-state authority and report verdict | independent category observations and check-only gates | every finding is reproducible; no repair occurred |
| `starci-diagnose` | reconciliation, read-only | simulated boundary and first-stop classification | expected and observed traces | environment failure is separated from skill defect |
| `starci-repair` | reconciliation | pass ordering, approval, shared files and close verdict | disjoint approved repository fixes and gates | complete stale and delivery inventory is green |
| `starci-debt-repay` | reconciliation | debt scope, closure decision and record update | independent measurements, approved source fixes and tests | only proven scopes close |
| `starci-fe-ui-reconcile` | reconciliation | cross-surface scope, discrepancy verdict, authority evolution and integration | isolated declared/observed inventories, approved disjoint FE changes and proof | durable authority and every approved consumer resolve consistently |
| `starci-grammar-refresh-references` | reconciliation | grammar boundary and authority-byte verdict | immutable reference audit and fetch evidence | references resolve while authority bytes stay unchanged |
| `starci-conversation-record` | linear | custody boundary, publication and stable head | provider metadata acquisition and redaction evidence | stored links validate without raw transcript Git storage |
| `starci-be-plan` | dual-track | demand/capability join and complete brief | isolated business-demand and schema/source inventories | every behavior binds to files and tests; no source write |
| `starci-be-approve` | reconciliation | revision decision, approval and integration | schema/sibling challenge, approved disjoint code and gates | implementation equals the approved revision |

## Write kinds

- `repository-write` may be delegated only after the selected skill's exact approval and only across disjoint targets.
- `authority-write` and `external-write` remain coordinator-only and therefore use sequential runtime tasks.
- `cache-write` is temporary materialization from a frozen contract; `proof` consumes stable state and frozen targets.
- A read-only capability emits no mutation task. Its workers return evidence; the coordinator authors the final report.

## Stops

- The physical skill is absent from `profiles.skillMaps`, its topology or step order differs from `PIPELINE`, or its map record is missing.
- A worker would decide scope, authority, approval, shared integration or the final verdict.
- Authority or provider mutation is assigned to a worker runtime.
- A write target overlaps another writer, lacks the exact approval, or falls outside the impact cone.

## Output

One validated orchestration receipt or its sequential equivalent, bound to the selected skill, exact pipeline steps,
immutable envelope, target registry, approvals, results and final proof.
