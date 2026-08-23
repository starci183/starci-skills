# Dialysis prescription delivery reconciliation

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dialysis-prescription-delivery-reconciliation` |
| Family | Work |
| Dominant task | Reconcile one dialysis prescription with machine-delivered parameters, access and anticoagulation interventions, fluid balance, adequacy targets and complications before session signoff and the next plan |
| Search aliases | dialysis-prescription-delivery-reconciliation, dialysis-reconciliation, session-signoff-and-next-plan |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `dialysis-reconciliation` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-DPR-01` | The user must reconcile one dialysis prescription with machine-delivered parameters, access and anticoagulation interventions, fluid balance, adequacy targets and complications before session signoff and the next plan | Require the dominant task. |
| `AR-DPR-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-DPR-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-DPR-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-DPR-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-DPR-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-DPR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `dialysis-prescription-delivery-reconciliation` if and only if `AR-DPR-01` through `AR-DPR-04` are evidenced, every named region and relationship is required, and none of `AR-DPR-90` through `AR-DPR-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ dialysis-reconciliation
├─ session-and-prescription-version
├─ prescribed-parameter-and-target-ledger
├─ device-event-and-delivery-time-series
├─ access-anticoagulation-and-intervention-log
├─ fluid-and-ultrafiltration-balance
├─ delivered-adequacy-and-target-comparison
├─ deviation-and-complication-review
└─ session-signoff-and-next-plan
```

Required relationship: `dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series ↔ access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dialysis-reconciliation` | Owns the state and decision of `dialysis-reconciliation`; preserves its relationship with downstream `session-and-prescription-version` without absorbing another region's owner. |
| `session-and-prescription-version` | Owns the state and decision of `session-and-prescription-version`; preserves its relationship with upstream `dialysis-reconciliation` and downstream `prescribed-parameter-and-target-ledger` without absorbing another region's owner. |
| `prescribed-parameter-and-target-ledger` | Owns the state and decision of `prescribed-parameter-and-target-ledger`; preserves its relationship with upstream `session-and-prescription-version` and downstream `device-event-and-delivery-time-series` without absorbing another region's owner. |
| `device-event-and-delivery-time-series` | Owns the state and decision of `device-event-and-delivery-time-series`; preserves its relationship with upstream `prescribed-parameter-and-target-ledger` and downstream `access-anticoagulation-and-intervention-log` without absorbing another region's owner. |
| `access-anticoagulation-and-intervention-log` | Owns the state and decision of `access-anticoagulation-and-intervention-log`; preserves its relationship with upstream `device-event-and-delivery-time-series` and downstream `fluid-and-ultrafiltration-balance` without absorbing another region's owner. |
| `fluid-and-ultrafiltration-balance` | Owns the state and decision of `fluid-and-ultrafiltration-balance`; preserves its relationship with upstream `access-anticoagulation-and-intervention-log` and downstream `delivered-adequacy-and-target-comparison` without absorbing another region's owner. |
| `delivered-adequacy-and-target-comparison` | Owns the state and decision of `delivered-adequacy-and-target-comparison`; preserves its relationship with upstream `fluid-and-ultrafiltration-balance` and downstream `deviation-and-complication-review` without absorbing another region's owner. |
| `deviation-and-complication-review` | Owns the state and decision of `deviation-and-complication-review`; preserves its relationship with upstream `delivered-adequacy-and-target-comparison` and downstream `session-signoff-and-next-plan` without absorbing another region's owner. |
| `session-signoff-and-next-plan` | Owns the state and decision of `session-signoff-and-next-plan`; preserves its relationship with upstream `deviation-and-complication-review` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Prescription targets, delivery time series, intervention log, fluid balance and adequacy/deviation review remain simultaneous around one session identity
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `prescribed-parameter-and-target-ledger` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Live delivery and prescribed-versus-delivered comparison remain primary; access/intervention history and adequacy evidence move to synchronized drawers, while fluid balance stays persistent
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `prescribed-parameter-and-target-ledger` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify prescription version → monitor current delivery and safety event → review intervention log → reconcile fluid inputs/outputs and ultrafiltration → compare adequacy → resolve deviations → sign off/next plan; charts have a time-keyed table alternative and only the current phase is primary
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `prescribed-parameter-and-target-ledger` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series → access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes prescription missing/stale/amended, device feed connecting/live/interrupted/recovered, access adequate/problematic, anticoagulation planned/held/changed, target and delivered value matching/deviating, fluid balance incomplete/imbalanced/reconciled, adequacy unavailable/pending/met/missed, complication active/resolved, signoff blocked/completed/amended and handoff pending/received.

## State obligations

Task-specific states: prescription missing/stale/amended, device feed connecting/live/interrupted/recovered, access adequate/problematic, anticoagulation planned/held/changed, target and delivered value matching/deviating, fluid balance incomplete/imbalanced/reconciled, adequacy unavailable/pending/met/missed, complication active/resolved, signoff blocked/completed/amended and handoff pending/received.

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

- Template must select one fictional prescription version, simulate a brief feed interruption, reconcile prescribed and delivered ultrafiltration against fluid entries, surface an access intervention beside the affected interval, block signoff on an unresolved variance, then produce a next-plan handoff receipt
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the surface could be `process-mass-balance-analyzer`, `cycle-count-variance-reconciliation-workbench`, `multichannel-waveform-analysis-workbench` or `live-operations-command-center`; a versioned dialysis prescription, session-bound device delivery, access/intervention events, fluid conservation, adequacy comparison and clinical signoff are all mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-DPR-90`, `AR-DPR-91`, or `AR-DPR-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [CMS End-Stage Renal Disease facilities requirements](https://www.cms.gov/medicare/health-safety-runtime/standards/conditions-coverage-participation/end-stage-renal-disease-facilities) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [National Kidney Foundation KDOQI guidelines and commentaries](https://www.kidney.org/professionals/kdoqi/guidelines-and-commentaries) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "dialysis-prescription-delivery-reconciliation",
  "matchedSituationCodes": [
    "AR-DPR-01",
    "AR-DPR-02",
    "AR-DPR-03",
    "AR-DPR-04"
  ],
  "aliases": [
    "dialysis-prescription-delivery-reconciliation",
    "dialysis-reconciliation",
    "session-signoff-and-next-plan"
  ],
  "dominantTask": "Reconcile one dialysis prescription with machine-delivered parameters, access and anticoagulation interventions, fluid balance, adequacy targets and complications before session signoff and the next plan",
  "regions": [
    "dialysis-reconciliation",
    "session-and-prescription-version",
    "prescribed-parameter-and-target-ledger",
    "device-event-and-delivery-time-series",
    "access-anticoagulation-and-intervention-log",
    "fluid-and-ultrafiltration-balance",
    "delivered-adequacy-and-target-comparison",
    "deviation-and-complication-review",
    "session-signoff-and-next-plan"
  ],
  "relationships": [
    "dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series ↔ access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan"
  ],
  "responsive": {
    "wide": "Prescription targets, delivery time series, intervention log, fluid balance and adequacy/deviation review remain simultaneous around one session identity",
    "intermediate": "Live delivery and prescribed-versus-delivered comparison remain primary; access/intervention history and adequacy evidence move to synchronized drawers, while fluid balance stays persistent",
    "compact": "Verify prescription version → monitor current delivery and safety event → review intervention log → reconcile fluid inputs/outputs and ultrafiltration → compare adequacy → resolve deviations → sign off/next plan; charts have a time-keyed table alternative and only the current phase is primary",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series → access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "prescribed-parameter-and-target-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "prescription missing/stale/amended",
    "device feed connecting/live/interrupted/recovered",
    "access adequate/problematic",
    "anticoagulation planned/held/changed",
    "target and delivered value matching/deviating",
    "fluid balance incomplete/imbalanced/reconciled",
    "adequacy unavailable/pending/met/missed",
    "complication active/resolved",
    "signoff blocked/completed/amended and handoff pending/received"
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
