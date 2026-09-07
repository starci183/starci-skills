# service.operate

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Inspect or change one declared auxiliary service and verify its requested state.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| service | .work/_resources/services/<resource>/resource.yaml | Read exact declared service, owner, desired state, command/config refs, target identity, probes and allowed recovery; never infer service ownership from a listening port. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/services/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.commandRef; details.probeRefs; details.observationRef | Update only service-owned observation/declaration fields included in scope; do not grant new authority by editing allowed effects. |
| evidence | E/manifest.yaml + E/service-probes.json + E/effects.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain actual holder and before/after health/stop evidence with selected command outcome and bounded recovery. Operator-specific observed result in E/result.md: Record one service outcome and partial effects; no product runtime or quality acceptance inferred. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | service, environment, target | evidence | Inspect target ownership, process/container identity and probe before action; reuse already matching state without restart. |
| 2 | service, environment | — | Confirm selected inspect/up/down/restart action and authority. Do not touch product runtime servers, foreign holders or unlisted dependencies. |
| 3 | service, environment | resource, evidence | Run only the declared authorized command if needed, preserve uncertain effects and avoid blind retries; no port stealing or undeclared install. |
| 4 | service, target | node, resource, evidence | Verify requested state using actual service probe and holder identity, report limits and stop without gates or product operations. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| service | Up is supported by the declared useful health probe; down is supported by owned process/container and endpoint observations, not an ungrounded absence. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- explicit owned auxiliary-service lifecycle action only

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| SERVICE_OWNERSHIP_UNKNOWN | Service target or effect is outside verified ownership/scope. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
