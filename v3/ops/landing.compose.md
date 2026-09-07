# landing.compose

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Specify one truthful landing-page sequence, visual ownership and asset/motion contract.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| identity | .work/_resources/design/<resource>/resource.yaml + approved content/reference assets | Read actual brand identity, claims/CTA authority, component API and references; competitor imagery or aspirational numbers cannot authorize customer logos, metrics or testimonials. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or unrelated receipt requirement. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | body: Promise / CTA / Section storyboard / Component ownership / Asset slots / Motion / Responsive / Audit contract; assertions | Each section names purpose, source-backed content, hierarchy, action, owner component/source, asset IDs/medium/rights, reduced-motion equivalent, performance budget when decided and acceptance proof. |
| evidence | E/manifest.yaml + E/composition-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain section-to-promise coverage and identity/asset/ownership review; no rendered UI result from this plan. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | business, identity, repo, target | node | Bind one truthful promise and primary action, current brand/system and existing page if any. Separate approved facts from placeholder marketing copy. |
| 2 | business, identity | node | Order sections by user understanding/task, map content and interaction to purpose, and assign shared versus application ownership without inventing unpublished component APIs. |
| 3 | identity, repo | node | Specify independent asset IDs, media choice, rights/provenance, placement/crop/responsive and accessible alternatives. Give motion triggers/end states/reduced-motion and performance measurement, not generic animation adjectives. |
| 4 | target, business, identity | evidence | Review every section/asset claim and corresponding visual/behavior audit instrument. Finish design contract only, no assets, source, preview server or publication. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| landing | Story/CTA/content/asset ownership and observable audit expectations are complete for selected scope; no unsupported commercial claim. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| LANDING_CLAIM_UNKNOWN | The intended promise/CTA, identity or factual marketing claim is not authorized. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
