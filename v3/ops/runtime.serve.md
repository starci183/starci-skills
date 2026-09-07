# runtime.serve

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Bring one selected development runtime to the authorized state and prove the actual served build.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| runtime | .work/_resources/runtimes/<resource>/resource.yaml + selected source command/config | Read exact runtime owner, command, checkout/build, endpoints, process/container identity, declared desired action and health/version probes. Integration merge is not implied by serving. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/runtimes/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.commandRef; details.sourceRef; details.endpoints; details.probeRefs; details.custodyRefs; details.observationRef | Update only declared owned runtime refs and observed-state pointer. Record local PID/session handles in ignored local state or bounded evidence, not durable identity. |
| evidence | E/manifest.yaml + E/runtime.json + E/probes.json + E/effects.json + E/build-output.txt when built + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record before/after generation, target/process ownership, actual build command/output, full source refs, immutable served artifact, endpoint probes and effect status. Operator-specific observed result in E/result.md: Keep code/build/served identity distinct and no UAT/release readiness claim from a healthy process. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, runtime, environment, repo | evidence | Inspect current process/container holder, source/build revision, ports and health. Reuse an already matching healthy runtime without restart. |
| 2 | runtime, environment, target | — | Check selected desired action and allowed effects. A foreign process/port is not permission to kill it or silently choose another port/origin. |
| 3 | runtime, repo, environment | resource, evidence | Perform only the exact authorized runtime change and bounded recovery. If integration is explicitly included, inspect ownership and conflict scope, preserve actual resulting commit and rerun affected gates; otherwise do not merge. |
| 4 | runtime, environment, repo | evidence | Probe actual served source/build identity, endpoints and stability using declared checks. A started PID or build success alone does not prove the target is serving the selected code. |
| 5 | target, runtime | node, resource, evidence | Record actual state, partial effects and source-versus-served mapping, then stop. No account/fixture/deploy action is automatically performed. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| runtime | Declared health and served-version evidence are observed on the actual target with correct owned generation. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- only authorized start/stop/restart/build or integration action on owned runtime

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| RUNTIME_OWNER_CONFLICT | Target/process/port is foreign, ambiguous or changed concurrently. |
| RUNTIME_EFFECT_UNAUTHORIZED | Required start/reset/merge/configuration change exceeds selected action. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
