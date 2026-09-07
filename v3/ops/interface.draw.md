# interface.draw

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Produce and inspect the requested visual direction for one business-grounded surface.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| design | .work/_resources/design/<resource>/resource.yaml + selected architecture/interface node | Read exact brand/source assets, surface anatomy, current design system, imagery rights/provenance and accepted references; consult available image/design skill when used. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or unrelated receipt requirement. |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Read relevant observation topics for the selected assertions; use only applicable accepted criteria, actual measurements and available instruments, not unselected execution machinery. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | body: Brief / Regions / States / Assets / Direction decision / Implementation limits; assertions | Specify actor/task, content authority, hierarchy, region anatomy, native controls, asset purpose/medium, responsive constraints and acceptance mapping. Record actual selected direction or unresolved material choice. |
| evidence | E/manifest.yaml + E/direction.png or actual requested format + E/prompt.txt + E/visual-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Retain actual generated/drawn image and tool provenance, full prompt when relevant, inspected fidelity findings and separate asset identities. A generated drawing proves no product behavior. |
| designSource | .work/_resources/design/<resource>/resource.yaml + .work/_resources/design/<resource>/assets/<asset> | files:[{path}]; details: accepted direction identity / source provenance | Write the selected approved art-direction asset as a canonical source input, with files paths relative to its resource.yaml directory. The core hashes actual bytes; do not author a sha256 field in files. Preserve the selected node graph: if its design resource/ref is missing, report the scope gap instead of silently adding a dependency. Generated/captured evidence images are not automatically design authority. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, design | node | Freeze the selected brief and content/region mapping, labelling placeholder/example copy. Choose a code-native/vector or raster medium matching the request; do not force ImageGen where not appropriate. |
| 2 | business, design | evidence, designSource | Use the available appropriate tool/skill to create the requested direction; retain the actual output and provenance. Missing tool means blocked output, never a claimed generated image. |
| 3 | target, design, business | node, evidence, designSource | Open and inspect actual output for business contradictions, hierarchy, component ownership, legibility, responsive feasibility and each independent asset. Distinguish subjective judgement from measured geometry. |
| 4 | target, design | node, evidence | Present the actual direction. Reuse accepted choice; ask only if materially different alternatives were requested and selection remains open. Stop without frontend code. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| visual | Actual visual bytes opened and reviewed against the brief; dimensions/tool provenance recorded; no UI/UAT pass assigned from the drawing. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- requested local/generated design assets

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| DESIGN_INPUT_UNKNOWN | Required business content, identity asset rights or material direction choice is missing. |
| VISUAL_TOOL_UNAVAILABLE | Requested visual output cannot be produced with available permitted tools. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <asset> | Actual selected source asset filename/format / tên file-định dạng asset nguồn thật đã chọn |
