# interface.fix

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Repair one scoped observed frontend defect and recheck the affected behavior/render.

Kind/profile: `implementation`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| finding | selected current evidence manifest + its actual assets | Read the exact failing assertion, source/render revision, measured observation and accepted design contract; a suggestion without reproduced evidence remains a hypothesis. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs. |
| [knowledge/ui/presentation/INDEX.md](../../knowledge/ui/presentation/INDEX.md) | Read matching presentation topics when the selected installed component/token family is bound. Never invent a rule ID or API from this index. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Only exact owned paths in the approved code-scope, with smallest required caller/integration changes; record actual diff and commit mapping, not proposed changes as delivered. |
| evidence | E/manifest.yaml + E/regression.json + E/before-after-review.md + E/after.png when visual + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record actual reproduction, cause, changed files and affected regressions; visual fixes need current inspected capture, behavior fixes need observed action/output. Operator-specific observed result in E/result.md: Link the original defect evidence and current repaired proof; never erase the old failure or silently change expected behavior. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | finding, repo, business, target | evidence | Reproduce or corroborate the exact defect at current source and distinguish stale evidence, library ownership and product-source cause. |
| 2 | finding, repo, business | source | Apply the smallest repair within agreed ownership and preserved business/design contract. If the defect needs a new requirement, shared-owner API or redesign outside scope, stop before expanding. |
| 3 | repo, finding, environment | evidence | Rerun targeted and collateral checks; capture and open the actual changed UI when appearance is affected, and test the interaction/persistence claim separately. |
| 4 | repo, target | node, evidence | Review and commit the scoped piece when authorized, record actual code/proof revisions and unresolved limitations. Stop; do not launch a larger generation chain. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| commit | Inspect exact staged diff and actual tests; bind full real source commit(s), per repository, and separately retain integration/tested mappings. Report uncommitted or no-change honestly. |
| regression | The same original expected assertion now has new observed evidence; unchanged collateral checks remain passing or explicitly unresolved. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- owned source edits
- scoped local commits when authorized
- targeted tests and authorized browser actions

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| REPAIR_SCOPE_UNKNOWN | Root cause or required ownership change is not established. |
| EXPECTED_CHANGE_REQUIRED | The proposed repair changes a business/design expectation not authorized by this task. |
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
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
