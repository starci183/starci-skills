# interface.generate

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Implement one selected frontend outcome and capture its actual rendered result.

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
| design | .work/_resources/design/<resource>/resource.yaml + accepted direction evidence | Read the actual installed component API/tokens and accepted surface/direction/state map; only require a separate visual direction if this task selected one. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs. |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or legacy receipt requirement. |
| [knowledge/ui/presentation/INDEX.md](../../knowledge/ui/presentation/INDEX.md) | Read matching presentation topics when the selected installed component/token family is bound. Never invent a rule ID or API from this index. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Only exact owned paths in the approved code-scope, with smallest required caller/integration changes; record actual diff and commit mapping, not proposed changes as delivered. |
| evidence | E/manifest.yaml + E/tests.json + E/render.png + E/render-review.md + E/runtime.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain real test output and screenshot from the implemented surface, actually opened/inspected. Include viewport/theme, observed route/state, driver, served build and limitations; no fixture screenshot labelled product proof. Operator-specific observed result in E/result.md: Map delivered components/routes/client calls to ACs and state coverage; record actual source revision separately from served render revision. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | repo, target, business, architecture, design | — | Inspect target and callers, actual installed component API, API schema and all applicable states. Reuse the approved shell; distinguish bounded refinement from a new business/state design. |
| 2 | repo, business, architecture, design | source | Implement native controls, data reads/actions, loading/empty/error/denied/success/recovery, keyboard/focus and responsive behavior inside owned source. No hardcoded fake success or guessed endpoint. |
| 3 | repo, target, design | source, evidence | Run relevant component/unit/type/build checks and interaction tests. Fix only within the selected implementation goal; preserve actual failures and keep required visual work unfinished if unavailable. |
| 4 | environment, repo, target, design | evidence | Bind an available authorized runtime/preview and real served build using common browser protocol. Navigate the implemented surface and capture requested viewport/state; open the image, inspect layout/overflow/content and record findings. |
| 5 | repo, target | node, evidence | Review owned diff, commit actual code when authorized, and bind tests/render to their real revisions. Capture again if relevant committed output changed. Full independent UAT remains its own selected proof, not implied by the screenshot. Stop. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| commit | Inspect exact staged diff and actual tests; bind full real source commit(s), per repository, and separately retain integration/tested mappings. Report uncommitted or no-change honestly. |
| render | Actual implemented surface screenshot is retained and visually inspected; code-only delivery is explicitly partial when this required capture cannot be made. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- owned source edits
- scoped local commits when authorized
- authorized local preview/test actions

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| UI_CONTRACT_UNKNOWN | Required business state, action API or component ownership is unresolved. |
| RUNTIME_UNVERIFIED | No permitted runtime can prove the implemented surface/build; do not fabricate a screenshot. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
