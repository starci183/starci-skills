# Clinical trial safety signal triage

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `clinical-trial-safety-signal-triage` |
| Family | Work |
| Dominant task | Triage a potential safety signal across a clinical-trial program by comparing exposed populations and background/arm rates, reviewing the linked adverse-event case series and causality gaps, validating the signal, and assigning a documented risk action |
| Search aliases | clinical-trial-safety-signal-triage, signal-triage, signal-history |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `signal-triage` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CTS-01` | The user must triage a potential safety signal across a clinical-trial program by comparing exposed populations and background/arm rates, reviewing the linked adverse-event case series and causality gaps, validating the signal, and assigning a documented risk action | Require the dominant task. |
| `AR-CTS-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-CTS-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-CTS-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-CTS-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-CTS-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-CTS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `clinical-trial-safety-signal-triage` if and only if `AR-CTS-01` through `AR-CTS-04` are evidenced, every named region and relationship is required, and none of `AR-CTS-90` through `AR-CTS-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ signal-triage
├─ product-program-exposure-and-period-context
├─ candidate-signal-queue
├─ adverse-event-case-series
├─ treatment-arm-denominator-and-background-rate
├─ imbalance-time-to-onset-and-subgroup-analyses
├─ selected-case-causality-and-data-gaps
├─ validation-and-prioritization
├─ assessment-or-risk-action-plan
└─ signal-history
```

