# release.deploy

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Deploy one authorized immutable artifact to one target and verify actual steady state or explicit rollback outcome.

Kind/profile: `release`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| release | .work/_resources/releases/<resource>/resource.yaml + selected quality/UAT/migration evidence | Read immutable artifact digest, source mapping, configuration/schema compatibility, intended target/revision, required gates, deployment authority, previous safe digest and recovery limits. Quality pass is not deploy permission. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/releases/<resource>/resource.yaml | id; kind; owner; revision; details.artifact; details.sourceRefs; details.configurationRef; details.target; details.deploymentEvidence | Keep immutable artifact identity and actual deployment evidence; do not retag/rebuild and call it the same release. |
| evidence | E/manifest.yaml + E/deployment.json + E/probes.json + E/recovery.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain actual target generation/digest before/after, requested command/tool outcome, probe observations over declared stability interval and bounded recovery/rollback effects. Operator-specific observed result in E/result.md: Name actual deployed/restored identity and unresolved acceptance; rollback success is not delivery of the rejected release. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, release, environment, repo | node | Verify explicit deploy authority, exact immutable artifact/source mapping and required current quality/UAT/schema admissions. Record approved deferrals without turning them into passes. |
| 2 | release, environment | evidence | Inspect actual active release/target/config revisions, artifact availability and rollback viability; compare again immediately before mutation. |
| 3 | release, environment | resource, evidence | Deploy exact artifact through available authorized provider mechanism. Do not modify DNS/host/credentials/schema unless those exact effects are included. |
| 4 | release, environment | evidence | Observe declared useful health/readiness probes and active digest through a bounded stability interval. Detect concurrent target changes before any recovery; only authorized bounded same-release recovery/rollback can run. |
| 5 | release, target | node, resource, evidence | Report deployed, failed, uncertain or restored identity accurately, keep partial effects and unmet probes, validate and stop. No source fixes, wider provisioning or release chain. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| deployment | Actual target runs intended immutable artifact and required probes hold for the declared window; a single green probe is not steady-state proof. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- exact selected deployment and explicitly bounded recovery/rollback

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| RELEASE_AUTHORITY_MISSING | Artifact/target/effect is not covered by explicit authority. |
| CONCURRENT_RELEASE | A foreign generation appeared during execution; do not roll it back. |
| STEADY_STATE_UNPROVEN | Required probes or exact served digest cannot be proved within the bounded window. |
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
