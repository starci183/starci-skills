# api.verify

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Verify a selected API contract against the real served target with isolated authorized effects.

Kind/profile: `uat.ux`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| identity | .work/_resources/identities/<identity>/resource.yaml | For authenticated/identity-changing scope, read actor alias, provider subject, roles/membership refs, environment and sealed custody reference; never print/copy credentials. Explicit anonymous scope records anonymous instead, without inventing an account resource. |
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | When fixture inputs are needed, read their revision, owned namespace/IDs, expected precondition, creation method, cleanup owner and exact allowed deletion set; never preseed tested outcomes. Explicit no-fixture scope records why no mutable prerequisite/cleanup applies, without a fabricated fixture. |
| suite | actual repository API test suite + selected architecture contract | Read real suite command/cases, API schema/auth/error/transaction expectations and selected required assertions. Missing suite is a source-owner gap, not fabricated passing cases. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/api-result.json + E/api-output.txt + E/readback.json + E/runtime.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Store actual suite cases and result output, status/error/schema checks, read-back and lifecycle observations, namespace effects and runtime provenance. API proof is not UI proof. Operator-specific observed result in E/result.md: Bind actor/environment/repositories, preserve selected API expectations and name untested or failed cases. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, suite, repo | — | Bind required assertions to actual suite cases and verify test/runner revision. Identify undeclared effects before running, without rewriting product cases here. |
| 2 | environment, identity, fixture, repo | evidence | Verify target physical/runtime version, authorization and owned fixture preconditions; distinguish anonymous cases from authenticated actors. Do not seed tested outcomes. |
| 3 | suite, environment, identity, fixture | evidence | Execute the actual declared API client suite with isolated inputs and preserve redacted request/result diagnostics. Copy only cases the runner reported; missing output is not-run or inconclusive. |
| 4 | business, suite, fixture | evidence | Check response contract, persistent read-back and lifecycle/authorization independently, including replay/idempotency or denial where promised. Observe owned effects and cleanup status; do not delete outside an explicitly selected safe set. |
| 5 | target, suite | node, evidence | Record per-assertion verdict and actual served-version evidence, validate bindings and finish without UI claims or source repair. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| api | Required contract/data/lifecycle observations pass with actual behavior assertion and verified served build; no guessed API case or unconditional HTTP-200 success. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- declared API test writes within owned namespace; no provisioning, deploy or broad cleanup

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| SUITE_MISSING | Required API behavior has no executable declared case or cannot be reached safely. |
| NAMESPACE_CONFLICT | Test data overlaps shared/foreign state or effect authorization is insufficient. |
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
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