Required relationship: `signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series ↔ treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `signal-triage` | Owns the state and decision of `signal-triage`; preserves its relationship with downstream `product-program-exposure-and-period-context` without absorbing another region's owner. |
| `product-program-exposure-and-period-context` | Owns the state and decision of `product-program-exposure-and-period-context`; preserves its relationship with upstream `signal-triage` and downstream `candidate-signal-queue` without absorbing another region's owner. |
| `candidate-signal-queue` | Owns the state and decision of `candidate-signal-queue`; preserves its relationship with upstream `product-program-exposure-and-period-context` and downstream `adverse-event-case-series` without absorbing another region's owner. |
| `adverse-event-case-series` | Owns the state and decision of `adverse-event-case-series`; preserves its relationship with upstream `candidate-signal-queue` and downstream `treatment-arm-denominator-and-background-rate` without absorbing another region's owner. |
| `treatment-arm-denominator-and-background-rate` | Owns the state and decision of `treatment-arm-denominator-and-background-rate`; preserves its relationship with upstream `adverse-event-case-series` and downstream `imbalance-time-to-onset-and-subgroup-analyses` without absorbing another region's owner. |
| `imbalance-time-to-onset-and-subgroup-analyses` | Owns the state and decision of `imbalance-time-to-onset-and-subgroup-analyses`; preserves its relationship with upstream `treatment-arm-denominator-and-background-rate` and downstream `selected-case-causality-and-data-gaps` without absorbing another region's owner. |
| `selected-case-causality-and-data-gaps` | Owns the state and decision of `selected-case-causality-and-data-gaps`; preserves its relationship with upstream `imbalance-time-to-onset-and-subgroup-analyses` and downstream `validation-and-prioritization` without absorbing another region's owner. |
| `validation-and-prioritization` | Owns the state and decision of `validation-and-prioritization`; preserves its relationship with upstream `selected-case-causality-and-data-gaps` and downstream `assessment-or-risk-action-plan` without absorbing another region's owner. |
| `assessment-or-risk-action-plan` | Owns the state and decision of `assessment-or-risk-action-plan`; preserves its relationship with upstream `validation-and-prioritization` and downstream `signal-history` without absorbing another region's owner. |
| `signal-history` | Owns the state and decision of `signal-history`; preserves its relationship with upstream `assessment-or-risk-action-plan` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Signal queue, arm/exposure context, population analyses, linked case series, causality gaps and action plan remain visible; a selected case never replaces the denominator view
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `signal-triage` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Population imbalance and selected signal status remain primary; case series and subgroup/time-to-onset analyses alternate in synchronized panes, while action priority persists
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `signal-triage` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Select signal → verify trial arms/exposure period → inspect observed-versus-expected and subgroup/time-to-onset → review linked serious cases → resolve causality/data gaps → validate and prioritize → assign action → history; population evidence precedes case detail and the surface is not a dossier stack
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `signal-triage` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series → treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes signal new/under review/validated/refuted/closed, exposure denominator pending/stale/ready, case serious/non-serious/duplicate/unavailable, arm imbalance absent/present/uncertain, time-to-onset or subgroup analysis insufficient/ready, causality related/unrelated/indeterminate, data request pending/received/failed, priority recalculating, action drafted/approved/overdue and history amended.

## State obligations

Task-specific states: signal new/under review/validated/refuted/closed, exposure denominator pending/stale/ready, case serious/non-serious/duplicate/unavailable, arm imbalance absent/present/uncertain, time-to-onset or subgroup analysis insufficient/ready, causality related/unrelated/indeterminate, data request pending/received/failed, priority recalculating, action drafted/approved/overdue and history amended.

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

- Template must triage a fictional event across two trial arms, distinguish a missing denominator from a zero event rate, reveal a subgroup/time-to-onset imbalance, link but not over-weight two serious cases, request missing causality data, change validation/priority with an announced reason, and preserve the signal history after closure
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the result is `risk-impact-likelihood-overview`, `evidence-led-case-resolution-dossier`, `diagnostic-evidence-bundle-review` or `asynchronous-outcome-tracker`; a trial-program signal queue, treatment-arm denominators, population imbalance analyses, linked multi-case review, validation state and risk-action lifecycle are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CTS-90`, `AR-CTS-91`, or `AR-CTS-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [FDA safety reporting requirements for INDs and BA/BE studies](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/safety-reporting-requirements-inds-and-babe-studies) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ICH E2A clinical safety data management](https://database.ich.org/sites/default/files/E2A_Guideline.pdf) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [EMA signal management](https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/pharmacovigilance-post-authorisation/signal-management) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "clinical-trial-safety-signal-triage",
  "matchedSituationCodes": [
    "AR-CTS-01",
    "AR-CTS-02",
    "AR-CTS-03",
    "AR-CTS-04"
  ],
  "aliases": [
    "clinical-trial-safety-signal-triage",
    "signal-triage",
    "signal-history"
  ],
  "dominantTask": "Triage a potential safety signal across a clinical-trial program by comparing exposed populations and background/arm rates, reviewing the linked adverse-event case series and causality gaps, validating the signal, and assigning a documented risk action",
  "regions": [
    "signal-triage",
    "product-program-exposure-and-period-context",
    "candidate-signal-queue",
    "adverse-event-case-series",
    "treatment-arm-denominator-and-background-rate",
    "imbalance-time-to-onset-and-subgroup-analyses",
    "selected-case-causality-and-data-gaps",
    "validation-and-prioritization",
    "assessment-or-risk-action-plan",
    "signal-history"
  ],
  "relationships": [
    "signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series ↔ treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history"
  ],
  "responsive": {
    "wide": "Signal queue, arm/exposure context, population analyses, linked case series, causality gaps and action plan remain visible; a selected case never replaces the denominator view",
    "intermediate": "Population imbalance and selected signal status remain primary; case series and subgroup/time-to-onset analyses alternate in synchronized panes, while action priority persists",
    "compact": "Select signal → verify trial arms/exposure period → inspect observed-versus-expected and subgroup/time-to-onset → review linked serious cases → resolve causality/data gaps → validate and prioritize → assign action → history; population evidence precedes case detail and the surface is not a dossier stack",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series → treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "signal-triage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "signal new/under review/validated/refuted/closed",
    "exposure denominator pending/stale/ready",
    "case serious/non-serious/duplicate/unavailable",
    "arm imbalance absent/present/uncertain",
    "time-to-onset or subgroup analysis insufficient/ready",
    "causality related/unrelated/indeterminate",
    "data request pending/received/failed",
    "priority recalculating",
    "action drafted/approved/overdue and history amended"
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
