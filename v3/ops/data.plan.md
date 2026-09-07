# data.plan

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Define attributable fixtures, expected preconditions and exact safe cleanup for selected tests.

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
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| cases | .work/<business>/uat/<flow>/**/node.md | Read selected expected outcomes and initial state to distinguish prerequisites from outcomes that the test itself must produce. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | body: Fixture purpose / Preconditions / Isolation / Placement / Verification / Cleanup; refs; dependsOn; assertions; required | State requested representative volume/content classes, ownership, exact namespace rules, expected initial state and safety limits; plan alone places no records. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| resource | .work/_resources/fixtures/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.namespace; details.actor; details.inputs; details.targets; details.expected; details.placement; details.cleanup; details.owner | Define resource refs to fixture bytes/scripts with revision, target entities/API paths, natural keys/IDs, ownership predicate, allowed update/delete set and cleanup owner. Use only schema-grounded fields. |
| evidence | E/manifest.yaml + E/fixture-plan-review.json | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain schema/namespace/AC comparison proving fixture does not pre-create tested outcomes and deletion scope is attributable. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | cases, business, repo, architecture | node | Identify exactly which initial records and volume classes the selected assertions need; inspect actual schema and normal product creation APIs. |
| 2 | repo, environment, cases | resource | Assign disjoint namespaces, stable ownership predicates and creation/update methods. No schema change solely to make cleanup convenient; missing attribution is a design blocker. |
| 3 | cases, business, architecture | node, resource | Specify fixture bytes, order/dependencies, expected read-back and rollback/deletion set. Existing shared rows are read-only unless separately authorized. |
| 4 | target, repo, cases, environment | evidence | Review schema validity, expected-versus-fixture separation, parallel collisions and cleanup subset safety. Finish the plan without seeding or provisioning. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| fixture-plan | Inputs satisfy preconditions without synthesizing the tested result; exact data ownership and cleanup set are demonstrable. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| FIXTURE_UNATTRIBUTABLE | Required fixture rows cannot be isolated or cleanup cannot be restricted safely. |
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
| <flow> | Selected UAT journey slug / slug journey UAT đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
