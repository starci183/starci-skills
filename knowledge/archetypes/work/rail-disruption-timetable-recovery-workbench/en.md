# Rail disruption timetable recovery workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rail-disruption-timetable-recovery-workbench` |
| Family | Work |
| Dominant task | Reconstruct a feasible plan of day after a rail disruption by changing train paths while preserving rolling-stock, crew, platform and passenger-connection continuity and controlling propagated delay. |
| Search aliases | `rail disruption timetable recovery`, `rail disruption timetable recovery workspace`, `rail disruption timetable recovery control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Reconstruct a feasible plan of day after a rail disruption by changing train paths while preserving rolling-stock, crew, platform and passenger-connection continuity and controlling propagated delay.
- no locally repaired train path is accepted until every stock, crew and platform continuation and propagated network delay is recomputed.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RDTRW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-RDTRW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-RDTRW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-RDTRW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-RDTRW-90` | The dominant task is actually `fleet-route-dispatch-planner`. | Reject. |
| `AR-RDTRW-91` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-RDTRW-92` | The dominant task is actually `critical-path-project-planner`. | Reject. |
| `AR-RDTRW-93` | The dominant task is actually `timeline-status-monitor`. | Reject. |

### Selection rule

Select `rail-disruption-timetable-recovery-workbench` if and only if `AR-RDTRW-01` through `AR-RDTRW-04` are evidenced and none of `AR-RDTRW-90` through `AR-RDTRW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
timetable-recovery → whole-working-timetable-version-and-disruption-boundary → all-service-time-distance-train-graph ↔ affected-and-unaffected-service-ledger → rolling-stock-circulation ↔ crew-duty-continuity ↔ platform-occupation-continuity → broken-turn-conflict-and-passenger-connection-register → network-wide-cancel-short-turn-replatform-and-retime-package → delay-propagation-simulation-across-following-services → whole-timetable-resource-feasibility-receipt → publish-handover-and-reconciliation
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `timetable-recovery` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `whole-working-timetable-version-and-disruption-boundary` | Owns Whole Working Timetable Version And Disruption Boundary evidence or action and preserves its declared relationship to the current selection. |
| `all-service-time-distance-train-graph` | Owns All Service Time Distance Train Graph evidence or action and preserves its declared relationship to the current selection. |
| `affected-and-unaffected-service-ledger` | Owns Affected And Unaffected Service Ledger evidence or action and preserves its declared relationship to the current selection. |
| `rolling-stock-circulation` | Owns Rolling Stock Circulation evidence or action and preserves its declared relationship to the current selection. |
| `crew-duty-continuity` | Owns Crew Duty Continuity evidence or action and preserves its declared relationship to the current selection. |
| `platform-occupation-continuity` | Owns Platform Occupation Continuity evidence or action and preserves its declared relationship to the current selection. |
| `broken-turn-conflict-and-passenger-connection-register` | Owns Broken Turn Conflict And Passenger Connection Register evidence or action and preserves its declared relationship to the current selection. |
| `network-wide-cancel-short-turn-replatform-and-retime-package` | Owns Network Wide Cancel Short Turn Replatform And Retime Package evidence or action and preserves its declared relationship to the current selection. |
| `delay-propagation-simulation-across-following-services` | Owns Delay Propagation Simulation Across Following Services evidence or action and preserves its declared relationship to the current selection. |
| `whole-timetable-resource-feasibility-receipt` | Owns Whole Timetable Resource Feasibility Receipt evidence or action and preserves its declared relationship to the current selection. |
| `publish-handover-and-reconciliation` | Owns Publish Handover And Reconciliation evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Time-distance graph, affected services, broken resource turns, recovery package and before/after propagation stay visible; the graph alone owns two-axis overflow.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `all-service-time-distance-train-graph` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected corridor/time pulse stays primary; train graph and resource circulations alternate, while the candidate package and feasibility result remain adjacent.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Disruption → affected and following timetable services → broken stock chain → broken crew duty → platform occupation conflict → complete cancel/short-turn/replatform/retime package → network delay propagation → whole-timetable continuity receipt → publish; an ordered service pulse replaces the running graph without reducing recovery to one vehicle route.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `timetable-recovery → whole-working-timetable-version-and-disruption-boundary → all-service-time-distance-train-graph ↔ affected-and-unaffected-service-ledger → rolling-stock-circulation ↔ crew-duty-continuity ↔ platform-occupation-continuity → broken-turn-conflict-and-passenger-connection-register → network-wide-cancel-short-turn-replatform-and-retime-package → delay-propagation-simulation-across-following-services → whole-timetable-resource-feasibility-receipt → publish-handover-and-reconciliation`.
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

