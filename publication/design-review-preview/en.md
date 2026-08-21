# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | validate the session-local review graph |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | write static HTML previews below project cache with no app build |
| `@baseline-schema` | `brainstorms/composition/schema.json` | file | bind the four-lock reference and owner tree |
| `@visual-proof-schema` | `publication/design-review-preview/visual-proof.schema.json` | file | prove same-viewport parity and delivery completion |

## Record

This module writes static `index.html` plus one raw HTML file per candidate/state. It has no React/Vite review app, dependency installation or viewer build. Every output remains disposable session evidence.

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

Default `generate` displays one complete long page or full start-to-end flow containing every block, page/step, state and transition needed for implementation. Only explicit `brainstorm` displays three or four targeted alternatives against that reviewed baseline.

### Block

Default `audit` displays the one Layout-generated block inside its complete parent page and reports pass or exact correction. Only explicit block `brainstorm` displays three or four anatomies inside the same parent geometry.

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
10. Generate/audit modes contain exactly one result; 3–4 alternatives require explicit brainstorm mode and an existing reviewed baseline.

## Stops

- Output outside the exact project cache is refused.
- Missing authored candidate/state HTML, condition coverage, executable interaction or viewport coverage is refused.
- A block without a current parent page or same-session parent preview is refused.
- A task that cannot continue through source implementation may show design-only evidence, but it must report that the result expired and is not accepted authority.
- A post-choice state requiring new product truth returns to owner approval.

## Output and proof

Write one static cache `index.html` plus raw candidate/state files, identify the result and exact source boundary, obtain approval once, implement in the same invocation, then report changed source paths and real-product proof.
