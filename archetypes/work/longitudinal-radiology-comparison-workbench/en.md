# Longitudinal radiology comparison workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `longitudinal-radiology-comparison-workbench` |
| Family | Work |
| Dominant task | Compare a current imaging study with selected prior studies, track named findings and measurements through time, compose a comparison impression, communicate critical results, and preserve report/addendum lineage |
| Search aliases | longitudinal-radiology-comparison-workbench, radiology-comparison, report-or-addendum-version |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `radiology-comparison` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-LRC-01` | The user must compare a current imaging study with selected prior studies, track named findings and measurements through time, compose a comparison impression, communicate critical results, and preserve report/addendum lineage | Require the dominant task. |
| `AR-LRC-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-LRC-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-LRC-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-LRC-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-LRC-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-LRC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `longitudinal-radiology-comparison-workbench` if and only if `AR-LRC-01` through `AR-LRC-04` are evidenced, every named region and relationship is required, and none of `AR-LRC-90` through `AR-LRC-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ radiology-comparison
├─ patient-and-study-timeline
├─ current-plus-multiple-prior-series-pairing
├─ synchronized-display-set
├─ named-finding-identity-ledger-across-dates
├─ per-finding-measurement-and-change-trajectory
├─ comparison-impression
├─ critical-result-communication
└─ report-or-addendum-version
```

Required relationship: `radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set ↔ named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `radiology-comparison` | Owns the state and decision of `radiology-comparison`; preserves its relationship with downstream `patient-and-study-timeline` without absorbing another region's owner. |
| `patient-and-study-timeline` | Owns the state and decision of `patient-and-study-timeline`; preserves its relationship with upstream `radiology-comparison` and downstream `current-plus-multiple-prior-series-pairing` without absorbing another region's owner. |
| `current-plus-multiple-prior-series-pairing` | Owns the state and decision of `current-plus-multiple-prior-series-pairing`; preserves its relationship with upstream `patient-and-study-timeline` and downstream `synchronized-display-set` without absorbing another region's owner. |
| `synchronized-display-set` | Owns the state and decision of `synchronized-display-set`; preserves its relationship with upstream `current-plus-multiple-prior-series-pairing` and downstream `named-finding-identity-ledger-across-dates` without absorbing another region's owner. |
| `named-finding-identity-ledger-across-dates` | Owns the state and decision of `named-finding-identity-ledger-across-dates`; preserves its relationship with upstream `synchronized-display-set` and downstream `per-finding-measurement-and-change-trajectory` without absorbing another region's owner. |
| `per-finding-measurement-and-change-trajectory` | Owns the state and decision of `per-finding-measurement-and-change-trajectory`; preserves its relationship with upstream `named-finding-identity-ledger-across-dates` and downstream `comparison-impression` without absorbing another region's owner. |
| `comparison-impression` | Owns the state and decision of `comparison-impression`; preserves its relationship with upstream `per-finding-measurement-and-change-trajectory` and downstream `critical-result-communication` without absorbing another region's owner. |
| `critical-result-communication` | Owns the state and decision of `critical-result-communication`; preserves its relationship with upstream `comparison-impression` and downstream `report-or-addendum-version` without absorbing another region's owner. |
| `report-or-addendum-version` | Owns the state and decision of `report-or-addendum-version`; preserves its relationship with upstream `critical-result-communication` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Study timeline, synchronized current/prior display, finding ledger, measurement trend and impression remain linked; changing a finding or prior updates every projection without discarding viewport context
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `patient-and-study-timeline` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Current/prior comparison remains primary with the active finding; timeline compresses to an explicit prior selector and measurement history/impression alternate in a synchronized secondary pane
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `patient-and-study-timeline` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Choose one named finding → review current state → step through at least two selected priors with matched location and a date-keyed measurement table → confirm the multi-date trajectory → write the comparison statement → communicate if critical → sign/addendum; simultaneous images yield to controlled alternation, while finding identity and the full prior sequence remain persistent
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `patient-and-study-timeline` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set → named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes current or prior loading/unavailable, series unmatched/matched, registration uncertain, finding new/stable/improved/worsened/resolved, measurement missing/changed/conflicting, comparison stale after prior change, critical communication pending/acknowledged/failed, report draft/signed/addendum, permission-limited study and focus restored after prior selection.

## State obligations

Task-specific states: current or prior loading/unavailable, series unmatched/matched, registration uncertain, finding new/stable/improved/worsened/resolved, measurement missing/changed/conflicting, comparison stale after prior change, critical communication pending/acknowledged/failed, report draft/signed/addendum, permission-limited study and focus restored after prior selection.

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

- Template must pair a fictional current study with at least two priors, preserve one named finding across every date, expose a missing comparable series without collapsing to a two-study result, switch to a date-keyed textual trajectory on compact, announce a critical communication receipt, and create an addendum without overwriting the signed impression
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology is `orthogonal-volume-slice-inspector`, `spatial-change-detection-workbench`, `multichannel-microscopy-analysis-workbench` or `timeline-audit-explorer`; a two-image change view or generic timeline is insufficient. Named finding identity across current plus multiple priors, date-keyed measurement trajectory, comparison impression and critical-result receipt are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-LRC-90`, `AR-LRC-91`, or `AR-LRC-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [DICOM Hanging Protocol Information Model](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.44.3.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ACR Practice Parameter for Communication of Diagnostic Imaging Findings](https://gravitas.acr.org/PPTS/GetDocumentView?docId=74) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "longitudinal-radiology-comparison-workbench",
  "matchedSituationCodes": [
    "AR-LRC-01",
    "AR-LRC-02",
    "AR-LRC-03",
    "AR-LRC-04"
  ],
  "aliases": [
    "longitudinal-radiology-comparison-workbench",
    "radiology-comparison",
    "report-or-addendum-version"
  ],
  "dominantTask": "Compare a current imaging study with selected prior studies, track named findings and measurements through time, compose a comparison impression, communicate critical results, and preserve report/addendum lineage",
  "regions": [
    "radiology-comparison",
    "patient-and-study-timeline",
    "current-plus-multiple-prior-series-pairing",
    "synchronized-display-set",
    "named-finding-identity-ledger-across-dates",
    "per-finding-measurement-and-change-trajectory",
    "comparison-impression",
    "critical-result-communication",
    "report-or-addendum-version"
  ],
  "relationships": [
    "radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set ↔ named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version"
  ],
  "responsive": {
    "wide": "Study timeline, synchronized current/prior display, finding ledger, measurement trend and impression remain linked; changing a finding or prior updates every projection without discarding viewport context",
    "intermediate": "Current/prior comparison remains primary with the active finding; timeline compresses to an explicit prior selector and measurement history/impression alternate in a synchronized secondary pane",
    "compact": "Choose one named finding → review current state → step through at least two selected priors with matched location and a date-keyed measurement table → confirm the multi-date trajectory → write the comparison statement → communicate if critical → sign/addendum; simultaneous images yield to controlled alternation, while finding identity and the full prior sequence remain persistent",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set → named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "patient-and-study-timeline",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "current or prior loading/unavailable",
    "series unmatched/matched",
    "registration uncertain",
    "finding new/stable/improved/worsened/resolved",
    "measurement missing/changed/conflicting",
    "comparison stale after prior change",
    "critical communication pending/acknowledged/failed",
    "report draft/signed/addendum",
    "permission-limited study and focus restored after prior selection"
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
