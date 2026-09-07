# interface.audit

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Inspect actual rendered selected screens and record truthful visual acceptance independently of implementation.

Kind/profile: `uat.ui`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| identity | .work/_resources/identities/<identity>/resource.yaml | For authenticated/identity-changing scope, read actor alias, provider subject, roles/membership refs, environment and sealed custody reference; never print/copy credentials. Explicit anonymous scope records anonymous instead, without inventing an account resource. |
| design | .work/_resources/design/<resource>/resource.yaml + accepted visual evidence | Read actual accepted design/state/viewport expectations and relevant installed UI proof rules; do not require a nonexistent universal design grammar. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Read relevant observation topics for the selected assertions; use only applicable accepted criteria, actual measurements and available instruments, not unselected execution machinery. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/<screen>.png + E/measurements.json + E/runtime.json + E/review.md + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Capture real image bytes, viewport/theme/route/state and actual DOM/computed measurements. Provenance includes environment, actor or anonymous, servedVersions, tool, capturedAt, servedVersionEvidence assertion. Images must be opened and inspected. Operator-specific observed result in E/result.md: Bind environment, actor or anonymous and all served repositories in refs. Record current findings without restyling source or altering acceptance. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, repo, design | node | Select only the requested screen/state matrix and acceptance assertions. Read actual implementation ownership and accepted design; do not substitute a generated concept for the target. |
| 2 | environment, identity, repo, target | evidence | Apply common browser provenance and isolation protocol. Verify actual rendered product login/state and served build, not just URL/HTTP 200. Anonymous paths explicitly omit authenticated identity. |
| 3 | design, target, environment | evidence | Reach each selected state using observed controls, capture actual viewport/theme and retain local hashed images. Inspect the images for hierarchy, density, text/content, overflow, responsive arrangement and reference fidelity. |
| 4 | design, target, business | evidence | Measure applicable contrast, computed layout, focus/keyboard behavior and motion/reduced-motion with actual tool observations. Label subjective design judgement separately from numeric measurements. |
| 5 | target, design | node, evidence | Write per-assertion pass/fail/not-run/inconclusive and owner-routed defects. Missing runtime/capture is a blocker; known visual failure remains fail. Validate and stop without source fixes or UAT behavioral certification. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| visual | Required UI assertions pass with real inspected local PNG/JPEG/WebP assets and passing served-version observation. Hash integrity alone is insufficient. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- authorized navigation/sign-in and non-destructive UI state setup

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| CAPTURE_UNAVAILABLE | Selected state cannot be reached/captured on the verified product runtime. |
| IDENTITY_UNPROVEN | Guarded state lacks authorized actor/custody or real authenticated product content. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <screen> | Selected surface/state slug / slug screen-state đã chọn |
