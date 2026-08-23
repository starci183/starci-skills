# Spirometry maneuver quality repeatability workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spirometry-maneuver-quality-repeatability-workbench` |
| Family | Work |
| Dominant task | Acquire and adjudicate a spirometry session maneuver by maneuver, reject technically unacceptable efforts with explicit reasons, prove repeatability across the acceptable set, derive best values from their source maneuvers, pair pre/post-bronchodilator results when present, and issue a quality-bounded interpretation |
| Search aliases | spirometry-maneuver-quality-repeatability-workbench, spirometry-quality, interpretation-and-signed-report |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `spirometry-quality` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SMQ-01` | The user must acquire and adjudicate a spirometry session maneuver by maneuver, reject technically unacceptable efforts with explicit reasons, prove repeatability across the acceptable set, derive best values from their source maneuvers, pair pre/post-bronchodilator results when present, and issue a quality-bounded interpretation | Require the dominant task. |
| `AR-SMQ-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-SMQ-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-SMQ-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-SMQ-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-SMQ-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-SMQ-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `spirometry-maneuver-quality-repeatability-workbench` if and only if `AR-SMQ-01` through `AR-SMQ-04` are evidenced, every named region and relationship is required, and none of `AR-SMQ-90` through `AR-SMQ-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ spirometry-quality
├─ session-patient-calibration-and-reference-context
├─ maneuver-queue
├─ selected-volume-time-and-flow-volume-pair
├─ maneuver-acceptability-error-ledger
├─ acceptable-maneuver-set
├─ repeatability-proof
├─ best-value-selection
├─ pre-post-bronchodilator-pairing
└─ interpretation-and-signed-report
```

