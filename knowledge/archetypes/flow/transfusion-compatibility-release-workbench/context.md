# Transfusion compatibility release workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `transfusion-compatibility-release-workbench` |
| Family | Flow |
| Dominant task | Prove recipient-to-component compatibility from current and historical evidence, select and reserve a suitable unit, execute a governed emergency exception when needed, and issue the component with an end-to-end trace receipt |
| Search aliases | transfusion-compatibility-release-workbench, compatibility-release, transfusion-trace-receipt |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `compatibility-release` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-TCR-01` | The user must prove recipient-to-component compatibility from current and historical evidence, select and reserve a suitable unit, execute a governed emergency exception when needed, and issue the component with an end-to-end trace receipt | Require the dominant task. |
| `AR-TCR-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-TCR-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-TCR-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-TCR-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-TCR-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-TCR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `transfusion-compatibility-release-workbench` if and only if `AR-TCR-01` through `AR-TCR-04` are evidenced, every named region and relationship is required, and none of `AR-TCR-90` through `AR-TCR-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ compatibility-release
├─ recipient-current-sample-and-history
├─ abo-rh-antibody-evidence
├─ component-unit-pool
├─ recipient-by-unit-compatibility-matrix
├─ crossmatch-and-reservation-state
├─ exception-and-emergency-release-path
├─ issue-and-handoff
└─ transfusion-trace-receipt
```

