# Passenger connection protection decision board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `passenger-connection-protection-decision-board` |
| Family | Overview |
| Dominant task | Decide whether one connecting service should hold or depart by comparing uncertain feeder arrival and accessible transfer feasibility against stranded-passenger benefit, downstream delay propagation and operating authority. |
| Search aliases | `passenger connection protection decision`, `passenger connection protection decision workspace`, `passenger connection protection decision control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Decide whether one connecting service should hold or depart by comparing uncertain feeder arrival and accessible transfer feasibility against stranded-passenger benefit, downstream delay propagation and operating authority.
- the board owns exactly one expiring operational choice and must compare the accessible cohort separately from faster transfer passengers.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PCPDB-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-PCPDB-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-PCPDB-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-PCPDB-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-PCPDB-90` | The dominant task is actually `rail-disruption-timetable-recovery-workbench`. | Reject. |
| `AR-PCPDB-91` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-PCPDB-92` | The dominant task is actually `asynchronous-outcome-tracker`. | Reject. |
| `AR-PCPDB-93` | The dominant task is actually `spatial-route-itinerary-explorer`. | Reject. |

### Selection rule

Select `passenger-connection-protection-decision-board` if and only if `AR-PCPDB-01` through `AR-PCPDB-04` are evidenced and none of `AR-PCPDB-90` through `AR-PCPDB-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
connection-protection → one-imminent-feeder-to-connecting-service-pair → interchange-policy-live-clock-and-named-decision-authority → feeder-arrival-uncertainty → transfer-cohorts-by-accessible-route-and-measured-transfer-time → connecting-service-ready-state-scheduled-departure-and-next-option → explicit-hold-or-depart-decision-deadline → protected-vs-stranded-cohort-effect ↔ downstream-delay-resource-and-passenger-propagation → authority-bounded-hold-or-depart-command → acknowledgement-before-expiry → measured-transfer-count-and-actual-departure-delay-outcome
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `connection-protection` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `one-imminent-feeder-to-connecting-service-pair` | Owns One Imminent Feeder To Connecting Service Pair evidence or action and preserves its declared relationship to the current selection. |
| `interchange-policy-live-clock-and-named-decision-authority` | Owns Interchange Policy Live Clock And Named Decision Authority evidence or action and preserves its declared relationship to the current selection. |
| `feeder-arrival-uncertainty` | Owns Feeder Arrival Uncertainty evidence or action and preserves its declared relationship to the current selection. |
| `transfer-cohorts-by-accessible-route-and-measured-transfer-time` | Owns Transfer Cohorts By Accessible Route And Measured Transfer Time evidence or action and preserves its declared relationship to the current selection. |
| `connecting-service-ready-state-scheduled-departure-and-next-option` | Owns Connecting Service Ready State Scheduled Departure And Next Option evidence or action and preserves its declared relationship to the current selection. |
| `explicit-hold-or-depart-decision-deadline` | Owns Explicit Hold Or Depart Decision Deadline evidence or action and preserves its declared relationship to the current selection. |
| `protected-vs-stranded-cohort-effect` | Owns Protected Vs Stranded Cohort Effect evidence or action and preserves its declared relationship to the current selection. |
| `downstream-delay-resource-and-passenger-propagation` | Owns Downstream Delay Resource And Passenger Propagation evidence or action and preserves its declared relationship to the current selection. |
| `authority-bounded-hold-or-depart-command` | Owns Authority Bounded Hold Or Depart Command evidence or action and preserves its declared relationship to the current selection. |
| `acknowledgement-before-expiry` | Owns Acknowledgement Before Expiry evidence or action and preserves its declared relationship to the current selection. |
| `measured-transfer-count-and-actual-departure-delay-outcome` | Owns Measured Transfer Count And Actual Departure Delay Outcome evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Feeder uncertainty, transfer cohorts, departure/next-option facts, hold candidates, protected-versus-propagated effects and instruction authority remain visible on one decision board.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `one-imminent-feeder-to-connecting-service-pair` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected connection and decision deadline stay pinned; transfer feasibility and downstream consequence evidence alternate while the authorized instruction remains adjacent.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** One feeder/connection pair → live arrival range → accessible and standard cohorts with measured transfer times → scheduled departure/next option → decision deadline countdown → hold versus depart effects → named authority limit → issue and acknowledge before expiry → measured transferred/stranded count and actual departure delay; a numeric decision ladder replaces the station map.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `connection-protection → one-imminent-feeder-to-connecting-service-pair → interchange-policy-live-clock-and-named-decision-authority → feeder-arrival-uncertainty → transfer-cohorts-by-accessible-route-and-measured-transfer-time → connecting-service-ready-state-scheduled-departure-and-next-option → explicit-hold-or-depart-decision-deadline → protected-vs-stranded-cohort-effect ↔ downstream-delay-resource-and-passenger-propagation → authority-bounded-hold-or-depart-command → acknowledgement-before-expiry → measured-transfer-count-and-actual-departure-delay-outcome`.
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

