# architecture.decide

English runtime authority; generated from the maintained operator authoring sources.

Read [the common protocol](common.md) and this document completely before acting.

## Specific goal

Resolve a bounded design into real repository ownership, contracts and implementable code scope.

Kind/profile: `architecture`. Select exact target nodes from the current request; never run the whole tree automatically.

## The graph lives in .work, not in the op

This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.

## Required reads and grounding authority

| ID | Read location | Content / authority |
| --- | --- | --- |
| target | N/node.md | Read current target, ancestor scope, refs, dependencies, assertions and validator freshness. For an explicitly new target, absence is expected: inspect the nearest existing ancestor/workspace, then create only that selected scope. Preserve unaffected accepted content. |
| business | .work/<business>/business/**/node.md | Read accepted requirements, decisions, constraints and acceptance IDs declared as relevant inputs in the selected .work graph. Intent governs expected behavior; source is not a replacement. Do not invent a mandatory BA predecessor for a scope that does not require one; a needed missing input is a reported graph/scope gap, not a new dependency silently added here. |
| repo | repository:<repo-id>/<bound-paths> | When source exists/is selected, resolve repository resource, actual checkout/root/HEAD and dirty state; read applicable instructions, manifests, owning code, callers and relevant tests. Greenfield/spec-only work records source not-yet-created and grounds intent in the user request; no invented repository or fact citation. Source implementation still needs an actual selected writable repository. |
| constraints | selected resource contracts + actual package/deployment manifests | Read exact versions, deployment topology and data constraints; compatibility claims need source/documentation or experiments, not memory. |

## Conditional domain references

| Source | When to read |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Only when the selected backend actually uses the documented NestJS family; inspect actual current code before adopting a topic. This is a topic index, not v2 routing. |

## Exact writes and field/content matrix

| ID | Destination | Fields / sections | Required content |
| --- | --- | --- | --- |
| node | .work/<business>/architecture/<piece>/node.md | body: Observed system / Decision / Alternatives / Data ownership / Operations / API & events / Failure modes / Code scope / Verification / Open risks; refs; dependsOn; assertions; required | For each operation specify caller, owner/writer, transport, request/response/errors, authorization, stores, transaction, idempotency/concurrency, event ordering, migrations and acceptance IDs. Code scope rows name repository ID, existing/proposed path, symbol/module, create/modify/delete intent, responsibility, callers, protected paths, tests and prerequisites. Graph edits apply only to the explicitly selected approved scope: declare real prerequisite node IDs in dependsOn and semantic input node/resource IDs in refs. No catalogue-wide chain or new unrelated scope; finish all graph/spec changes before review proof. |
| evidence | E/manifest.yaml + E/source-map.json + E/design-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Record observed current source map and compatibility checks; selected alternative/risk review is design proof, not a passing runtime. |

## Ordered bounded procedure

| # | Read IDs | Write IDs | Action and check |
| --- | --- | --- | --- |
| 1 | repo, constraints, target | evidence | Inspect current entrypoints, dependency graph, composition/DI, persistence and deployment files before proposing boundaries. Record what is unknown and actual existence/absence of candidate paths. |
| 2 | business, constraints, repo | node | Map each accepted outcome to one enforcing owner and each store to its authoritative writer; state read-only consumers, tenant isolation and sanctioned shared writes. |
| 3 | business, constraints | node | Choose the smallest design meeting hard constraints; compare materially different alternatives when the decision warrants it. Document trade-offs, backward compatibility, rollout/migration, rollback limits and operational failure modes. |
| 4 | business, repo, constraints | node | Specify API/event contracts and every mutation transaction, retry and concurrency policy. A framework list is not architecture; ambiguous writer or data ownership is a blocker. |
| 5 | repo, business | node | Resolve concrete source paths and symbols with caller wiring, tests and protected boundaries. New files remain proposed until created; no claim that a guessed module already exists. |
| 6 | target, business, repo, constraints | evidence | Review AC coverage, ownership contradictions, adverse paths and compatibility evidence. If independent review is requested, use only authorized available delegation; otherwise label self-review honestly. Stop after the design result. |

## Proof and completion requirements

| ID | Required observation |
| --- | --- |
| binding | Run workspace validation; every cited ID/path exists or is explicitly proposed, required assertions are covered, input bindings are current, and an honest not-run/fail cannot earn done. |
| implementability | Every selected operation has an owner, actual/proposed repo-path scope and test instrument; every required business outcome maps to a contract. No source implementation claim. |

Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.

## Side effects and ownership boundary

Only scoped metadata/evidence writes; no product or external-service mutation.

This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.

## Blockers and stop

| Code | Condition / missing fact |
| --- | --- |
| OWNERSHIP_UNKNOWN | An operation/store has no determined owner or required write crosses another owner without scope. |
| COMPATIBILITY_UNKNOWN | A required version, contract or migration compatibility claim lacks evidence. |
| DECLARED_DEPENDENCY_UNMET | A declared prerequisite is not effectively done, or a required declared input/scope is missing. Report node/resource IDs and propose a separately selected graph update when needed; never run predecessors or weaken dependsOn/refs/required to proceed. |

Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.

## Placeholder resolution

N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.

| Placeholder | Value source |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <piece> | Stable selected piece slug / slug piece đã chọn |
