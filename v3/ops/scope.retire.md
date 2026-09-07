# scope.retire

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Retire exactly the selected business/resource scope while preserving required evidence and live consumers.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| inventory | selected nodes/resources + incoming refs + actual Git worktree inventory | Read selected retirement request, stable IDs, live incoming references, retention/custody requirements, tracked/dirty/untracked artifacts and exact worktree registrations. A folder called .worktrees is not evidence of disposable content. |
| authority | explicit retirement/deletion scope + durable storage policy | Read exact selected removals and recovery constraints; default retirement is a scoped metadata decision, not recursive deletion. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; dependsOn; refs; assertions; required | Write only the explicitly authorized retirement decision/scope before review; preserve stable IDs and obligations. Actual removal/retention observations belong in evidence. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/retirement-inventory.json + E/retention-check.json + E/removal.json only when selected + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record exact artifacts, ownership, safe destinations, verified hashes/readability and selected removal outcomes/recovery limitations; never copy secret plaintext. Operator-specific observed result in E/result.md: Record retired scope, actual decision authority, replacement IDs where applicable, consumer dispositions and retention/access policy. Preserve stable identities and do not relabel unfinished required work na without a real scope decision. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | inventory, authority, repo, target | evidence | Inventory exact selected nodes/resources, Git state, image/evidence/account custody references and all live consumers. Distinguish custom durable .worktrees artifacts from Git-managed checkouts. |
| 2 | inventory, authority | node | Resolve consumer preserve/replace/defer/retire dispositions and retention/recovery obligations. Missing decision or custody blocks deletion, not the read-only inventory. |
| 3 | inventory, authority, repo | evidence | Verify required durable artifacts are retained and retrievable at approved destinations before any explicitly selected deletion. Resolve absolute targets, symlink/junction boundaries and worktree registration; never broad recursive delete a workspace/root. |
| 4 | inventory, authority, repo | evidence | Execute only separately authorized exact retirement effects, preferring reversible operations and appropriate Git worktree lifecycle. Preserve uncommitted/untracked user work; uncertain ownership stops removal. |
| 5 | target, inventory, authority | node, evidence | Validate surviving references/readability and report what was retired, actually removed, retained and recoverable. Stop; no opportunistic cleanup of adjacent work. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| retention | No required live consumer or sole evidence/custody copy is lost; exact selected effects and recovery status are observed. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- explicit retirement metadata and separately authorized exact destructive actions only

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| RETIREMENT_UNSAFE | Exact target, user ownership, consumer disposition or durable retention is unresolved. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
