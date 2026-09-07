# library.update

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Repair or consume one selected owner-package change with package and consumer proof kept distinct.

Kind/profile: `implementation`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| library | .work/_resources/libraries/<resource>/resource.yaml + actual package/consumer manifests | Read selected owner package, consumer list, exact version/integrity, exports/API, regression and chosen mode repair/pack/consume/publish. Do not default to patch bump or publication without version policy/scope. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Only exact owned paths in the approved code-scope, with smallest required caller/integration changes; record actual diff and commit mapping, not proposed changes as delivered. |
| resource | .work/_resources/libraries/<resource>/resource.yaml | id; kind; owner; revision; details.package; details.version; details.integrity; details.ownerRepository; details.consumerRefs; details.evidenceRef | Record only actual packed/published/consumed identities and verified package API; not a hypothetical release. |
| evidence | E/manifest.yaml + E/package-tests.json + E/consumer-tests.json + E/package-integrity.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Keep owner regression/build/pack output and consumer before/after test output at their own revisions; package integrity from actual archive/registry read-back. Operator-specific observed result in E/result.md: Bind distinct package and consumer repos/commits, selected release integrity and actual before/after regression. A repaired library alone does not mean consumers adopted it. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, repo, library | — | Inspect canonical owner and exact consumer dependency; reproduce selected regression and verify mode/write ceilings. Consumer workaround is not an owner repair. |
| 2 | repo, library | source, evidence | For selected owner repair, add regression, fix source within package scope, run package checks and apply actual version policy only when needed. For consume-only, do not modify package source. |
| 3 | repo, library | resource, evidence | For selected pack/publish, pack actual tested commit and record integrity; publish only with explicit registry authority and read back exact served version/integrity. |
| 4 | repo, library | source, evidence | For selected consume, update exact manifests/lockfile, verify installed bytes/version/integrity, rerun unchanged consumer regression and required gates. Do not silently patch unrelated consumers. |
| 5 | target, repo, library | node, resource, evidence | Review and commit each selected source piece, retain per-repo lineage and package-versus-consumer verdicts, then stop with any unselected adoption/publication explicit. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| commit | Inspect exact staged diff and actual tests; bind full real source commit(s), per repository, and separately retain integration/tested mappings. Report uncommitted or no-change honestly. |
| library | Selected package and/or consumer behavior passes at verified exact identities; packed is not published, published is not consumed, consumed is not regression-tested. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- selected package/consumer source or metadata edits
- scoped commits when authorized
- registry publication only when explicitly included

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| LIBRARY_OWNER_UNKNOWN | Required owner, consumer boundary, version policy or release integrity is ungrounded. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
