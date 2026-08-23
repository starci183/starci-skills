# Infusion titration safety console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `infusion-titration-safety-console` |
| Family | Work |
| Dominant task | Titrate a continuous infusion by reconciling the medication order and protocol stage with pump programming and delivered events, observing patient response and cumulative dose/fluid, and requiring safety checks plus independent verification before each consequential change |
| Search aliases | infusion-titration-safety-console, infusion-safety, handoff |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `infusion-safety` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-ITS-01` | The user must titrate a continuous infusion by reconciling the medication order and protocol stage with pump programming and delivered events, observing patient response and cumulative dose/fluid, and requiring safety checks plus independent verification before each consequential change | Require the dominant task. |
| `AR-ITS-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-ITS-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-ITS-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-ITS-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-ITS-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-ITS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `infusion-titration-safety-console` if and only if `AR-ITS-01` through `AR-ITS-04` are evidenced, every named region and relationship is required, and none of `AR-ITS-90` through `AR-ITS-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ infusion-safety
├─ patient-order-drug-concentration-and-line
├─ protocol-stage-and-titration-rule
├─ ordered-rate-and-dose-envelope
├─ ordered-versus-programmed-versus-delivered-triad
├─ patient-response-and-alarm-window
├─ cumulative-dose-fluid-and-exposure-ledger
├─ titrate-hold-or-rescue-decision
├─ independent-verification
├─ executed-change-and-observed-outcome
└─ handoff
```

