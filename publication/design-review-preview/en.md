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

- `design.json` owns task binding, journey/business/component synthesis, grammar facts and receipt, candidate metadata, page contract, UI-condition inventory and viewport obligations. States-stage design additionally owns the complete `renderContract` and canonical `executionPrompt`.
- authored HTML owns composition, hierarchy, responsive behavior and executable in-memory behavior for each declared state; state-review captures are a bounded representative sample.

Schema 7 page review binds a canonical `pageContract` only. It covers complete page anatomy, representative
states, state inventory and reference viewports but carries no write authority. After `OK #1`, state review
preserves that page hash and adds the `renderContract`, which covers every page/region/state/transition and exact
source files, owner/component/contract, anatomy, data mapping and visual obligations. Its `renders` select no more
than five representative page/state pairs across the whole flow and cover every reference viewport for each
selected state. Its canonical prompt
repeats identities and boundary, requires exact implementation and forbids reinterpretation. Only `OK #2`
turns that exact contract into implementation authority.
Transition evidence names page/state at both endpoints, including cross-page navigation. Representative preview
content is explicitly fixture-only; runtime values remain source-owned.

All material lives below:

```text
.worktrees/<project>/cache/design/<session-id>/
```

No accepted bundle, revision map, layout head, block head or design branch exists. Candidate digests are cache keys only.

## Review flow

### Layout

Layout publishes two labeled reviews. `pages` displays one complete long page or full flow at one representative
populated state per page and every reference viewport. It proves customer journey, business obligations,
component anatomy, hierarchy and density before states. `OK #1` is cache-only. `states` then keeps every declared
condition executable without changing the approved page contract, displays no more than five representative
states selected for risk and transition coverage, and discloses exact source files for `OK #2`.
Only explicit page-stage `brainstorm` displays three or four targeted alternatives.

### Block

Default `audit` displays the one Layout-generated block inside its complete parent page and reports pass or exact correction. Only explicit block `brainstorm` displays three or four anatomies inside the same parent geometry.

## Canvas law

The product canvas contains authored product HTML only. It never inserts generic templates, rough cards, schema labels, hashes or evidence chrome. Review controls remain outside the canvas.

Every candidate is a self-contained HTML document with deterministic in-memory behavior. It covers every evidenced viewport, overlay, disclosure, async, data, permission and interaction condition. Irrelevant condition families are explicitly `not-applicable`. Product controls, not a QA-only switcher, reach declared transitions. Network access and backend mutation are forbidden.

Representative content must be business-faithful and production-like. Lorem, generic cards, toy counts, repeated filler and partial owned surfaces are blocking defects.

## Quality proof

Before each layout approval, schema 2 maturity evidence binds either page contract (`reviewStage: pages`) or
the render contract's bounded selected pairs (`reviewStage: states`) to real full-viewport captures and zero
defects. After implementation, review every selected preview/source pair at the exact baseline viewport/state.
`visual-proof.json` schema 2 binds
the selected candidate and render-contract identities, records distinct real preview/source capture paths for
each pair, and requires parity plus explicit `mismatches: []`, zero known defects and the requested delivery
state. Computed CSS supports but never replaces those captures.

Creativity precedes principles review. Only the selected candidate is audited into class-free `principleObligations`; source implementation resolves those obligations through current principles and patterns.

## Rules

1. Every review artifact is ignored project cache.
2. Candidate digests identify cache entries only and never become durable design identity.
3. Layout uses cache-only page approval followed by state/source approval; block uses its displayed source approval. Implementation remains in the same invocation.
4. Another task must regenerate design evidence from current authority; it cannot resume from cache.
5. A block is reviewed inside the exact current parent page and region.
6. Preview navigation never writes state or counts as approval.
7. Source code, tests and browser proof are the durable accepted outcome.
8. Creativity precedes principles review; implementation follows source patterns and gates.
9. MASTER is shared by every candidate; page files record deviations only and principles inspect deltas only.
10. Generate/audit modes contain exactly one result; 3–4 alternatives require explicit page-stage brainstorm mode and an existing reviewed baseline.
11. Page-stage review never contains a render contract or execution prompt; state-stage review preserves the exact approved page hash.

## Stops

- Output outside the exact project cache is refused.
- Page review missing journey/business/component synthesis, representative full-page HTML, maturity evidence or viewport coverage is refused.
- State review missing condition coverage, executable interaction, exact source files or an unchanged approved page contract is refused.
- A block without a current parent page or same-session parent preview is refused.
- A task that cannot continue through source implementation may show design-only evidence, but it must report that the result expired and is not accepted authority.
- A post-choice state requiring new product truth returns to owner approval.

## Output and proof

Write one labeled static review for complete pages and obtain cache-only `OK #1`. Expand states under the unchanged page hash, write the labeled state review, disclose exact files and obtain `OK #2`. Implement in the same invocation, then report changed source paths and real-product proof.
