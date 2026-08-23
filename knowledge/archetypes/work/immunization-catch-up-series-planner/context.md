# Immunization catch up series planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `immunization-catch-up-series-planner` |
| Family | Work |
| Dominant task | Validate administered doses across single-antigen and combination products, credit their antigen components to concurrent series, and build the earliest valid catch-up visit bundles without restarting any valid series |
| Search aliases | immunization-catch-up-series-planner, catch-up-plan, scheduled-plan-and-registry-receipt |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `catch-up-plan` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-ICS-01` | The user must validate administered doses across single-antigen and combination products, credit their antigen components to concurrent series, and build the earliest valid catch-up visit bundles without restarting any valid series | Require the dominant task. |
| `AR-ICS-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-ICS-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-ICS-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-ICS-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-ICS-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-ICS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `immunization-catch-up-series-planner` if and only if `AR-ICS-01` through `AR-ICS-04` are evidenced, every named region and relationship is required, and none of `AR-ICS-90` through `AR-ICS-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ catch-up-plan
├─ person-age-risk-and-policy-version
├─ administered-dose-event-ledger
├─ product-to-antigen-component-map
├─ per-antigen-series-state
├─ historical-dose-validity-and-minimum-interval-rules
├─ contraindication-and-special-situation-checks
├─ candidate-visit-dose-bundles
├─ earliest-valid-date-and-series-completion-proof
└─ scheduled-plan-and-registry-receipt
```

