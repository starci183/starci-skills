# knowledge.repair

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Repair one challenged canonical instruction/rule and its mirror from concrete applicability evidence.

Kind/profile: `implementation`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| rule | selected canonical knowledge file + mirror + applicable owner maintenance policy + original challenge evidence | Read the actual rule identifier/case and its owner/callers, observed counterexamples and existing enforcement. Read relevant skill instructions fully if editing a skill. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Only exact owned paths in the approved code-scope, with smallest required caller/integration changes; record actual diff and commit mapping, not proposed changes as delivered. |
| evidence | E/manifest.yaml + E/rule-review.md + E/validation.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Keep applicability findings, exact before/after authority paths, actual validator/citation/mirror checks and origin-context retest when included. Operator-specific observed result in E/result.md: Record evidence-backed reason and canonical owner, preserving stable rule IDs and existing valid scope. A one-off preference is not universal law. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, rule, repo | — | Check whether the issue is existing enforcement failure, missing concept, wrong existing rule or duplicate concept using the actual maintenance policy of the selected owner. Choose one canonical owner before edits. |
| 2 | rule, repo | source | Make smallest scoped rule/gate/step repair with stable IDs, same-commit Vietnamese mirror and no product-specific law. Update genuine callers/contracts together; do not patch consumers as hidden workaround. |
| 3 | rule, repo | evidence | Run actual relevant validation/citation/parity and behavioral regression checks. Generated documents use their owned generators; inspect changes rather than claiming textual shape proves sound guidance. |
| 4 | target, rule, repo | node, evidence | Commit owned change when authorized and report exact originating context needing re-evaluation. Do not automatically rerun its operation or claim visual correctness. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| commit | Inspect exact staged diff and actual tests; bind full real source commit(s), per repository, and separately retain integration/tested mappings. Report uncommitted or no-change honestly. |
| knowledge | Repair follows canonical ownership and actual rule-applicability evidence; mirror/references and applicable regressions validate. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- exact authorized knowledge source/mirror edits
- scoped local commits when authorized

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| RULE_OWNER_UNKNOWN | Challenge cannot be grounded in a canonical owner/applicable case or needs wider authority. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
