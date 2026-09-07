# uat.verify

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Execute one selected real-product journey and prove its promised interaction and persistence.

Kind/profile: `uat.ux`. Select exact target nodes from the current request; never run the whole tree automatically.

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
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | When fixture inputs are needed, read their revision, owned namespace/IDs, expected precondition, creation method, cleanup owner and exact allowed deletion set; never preseed tested outcomes. Explicit no-fixture scope records why no mutable prerequisite/cleanup applies, without a fabricated fixture. |
| cases | .work/<business>/uat/<flow>/**/node.md | Read the prewritten case steps/ACs, UI versus UX scopes and required quality admissions if declared. Do not invent expected results during the run. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Read relevant observation topics for the selected assertions; use only applicable accepted criteria, actual measurements and available instruments, not old run-chain machinery. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| evidence | E/manifest.yaml + E/walk.json + E/result.json + E/screens/*.png + E/readback.json + E/runtime.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record original planned assertion IDs, actual actions and observed locators, input redactions, screenshots, feedback, persisted read-back/reload observations, exit/result status and provenance. UX includes actual passing kind:behavior assertion only when observed. Operator-specific observed result in E/result.md: Keep requirement and expected case unchanged. Bind environment, actor and served repo resources; retain actual failures and cleanup still owed. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, business, cases, repo | — | Freeze expected cases and input digest before product actions. Confirm scope/allowed mutations and required admissions at applicable source versions; absence is reported, not bypassed. |
| 2 | environment, identity, fixture, repo | evidence | Verify physical runtime/origin, served versions, configuration and actor login into real product content. Check fixture preconditions read-only; do not create accounts, seed missing outcomes or switch to another environment. |
| 3 | cases, environment, identity, fixture | evidence | Use actual browser skill/tools or permitted installed Playwright with isolated session and namespace. Discover controls from current DOM/accessibility state and perform ordered UI actions; retain failures where they occur. |
| 4 | cases, business, fixture | evidence | For each expected assertion observe actual response, UI feedback and persistent postcondition; reload/resume or use authorized read-only API/DB corroboration as specified. Direct API writes cannot stand in for UI actions. |
| 5 | cases, target | evidence | Judge appearance, interaction/experience and persistence separately. Screenshot-only is no behavior pass; unreached steps are not-run, uncertain read-back inconclusive and mismatches fail. Keep actual tool output and inspect captured images. |
| 6 | target, fixture | node, evidence | Record defects, evidence and exact remaining fixture cleanup responsibility. Perform no unselected cleanup or repair. Validate required assertions; only a fully proven selected leaf can be done. Stop after the result. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| journey | Actual controls performed the promised action; required AC observations include one passing behavior assertion, served-version proof and persistence/negative checks when required. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- declared product UI actions within isolated fixture namespace
- authorized sign-in; no provisioning or automatic cleanup

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| PREREQUISITE_UNVERIFIED | Runtime version, actor membership, fixture state or expected case is not grounded. |
| ACTION_OUTSIDE_SCOPE | Continuing requires broader account/data/service mutation than this journey permits. |
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
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
| <flow> | Selected UAT journey slug / slug journey UAT đã chọn |