Required relationship: `catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state ↔ historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `catch-up-plan` | Owns the state and decision of `catch-up-plan`; preserves its relationship with downstream `person-age-risk-and-policy-version` without absorbing another region's owner. |
| `person-age-risk-and-policy-version` | Owns the state and decision of `person-age-risk-and-policy-version`; preserves its relationship with upstream `catch-up-plan` and downstream `administered-dose-event-ledger` without absorbing another region's owner. |
| `administered-dose-event-ledger` | Owns the state and decision of `administered-dose-event-ledger`; preserves its relationship with upstream `person-age-risk-and-policy-version` and downstream `product-to-antigen-component-map` without absorbing another region's owner. |
| `product-to-antigen-component-map` | Owns the state and decision of `product-to-antigen-component-map`; preserves its relationship with upstream `administered-dose-event-ledger` and downstream `per-antigen-series-state` without absorbing another region's owner. |
| `per-antigen-series-state` | Owns the state and decision of `per-antigen-series-state`; preserves its relationship with upstream `product-to-antigen-component-map` and downstream `historical-dose-validity-and-minimum-interval-rules` without absorbing another region's owner. |
| `historical-dose-validity-and-minimum-interval-rules` | Owns the state and decision of `historical-dose-validity-and-minimum-interval-rules`; preserves its relationship with upstream `per-antigen-series-state` and downstream `contraindication-and-special-situation-checks` without absorbing another region's owner. |
| `contraindication-and-special-situation-checks` | Owns the state and decision of `contraindication-and-special-situation-checks`; preserves its relationship with upstream `historical-dose-validity-and-minimum-interval-rules` and downstream `candidate-visit-dose-bundles` without absorbing another region's owner. |
| `candidate-visit-dose-bundles` | Owns the state and decision of `candidate-visit-dose-bundles`; preserves its relationship with upstream `contraindication-and-special-situation-checks` and downstream `earliest-valid-date-and-series-completion-proof` without absorbing another region's owner. |
| `earliest-valid-date-and-series-completion-proof` | Owns the state and decision of `earliest-valid-date-and-series-completion-proof`; preserves its relationship with upstream `candidate-visit-dose-bundles` and downstream `scheduled-plan-and-registry-receipt` without absorbing another region's owner. |
| `scheduled-plan-and-registry-receipt` | Owns the state and decision of `scheduled-plan-and-registry-receipt`; preserves its relationship with upstream `earliest-valid-date-and-series-completion-proof` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Dose history, product-to-antigen component map, per-antigen series matrix, validity/rule evidence and candidate visit bundles remain simultaneously visible; selecting one administered product highlights every series it credits
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `administered-dose-event-ledger` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** The active antigen series and candidate visit bundle remain primary; complete history, rule provenance and other series move to synchronized drawers, while contraindications and the earliest-valid date remain persistent
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `administered-dose-event-ledger` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify person, age/risk and policy version → choose one antigen series → validate each prior dose and product component → identify the missing step and earliest valid date → add coadministerable doses to one visit bundle → resolve contraindications → schedule and record registry receipt; the full multi-series matrix yields to a bounded accessible table route instead of stacked desktop panes
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `administered-dose-event-ledger` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state → historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes history loading/duplicate/uncertain, product component known/unknown, dose valid/too-early/not-counted, series complete/incomplete/conditional, minimum interval satisfied/pending, contraindication active/cleared/unknown, visit bundle feasible/conflicted, earliest date recalculating/stale, plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded.

## State obligations

Task-specific states: history loading/duplicate/uncertain, product component known/unknown, dose valid/too-early/not-counted, series complete/incomplete/conditional, minimum interval satisfied/pending, contraindication active/cleared/unknown, visit bundle feasible/conflicted, earliest date recalculating/stale, plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with a valid next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow cancellation when safe, and announce progress. |
| Success | Confirm the exact changed scope, update dependent summaries, and preserve the next valid step. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus. |
| Responsive presentation | Wide retains simultaneity; intermediate makes low-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must import a fictional combination-vaccine history, credit at least two antigen series from one product, invalidate one too-early dose without restarting another valid series, calculate and announce an earliest date, construct a coadministration bundle, surface and resolve a contraindication, reschedule, and preserve the registry receipt after every topology change
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology could be `calendar-resource-scheduler`, `prerequisite-pathway-planner`, `rule-builder-workbench` or `stage-gated-process-record`; resource booking, course prerequisites or authored rules are insufficient. Multi-antigen component credit, per-dose validity, minimum intervals, no-restart catch-up logic and one visit satisfying several independent series are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-ICS-90`, `AR-ICS-91`, or `AR-ICS-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit thresholds.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [CDC catch-up immunization schedule](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WHO recommendations for interrupted or delayed routine immunization](https://www.who.int/publications/m/item/table-3-recommendations-for-interrupted-or-delayed-routine-immunization-summary-of-who-position-papers) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard grid semantics. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "immunization-catch-up-series-planner",
  "matchedSituationCodes": [
    "AR-ICS-01",
    "AR-ICS-02",
    "AR-ICS-03",
    "AR-ICS-04"
  ],
  "aliases": [
    "immunization-catch-up-series-planner",
    "catch-up-plan",
    "scheduled-plan-and-registry-receipt"
  ],
  "dominantTask": "Validate administered doses across single-antigen and combination products, credit their antigen components to concurrent series, and build the earliest valid catch-up visit bundles without restarting any valid series",
  "regions": [
    "catch-up-plan",
    "person-age-risk-and-policy-version",
    "administered-dose-event-ledger",
    "product-to-antigen-component-map",
    "per-antigen-series-state",
    "historical-dose-validity-and-minimum-interval-rules",
    "contraindication-and-special-situation-checks",
    "candidate-visit-dose-bundles",
    "earliest-valid-date-and-series-completion-proof",
    "scheduled-plan-and-registry-receipt"
  ],
  "relationships": [
    "catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state ↔ historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt"
  ],
  "responsive": {
    "wide": "Dose history, product-to-antigen component map, per-antigen series matrix, validity/rule evidence and candidate visit bundles remain simultaneously visible; selecting one administered product highlights every series it credits",
    "intermediate": "The active antigen series and candidate visit bundle remain primary; complete history, rule provenance and other series move to synchronized drawers, while contraindications and the earliest-valid date remain persistent",
    "compact": "Verify person, age/risk and policy version → choose one antigen series → validate each prior dose and product component → identify the missing step and earliest valid date → add coadministerable doses to one visit bundle → resolve contraindications → schedule and record registry receipt; the full multi-series matrix yields to a bounded accessible table route instead of stacked desktop panes",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state → historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "administered-dose-event-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "history loading/duplicate/uncertain",
    "product component known/unknown",
    "dose valid/too-early/not-counted",
    "series complete/incomplete/conditional",
    "minimum interval satisfied/pending",
    "contraindication active/cleared/unknown",
    "visit bundle feasible/conflicted",
    "earliest date recalculating/stale",
    "plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