Required relationship: `compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `compatibility-release` | Owns the state and decision of `compatibility-release`; preserves its relationship with downstream `recipient-current-sample-and-history` without absorbing another region's owner. |
| `recipient-current-sample-and-history` | Owns the state and decision of `recipient-current-sample-and-history`; preserves its relationship with upstream `compatibility-release` and downstream `abo-rh-antibody-evidence` without absorbing another region's owner. |
| `abo-rh-antibody-evidence` | Owns the state and decision of `abo-rh-antibody-evidence`; preserves its relationship with upstream `recipient-current-sample-and-history` and downstream `component-unit-pool` without absorbing another region's owner. |
| `component-unit-pool` | Owns the state and decision of `component-unit-pool`; preserves its relationship with upstream `abo-rh-antibody-evidence` and downstream `recipient-by-unit-compatibility-matrix` without absorbing another region's owner. |
| `recipient-by-unit-compatibility-matrix` | Owns the state and decision of `recipient-by-unit-compatibility-matrix`; preserves its relationship with upstream `component-unit-pool` and downstream `crossmatch-and-reservation-state` without absorbing another region's owner. |
| `crossmatch-and-reservation-state` | Owns the state and decision of `crossmatch-and-reservation-state`; preserves its relationship with upstream `recipient-by-unit-compatibility-matrix` and downstream `exception-and-emergency-release-path` without absorbing another region's owner. |
| `exception-and-emergency-release-path` | Owns the state and decision of `exception-and-emergency-release-path`; preserves its relationship with upstream `crossmatch-and-reservation-state` and downstream `issue-and-handoff` without absorbing another region's owner. |
| `issue-and-handoff` | Owns the state and decision of `issue-and-handoff`; preserves its relationship with upstream `exception-and-emergency-release-path` and downstream `transfusion-trace-receipt` without absorbing another region's owner. |
| `transfusion-trace-receipt` | Owns the state and decision of `transfusion-trace-receipt`; preserves its relationship with upstream `issue-and-handoff` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Recipient/sample history, candidate units, compatibility matrix, selected-unit proof and issue/exception rail remain simultaneous; incompatible evidence cannot be hidden by selection
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `recipient-by-unit-compatibility-matrix` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Recipient evidence and selected-unit compatibility remain primary; the candidate pool becomes a filtered drawer and trace history moves behind an explicit receipt route
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `recipient-by-unit-compatibility-matrix` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify recipient/sample → review antibodies/history → select one candidate unit → inspect compatibility and crossmatch proof → reserve → normal or emergency authorization → issue/handoff → confirm trace receipt; pool-wide comparison becomes a bounded table, with one unit decision primary
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `recipient-by-unit-compatibility-matrix` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes recipient identity verified/mismatch, sample current/expired/unavailable, history clear/conflicting, antibody screen negative/positive/pending, unit available/held/reserved/unavailable, compatible/incompatible/indeterminate, crossmatch pending/pass/fail, emergency justification draft/authorized/rejected, issue pending/completed/recalled, handoff acknowledged/missing and trace conflict/amendment.

## State obligations

Task-specific states: recipient identity verified/mismatch, sample current/expired/unavailable, history clear/conflicting, antibody screen negative/positive/pending, unit available/held/reserved/unavailable, compatible/incompatible/indeterminate, crossmatch pending/pass/fail, emergency justification draft/authorized/rejected, issue pending/completed/recalled, handoff acknowledged/missing and trace conflict/amendment.

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

- Template must expose why two fictional units are compatible or rejected, invalidate a unit when the sample expires, complete both a normal reservation and a separately authorized emergency path, prevent duplicate issue while pending, and close only after an acknowledged unit-specific trace receipt
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology is `chain-of-custody-transfer-ledger`, `waitlist-offer-allocation-board`, `entity-resolution-cluster-adjudicator` or inventory picking; recipient-specific serologic compatibility, current-sample validity, crossmatch/reservation, governed emergency release and transfusion trace receipt are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-TCR-90`, `AR-TCR-91`, or `AR-TCR-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [FDA current good manufacturing practice for blood and blood components](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-F/part-606) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [FDA biological product deviation reporting guidance](https://www.fda.gov/media/70694/download) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ISBT 128 traceability guidance](https://www.isbtweb.org/resource/tb-004-isbt-128-and-traceability-v1-1-0-pdf.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard grid semantics. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "transfusion-compatibility-release-workbench",
  "matchedSituationCodes": [
    "AR-TCR-01",
    "AR-TCR-02",
    "AR-TCR-03",
    "AR-TCR-04"
  ],
  "aliases": [
    "transfusion-compatibility-release-workbench",
    "compatibility-release",
    "transfusion-trace-receipt"
  ],
  "dominantTask": "Prove recipient-to-component compatibility from current and historical evidence, select and reserve a suitable unit, execute a governed emergency exception when needed, and issue the component with an end-to-end trace receipt",
  "regions": [
    "compatibility-release",
    "recipient-current-sample-and-history",
    "abo-rh-antibody-evidence",
    "component-unit-pool",
    "recipient-by-unit-compatibility-matrix",
    "crossmatch-and-reservation-state",
    "exception-and-emergency-release-path",
    "issue-and-handoff",
    "transfusion-trace-receipt"
  ],
  "relationships": [
    "compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt"
  ],
  "responsive": {
    "wide": "Recipient/sample history, candidate units, compatibility matrix, selected-unit proof and issue/exception rail remain simultaneous; incompatible evidence cannot be hidden by selection",
    "intermediate": "Recipient evidence and selected-unit compatibility remain primary; the candidate pool becomes a filtered drawer and trace history moves behind an explicit receipt route",
    "compact": "Verify recipient/sample → review antibodies/history → select one candidate unit → inspect compatibility and crossmatch proof → reserve → normal or emergency authorization → issue/handoff → confirm trace receipt; pool-wide comparison becomes a bounded table, with one unit decision primary",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "recipient-by-unit-compatibility-matrix",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "recipient identity verified/mismatch",
    "sample current/expired/unavailable",
    "history clear/conflicting",
    "antibody screen negative/positive/pending",
    "unit available/held/reserved/unavailable",
    "compatible/incompatible/indeterminate",
    "crossmatch pending/pass/fail",
    "emergency justification draft/authorized/rejected",
    "issue pending/completed/recalled",
    "handoff acknowledged/missing and trace conflict/amendment"
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