Task-specific states: Feeder estimate live/stale/widening, cohort count known/estimated, accessible path open/blocked/unknown, transfer feasible/marginal/impossible, departure on-time/ready/held/gone, candidate within/outside authority, downstream effect low/high/uncertain, decision pending/authorized/expired/superseded, instruction issued/acknowledged/declined and actual transfer complete/partial/missed.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `one-imminent-feeder-to-connecting-service-pair` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `interchange-policy-live-clock-and-named-decision-authority` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `interchange-policy-live-clock-and-named-decision-authority` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `acknowledgement-before-expiry` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `measured-transfer-count-and-actual-departure-delay-outcome` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `measured-transfer-count-and-actual-departure-delay-outcome` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `measured-transfer-count-and-actual-departure-delay-outcome` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `one-imminent-feeder-to-connecting-service-pair` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `measured-transfer-count-and-actual-departure-delay-outcome` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `connection-protection` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Decide whether one connecting service should hold or depart by comparing uncertain feeder arrival and accessible transfer feasibility against stranded-passenger benefit, downstream delay propagation and operating authority.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `rail-disruption-timetable-recovery-workbench`; this is `AR-PCPDB-90` evidence and must route to an adjacent archetype.
- Reject `calendar-resource-scheduler`; this is `AR-PCPDB-91` evidence and must route to an adjacent archetype.
- Reject `asynchronous-outcome-tracker`; this is `AR-PCPDB-92` evidence and must route to an adjacent archetype.
- Reject `spatial-route-itinerary-explorer`; this is `AR-PCPDB-93` evidence and must route to an adjacent archetype.

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
| [Network Rail Delay Attribution Principles and Rules](https://www.networkrail.co.uk/wp-content/uploads/2025/06/April-2025-DAPR.pdf) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FTA STOPS timed-transfer guidance](https://www.transit.dot.gov/sites/fta.dot.gov/files/2024-09/STOPS-User-Guide-v2-53-v.pdf) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "passenger-connection-protection-decision-board",
  "situationCodes": [
    "<matched AR-PCPDB-* codes>"
  ],
  "searchAliases": [
    "passenger connection protection decision",
    "passenger connection protection decision workspace",
    "passenger connection protection decision control"
  ],
  "dominantTask": "Decide whether one connecting service should hold or depart by comparing uncertain feeder arrival and accessible transfer feasibility against stranded-passenger benefit, downstream delay propagation and operating authority.",
  "regions": [
    "connection-protection",
    "one-imminent-feeder-to-connecting-service-pair",
    "interchange-policy-live-clock-and-named-decision-authority",
    "feeder-arrival-uncertainty",
    "transfer-cohorts-by-accessible-route-and-measured-transfer-time",
    "connecting-service-ready-state-scheduled-departure-and-next-option",
    "explicit-hold-or-depart-decision-deadline",
    "protected-vs-stranded-cohort-effect",
    "downstream-delay-resource-and-passenger-propagation",
    "authority-bounded-hold-or-depart-command",
    "acknowledgement-before-expiry",
    "measured-transfer-count-and-actual-departure-delay-outcome"
  ],
  "regionRelationships": [
    "the board owns exactly one expiring operational choice and must compare the accessible cohort separately from faster transfer passengers."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "connection-protection -> one-imminent-feeder-to-connecting-service-pair -> interchange-policy-live-clock-and-named-decision-authority -> feeder-arrival-uncertainty -> transfer-cohorts-by-accessible-route-and-measured-transfer-time -> connecting-service-ready-state-scheduled-departure-and-next-option -> explicit-hold-or-depart-decision-deadline -> protected-vs-stranded-cohort-effect -> downstream-delay-resource-and-passenger-propagation -> authority-bounded-hold-or-depart-command -> acknowledgement-before-expiry -> measured-transfer-count-and-actual-departure-delay-outcome",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "one-imminent-feeder-to-connecting-service-pair",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Feeder estimate live/stale/widening",
    "cohort count known/estimated",
    "accessible path open/blocked/unknown",
    "transfer feasible/marginal/impossible",
    "departure on-time/ready/held/gone",
    "candidate within/outside authority",
    "downstream effect low/high/uncertain",
    "decision pending/authorized/expired/superseded",
    "instruction issued/acknowledged/declined",
    "actual transfer complete/partial/missed"
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

