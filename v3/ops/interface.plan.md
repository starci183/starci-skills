# interface.plan

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Define the selected frontend surfaces, shared shell and interaction/state contracts before source work.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| design | .work/_resources/design/<resource>/resource.yaml + selected supplied references | Read actual design-system package/tokens/components, brand constraints and supplied reference assets. Reference appearance cannot invent business copy or data. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs. |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or unrelated receipt requirement. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | .work/<business>/architecture/interface/<piece>/node.md + selected implementation/frontend/<piece>/node.md + explicitly selected audit/quality child directories/node.md | body: Surface map / Shared shell / Interaction states / Data contracts / Accessibility / Source scope / Acceptance; refs; dependsOn; assertions; required | Surface rows: stable ID, route/host, actor/task, shell owner, entry/exit, reads/writes, loading/empty/error/denied/success, viewport/keyboard needs, source path and AC refs. Keep implementation children todo. If the current request explicitly selects a scoped preset with a later audit/quality/portfolio review, declare that exact consumer target and expected assertions now, todo, under the approved graph. Do not create review scope merely because this planning op ran; no consumer invents missing targets later. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/surface-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record discovered routes/screens and accepted/proposed distinctions, omitted scope with reasons, and mapping review. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | business, repo, target | node | Inspect actual routes, layouts, components, modal hosts and client API bindings; record existing versus proposed surfaces. |
| 2 | business, design | node | Assign shared navigation/shell once, with no-shell explicitly valid where appropriate; map actor goals, actions and feedback. Preserve accepted design choices. |
| 3 | business, repo, design | node | Specify each surface state and transition, backend contract/dependency, focus/error/recovery behavior and responsive/accessibility expectations. Do not invent endpoints or selectors. |
| 4 | target, business, repo, design | evidence | Check that selected outcomes and observed in-scope routes are mapped, ownership does not overlap and test/visual coverage has a home. End with the plan, not generation. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| surfaces | Each selected surface has an actor/task, actual or proposed route, state coverage and implementation/UAT destination. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| SURFACE_UNKNOWN | Required entry, action contract or shell owner cannot be grounded. |
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
| <piece> | Stable selected piece slug / slug piece đã chọn |
