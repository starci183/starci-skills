---
name: starci-fe-design-resolve
description: Process one or more frontend design requests from .claude/knowledge/requests. Audit the source-first correction, record bad attempts in the rejects table before overwriting them, update the same request, then learn the accepted outcome into the smallest routed grammar or principle and close it with proof.
---

# starci-fe-design-resolve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approvals, progress and reporting boundary |
| `@orchestration` | `runtime/orchestration/context.md` | context | coordinate authority, source and proof without split decisions |
| `@requests` | `knowledge/requests/context.md` | context | select and close durable feedback records |
| `@workspaces` | `knowledge/contexts/workspaces/context.md` | context | resolve the project and FE role |
| `@worktrees` | `knowledge/contexts/worktrees/context.md` | context | resolve durable authority and product write roots |
| `@business` | `knowledge/contexts/business/context.md` | context | preserve or explicitly block on product truth |
| `@grammar` | `knowledge/grammars/context.md` | context | own product-family outcomes, meaning, owners and behavior |
| `@principles` | `knowledge/compilers/principles/context.md` | context | own reusable product-neutral visual situations |
| `@patterns-fe` | `knowledge/compilers/patterns/fe/context.md` | context | bind corrections to exact FE owners |
| `@frontend-quality` | `knowledge/brainstorms/frontend-quality/context.md` | context | challenge unresolved UI direction when one is required |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | choose proportional execution depth |
| `@validate-request` | `scripts/validate-design-request.mjs` | script | validate request transitions and closure |
| `@compile-context` | `scripts/compile-context.mjs` | script | rebuild runtime context after authority changes |
| `@check-deps` | `scripts/check-deps.mjs` | script | prove authority dependency graphs |
| `@lints-fe` | `runtime/gates/fe/lints/context.md` | context | prove implemented frontend source |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce same-state, same-viewport proof when visual |

## NESTED SKILLS

None.

## IMPACT ROUTING

Run `@classify-fe-change` for every selected request. Exact specified corrections use `micro`; one component uses
`component`; page or flow anatomy uses `page`; reusable or cross-surface changes use `capability`/`cross-domain`.
Batch only requests with compatible expected outcomes, authority targets and non-conflicting source boundaries.

An explicit owner ruling is sufficient to evolve the routed product grammar for that product. Evolve a principle
only when the situation is product-neutral and supported by reusable evidence. Every resolved request must leave a
durable executable regression in the routed grammar or principle layer, even when the original law was sound and
the failure was source application or enforcement.

## PIPELINE

Topology: `reconciliation` from queued owner feedback through authority and product evidence.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| select | shared | explicit ids or all `open` requests | validate, order, deduplicate and lock a compatible batch | immutable request batch and impact classification | no conflicting outcomes or foreign dirt |
| audit-source | reconciliation | request evidence, routed business truth and source-first correction | reproduce each outcome, accept the attempt or prepare its reject/replacement, and classify the durable lesson | source verdict, proposed reject refs, impact cone and authority disposition | no source is overwritten during audit; business changes are accepted or blocked |
| source-authority-boundary | decision | source verdict, grammar, principles and any unresolved UI/flow choice | review direction only where a decision remains open, then publish exact reject/source/authority/proof batch | approved immutable write batch | manual approval or bound `mode=auto`; no scope widening |
| correct-source | execution | approved source verdict and replacement | when wrong, append the reject row first, overwrite source, update the same request and prove the replacement | final source attempt, reject refs and source proof | rejected evidence exists before replacement; expected outcome is observable |
| encode-authority | execution | approved lesson and correct source evidence | update the smallest grammar/principle record and executable regression, then compile and check dependencies | authority receipts bound to final source | authority expresses the accepted outcome without false generalization |
| prove-close | proof | final source, evolved authority and selected requests | rerun targeted gates and real-product proof, update the same requests and close them | passing proof and `resolved` records | every request has authority, final source, proof and reject refs; zero known defect |

## Approval modes

`manual` is default. Exact `mode=auto` binds approval to the displayed immutable request set and write boundary.
It cannot add requests, authority roots, product repositories, credentials, external publication, package release,
push or deployment. Those actions still require authority in the user's request.

## Run

Read `@skill-shape`, `@requests` and `@orchestration`, resolve `defaultLang`, then select explicit request ids. If
the invocation says to process the queue without ids, select all `open` requests in `(createdOn, id)` order and
split incompatible batches rather than merging their decisions.

Reproduce the exact states and audit the source-first attempt already recorded in the request. When it is wrong,
prepare one reject row and replacement inside the displayed write boundary. After approval, append that immutable
row to `knowledge/requests/rejects.json` before overwriting source, add its id to the same request, and prove the replacement.
Never create a second request for the same expected outcome. Classify the durable lesson as business-authority gap,
grammar ruling/gap, principle gap, pattern-or-gate gap, source application miss or drift.

UI feedback with a fully specified expected outcome needs no alternative direction. For an unresolved design or
flow choice, show one complete functional direction by default; show 3–4 only when the owner explicitly asks to
brainstorm. User-flow changes may reorder or clarify existing outcomes and transitions only when routed business
truth supports them; new actors, operations, entitlements, routes or backend capability block the request pending
business authority.

After the final source attempt is correct, update English/Vietnamese authority records and executable cases from
that evidence, compile runtime context and run dependency/authority gates. Re-run the real connected product at
risk-covering states/viewports so authority did not invalidate the source result. Only then keep implementation
`applied`, proof `passed`, write resolution/reject refs and mark each request `resolved`.

## Rules

1. Process only valid records under `.claude/knowledge/requests`; never resolve feedback from memory alone.
2. Source is corrected before authority learning; every resolved request cites at least one final product source path and changes at least one routed grammar or principle path.
3. Grammar owns product-specific meaning and behavior; principles own reusable product-neutral visual situations.
4. Owner feedback is decisive about expected product outcome but remains evidence, not an automatic diagnosis.
5. Do not manufacture business truth, backend capability, routes, states or data operations.
6. A wrong source attempt is recorded in `knowledge/requests/rejects.json` before it is overwritten; the same request gains the reject ref.
7. Micro corrections stay micro when anatomy and ownership are fixed; authority regression does not force a full layout ceremony.
8. Conflicting request outcomes require owner reconciliation before implementation.
9. Preserve unrelated dirty files and use exact write boundaries.
10. Closure requires authority compilation, targeted source gates, real-product proof and valid request/reject records.
11. Push, publish, release, deploy and provider changes occur only when explicitly authorized.

## Stops

- A selected request is invalid, already owned by another active resolution or conflicts with the batch.
- Required business truth or backend capability is missing.
- Authority targets cannot be resolved or principle generalization lacks reusable evidence.
- A failed source attempt cannot be preserved in the rejects table before replacement.
- Pre-existing target changes cannot be attributed and preserved safely.
- Required credentials, approval or real-product state are unavailable.
- A known defect remains or closure would lack authority, source or proof references.

## OUTPUT

Report selected request ids, per-request verdict, grammar/principle changes, affected product owners, tests and real
product proof, final status and any blocked requests. Distinguish authority gaps from application/enforcement misses.
