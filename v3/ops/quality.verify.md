# quality.verify

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Run the selected repository quality gates and report their actual bounded verdict.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| gates | actual repository scripts/config + selected gate criteria | Read actual commands, thresholds, test scopes and applicable product-change proof. Explicit task scope may authorize normal tests; do not impose a new blanket E2E approval. Shared destructive tests still need scoped authority. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/gates/<gate>.json + E/logs/<gate>.txt + E/coverage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Per gate retain command, cwd/repo, actual commit/tree, configuration/hash, exit, test counts, thresholds and observed metrics, raw redacted output and failure classification. Operator-specific observed result in E/result.md: List required gates and exact source/config coverage, never project-wide claims from diff-only gates. Accepted debt is separate, never relabels raw failure pass. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, repo, gates | node | Inspect baseline and selected source revisions/configuration before execution. Verify commands exist and distinguish no-test, unavailable runner and a real failing test. |
| 2 | repo, gates | evidence | Run required checks on the intended bytes; retain exact command/exit/output. Record all required failures possible without unsafe continuation. No source, threshold or command weakening. |
| 3 | gates, repo | evidence | Compare each metric to its configured/requested threshold and applicable scope. Preserve absent thresholds as unconfigured, not zero; no-test success is not test coverage. |
| 4 | target, repo, gates | node, evidence | Classify source regression, baseline debt, environment block and suspected flakiness using diagnostics. Report raw outcomes and any approved exception separately; validate and stop, no repair chain. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| gates | Each required check has actual observed output and a passing criterion; failed/unavailable checks cannot complete a required acceptance leaf. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- selected local verification commands; no source repairs

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| GATE_UNAVAILABLE | Required command/config/runtime cannot run as declared. |
| SOURCE_CHANGED | Source or configuration changed during measurements, making results incoherent. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <gate> | Declared repository gate ID / ID gate repo đã khai |
