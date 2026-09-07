# uat.plan

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Define executable acceptance cases for the selected journeys without running them.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| resources | selected identity and fixture resources, when required | Read existing aliases, isolation policy and fixture definitions without provisioning anything. Anonymous/no-fixture modes are valid when explicitly applicable. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | .work/<business>/uat/<flow>/node.md + ui/<screen>/node.md + ux/<piece>/node.md + explicitly selected workflow-review/node.md | body: Flow / Actor / Preconditions / Case steps / Expected / Proof / Cleanup / Isolation; refs; dependsOn; assertions; required; state | Flow parent states purpose and common preconditions. UI leaves identify screen/state, viewport/theme and appearance criteria. UX leaves identify case/AC, actor, fixture, ordered action, expected output/state, persistence/denial proof and cleanup ownership. Planned leaves remain todo. If the current request explicitly selects a scoped preset with a later audit/quality/portfolio review, declare that exact consumer target and expected assertions now, todo, under the approved graph. Do not create review scope merely because this planning op ran; no consumer invents missing targets later. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/case-coverage.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record acceptance coverage and safety/isolation review; no run result is emitted for unexecuted cases. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | business, target, repo | node | Enumerate selected actor journeys from acceptance, including happy, invalid/denied, interrupted and reload/resume paths where applicable. Distinguish expected assertions from proposed locator strategies. |
| 2 | repo, environment, resources | node | Resolve actual entry routes and documented API/read-back instruments. Record exact environment/actor/fixture IDs, preconditions and allowed effects; do not invent missing accounts or route controls. |
| 3 | business, resources, target | node | Write cases before execution: input, action, expected feedback, persistent postcondition, negative outcome and evidence instrument. Keep expected results independent of what the current implementation happens to do. |
| 4 | resources, environment, target | node | Specify namespace and session isolation, cleanup owner and permitted rollback set. Mark independent flows parallel-ready only after checking shared writes; planning does not spawn agents. |
| 5 | business, target, repo, resources, environment | evidence | Review every scoped AC has a case or explicit accepted deferral and that each case is reproducible from declared prerequisites. Stop after plan. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| cases | Each case has stable assertion IDs and a concrete expected observation/proof source; no unrun case is marked passed. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| FLOW_UNDEFINED | An in-scope journey lacks a grounded entry, actor, expected result or prerequisite ownership. |
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
| <screen> | Selected surface/state slug / slug screen-state đã chọn |
| <piece> | Stable selected piece slug / slug piece đã chọn |