Task-specific states: Plan loading/versioned/stale, disruption open/contained/cleared, service unaffected/delayed/cancelled/short-turned, stock/crew/platform turn intact/broken, passenger connection protected/missed, candidate partial/infeasible/feasible, simulation pending/complete/diverged, plan draft/published/superseded and handover acknowledged.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `whole-working-timetable-version-and-disruption-boundary` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `all-service-time-distance-train-graph` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `all-service-time-distance-train-graph` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `whole-timetable-resource-feasibility-receipt` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `publish-handover-and-reconciliation` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `publish-handover-and-reconciliation` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `publish-handover-and-reconciliation` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `whole-working-timetable-version-and-disruption-boundary` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `publish-handover-and-reconciliation` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `timetable-recovery` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Reconstruct a feasible plan of day after a rail disruption by changing train paths while preserving rolling-stock, crew, platform and passenger-connection continuity and controlling propagated delay.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `fleet-route-dispatch-planner`; this is `AR-RDTRW-90` evidence and must route to an adjacent archetype.
- Reject `calendar-resource-scheduler`; this is `AR-RDTRW-91` evidence and must route to an adjacent archetype.
- Reject `critical-path-project-planner`; this is `AR-RDTRW-92` evidence and must route to an adjacent archetype.
- Reject `timeline-status-monitor`; this is `AR-RDTRW-93` evidence and must route to an adjacent archetype.

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
| [Network Rail timetable planning](https://www.networkrail.co.uk/industry-and-commercial/the-timetable/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ERA Operation and Traffic Management TSI](https://www.era.europa.eu/domains/technical-specifications-interoperability/operation-and-traffic-management-tsi_en) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "rail-disruption-timetable-recovery-workbench",
  "situationCodes": [
    "<matched AR-RDTRW-* codes>"
  ],
  "searchAliases": [
    "rail disruption timetable recovery",
    "rail disruption timetable recovery workspace",
    "rail disruption timetable recovery control"
  ],
  "dominantTask": "Reconstruct a feasible plan of day after a rail disruption by changing train paths while preserving rolling-stock, crew, platform and passenger-connection continuity and controlling propagated delay.",
  "regions": [
    "timetable-recovery",
    "whole-working-timetable-version-and-disruption-boundary",
    "all-service-time-distance-train-graph",
    "affected-and-unaffected-service-ledger",
    "rolling-stock-circulation",
    "crew-duty-continuity",
    "platform-occupation-continuity",
    "broken-turn-conflict-and-passenger-connection-register",
    "network-wide-cancel-short-turn-replatform-and-retime-package",
    "delay-propagation-simulation-across-following-services",
    "whole-timetable-resource-feasibility-receipt",
    "publish-handover-and-reconciliation"
  ],
  "regionRelationships": [
    "no locally repaired train path is accepted until every stock, crew and platform continuation and propagated network delay is recomputed."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "timetable-recovery -> whole-working-timetable-version-and-disruption-boundary -> all-service-time-distance-train-graph -> affected-and-unaffected-service-ledger -> rolling-stock-circulation -> crew-duty-continuity -> platform-occupation-continuity -> broken-turn-conflict-and-passenger-connection-register -> network-wide-cancel-short-turn-replatform-and-retime-package -> delay-propagation-simulation-across-following-services -> whole-timetable-resource-feasibility-receipt -> publish-handover-and-reconciliation",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "all-service-time-distance-train-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Plan loading/versioned/stale",
    "disruption open/contained/cleared",
    "service unaffected/delayed/cancelled/short-turned",
    "stock/crew/platform turn intact/broken",
    "passenger connection protected/missed",
    "candidate partial/infeasible/feasible",
    "simulation pending/complete/diverged",
    "plan draft/published/superseded",
    "handover acknowledged"
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

