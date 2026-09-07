# goal.setup

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Establish one business purpose and its initial completion tree without executing product work.

Kind/profile: `business`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| intent | current user request + existing .work/workspace.yaml | Read the actual requested outcome, agreed scope and existing workspace identity; do not turn examples or future ideas into obligations. |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| workspace | .work/workspace.yaml | schema; id; extensions | Initialize only an explicitly new canonical workspace; reuse an existing workspace unchanged. Never invent repository/environment resources merely to satisfy setup. |
| node | .work/<business>/node.md + .work/<business>/setup/node.md + selected child directories/node.md | id; kind; required; dependsOn; refs; assertions; body: Purpose / Scope / Done when / Decisions / Unknowns; extensions.work3.nativeGoal: actual returned current-task goal reference only | Write the parent purpose with no state. The one setup leaf .work/<business>/setup/node.md is N for this op, kind business, with only scope-review assertions. All planned business/architecture/code/UAT leaves remain todo, or explicit blocked/na with real reasons. Scope decisions distinguish implement, defer and not applicable. Store requirement IDs once. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/scope-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain source-intent citations and actual scope/coverage review under the setup leaf only. Set setup done only after real review evidence and validation; initial scaffolding has no completion. No code/UAT pass. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | intent, target | workspace, node | Resolve the existing canonical workspace, or initialize only the explicitly new workspace identity; establish one purpose, actors/outcomes stated so far, inclusions and exclusions. Mark unspecified behavior unknown. |
| 2 | intent, target | node | Map the purpose into the smallest useful completion tree. A task may cover three UAT flows, but each flow has separate UI and UX assertion leaves; do not pre-expand irrelevant lifecycle branches. |
| 3 | intent, target | node | Record applicability and dependencies by stable IDs. A defer decision needs rationale/owner/revisit trigger and stays visible; it is not done or na. Reuse explicit approval, asking only unresolved material scope choices. |
| 4 | intent, target | node | When the user explicitly requests a native goal for this current chat/task and an actual supported goal tool exists, inspect/create/reuse that goal according to the tool contract; retain only its returned reference in extensions.work3.nativeGoal. Otherwise keep purpose in .work and the current chat. Never invent a platform goal ID or create a separate task/agent goal automatically. |
| 5 | target | evidence | Review tree coverage against the original purpose, validate references and report selected eligible ops as suggestions only. Stop without dispatch or cooking child pieces. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| scope | Every declared outcome is mapped to a required leaf, explicit deferred decision or justified non-applicability; setup completion never rolls implementation forward. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- native current-task goal creation/reuse only when explicitly requested and supported

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| PURPOSE_AMBIGUOUS | Multiple materially different purposes or repository identities remain unresolved. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
