# backend.generate

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Implement one selected backend outcome and prove its declared contract on actual code.

Kind/profile: `implementation`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| architecture | .work/<business>/architecture/**/node.md | Read data ownership, operations/API/events, boundaries, code-scope and rationale declared by the selected .work graph; distinguish proposed paths from observed files. No universal architecture-first op chain is implied; report genuinely missing required scope before proceeding. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Only when the selected backend actually uses the documented NestJS family; inspect actual current code before adopting a topic. This is a topic index, not v2 routing. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Only exact owned paths in the approved code-scope, with smallest required caller/integration changes; record actual diff and commit mapping, not proposed changes as delivered. |
| evidence | E/manifest.yaml + E/tests.json + E/test-output.txt + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Store actual command, cwd/repo, source commit/tree, environment, exit code, counts and expected/actual per required proof, with sanitized original output. Operator-specific observed result in E/result.md: Map each AC/operation to delivered repo/path/symbol and actual commit. Preserve business and architecture authority; unknown rules are blockers, not implementation defaults. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, architecture, repo | — | Bind the exact operation/AC set and inspect existing code plus sibling conventions, including DI/module registration and every relevant caller. Reuse already conforming behavior. |
| 2 | business, architecture, repo | source | Implement transport, validation, permission checks, use-case logic and persistence inside the declared ownership. Enforce denials before unauthorized side effects; do not invent fallback behavior. |
| 3 | business, architecture, repo | source | Implement declared transaction, retry/idempotency, concurrency, error identity and read-time revalidation. Migrations are source only; applying them remotely is not included. |
| 4 | repo, target | source, evidence | Add/repair scoped tests; execute positive, denial, invalid-input and applicable race/reload regressions plus repository-required checks. Preserve raw failure and no-test/not-run status; repair only within this approved implementation goal. |
| 5 | repo, target | node, evidence | Review diff, verify no unrelated changes, commit the piece when authorized and read back the real SHA/diff. Bind proof to actual tested bytes; fresh code needs fresh required evidence. Stop after delivery. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| commit | Inspect exact staged diff and actual tests; bind full real source commit(s), per repository, and separately retain integration/tested mappings. Report uncommitted or no-change honestly. |
| behavior | Tests prove each declared operation facet including negative authorization and persistent state when promised; compile-only output cannot certify behavior. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- owned source edits
- scoped local commits when authorized
- tests in declared sandbox

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| BUSINESS_UNKNOWN | Implementation reaches a rule not decided by the accepted business node. |
| SCOPE_WIDENING | Required operation, owner or protected path lies outside selected code-scope. |
| PROOF_UNAVAILABLE | A required check cannot execute or does not prove the declared behavior. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
