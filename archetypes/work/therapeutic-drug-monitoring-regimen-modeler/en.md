# Therapeutic drug monitoring regimen modeler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `therapeutic-drug-monitoring-regimen-modeler` |
| Family | Work |
| Dominant task | Reconstruct dose and timed-concentration history, estimate an exposure state with uncertainty, compare candidate regimens against a therapeutic window and toxicity/efficacy trade-off, then recommend a regimen plus the next informative sample |
| Search aliases | therapeutic-drug-monitoring-regimen-modeler, tdm-modeler, follow-up-receipt |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `tdm-modeler` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-TDM-01` | The user must reconstruct dose and timed-concentration history, estimate an exposure state with uncertainty, compare candidate regimens against a therapeutic window and toxicity/efficacy trade-off, then recommend a regimen plus the next informative sample | Require the dominant task. |
| `AR-TDM-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-TDM-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-TDM-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-TDM-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-TDM-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-TDM-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `therapeutic-drug-monitoring-regimen-modeler` if and only if `AR-TDM-01` through `AR-TDM-04` are evidenced, every named region and relationship is required, and none of `AR-TDM-90` through `AR-TDM-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ tdm-modeler
├─ patient-drug-and-target-context
├─ administered-dose-event-timeline
├─ timed-concentration-samples
├─ fitted-pk-state-and-uncertainty
├─ therapeutic-exposure-window
├─ candidate-regimen-projections
├─ efficacy-toxicity-tradeoff
├─ recommended-regimen-and-next-sample-plan
└─ follow-up-receipt
```

