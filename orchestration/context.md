# Agent orchestration

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@codex-orchestration` | `orchestration/codex/context.md` | context | map the common contract to Sol coordinator and Luna workers |
| `@claude-orchestration` | `orchestration/claude/context.md` | context | map the common contract to Opus coordinator and Sonnet workers |
| `@frontend-map` | `orchestration/frontend/context.md` | context | bind Layout, Block and Refactor steps to exact coordinator and worker work |
| `@profiles` | `orchestration/profiles.json` | file | keep runtime model roles and concurrency machine-readable |
| `@receipt-schema` | `orchestration/receipt.schema.json` | file | define the internal machine-validated run record |
| `@validate-orchestration` | `scripts/validate-orchestration.mjs` | script | reject unsafe ownership or incomplete skill bindings |

## Record

This module is the one home of provider-neutral agent orchestration. A selected skill still owns its business,
design, source and proof rules; orchestration only partitions that work without changing decisions, approvals or
write boundaries. Runtime adapters translate the same roles into Claude Code or Codex capabilities.

## Roles

The **coordinator** is the integration owner, not an unquestionable source of truth. It resolves scope, business and journey meaning,
chooses UI direction, classifies state ownership, presents approvals, freezes the exact boundary, reviews worker
receipts, integrates shared files and declares the final verdict.

A **worker** receives one bounded task with one output owner. Workers may inventory and challenge evidence, generate cache HTML,
implement approved source in disjoint files, seed approved local data, run tests or capture browser proof. A worker
never selects a product or UI decision, consumes approval, expands scope, edits shared authority, integrates
overlapping changes or declares completion.

## Phase ownership

| Phase | Decision owner | Delegable worker work | Join gate |
|---|---|---|---|
| scope and evidence | coordinator | independent route, source, component, contract and state inventories | every receipt has provenance and the same immutable envelope |
| journey and UI direction | coordinator | read-only counterevidence and feasibility checks | coordinator prints and recommends the direction |
| cache review | coordinator owns anatomy and acceptance | generate HTML/CSS/fixtures and captures from the frozen direction | rendered output matches the direction receipt and contains no new decision |
| state and source boundary | coordinator | state inventory, source-owner chain and impact-cone audits | one exact writer registry and approval boundary |
| implementation | coordinator owns integration | code, seed and tests in disjoint approved paths | one writer per path; all approved obligations mapped |
| proof | coordinator owns parity verdict | gates, browser operations, captures and mismatch inventory | coordinator reproduces evidence and closes only at zero known mismatch |

HTML generation and coding are execution, so they default to workers. Journey choice, UI design, ownership
classification and acceptance are decisions, so they remain with the coordinator. A worker may propose facts or
counterexamples; it may not turn them into the selected design.

## Mandatory orchestration step

Layout, Block and Refactor expose one non-approval `orchestration` row after their scope/evidence is bound and
before direction rendering. The coordinator publishes a compact orchestration receipt containing:

1. resolved runtime adapter and model roles;
2. task ids, dependencies and whether each task is `read`, `cache-write`, `source-write` or `proof`;
3. the exact output and writer paths owned by each task;
4. the coordinator-only decisions and shared paths;
5. concurrency batches and the sequential fallback.

This is an internal run record, not part of the user-facing step plan. Show only material progress, evidence,
decision and exact boundary. Every produced output names a downstream task, gate or delivery consumer; an unused
artifact invalidates a complete run. It adds no owner approval and never splits an existing staged approval.

## Dispatch contract

Every worker task binds `taskId`, selected skill and step, immutable context-envelope id, objective, required
inputs, allowed reads, exact writes, forbidden decisions, required proof and stop conditions. Every result returns
`taskId`, status, input hashes, observations with provenance, changed paths, commands/proof, unresolved findings
and a boundary-drift flag.

The receipt is revalidated and append-only refreshed at each coordinator phase gate. Cache tasks bind both the
exact frozen contract hash and the validated target-matched `qualityReviewAt` hash, and depend on passed
`contract-freeze` plus `quality-review` events. Source tasks bind the complete approved path set and the proportional
approval identity: component impact uses `OK #1:<source-boundary-hash>`; page/full impact uses `OK #2:<source-boundary-hash>`.
Auto prefixes the same identity with `AUTO:<autoApprovalAt>:` and binds `autoApprovalAt` to the immutable envelope.
Both forms depend on the same passed source-approval gate and exact writer registry; neither authorizes scope
expansion or external action. When Refactor evolves authority, source tasks also bind the compiled authority-proof hash. Proof tasks bind the stable-build and selected
proof-target hashes and depend on every source task. A future task is not dispatchable while its gate identity is
absent.

Each phase gate is also a passed coordinator event. Worker tasks name those event ids in `dependsOnGates`; copying
a hash without the event cannot unlock work. `impactConeAt` is recomputed from the disclosed owner paths,
consumers, tests, required paths and inventory proof, and every required path receives exactly one source writer.

The coordinator rejects a receipt when its envelope is stale, evidence is unproved, a write is outside boundary,
a decision was made by a worker or another task owns the same path. Rejected work is not silently integrated.

For `capability` and `cross-domain` impact, a second reviewer receives evidence without the coordinator's recommendation,
cannot write source, may raise concrete challenges, and must close them through evidence before source dispatch. A
consistent coordinator answer is not treated as an independent proof.

## Dependency and writer law

- Parallelize only tasks whose required inputs are already gate-passed and whose output and write ownership do not overlap.
- One path has one writer for the entire batch. A directory boundary is insufficient when two tasks can touch the same file.
- `.claude` authority, approval records, shared contracts, shared entrypoints, manifests and final integration remain coordinator-only.
- A worker may implement product source only after the source-authorizing approval and only inside its assigned subset.
- Workers do not spawn workers. The coordinator alone refills slots, follows up, interrupts and closes tasks.
- More agents are not progress. Three is the current runtime capacity, not a claimed optimum. Dispatch only ready,
  disjoint work whose expected saved time exceeds coordination overhead; otherwise execute sequentially.
- Dirty or unattributable target overlap stops that assignment and returns it to the coordinator.

## Runtime and fallback

Measure the active host before dispatch and select exactly one adapter. Never mix Claude and Codex agents inside a
single orchestration receipt. If delegation, the requested model or safe disjoint boundaries are unavailable,
execute the same tasks sequentially under the coordinator with identical context firewalls and receipts. Fallback
changes scheduling, not authority or proof.

On completion record wall time, token usage when measurable, coordinator rework, approvals that changed a decision,
unique defects caught, false-positive gates and artifact creation/use. `scripts/summarize-run-metrics.mjs` compares
only like impact levels. A rule without positive outcome evidence is downgraded or removed instead of gaining ceremony.
