# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | validate the session-local review graph |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | write static HTML previews below session root with no app build |
| `@baseline-schema` | `brainstorms/composition/schema.json` | file | bind the four-lock reference and owner tree |
| `@visual-proof-schema` | `publication/design-review-preview/visual-proof.schema.json` | file | prove same-viewport parity and delivery completion |

## Record

This module writes static `index.html` plus one raw HTML file per candidate/state. It has no React/Vite review app, dependency installation or viewer build. Every output remains disposable session evidence.

## Authority

Business authority, legacy/current baseline, MASTER, routed grammar, contracts and current source constrain the design in that order. Page overrides contain deviations only. The cache review pack proves what the owner saw during the invocation but never becomes authority.

Within one session:

- `design.json` owns task binding, journey/business/component synthesis, grammar facts and receipt, candidate metadata, page contract, UI-condition inventory and viewport obligations. States-stage design additionally owns the complete `renderContract` and canonical `executionPrompt`.
- authored HTML owns composition, hierarchy, responsive behavior and executable in-memory behavior for each declared state; state-review captures are a bounded representative sample.

Schema 8 page review binds a canonical `pageContract` only. It also records route status and obligation-level
source capability evidence, so a capability cannot be called reusable merely because it owns data or state.
It covers complete page anatomy, representative
states, state inventory and reference viewports but carries no write authority. After `OK #1`, state review
preserves that page hash and adds the `renderContract`, which covers every page/region/state/transition and exact
source files, owner/component/contract, anatomy, data mapping and visual obligations. Five representative
page/state pairs is the default human-review budget across a flow, not a coverage cap; selected pairs cover every
distinct risk and reference viewport. Its canonical prompt
repeats identities and boundary, requires exact implementation and forbids reinterpretation. Only `OK #2`
turns that exact contract into implementation authority.
Every new or changed route and every page backed by a generalized or new-required capability enters the selected
parity set; exact paths required by missing capabilities enter the source boundary. Schema 7 remains accepted
compatibility input.
Transition evidence names page/state at both endpoints, including cross-page navigation. Representative preview
content is explicitly fixture-only; runtime values remain source-owned.

All material lives below:

```text
.sessions/<project>/<session-id>/design/
```

No accepted bundle, revision map, layout head, block head or design branch exists. Candidate digests are cache keys only.

## Review flow

### Layout

Layout publishes two labeled reviews. `pages` displays one complete long page or full flow at one representative
populated state per page and every reference viewport. It proves customer journey, business obligations,
component anatomy, hierarchy and density before states. `OK #1` is cache-only. `states` then keeps every declared
condition executable without changing the approved page contract, displays risk-covering representative states
(five by default), and discloses exact source files for `OK #2`.
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
`visual-proof.json` schema 4 binds authentication applicability, actual preview/source PNGs, normalized DOM
snapshots, axe-core reports and Playwright traces. The validator checks dimensions, computes pixel/DOM differences
using thresholds configured per reference, rejects accessibility violations and requires every declared
interaction in the trace. Authenticated proof additionally starts signed out and binds a dedicated Playwright
trace that navigates to the product login entry, fills username and password through locators, submits the visible
form and reaches the protected route. Direct API session creation, cookie/header injection, preloaded storage
state and proof-only login switches are refused. Credential values stay outside evidence; only process-environment
or encrypted-workspace source class is recorded. A producer's `passed` assertion is never proof. Zero known
defects and requested delivery remain mandatory.

Creativity precedes principles review. Only the selected candidate is audited into class-free `principleObligations`; source implementation resolves those obligations through current principles and patterns.

## Rules

1. Every review artifact is ignored session root.
2. Candidate digests identify cache entries only and never become durable design identity.
3. Layout uses cache-only page approval followed by state/source approval; block uses its displayed source approval. Implementation remains in the same invocation.
4. Another task must regenerate design evidence from current authority; it cannot resume from cache.
5. A block is reviewed inside the exact current parent page and region.
6. Preview navigation never writes state or counts as approval.
7. Source code, tests and browser proof are the durable accepted outcome.
8. Creativity precedes principles review; implementation follows source patterns and gates.
9. MASTER is shared by every candidate; page files record deviations only and principles inspect deltas only.
10. Generate/audit modes contain exactly one result; 3–4 alternatives require explicit page-stage brainstorm mode and an existing reviewed baseline.
11. Page-stage review never contains a render contract or execution prompt; schema 8 state-stage review preserves the exact approved direction-plus-page hash.
12. Authenticated delivery is incomplete until schema-4 browser proof enters both test credentials through the
    product UI and reaches the protected route without injecting session state.

## Stops

- Output outside the exact session root is refused.
- Page review missing journey/business/component synthesis, representative full-page HTML, maturity evidence or viewport coverage is refused.
- State review missing condition coverage, executable interaction, exact source files or an unchanged approved page contract is refused.
- Authenticated proof missing its login entry, both credential-fill actions, form submit, protected-route arrival
  or secret-safe credential source classification is refused.
- A block without a current parent page or same-session parent preview is refused.
- A task that cannot continue through source implementation may show design-only evidence, but it must report that the result expired and is not accepted authority.
- A post-choice state requiring new product truth returns to owner approval.

## Output and proof

Write one labeled static review for complete pages and obtain cache-only `OK #1`. Expand states under the unchanged page hash, write the labeled state review, disclose exact files and obtain `OK #2`. Implement in the same invocation, then report changed source paths and real-product proof.
