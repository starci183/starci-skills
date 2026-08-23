# Driver duty rest compliance planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `driver-duty-rest-compliance-planner` |
| Family | Work |
| Dominant task | Build or repair a professional driver's trip-duty plan by placing driving, other work, availability, break and rest events against simultaneous daily, weekly, rolling-cycle and reset rules with exact violation provenance. |
| Search aliases | `driver duty rest compliance`, `driver duty rest compliance workspace`, `driver duty rest compliance control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Build or repair a professional driver's trip-duty plan by placing driving, other work, availability, break and rest events against simultaneous daily, weekly, rolling-cycle and reset rules with exact violation provenance.
- several clocks consume and reset differently over the same event sequence.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DDRCP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-DDRCP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-DDRCP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-DDRCP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-DDRCP-90` | The dominant task is actually `multi-track-timeline-editor`. | Reject. |
| `AR-DDRCP-91` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-DDRCP-92` | The dominant task is actually `calculation-estimate-flow`. | Reject. |

### Selection rule

Select `driver-duty-rest-compliance-planner` if and only if `AR-DDRCP-01` through `AR-DDRCP-04` are evidenced and none of `AR-DDRCP-90` through `AR-DDRCP-92` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
duty-rest-planner → driver-jurisdiction-timezone-and-rule-version → immutable-actual-duty-log → planned-trip-activity-sequence → elapsed-driving-duty-break-rest-and-cycle-clocks ↔ rule-reset-and-exception-ledger → first-violation-point-and-causal-events → compliant-rest-or-activity-alternatives → selected-plan-and-remaining-allowance → attestation-and-audit-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `duty-rest-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `driver-jurisdiction-timezone-and-rule-version` | Owns Driver Jurisdiction Timezone And Rule Version evidence or action and preserves its declared relationship to the current selection. |
| `immutable-actual-duty-log` | Owns Immutable Actual Duty Log evidence or action and preserves its declared relationship to the current selection. |
| `planned-trip-activity-sequence` | Owns Planned Trip Activity Sequence evidence or action and preserves its declared relationship to the current selection. |
| `elapsed-driving-duty-break-rest-and-cycle-clocks` | Owns Elapsed Driving Duty Break Rest And Cycle Clocks evidence or action and preserves its declared relationship to the current selection. |
| `rule-reset-and-exception-ledger` | Owns Rule Reset And Exception Ledger evidence or action and preserves its declared relationship to the current selection. |
| `first-violation-point-and-causal-events` | Owns First Violation Point And Causal Events evidence or action and preserves its declared relationship to the current selection. |
| `compliant-rest-or-activity-alternatives` | Owns Compliant Rest Or Activity Alternatives evidence or action and preserves its declared relationship to the current selection. |
| `selected-plan-and-remaining-allowance` | Owns Selected Plan And Remaining Allowance evidence or action and preserves its declared relationship to the current selection. |
| `attestation-and-audit-export` | Owns Attestation And Audit Export evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Actual log, planned sequence, all clocks, violation provenance and alternative rest placements remain aligned on one time axis; only that bounded axis may scroll horizontally.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `duty-rest-planner` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected violation and clock stack stay primary; actual/planned timeline and rule evidence alternate while remaining allowance remains visible.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Actual duty state → next planned activity → each active clock → first violation → rule/reset explanation → rest alternatives → selected plan → attestation; chronological events replace the multi-lane timeline.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `duty-rest-planner → driver-jurisdiction-timezone-and-rule-version → immutable-actual-duty-log → planned-trip-activity-sequence → elapsed-driving-duty-break-rest-and-cycle-clocks ↔ rule-reset-and-exception-ledger → first-violation-point-and-causal-events → compliant-rest-or-activity-alternatives → selected-plan-and-remaining-allowance → attestation-and-audit-export`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: Log loading/certified/corrected, activity actual/planned, clock available/warning/exhausted/reset-pending, break qualifying/non-qualifying, rest regular/reduced/split, exception available/used/unsupported, plan compliant/violating, correction requested/approved, attestation pending/signed and audit export ready/failed.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `driver-jurisdiction-timezone-and-rule-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `immutable-actual-duty-log` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `immutable-actual-duty-log` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `selected-plan-and-remaining-allowance` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `attestation-and-audit-export` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `attestation-and-audit-export` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `attestation-and-audit-export` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `driver-jurisdiction-timezone-and-rule-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `attestation-and-audit-export` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `duty-rest-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Build or repair a professional driver's trip-duty plan by placing driving, other work, availability, break and rest events against simultaneous daily, weekly, rolling-cycle and reset rules with exact violation provenance.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `multi-track-timeline-editor`; this is `AR-DDRCP-90` evidence and must route to an adjacent archetype.
- Reject `calendar-resource-scheduler`; this is `AR-DDRCP-91` evidence and must route to an adjacent archetype.
- Reject `calculation-estimate-flow`; this is `AR-DDRCP-92` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FMCSA Interstate Truck Driver's Guide to Hours of Service](https://www.fmcsa.dot.gov/regulations/hours-service/interstate-truck-drivers-guide-hours-service) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [European Commission driving and rest times guidance](https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "driver-duty-rest-compliance-planner",
  "situationCodes": [
    "<matched AR-DDRCP-* codes>"
  ],
  "searchAliases": [
    "driver duty rest compliance",
    "driver duty rest compliance workspace",
    "driver duty rest compliance control"
  ],
  "dominantTask": "Build or repair a professional driver's trip-duty plan by placing driving, other work, availability, break and rest events against simultaneous daily, weekly, rolling-cycle and reset rules with exact violation provenance.",
  "regions": [
    "duty-rest-planner",
    "driver-jurisdiction-timezone-and-rule-version",
    "immutable-actual-duty-log",
    "planned-trip-activity-sequence",
    "elapsed-driving-duty-break-rest-and-cycle-clocks",
    "rule-reset-and-exception-ledger",
    "first-violation-point-and-causal-events",
    "compliant-rest-or-activity-alternatives",
    "selected-plan-and-remaining-allowance",
    "attestation-and-audit-export"
  ],
  "regionRelationships": [
    "several clocks consume and reset differently over the same event sequence."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "duty-rest-planner -> driver-jurisdiction-timezone-and-rule-version -> immutable-actual-duty-log -> planned-trip-activity-sequence -> elapsed-driving-duty-break-rest-and-cycle-clocks -> rule-reset-and-exception-ledger -> first-violation-point-and-causal-events -> compliant-rest-or-activity-alternatives -> selected-plan-and-remaining-allowance -> attestation-and-audit-export",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "duty-rest-planner",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Log loading/certified/corrected",
    "activity actual/planned",
    "clock available/warning/exhausted/reset-pending",
    "break qualifying/non-qualifying",
    "rest regular/reduced/split",
    "exception available/used/unsupported",
    "plan compliant/violating",
    "correction requested/approved",
    "attestation pending/signed",
    "audit export ready/failed"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

