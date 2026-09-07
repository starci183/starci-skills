# data.seed

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Apply or clean only the selected owned fixture set and verify its exact observed state.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | When fixture inputs are needed, read their revision, owned namespace/IDs, expected precondition, creation method, cleanup owner and exact allowed deletion set; never preseed tested outcomes. Explicit no-fixture scope records why no mutable prerequisite/cleanup applies, without a fabricated fixture. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| identity | .work/_resources/identities/<identity>/resource.yaml | For authenticated/identity-changing scope, read actor alias, provider subject, roles/membership refs, environment and sealed custody reference; never print/copy credentials. Explicit anonymous scope records anonymous instead, without inventing an account resource. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| authority | current fixture operation scope + actual source-owned fixture script | Read selected inspect/apply/cleanup action and exact script/input revision; account provisioning, schema migration and broad database restore are outside this scope. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/fixtures/<resource>/resource.yaml | id; kind; owner; revision; details.placementEvidence; details.cleanupEvidence | Link actual placement/cleanup evidence to the existing fixture resource without modifying its intended outcomes. |
| evidence | E/manifest.yaml + E/records.json + E/before-after.json + E/fixture-output.txt + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | For each row record store/key, namespace/owner, operation/outcome and read-back; cleanup receipt records only proven owned removed IDs. Redact sensitive fixture content. Operator-specific observed result in E/result.md: Record actual placed/reused/removed rows and remaining cleanup owner. A planned row list is not actual created data. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | fixture, authority, environment, identity, repo | — | Validate input/script revision, exact target, actor and mutation scope. Read-only inspect may proceed without assuming apply/cleanup authority. |
| 2 | fixture, environment, authority | evidence | Inspect every target key and classify matching/missing/invalid/foreign/uncertain records before changing any. Foreign or uncertain ownership is never overwritten/deleted. |
| 3 | fixture, authority, repo, environment | evidence | Apply only approved missing/invalid owned inputs through declared normal API or reviewed fixture runner; cleanup only selected exact owned set after fresh validation. Never seed the tested outcome or reapply uncertain mutations. |
| 4 | fixture, environment, target | node, resource, evidence | Read back actual records or prove selected removal, preserve shared rows, record partial effects and remaining cleanup. Validate and stop without executing UAT. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| fixture-state | Actual read-back equals planned preconditions, or exact owned deletion is verified; partial/uncertain effects cannot be declared clean. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- explicit fixture placement/update or exact authorized cleanup subset

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| FIXTURE_AUTHORITY_MISSING | Selected operation lacks permission for its exact data target/effect. |
| FIXTURE_SHARED_ROW | Mutation would affect foreign/shared or unattributable records. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
