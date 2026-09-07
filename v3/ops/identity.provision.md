# identity.provision

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Inspect or apply the explicitly selected identity/account change and prove the resulting actor.

Kind/profile: `operations`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read the existing selected N/node.md, ancestor scope, declared refs/dependencies/assertions and validator freshness. This consumer op requires its target node to exist. An absent target is a scope/graph gap: report it and propose a separately selected scope op; do not create a target or invent its acceptance/graph here. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Read exact target/origins, owner, configuration revision, declared probes and allowed effects; validate live observations without inferring identity from hostname alone. |
| identity | .work/_resources/identities/<identity>/resource.yaml | For authenticated/identity-changing scope, read actor alias, provider subject, roles/membership refs, environment and sealed custody reference; never print/copy credentials. Explicit anonymous scope records anonymous instead, without inventing an account resource. |
| authority | current explicit account action + provider/admin custody declaration | Read exact create/repair/rotate/inspect scope, provider realm/tenant, expected role/membership and existing authoritative account lookup. UAT access alone does not permit creating/resetting users. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Read the existing selected scope, expected assertions and .work graph unchanged. Write only state/blocker/completion here; actual observations, findings, commit mappings and remaining cleanup belong to the evidence result, not semantic node prose. Missing refs/dependencies/acceptance require a reported gap or separately selected scope update; never add/remove them to obtain pass. |
| resource | .work/_resources/identities/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.alias; details.provider; details.subject; details.roles; details.memberships; details.credentialRef; details.custodian; details.lifecycle | Store only verified non-secret identity/custody metadata. Keep environment-specific subjects distinct; never duplicate aliases to hide an uncertain existing account. |
| evidence | E/manifest.yaml + E/identity-checks.json + E/login.png when safe + E/effect.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record actual before/after account IDs, role/membership checks, real product-login verification and custody resolution by name. Omit credentials/tokens/cookies and secret-bearing screenshots. Operator-specific observed result in E/result.md: Separate provider account creation, role assignment, backend membership and real product login; mark each unknown/failure honestly. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | target, authority, environment, identity, business | — | Confirm exact authorized action and expected actor permissions. Inspect existing account by provider subject/alias; uncertainty triggers read-only reconciliation, not another create. |
| 2 | authority, identity, environment | evidence | Resolve sealed custody using available permitted secret mechanism without printing values; inspect realm/tenant, membership source and credential lifecycle ownership. |
| 3 | authority, identity, business, environment | resource, evidence | Apply only requested missing/invalid owned identity changes. Reuse valid accounts; do not add admin privileges, reset passwords or edit another tenant as a workaround. Inspect-only mode performs no provider writes. |
| 4 | identity, environment, business | evidence | Verify provider subject/roles and normal backend membership independently, then actual product login if requested. A token or redirected URL alone does not prove the actor reached intended product content. |
| 5 | target, authority, identity | node, resource, evidence | Publish names/refs and actual observed action outcome; rotation additionally proves new custody works and obsolete credential rejection only when rotation is selected. Stop without fixture creation. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| actor | Selected desired identity state and required real login/membership checks pass; provider existence alone cannot certify complete UAT actor readiness. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

- only explicitly authorized account create/repair/rotation; existing account use is not creation authority

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| ACCOUNT_AUTHORITY_MISSING | The next identity mutation exceeds the explicit selected account action. |
| CUSTODY_UNAVAILABLE | Approved sealed credential mechanism or account ownership cannot be verified. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