Required relationship: `infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad ↔ patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `infusion-safety` | Owns the state and decision of `infusion-safety`; preserves its relationship with downstream `patient-order-drug-concentration-and-line` without absorbing another region's owner. |
| `patient-order-drug-concentration-and-line` | Owns the state and decision of `patient-order-drug-concentration-and-line`; preserves its relationship with upstream `infusion-safety` and downstream `protocol-stage-and-titration-rule` without absorbing another region's owner. |
| `protocol-stage-and-titration-rule` | Owns the state and decision of `protocol-stage-and-titration-rule`; preserves its relationship with upstream `patient-order-drug-concentration-and-line` and downstream `ordered-rate-and-dose-envelope` without absorbing another region's owner. |
| `ordered-rate-and-dose-envelope` | Owns the state and decision of `ordered-rate-and-dose-envelope`; preserves its relationship with upstream `protocol-stage-and-titration-rule` and downstream `ordered-versus-programmed-versus-delivered-triad` without absorbing another region's owner. |
| `ordered-versus-programmed-versus-delivered-triad` | Owns the state and decision of `ordered-versus-programmed-versus-delivered-triad`; preserves its relationship with upstream `ordered-rate-and-dose-envelope` and downstream `patient-response-and-alarm-window` without absorbing another region's owner. |
| `patient-response-and-alarm-window` | Owns the state and decision of `patient-response-and-alarm-window`; preserves its relationship with upstream `ordered-versus-programmed-versus-delivered-triad` and downstream `cumulative-dose-fluid-and-exposure-ledger` without absorbing another region's owner. |
| `cumulative-dose-fluid-and-exposure-ledger` | Owns the state and decision of `cumulative-dose-fluid-and-exposure-ledger`; preserves its relationship with upstream `patient-response-and-alarm-window` and downstream `titrate-hold-or-rescue-decision` without absorbing another region's owner. |
| `titrate-hold-or-rescue-decision` | Owns the state and decision of `titrate-hold-or-rescue-decision`; preserves its relationship with upstream `cumulative-dose-fluid-and-exposure-ledger` and downstream `independent-verification` without absorbing another region's owner. |
| `independent-verification` | Owns the state and decision of `independent-verification`; preserves its relationship with upstream `titrate-hold-or-rescue-decision` and downstream `executed-change-and-observed-outcome` without absorbing another region's owner. |
| `executed-change-and-observed-outcome` | Owns the state and decision of `executed-change-and-observed-outcome`; preserves its relationship with upstream `independent-verification` and downstream `handoff` without absorbing another region's owner. |
| `handoff` | Owns the state and decision of `handoff`; preserves its relationship with upstream `executed-change-and-observed-outcome` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Order/envelope, pump program and delivery, response/alarm trends, cumulative ledger, active decision and verifier state remain simultaneously visible around one line and drug identity
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `protocol-stage-and-titration-rule` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Active rate/dose, response and next permitted action remain primary; order/rule provenance and cumulative history become synchronized drawers, while line/drug identity stays fixed
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `protocol-stage-and-titration-rule` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify patient/drug/concentration/line → confirm protocol stage and ordered envelope → reconcile ordered, programmed and delivered values in one triad → review the bounded response window plus cumulative dose/fluid exposure → choose titrate, hold or rescue → obtain independent verification → execute once → observe outcome → hand off; the active action and rescue remain reachable, while history yields to an exposure ledger route rather than stacked trend panels
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `protocol-stage-and-titration-rule` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad → patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes identity mismatch/matched, order pending/active/amended/stale, concentration or line confirmed/conflicting, protocol stage active/criteria unmet, rate within/outside envelope, pump connecting/running/paused/occluded/disconnected, delivery event delayed/conflicting, response stable/worsening/threshold crossed, cumulative ledger incomplete/reconciled, decision draft/verified/executing/reverted, rescue active, handoff sent/acknowledged and permission denied.

## State obligations

Task-specific states: identity mismatch/matched, order pending/active/amended/stale, concentration or line confirmed/conflicting, protocol stage active/criteria unmet, rate within/outside envelope, pump connecting/running/paused/occluded/disconnected, delivery event delayed/conflicting, response stable/worsening/threshold crossed, cumulative ledger incomplete/reconciled, decision draft/verified/executing/reverted, rescue active, handoff sent/acknowledged and permission denied.

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

- Template must detect a fictional mismatch among ordered, programmed and delivered rates, keep the response threshold plus cumulative dose/fluid exposure visible during correction, disable execution and duplicates while independent verification is pending, preserve hold and rescue as first-class alternatives, announce the delivered change without stealing focus, and generate an acknowledged handoff only after observing the outcome
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology is `live-operations-command-center`, `multichannel-waveform-analysis-workbench`, `rule-builder-workbench`, a generic guardrail command loop or medication form; live signals or a permitted setting alone are insufficient. One infusion must expose the ordered/programmed/delivered triad, cumulative exposure, bounded patient response, titrate/hold/rescue alternatives and independent verification before execution
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-ITS-90`, `AR-ITS-91`, or `AR-ITS-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [FDA infusion pumps](https://www.fda.gov/medical-devices/general-hospital-devices-and-supplies/infusion-pumps) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [FDA infusion-pump risk-reduction strategies for clinicians](https://www.fda.gov/medical-devices/infusion-pumps/infusion-pump-risk-reduction-strategies-clinicians) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [IHE Patient Care Device profiles](https://profiles.ihe.net/DEV/index.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports focus visibility around persistent surfaces. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "infusion-titration-safety-console",
  "matchedSituationCodes": [
    "AR-ITS-01",
    "AR-ITS-02",
    "AR-ITS-03",
    "AR-ITS-04"
  ],
  "aliases": [
    "infusion-titration-safety-console",
    "infusion-safety",
    "handoff"
  ],
  "dominantTask": "Titrate a continuous infusion by reconciling the medication order and protocol stage with pump programming and delivered events, observing patient response and cumulative dose/fluid, and requiring safety checks plus independent verification before each consequential change",
  "regions": [
    "infusion-safety",
    "patient-order-drug-concentration-and-line",
    "protocol-stage-and-titration-rule",
    "ordered-rate-and-dose-envelope",
    "ordered-versus-programmed-versus-delivered-triad",
    "patient-response-and-alarm-window",
    "cumulative-dose-fluid-and-exposure-ledger",
    "titrate-hold-or-rescue-decision",
    "independent-verification",
    "executed-change-and-observed-outcome",
    "handoff"
  ],
  "relationships": [
    "infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad ↔ patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff"
  ],
  "responsive": {
    "wide": "Order/envelope, pump program and delivery, response/alarm trends, cumulative ledger, active decision and verifier state remain simultaneously visible around one line and drug identity",
    "intermediate": "Active rate/dose, response and next permitted action remain primary; order/rule provenance and cumulative history become synchronized drawers, while line/drug identity stays fixed",
    "compact": "Verify patient/drug/concentration/line → confirm protocol stage and ordered envelope → reconcile ordered, programmed and delivered values in one triad → review the bounded response window plus cumulative dose/fluid exposure → choose titrate, hold or rescue → obtain independent verification → execute once → observe outcome → hand off; the active action and rescue remain reachable, while history yields to an exposure ledger route rather than stacked trend panels",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad → patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "protocol-stage-and-titration-rule",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "identity mismatch/matched",
    "order pending/active/amended/stale",
    "concentration or line confirmed/conflicting",
    "protocol stage active/criteria unmet",
    "rate within/outside envelope",
    "pump connecting/running/paused/occluded/disconnected",
    "delivery event delayed/conflicting",
    "response stable/worsening/threshold crossed",
    "cumulative ledger incomplete/reconciled",
    "decision draft/verified/executing/reverted",
    "rescue active",
    "handoff sent/acknowledged and permission denied"
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