Required relationship: `tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline ↔ timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `tdm-modeler` | Owns the state and decision of `tdm-modeler`; preserves its relationship with downstream `patient-drug-and-target-context` without absorbing another region's owner. |
| `patient-drug-and-target-context` | Owns the state and decision of `patient-drug-and-target-context`; preserves its relationship with upstream `tdm-modeler` and downstream `administered-dose-event-timeline` without absorbing another region's owner. |
| `administered-dose-event-timeline` | Owns the state and decision of `administered-dose-event-timeline`; preserves its relationship with upstream `patient-drug-and-target-context` and downstream `timed-concentration-samples` without absorbing another region's owner. |
| `timed-concentration-samples` | Owns the state and decision of `timed-concentration-samples`; preserves its relationship with upstream `administered-dose-event-timeline` and downstream `fitted-pk-state-and-uncertainty` without absorbing another region's owner. |
| `fitted-pk-state-and-uncertainty` | Owns the state and decision of `fitted-pk-state-and-uncertainty`; preserves its relationship with upstream `timed-concentration-samples` and downstream `therapeutic-exposure-window` without absorbing another region's owner. |
| `therapeutic-exposure-window` | Owns the state and decision of `therapeutic-exposure-window`; preserves its relationship with upstream `fitted-pk-state-and-uncertainty` and downstream `candidate-regimen-projections` without absorbing another region's owner. |
| `candidate-regimen-projections` | Owns the state and decision of `candidate-regimen-projections`; preserves its relationship with upstream `therapeutic-exposure-window` and downstream `efficacy-toxicity-tradeoff` without absorbing another region's owner. |
| `efficacy-toxicity-tradeoff` | Owns the state and decision of `efficacy-toxicity-tradeoff`; preserves its relationship with upstream `candidate-regimen-projections` and downstream `recommended-regimen-and-next-sample-plan` without absorbing another region's owner. |
| `recommended-regimen-and-next-sample-plan` | Owns the state and decision of `recommended-regimen-and-next-sample-plan`; preserves its relationship with upstream `efficacy-toxicity-tradeoff` and downstream `follow-up-receipt` without absorbing another region's owner. |
| `follow-up-receipt` | Owns the state and decision of `follow-up-receipt`; preserves its relationship with upstream `recommended-regimen-and-next-sample-plan` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Dose/sample timeline, fitted state, exposure window, candidate projections and trade-off/recommendation remain simultaneously linked; changing a timing fact invalidates dependent estimates visibly
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `administered-dose-event-timeline` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Dose/sample timing and one candidate projection remain primary; model uncertainty and alternative regimens become synchronized drawers, while target-window status persists
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `administered-dose-event-timeline` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify actual doses → place/confirm timed samples → inspect fitted exposure with tabular interval alternative → compare one candidate regimen at a time → review efficacy/toxicity → choose regimen → schedule next sample → follow-up receipt; no stack of miniature curves
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `administered-dose-event-timeline` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline → timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes dose event confirmed/missed/uncertain, sample time valid/ambiguous/missing, assay result pending/available/flagged, fit calculating/converged/poor/unavailable, uncertainty acceptable/wide, exposure below/within/above target, candidate feasible/contraindicated, recommendation draft/signed/superseded, next sample scheduled/missed and follow-up received/overdue.

## State obligations

Task-specific states: dose event confirmed/missed/uncertain, sample time valid/ambiguous/missing, assay result pending/available/flagged, fit calculating/converged/poor/unavailable, uncertainty acceptable/wide, exposure below/within/above target, candidate feasible/contraindicated, recommendation draft/signed/superseded, next sample scheduled/missed and follow-up received/overdue.

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

- Template must place two fictional concentrations relative to confirmed and uncertain dose events, make the ambiguity widen or invalidate the fitted estimate, compare two regimens against a visible exposure window, choose one only after toxicity review, schedule a next sample, and announce follow-up without moving focus
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology is `microplate-dose-response-analysis-workbench`, `scenario-sensitivity-modeler`, `multichannel-waveform-analysis-workbench` or a medication calculator; actual dose-event/sample timing, fitted exposure uncertainty, therapeutic target window, projected alternative regimens and a closed-loop next-sample plan are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-TDM-90`, `AR-TDM-91`, or `AR-TDM-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [FDA analysis of therapeutic drug monitoring in drug labels](https://www.fda.gov/science-research/fda-stem-outreach-education-and-engagement/analysis-therapeutic-drug-monitoring-drug-labels) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [FDA Population Pharmacokinetics guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/population-pharmacokinetics) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [EMA reporting population pharmacokinetic analyses guideline](https://www.ema.europa.eu/en/reporting-results-population-pharmacokinetic-analyses-scientific-guideline) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "therapeutic-drug-monitoring-regimen-modeler",
  "matchedSituationCodes": [
    "AR-TDM-01",
    "AR-TDM-02",
    "AR-TDM-03",
    "AR-TDM-04"
  ],
  "aliases": [
    "therapeutic-drug-monitoring-regimen-modeler",
    "tdm-modeler",
    "follow-up-receipt"
  ],
  "dominantTask": "Reconstruct dose and timed-concentration history, estimate an exposure state with uncertainty, compare candidate regimens against a therapeutic window and toxicity/efficacy trade-off, then recommend a regimen plus the next informative sample",
  "regions": [
    "tdm-modeler",
    "patient-drug-and-target-context",
    "administered-dose-event-timeline",
    "timed-concentration-samples",
    "fitted-pk-state-and-uncertainty",
    "therapeutic-exposure-window",
    "candidate-regimen-projections",
    "efficacy-toxicity-tradeoff",
    "recommended-regimen-and-next-sample-plan",
    "follow-up-receipt"
  ],
  "relationships": [
    "tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline ↔ timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt"
  ],
  "responsive": {
    "wide": "Dose/sample timeline, fitted state, exposure window, candidate projections and trade-off/recommendation remain simultaneously linked; changing a timing fact invalidates dependent estimates visibly",
    "intermediate": "Dose/sample timing and one candidate projection remain primary; model uncertainty and alternative regimens become synchronized drawers, while target-window status persists",
    "compact": "Verify actual doses → place/confirm timed samples → inspect fitted exposure with tabular interval alternative → compare one candidate regimen at a time → review efficacy/toxicity → choose regimen → schedule next sample → follow-up receipt; no stack of miniature curves",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline → timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "administered-dose-event-timeline",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "dose event confirmed/missed/uncertain",
    "sample time valid/ambiguous/missing",
    "assay result pending/available/flagged",
    "fit calculating/converged/poor/unavailable",
    "uncertainty acceptable/wide",
    "exposure below/within/above target",
    "candidate feasible/contraindicated",
    "recommendation draft/signed/superseded",
    "next sample scheduled/missed and follow-up received/overdue"
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
