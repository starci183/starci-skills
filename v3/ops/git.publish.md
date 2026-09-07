# git.publish

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Publish only the explicitly selected verified Git commit/ref boundary and read it back.

Kind/profile: `release`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| publication | actual Git remote/ref policy + selected commits/evidence + explicit publish request | Read target remote/ref, exact delivered full SHAs, changed-file scope, hooks and required checks. A local commit request is not push, tag, PR, merge or cleanup permission. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/git-publication.json + E/hook-output.txt + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record observed local/remote refs before/after, exact command/exit, verified diff/ancestry and checks at the actual integrated head. Operator-specific observed result in E/result.md: Record original, integrated and published full SHAs separately, target ref and actual publication result; no worktree cleanup implied. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | repo, publication, target | node | Verify explicit selected remote/ref/action and full source commits; inspect dirty changes and staged scope without absorbing unrelated work. |
| 2 | repo, publication | evidence | Inspect current remote and local refs, branch policy and required checks/hooks. If integration is included, review exact diff/conflicts and retest the actual result; no amend/rebase/squash or force as a workaround. |
| 3 | publication, repo | evidence | Perform only explicitly requested integration/publication action, non-force and with hooks preserved. Tag/PR actions occur only when named; rejected or uncertain effects require read-back before retry. |
| 4 | publication, repo, target | node, evidence | Read target ref back and compare exact expected SHA, record true lineage and limits, then stop without deleting branch/worktree/evidence or stopping runtime. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| published-ref | Actual remote/ref equals selected verified publication; failed hook/push or unresolved remote read-back is not success. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- explicitly authorized local integration and/or non-force remote publication

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| PUBLISH_NOT_AUTHORIZED | Requested scope does not authorize this remote/ref/tag/integration effect. |
| GIT_DIVERGED | Unexpected divergence, hook failure or dirty overlap prevents safe selected publication. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
