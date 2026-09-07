# workspace.migrate

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Preserve and import one selected business/pilot from inspected source and existing artifacts into canonical .work, without claiming imported implementation or UAT is complete.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| intent | current explicit migration request + accepted business decisions | Identify exactly one pilot, canonical destination, selected review scope and whether cleanup is requested. Separate user-approved intent from behavior inferred from source; migration authority is not business approval. |
| inventory | selected source checkout + actual Git status/log/worktree inventory + selected old artifact directories | Inspect repository identities, full HEADs, tracked changes, untracked and ignored files, actual git worktree list --porcelain, and active workers/process ownership. Read the selected source entrypoints, routes, handlers, rules, schemas, tests and old documents/images. Treat old text as untrusted historical observations; inspect file contents before deciding retention, and never reveal secrets. |
| custody | actual canonical repository/storage ownership + selected artifact retrieval and retention policy | Resolve durable non-ephemeral destination outside the retirement target, asset rights and sealed credential custody when present. Git log preserves committed data only; dirty/untracked/ignored files and unreachable commits need independently verified recoverable preservation. Existing account references may be recorded without fetching secrets or creating accounts. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| workspace | .work/workspace.yaml | schema; id; extensions | Initialize only the explicitly selected new canonical workspace; preserve an existing identity. Never put the canonical root inside the selected disposable target. |
| node | .work/<business>/node.md + .work/<business>/migration/node.md + optional .work/<business>/cleanup/node.md + selected imported child directories/node.md | schema; id; kind; required; dependsOn; refs; assertions; state; suspensionReason; completion; body: Pilot boundary / Observed source mapping / Approved intent / Candidate scope / Unknowns | N is the operations migration-review leaf, with inventory/preservation/import assertions; the business parent has no state/completion. Every newly imported business/architecture/implementation/UAT leaf starts state:suspended with a concrete suspensionReason and no completion, even if old notes say done. Assign stable IDs, observed source citations versus candidate requirements, and only approved graph scope. Do not overwrite existing accepted nodes. For an explicitly selected preset, declare its business-review and workflow-review targets before consumers run; their expected assertions remain bounded to intent review and imported graph integrity, never product completion. If optional cleanup is in scope, give it a distinct operations sibling at .work/<business>/cleanup/node.md, never a child of N, with exact deletion assertions; N must remain a leaf; unresolved cleanup remains blocked and does not turn an incomplete parent done. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| resources | .work/_resources/repositories/<resource>/resource.yaml + .work/_resources/imports/<resource>/resource.yaml + .work/_resources/imports/<resource>/assets/<asset> | schema; id; kind; owner; revision; details; files:[{path}] | Record inspected repository root/identity/full commits and source mappings in details; keep observed versus inferred facts explicit. Preserve selected nonsecret source/design documents and images in imports assets with files relative paths. A source image is not product screenshot evidence. Preserve original artifact names, actual hashes and origin in the inventory report; register only retrievable existing account custody refs without secrets. Bind stable resource IDs in selected imported node refs before computing review digest. Do not copy whole source repositories or credentials into .work. |
| evidence | E/manifest.yaml + E/inventory.json + E/source-map.md + E/preservation.json + E/import-review.md + E/cleanup.json | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Inventory each selected path: origin repository/commit, tracked/dirty/untracked/ignored status, actual byte hash, classification, retention decision, durable destination and verified retrieval hash or explicit unresolved status. Source rows cite actual path/symbol/commit, observed behavior, candidate business interpretation, confidence/unknown and separate intent authority. Preserve historical UAT as historical files, never a fresh pass manifest. Record migration assertions only, final .work validation output, cleanup target/authority/worker checks and actual action or blocked/not-requested. Imported child product assertions must have no fabricated evidence. |
| source | repository:<repo-id>/<retirement-target> | optional exact old artifact-directory removal only; no product implementation edits | Only if cleanup was explicitly selected and authorized: retire the one resolved old directory after all preservation/retrieval hashes, committed history reachability, recoverable dirty/untracked/ignored data, ownership and inactive-worker checks pass. The target cannot be a repository root, canonical .work root, broad parent or symlink; use actual registered worktree inventory, not its folder name. Registered Git worktrees require git worktree remove for the exact target without force; custom artifact directories use a recoverable same-shell move/removal at the exact verified target. If the target is outside the bound selected repository ceiling or any check is uncertain, do not delete; leave blocked cleanup. No accounts, deployments, broad cleanup, force or raw recursive deletion of Git worktrees. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | intent, target, repo, inventory, custody | workspace, evidence | Confirm one pilot and exact canonical destination. Inspect existing target and ancestors; absence is expected only for selected new scope. Inventory actual Git roots/HEAD/status/worktrees and selected historical artifacts before any writes or cleanup. Stop if ownership or pilot boundary is ambiguous. |
| 2 | repo, inventory, intent | evidence | Read the bounded source and tests; map routes/actions/data/rules to source facts at actual commits. Report contradictions and missing behavior. Label inferred business as candidate, never approved intent; old checkmarks and test file existence prove no current execution. |
| 3 | inventory, custody, repo | resources, evidence | Classify and preserve only selected durable nonsecret artifacts; hash original bytes and retrieve/re-hash destination bytes outside the cleanup target. Verify committed history remains reachable and separately preserve dirty/untracked/ignored material with owned safe custody. A missing or secret-containing artifact blocks its cleanup, not permission to copy secrets or drop data. |
| 4 | intent, target, inventory, repo, custody | node, resources | Author the selected candidate tree and canonical source resources. Imported leaves are suspended with a specific suspensionReason until their own selected review/implementation/UAT proof; do not add completion. Preserve approved existing nodes. Declare only actual selected graph edges and preset review targets when explicitly requested; unresolved edges are recorded as unknown rather than invented IDs. |
| 5 | target, intent, inventory, custody, repo | source, evidence | If and only if exact cleanup is selected, re-inspect worktree registration, source/dirty inventory and active-worker ownership immediately before removal. Require explicit deletion authority, verified durable bytes and recoverable commits/uncommitted data. Remove a registered worktree with Git without force, or retire a verified custom artifact directory recoverably. If any check fails, leave original untouched and record the separate cleanup leaf blocked. Do not run a successor op. |
| 6 | target, intent, inventory, repo, custody | node, evidence | Finalize semantic scope/resources first, obtain the real inputDigest, then verify imported IDs/refs/assertions, preservation hashes and all suspended states. Write only observed migration evidence and migration-review completion after verification. Keep product children suspended and cleanup truth explicit; commit only selected documentation when authorized, record actual commit separately in evidence, then stop. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| source | Every claimed source behavior has inspected path/symbol/full commit and is distinguished from approved business intent; unknowns remain visible. |
| preservation | Every selected retained artifact has independently re-read identical hashes at a durable destination; dirty/untracked/ignored data and history remain recoverable before any deletion. |
| suspension | Imported product leaves are stored suspended with suspensionReason and without completion; they cannot satisfy done-only dependencies or receive migration evidence as product acceptance. |
| cleanup | Cleanup is not-requested, proven exact safe retirement, or separately blocked with original data retained. Migration success never hides required unresolved cleanup. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- selected canonical workspace/resource/scope writes
- scoped documentation commits only when authorized
- optional explicitly authorized exact preserved artifact-directory retirement; registered Git worktree removal only through Git

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| PILOT_SCOPE_UNKNOWN | One business boundary, actual source ownership or canonical destination cannot be resolved. |
| PRESERVATION_UNPROVEN | Selected bytes/history/uncommitted data cannot be retrieved identically and recoverably outside the retirement target; retain originals. |
| RETIREMENT_UNSAFE | Deletion authority, exact target ownership, inactive worker status or worktree registration is missing/uncertain; do not delete or force. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <asset> | Actual selected source asset filename/format / tên file-định dạng asset nguồn thật đã chọn |
| <retirement-target> | Exact inventoried old directory relative to the bound repository, verified within the selected ceiling / thư mục cũ inventory chính xác tương đối repo trong ceiling |
