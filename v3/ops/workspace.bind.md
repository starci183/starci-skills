# workspace.bind

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Bind the selected repository and canonical .work location to verified local identities.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| declaration | current explicit repository scope + .work/_resources/repositories/<resource>/resource.yaml | Read explicit task location/repository selection and existing portable identity. A directory name, cwd or similar remote is only a hint when identity is unresolved. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/repositories/<resource>/resource.yaml | id; kind; owner; revision; details.identity; details.remote; details.defaultRef; details.sourceRoots; details.workRootRef | Create/repair only the explicitly selected repository declaration from verified Git metadata; machine-specific checkout paths stay local or observations, not portable identity. |
| evidence | E/manifest.yaml + E/repository-observation.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record actual Git root/common-dir, branch/full HEAD, worktree registration, dirty paths and link targets; secrets in remote URLs must be removed. Operator-specific observed result in E/result.md: Record stable repo identity and observed checkout/head separately, permitted source write ceiling and canonical work-root location; do not mistake Git worktree for durable evidence storage. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | declaration, target | evidence | Resolve exact Git root/common directory and remote identity using read-only Git inspection. Inspect existing .work ownership and avoid creating a second canonical tree. |
| 2 | declaration | evidence | Inspect actual branch/HEAD, registered worktree and unrelated dirty paths; resolve source links/junctions before suggesting a write ceiling. Do not stash/reset/clean/switch/remove. |
| 3 | target, declaration | node, resource | Bind only verified identity and chosen portable refs, preserving user scope and existing IDs. Record missing identity or conflicting roots together. |
| 4 | target, declaration | evidence | Validate references and report checkout readiness separately from runtime readiness; no server, account, Git worktree or platform task is created. Stop. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| identity | Observed Git identity matches selected repo scope and canonical .work binding; unresolved identity cannot become an invented resource. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| REPOSITORY_AMBIGUOUS | Explicit selection and observed root/remote disagree or multiple canonical work roots remain. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
