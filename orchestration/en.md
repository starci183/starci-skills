---
title: Agent orchestration
---

# Agent orchestration

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@codex-orchestration` | `orchestration/codex/en.md` | en | map the common contract to Sol coordinator and Luna workers |
| `@claude-orchestration` | `orchestration/claude/en.md` | en | map the common contract to Opus coordinator and Sonnet workers |
| `@phase-maps` | `orchestration/maps/en.md` | en | route the selected physical skill to exactly one validated phase map |
| `@profiles` | `orchestration/profiles.json` | file | keep runtime model roles and concurrency machine-readable |
| `@receipt-schema` | `orchestration/receipt.schema.json` | file | define the internal machine-validated run record |
| `@validate-orchestration` | `scripts/validate-orchestration.mjs` | script | reject unsafe ownership or incomplete skill bindings |

## Record

This module is the one home of provider-neutral agent orchestration for every physical StarCi skill. A selected
skill still owns its business, design, source and proof rules; orchestration only partitions that work without
changing decisions, approvals or write boundaries. Runtime adapters translate the same roles into Claude Code or
Codex capabilities, while `profiles.skillMaps` binds every skill to its exact pipeline, impact and approval shape.

## Roles

The **coordinator** is the integration owner, not an unquestionable source of truth. It resolves scope and
authority, owns domain decisions, presents approvals, freezes the exact boundary, reviews worker receipts,
integrates shared targets and declares the final verdict.

A **worker** receives one bounded task with one output owner. Workers may inventory and challenge evidence,
materialize a frozen artifact, implement approved repository changes in disjoint files, run tests or capture
proof. A worker never selects scope or authority, consumes approval, expands scope, edits shared authority,
performs provider mutation, integrates overlapping changes or declares completion.

## Phase ownership

| Phase | Decision owner | Delegable worker work | Join gate |
|---|---|---|---|
| scope and evidence | coordinator | independent route, source, component, contract and state inventories | every receipt has provenance and the same immutable envelope |
| authority and decision | coordinator | read-only counterevidence and feasibility checks | coordinator accepts one decision or discrepancy receipt |
| bounded materialization | coordinator owns meaning and acceptance | generate cache artifacts or other frozen outputs | output matches its accepted input and contains no new decision |
| write boundary | coordinator | owner-chain, target and impact-cone audits | one exact writer registry and approval boundary |
| execution | coordinator owns authority/external mutations and integration | approved repository changes and tests in disjoint targets | one writer per target; all approved obligations mapped |
| proof | coordinator owns the final verdict | gates, remote reads, captures and mismatch inventory | coordinator reproduces evidence and closes only at zero known mismatch |

Materialization and approved disjoint repository work may be delegated. Scope, authority, product/UI decisions,
ownership classification, provider mutation and acceptance remain with the coordinator. A worker may propose
facts or counterexamples; it may not turn them into the selected decision.

## Mandatory orchestration step

Every selected skill resolves its `profiles.skillMaps` entry and phase-map record after binding scope/evidence and
before its first delegable task. Layout, Block and Refactor retain their explicit non-approval `orchestration` row;
other skills use their existing `PIPELINE` steps without adding user ceremony. The coordinator publishes a compact
orchestration receipt containing:

1. resolved runtime adapter and model roles;
2. task ids, dependencies and whether each task is `read`, `cache-write`, `repository-write`, `authority-write`, `external-write` or `proof`;
3. the exact output and writer targets owned by each task;
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
`contract-freeze` plus `quality-review` events. Every mutation binds the complete approved target set and the
selected skill's exact approval label from `profiles.skillMaps`; staged frontend writes retain `OK #1`/`OK #2`,
while ordinary capability boundaries use `OK`. Auto remains available only to maps that declare it and binds the
same identity to the immutable envelope. Authority and external writes are coordinator-only sequential tasks.
When Refactor evolves authority, dependent repository tasks also bind the compiled authority-proof hash. Proof
tasks bind stable-state and selected proof-target hashes and depend on every mutation task. A future task is not
dispatchable while its gate identity is absent.

Each phase gate is also a passed coordinator event. Worker tasks name those event ids in `dependsOnGates`; copying
a hash without the event cannot unlock work. `impactConeAt` is recomputed from the disclosed owners, consumers,
tests, required targets and inventory proof, and every required target receives exactly one writer.

The coordinator rejects a receipt when its envelope is stale, evidence is unproved, a write is outside boundary,
a decision was made by a worker or another task owns the same path. Rejected work is not silently integrated.

For `capability` and `cross-domain` impact, a second reviewer receives evidence without the coordinator's recommendation,
cannot write state, may raise concrete challenges, and must close them through evidence before mutation dispatch. A
consistent coordinator answer is not treated as an independent proof.

## Dependency and writer law

- Parallelize only tasks whose required inputs are already gate-passed and whose output and write ownership do not overlap.
- One target has one writer for the entire batch. A directory boundary is insufficient when two tasks can touch the same file.
- `.claude` authority, approval records, shared contracts, shared entrypoints, manifests and final integration remain coordinator-only.
- A worker may implement repository state only after the selected skill's write-authorizing approval and only inside its assigned subset.
- Authority and external/provider mutation remain coordinator-only even when their evidence and proof reads are delegated.
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

## Scope

This module binds every physical StarCi capability through `profiles.skillMaps`. The validator rejects any missing,
extra or stale skill entry and any topology or step order that differs from the selected skill's `PIPELINE`.
Coverage does not force delegation: a map runs sequentially whenever it has no safe, ready, disjoint,
overhead-positive worker task.
