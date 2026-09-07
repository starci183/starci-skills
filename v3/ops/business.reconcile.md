# business.reconcile

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Compare the accepted business tree with delivered source and real acceptance evidence without rewriting requirements.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| proofs | selected implementation/UAT/release nodes and original evidence bundles | Read original assets, assertion observations, completion digests, commit lineage and test/runtime revisions; chat summaries are navigation hints, not acceptance proof. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/reconciliation.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record requirement IDs, source/evidence refs, actual verification and discrepancy list; preserve deferred and untested work explicitly. Operator-specific observed result in E/result.md: For each AC list expected, enforcing source, proving evidence, actual, freshness and gap owner; no business done/implemented flag is copied over an incomplete tree. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, proofs, repo | — | Resolve original requirement/evidence versions and delivered repository commits; reject stale/missing refs before claiming enforcement. |
| 2 | business, repo, proofs | evidence | Compare each required business dimension to delivered code and independent observations, including denial and persistence where required. Existing tests proving another behavior do not close this AC. |
| 3 | business, proofs, target | node, evidence | Record pass, discrepancy, stale and unproven rows plus named owners; keep implementation state and UAT result separate. Never edit expected to match actual or waive missing scope without a real decision. |
| 4 | target, proofs | node, evidence | Validate all refs and report the derived business completion and remaining leaves. Stop; proposing a next repair does not execute it. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| reconciliation | Every selected required AC is genuinely supported by current source/evidence; unresolved rows remain visible and cannot certify the parent complete. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| DELIVERY_UNPROVEN | A required claim has no coherent code/evidence revision or contradicts observed behavior. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
