# backend.plan

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Partition selected backend operations into independently implementable pieces and dependencies.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| architecture | .work/<business>/architecture/**/node.md | Read data ownership, operations/API/events, boundaries, code-scope and rationale declared by the selected .work graph; distinguish proposed paths from observed files. No universal architecture-first op chain is implied; report genuinely missing required scope before proceeding. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Only when the selected backend actually uses the documented NestJS family; inspect actual current code before adopting a topic. Use this index only for applicable code patterns. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | .work/<business>/implementation/backend/<piece>/node.md | body: Goal / Operations / Write ceiling / Protected paths / Contracts / Tests / Done when; dependsOn; refs; assertions; state; required | Create/revise todo implementation leaves. Each operation maps to one primary owner piece; each piece lists repository/path/symbol, stores, source test commands, AC IDs and dependency IDs. Planning does not mark these implementation leaves done. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/partition-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record coverage, disjoint ownership and dependency review for the selected planning node. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, architecture, business, repo | node | Enumerate selected operations and their actual writer/store boundaries. Group cohesive changes by business outcome and safe commit boundary, not a fixed file-count limit. |
| 2 | architecture, repo | node | Assign complete source ceilings, protected paths, migrations and caller wiring; include tests for transport, validation, authorization, transaction and read-back where applicable. |
| 3 | architecture, business, target | node | Declare dependencies explicitly, identify shared owner work and justify any parallel-ready pieces. Never spawn workers or implement as a side effect of a plan. |
| 4 | architecture, business, repo, target | evidence | Verify every selected operation is assigned once, no unresolved ownership overlap and each piece can be reviewed and tested. Finish the planning node only. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| partition | Complete selected operation coverage and resolvable dependency graph; generated implementation leaves remain unfinished. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| PARTITION_CONFLICT | Writer/store ownership cannot be partitioned without reopening architecture. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <piece> | Stable selected piece slug / slug piece đã chọn |
