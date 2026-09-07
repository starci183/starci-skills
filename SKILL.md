---
name: starci
description: Work on an explicitly selected product-development operation using a business completion tree, scoped resources, and evidence-bound results. Use for tracked business, architecture, implementation, verification, and delivery work; answer ordinary questions without creating a workflow.
---

# StarCi Work 3.0

Use the user's current goal and authorization, not a precomputed chain. One task may contain several operations for one purpose; one invocation completes only the selected operation or explicitly approved independent group and then stops.

## Load only what this operation needs

1. Read [v3/README.md](v3/README.md) for supported storage, CLI and evidence limits.
2. Resolve the selected operation in [v3/ops/catalog.json](v3/ops/catalog.json). Read its `commonDocument` and its exact `document`, relative to that catalogue. Do not guess an operation path or load all operations.
3. Read the canonical business goal, selected node, applicable ancestors, dependencies and resource references in the product-owned `.work`. Inspect source at the bound repository/revision before making source claims.
4. Use the current core schemas and [core documentation](v3/core/README.md) for machine fields. Operator prose cannot override a schema or tool permission.

English contracts are runtime authority; same-stem Vietnamese files are human mirrors. Existing source/knowledge can be read as evidence without importing its old routing instructions.

## Choose and stop

For a new product purpose, use `goal.setup` to establish the business goal, scope, applicability and initial completion tree. This does not authorize implementation of the whole tree. A question, review or diagnosis does not authorize fixes, deployment or account changes.

State the selected specific goal, expected result, write boundary and done-when compactly. Reuse explicit user authorization already covering them. Ask only for a missing decision or materially new authority. Keep this exchange in the task; no strict request/response files.

Identify eligible unfinished pieces from the tree, but execute only the selection covered by the request. Missing prerequisites are concrete blockers, not permission to invoke additional operators. Stop with actual result, evidence, code commits when applicable, and what remains unproved.

Scope and dependency edges belong to `.work`, not to a hardcoded operator chain. Read the selected node's declared graph; do not add, remove or bypass prerequisites to make an operation pass. A scope change must be explicitly selected and authorized. Changed semantic inputs suspend affected completed work transitively; retain its original commits/evidence and rerun only a subsequently selected piece, never the whole graph automatically.

## Evidence and truth

Separate desired behavior, observed behavior and inference. Cite repository/revision/path for source facts; use actual tool outputs for execution claims. Never manufacture account IDs, routes, screenshots, commits, approvals, test results or deployment provenance.

A passing validator proves the checks it implements, not semantic truth of arbitrary authored observations. Inspect evidence and its assertions. UI appearance is not behavioral UAT; login is not the downstream journey; source HEAD is not a served build. A requirement change invalidates affected proof until reviewed or retested.

Keep credentials in the existing sealed/vault owner. Store only refs in `.work`; inspect and redact artifacts before durable capture. Account records do not independently authorize authentication, mutation, reset or provisioning. Follow applicable browser/tool instructions.

## Parallel work

Default to one active operation. Spawn only when the user or applicable instructions authorize delegation. A requested group of three independent flows can use three agents, with distinct node/source write ownership, browser contexts and mutable-data namespaces. If isolation is unavailable, serialize or report the dependency.

Each worker reads its own operation contract and evidence; ordinary messages are not accepted proof by themselves. Do not spawn more agents from an already bounded group without authorization. Do not silently move work to another user task.

## Persistent result

Update only owned leaf files/resources/evidence. Parents derive completion. Record full code commit SHAs per piece and the actual integrated/served identity where relevant. Preserve user changes and keep commits scoped; do not push, publish or deploy unless requested.

Product `.work` is not a Git checkout container. Existing `.worktrees` data and actual Git worktrees are never automatically deleted or migrated. New execution must not enter the retained v2 `routing.json`, session-open, plan-chain, bank or attempt/request/response loop.
