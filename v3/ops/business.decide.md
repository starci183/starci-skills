# business.decide

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Specify the selected business behavior precisely enough to implement and independently accept it.

Kind/profile: `business`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| intent | current accepted user intent + supplied domain documents | Classify each statement as intent, observed fact, example, proposal, unknown or contradiction, with source citation/revision. Existing behavior does not authorize a new rule. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | .work/<business>/business/<piece>/node.md | body: Objective / Glossary / Actors & permissions / FR / NFR / Business rules / Non-business constraints / State transitions / Acceptance / Decisions / Open questions; refs; assertions; extensions.work3.decisions; dependsOn; required | FR rows: ID, actor, trigger, preconditions, input/schema, normal action/output, failure/denial, postcondition, priority, source and AC refs. NFR rows: metric, numeric target when decided, unit, workload, percentile/window, environment, measurement method and source; undecided targets stay unknown. BR rows: condition, decision, authority, affected transitions and exceptions. Technical/contractual constraints are separate from domain policy. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/coverage-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record requirement-to-acceptance coverage, concrete source observations and unresolved contradictions; a specification review is not implementation evidence. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, intent, repo | node | Inventory the actual domain: goals/non-goals, actor roles, ownership boundaries, vocabulary, current consumers and source-observed rules. Cite facts at repository/path/revision; label new requirements as intent. |
| 2 | intent, target | node | Enumerate each FR including invalid input, permission denial, retries, concurrency, cancellation and recovery only where applicable. Describe output and persisted side effects separately. |
| 3 | intent, repo | node | Specify measurable NFRs and non-business constraints separately: performance, availability, accessibility, security/privacy, observability, retention, compatibility and operational limits. Never invent legal requirements or numeric thresholds to fill a cell. |
| 4 | intent, repo | node | Build actor-action-resource permission matrix and state-transition table: from, trigger, guards, writer, to, effects, failure/no-op, repeat behavior and invariants. Include precedence when rules conflict. |
| 5 | intent, target | node | Write acceptance IDs as Given/When/Then or equivalent observable assertions with positive, negative and boundary scenarios. Link FR/NFR/BR IDs, intended UAT flow and proof instrument; expected behavior is fixed before implementation. |
| 6 | intent, target | node | For every discovered requirement/consumer choose implement, preserve, defer or not-applicable. Record rationale, decision authority, owner and revisit condition. Defer does not remove required scope without an actual user decision. |
| 7 | target, repo, intent | evidence | Review every requirement for a unique acceptance destination and every enforcement claim for real source evidence. List all material gaps together, preserve accepted unchanged rows, then finish the BA piece only. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| coverage | Each applicable FR/NFR/BR has acceptance IDs and source intent; no vague fast/secure/user-friendly NFR is accepted as measurable. Implementation/UAT status is untouched. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| BUSINESS_UNKNOWN | A required rule, actor permission, numeric target or acceptance result has no authoritative decision. |
| BUSINESS_CONTRADICTION | Accepted sources conflict; preserve both citations and ask the actual owner, never average them. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <piece> | Stable selected piece slug / slug piece đã chọn |
