# migration.release

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Apply the explicitly selected source-owned migration set to one verified target and prove its journal/data outcome.

Kind/profile: `release`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| architecture | .work/<business>/architecture/**/node.md | Read data ownership, operations/API/events, boundaries, code-scope and rationale declared by the selected .work graph; distinguish proposed paths from observed files. No universal architecture-first op chain is implied; report genuinely missing required scope before proceeding. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| migration | selected source-owned migration files/runner/config + explicit target authority | Read exact migration IDs/checksums, intended schema/data delta, source tests, backup/rollback constraints and journal inspection method. Creating/editing migration code is a separate implementation scope. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/journal-before.json + E/journal-after.json + E/migration-output.txt + E/replay.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Keep migration checksums, actual runner/command, redacted output, before/after journal/data checks and safe no-op replay/inspect result; no credentials in logs. Operator-specific observed result in E/result.md: Pin exact target/schema/source migration identity and expected postconditions. Production mutation is allowed only by explicit scoped authority, never by completion of code tests. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | migration, architecture, repo, environment, target | node | Verify selected exact target/authority, source revision and migration set; inspect runner behavior and recovery constraints before any database effect. |
| 2 | migration, environment | evidence | Inspect current journal/schema and backup/precondition evidence. Classify applied, safely pending, conflicting or partial/uncertain; never rerun a partial unknown effect blindly. |
| 3 | migration, repo, environment | evidence | Run only approved pending set through the actual reviewed source runner, or record inspected no-op. Preserve original journal rows and actual error output; no ad hoc SQL repair or automatic down migration. |
| 4 | migration, environment, target | node, evidence | Verify declared schema/data invariants and journal after execution; perform safe supported no-op replay or inspect to prove no pending changes. Report irreversible/partial effects and stop without deploying. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| migration | Exact selected set applied/no-op with journal integrity and declared data invariants proved; successful process exit alone is insufficient. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- exact authorized schema/data migration only; no automatic down/restore/deploy

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| MIGRATION_TARGET_UNKNOWN | Exact environment/schema/runner revision or mutation authority is missing. |
| MIGRATION_PARTIAL | Current journal/data or prior effect is partial, conflicting or uncertain; require owner recovery decision. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
