# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | validate the session-local review graph |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | render authored candidates below project cache |
| `@baseline-schema` | `brainstorms/composition/schema.json` | file | bind the four-lock reference and owner tree |
| `@visual-proof-schema` | `publication/design-review-preview/visual-proof.schema.json` | file | prove same-viewport parity and delivery completion |

## Record

This module displays layout and block choices without becoming product authority. Every candidate, selected composition, screenshot and manifest is disposable session evidence. The skill that obtains owner approval implements the selected outcome in frontend source before the same invocation ends.

## Authority

Business authority, legacy/current baseline, MASTER, routed grammar, contracts and current source constrain the design in that order. Page overrides contain deviations only. The cache review pack proves what the owner saw during the invocation but never becomes authority.

Within one session:

- `design.json` owns the task binding, business/contract ownership, grammar facts and receipt, candidate metadata, principle obligations, UI-condition inventory, transition graph and viewport obligations.
- authored HTML owns composition, hierarchy, responsive behavior and executable rendering for each declared state.

All material lives below:

```text
.worktrees/<project>/cache/design/<session-id>/
```

No accepted bundle, revision map, layout head, block head or design branch exists. Candidate digests are cache keys only.

## Review flow

### Layout

Display three or four complete standalone authored page/page-flow candidates using the same product-backed content and viewport set. Existing source-bound nodes remain unchanged between choices. Rank candidates and recommend one. After approval, the same skill invocation implements the selected composition and proves it in the product.

### Block

Display three or four materially different block candidates inside the exact current parent page and region geometry. The parent comes from current routed source or a parent preview created earlier in the same invocation. After approval, the same skill invocation updates the owning frontend source and proves the complete page.

## Canvas law

The product canvas contains authored product HTML only. It never inserts generic templates, rough cards, schema labels, hashes or evidence chrome. Review controls remain outside the canvas.

Every candidate is a self-contained HTML document with deterministic in-memory behavior. It covers every evidenced viewport, overlay, disclosure, async, data, permission and interaction condition. Irrelevant condition families are explicitly `not-applicable`. Product controls, not a QA-only switcher, reach declared transitions. Network access and backend mutation are forbidden.

Representative content must be business-faithful and production-like. Lorem, generic cards, toy counts, repeated filler and partial owned surfaces are blocking defects.

## Quality proof

Review every candidate and result at the exact baseline viewport/state pairs. Prove the full viewport, target region and preserved regions; computed CSS supports but never replaces this comparison. `visual-proof.json` must record zero known defects and reach the requested delivery state.

Creativity precedes principles review. Only the selected candidate is audited into class-free `principleObligations`; source implementation resolves those obligations through current principles and patterns.

## Rules

1. Every review artifact is ignored project cache.
2. Candidate digests identify cache entries only and never become durable design identity.
3. Layout/block approval and source implementation occur in the same skill invocation.
4. Another task must regenerate design evidence from current authority; it cannot resume from cache.
5. A block is reviewed inside the exact current parent page and region.
6. Preview navigation never writes state or counts as approval.
7. Source code, tests and browser proof are the durable accepted outcome.
8. Creativity precedes principles review; implementation follows source patterns and gates.
9. MASTER is shared by every candidate; page files record deviations only and principles inspect deltas only.

## Stops

- Output outside the exact project cache is refused.
- Missing authored candidate/state HTML, condition coverage, executable interaction or viewport coverage is refused.
- A block without a current parent page or same-session parent preview is refused.
- A task that cannot continue through source implementation may show design-only evidence, but it must report that the result expired and is not accepted authority.
- A post-choice state requiring new product truth returns to owner approval.

## Output and proof

Publish one cache review application, identify the recommended candidate and exact source boundary, obtain approval once, implement in the same invocation, then report changed source paths and real-product proof. Do not report revision hashes or registry heads.