Required relationship: `spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair ↔ maneuver-acceptability-error-ledger → acceptable-maneuver-set → FEV1-FVC-repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `spirometry-quality` | Owns the state and decision of `spirometry-quality`; preserves its relationship with downstream `session-patient-calibration-and-reference-context` without absorbing another region's owner. |
| `session-patient-calibration-and-reference-context` | Owns the state and decision of `session-patient-calibration-and-reference-context`; preserves its relationship with upstream `spirometry-quality` and downstream `maneuver-queue` without absorbing another region's owner. |
| `maneuver-queue` | Owns the state and decision of `maneuver-queue`; preserves its relationship with upstream `session-patient-calibration-and-reference-context` and downstream `selected-volume-time-and-flow-volume-pair` without absorbing another region's owner. |
| `selected-volume-time-and-flow-volume-pair` | Owns the state and decision of `selected-volume-time-and-flow-volume-pair`; preserves its relationship with upstream `maneuver-queue` and downstream `maneuver-acceptability-error-ledger` without absorbing another region's owner. |
| `maneuver-acceptability-error-ledger` | Owns the state and decision of `maneuver-acceptability-error-ledger`; preserves its relationship with upstream `selected-volume-time-and-flow-volume-pair` and downstream `acceptable-maneuver-set` without absorbing another region's owner. |
| `acceptable-maneuver-set` | Owns the state and decision of `acceptable-maneuver-set`; preserves its relationship with upstream `maneuver-acceptability-error-ledger` and downstream `repeatability-proof` without absorbing another region's owner. |
| `repeatability-proof` | Owns the state and decision of `repeatability-proof`; preserves its relationship with upstream `acceptable-maneuver-set` and downstream `best-value-selection` without absorbing another region's owner. |
| `best-value-selection` | Owns the state and decision of `best-value-selection`; preserves its relationship with upstream `repeatability-proof` and downstream `pre-post-bronchodilator-pairing` without absorbing another region's owner. |
| `pre-post-bronchodilator-pairing` | Owns the state and decision of `pre-post-bronchodilator-pairing`; preserves its relationship with upstream `best-value-selection` and downstream `interpretation-and-signed-report` without absorbing another region's owner. |
| `interpretation-and-signed-report` | Owns the state and decision of `interpretation-and-signed-report`; preserves its relationship with upstream `pre-post-bronchodilator-pairing` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Maneuver queue, selected volume–time and flow–volume views, acceptability findings, acceptable-set repeatability, best values and pre/post comparison remain simultaneously visible; changing a maneuver verdict invalidates every dependent proof and interpretation visibly
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `maneuver-acceptability-error-ledger` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** The selected maneuver, its paired curve views and acceptability verdict remain primary; the complete maneuver set and repeatability proof move to a synchronized rail, while best-value provenance and pre/post pairing status remain persistent
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `maneuver-acceptability-error-ledger` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify session, patient, calibration and reference context → perform or select one maneuver → inspect volume–time and flow–volume evidence with a time/volume/flow table alternative → resolve each acceptability error → admit or reject the maneuver → review acceptable-set repeatability → trace FEV1 and FVC best values to their source maneuvers → pair pre/post bronchodilator if present → interpret and sign; curves yield to one selected evidence stage plus a semantic numeric route rather than stacked miniature plots
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `maneuver-acceptability-error-ledger` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair → maneuver-acceptability-error-ledger → acceptable-maneuver-set → repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes session new/resumed/signed, patient identity matched/mismatch, calibration current/expired/failed, reference context complete/stale, maneuver queued/recording/completed/aborted, curve loading/ready/error, acceptability pending/pass/fail with cough/early-termination/start/effort reason, maneuver admitted/rejected/reinstated, acceptable set insufficient/sufficient, repeatability pending/pass/fail/stale, best value unselected/derived/invalidated, pre/post unmatched/paired/conflicting, interpretation draft/blocked/signed/amended and permission-limited prior session.

## State obligations

Task-specific states: session new/resumed/signed, patient identity matched/mismatch, calibration current/expired/failed, reference context complete/stale, maneuver queued/recording/completed/aborted, curve loading/ready/error, acceptability pending/pass/fail with cough/early-termination/start/effort reason, maneuver admitted/rejected/reinstated, acceptable set insufficient/sufficient, repeatability pending/pass/fail/stale, best value unselected/derived/invalidated, pre/post unmatched/paired/conflicting, interpretation draft/blocked/signed/amended and permission-limited prior session.

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

- Template must capture at least four fictional maneuvers, expose one cough and one early-termination acceptability failure beside their curve and numeric evidence, keep rejected efforts out of repeatability, announce when the remaining acceptable set passes or fails, trace best FEV1 and FVC to their possibly different source maneuvers, pair a post-bronchodilator set to the correct baseline, block signout after any stale verdict, and retain the same maneuver identities, quality reasons and recovery actions at every topology
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology could be `regulated-sample-selection-workbench`, `multichannel-waveform-analysis-workbench`, `longitudinal-radiology-comparison-workbench` or a generic pulmonary test report; population sampling, free waveform inspection, date comparison or final values alone are insufficient. Maneuver-level paired curve evidence, named acceptability failures, repeatability across only the acceptable set, source-bound best-value derivation and governed pre/post-bronchodilator pairing are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SMQ-90`, `AR-SMQ-91`, or `AR-SMQ-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [CDC/NIOSH current coal-worker spirometry requirements and resources](https://www.cdc.gov/niosh/cwhsp/spirometry/index.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ATS/ERS Standardization of Spirometry 2019 technical statement](https://academic.oup.com/ajrccm/article/200/8/e70/8497012) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "spirometry-maneuver-quality-repeatability-workbench",
  "matchedSituationCodes": [
    "AR-SMQ-01",
    "AR-SMQ-02",
    "AR-SMQ-03",
    "AR-SMQ-04"
  ],
  "aliases": [
    "spirometry-maneuver-quality-repeatability-workbench",
    "spirometry-quality",
    "interpretation-and-signed-report"
  ],
  "dominantTask": "Acquire and adjudicate a spirometry session maneuver by maneuver, reject technically unacceptable efforts with explicit reasons, prove repeatability across the acceptable set, derive best values from their source maneuvers, pair pre/post-bronchodilator results when present, and issue a quality-bounded interpretation",
  "regions": [
    "spirometry-quality",
    "session-patient-calibration-and-reference-context",
    "maneuver-queue",
    "selected-volume-time-and-flow-volume-pair",
    "maneuver-acceptability-error-ledger",
    "acceptable-maneuver-set",
    "repeatability-proof",
    "best-value-selection",
    "pre-post-bronchodilator-pairing",
    "interpretation-and-signed-report"
  ],
  "relationships": [
    "spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair ↔ maneuver-acceptability-error-ledger → acceptable-maneuver-set → FEV1-FVC-repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report"
  ],
  "responsive": {
    "wide": "Maneuver queue, selected volume–time and flow–volume views, acceptability findings, acceptable-set repeatability, best values and pre/post comparison remain simultaneously visible; changing a maneuver verdict invalidates every dependent proof and interpretation visibly",
    "intermediate": "The selected maneuver, its paired curve views and acceptability verdict remain primary; the complete maneuver set and repeatability proof move to a synchronized rail, while best-value provenance and pre/post pairing status remain persistent",
    "compact": "Verify session, patient, calibration and reference context → perform or select one maneuver → inspect volume–time and flow–volume evidence with a time/volume/flow table alternative → resolve each acceptability error → admit or reject the maneuver → review acceptable-set repeatability → trace FEV1 and FVC best values to their source maneuvers → pair pre/post bronchodilator if present → interpret and sign; curves yield to one selected evidence stage plus a semantic numeric route rather than stacked miniature plots",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair → maneuver-acceptability-error-ledger → acceptable-maneuver-set → repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "maneuver-acceptability-error-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "session new/resumed/signed",
    "patient identity matched/mismatch",
    "calibration current/expired/failed",
    "reference context complete/stale",
    "maneuver queued/recording/completed/aborted",
    "curve loading/ready/error",
    "acceptability pending/pass/fail with cough/early-termination/start/effort reason",
    "maneuver admitted/rejected/reinstated",
    "acceptable set insufficient/sufficient",
    "repeatability pending/pass/fail/stale",
    "best value unselected/derived/invalidated",
    "pre/post unmatched/paired/conflicting",
    "interpretation draft/blocked/signed/amended and permission-limited prior session"
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
