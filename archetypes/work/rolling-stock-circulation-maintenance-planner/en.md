# Rolling stock circulation maintenance planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rolling-stock-circulation-maintenance-planner` |
| Family | Work |
| Dominant task | Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release. |
| Search aliases | `rolling stock circulation maintenance`, `rolling stock circulation maintenance workspace`, `rolling stock circulation maintenance control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release.
- a fleet type or anonymous spare can never substitute for the named unit whose service, formation, depot and maintenance history must remain continuous.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RSCMP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-RSCMP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-RSCMP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-RSCMP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-RSCMP-90` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-RSCMP-91` | The dominant task is actually `fleet-route-dispatch-planner`. | Reject. |
| `AR-RSCMP-92` | The dominant task is actually `critical-path-project-planner`. | Reject. |
| `AR-RSCMP-93` | The dominant task is actually `inventory-replenishment-planner`. | Reject. |

### Selection rule

Select `rolling-stock-circulation-maintenance-planner` if and only if `AR-RSCMP-01` through `AR-RSCMP-04` are evidenced and none of `AR-RSCMP-90` through `AR-RSCMP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
circulation-planner → operating-plan-horizon-and-fleet-policy → service-leg-and-required-formation-graph → named-physical-unit-roster-capability-and-due-state → identity-preserving-unit-to-service-leg-chains ↔ couple-split-and-formation-membership-events → arrival-to-depot-path-and-stabling-position → unit-specific-cleaning-inspection-and-maintenance-window → depot-exit-to-next-service-continuity → broken-unit-chain-and-formation-coverage-gaps → identity-specific-swap-or-resequence-scenarios → whole-circulation-release-and-depot-handoff
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `circulation-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `operating-plan-horizon-and-fleet-policy` | Owns Operating Plan Horizon And Fleet Policy evidence or action and preserves its declared relationship to the current selection. |
| `service-leg-and-required-formation-graph` | Owns Service Leg And Required Formation Graph evidence or action and preserves its declared relationship to the current selection. |
| `named-physical-unit-roster-capability-and-due-state` | Owns Named Physical Unit Roster Capability And Due State evidence or action and preserves its declared relationship to the current selection. |
| `identity-preserving-unit-to-service-leg-chains` | Owns Identity Preserving Unit To Service Leg Chains evidence or action and preserves its declared relationship to the current selection. |
| `couple-split-and-formation-membership-events` | Owns Couple Split And Formation Membership Events evidence or action and preserves its declared relationship to the current selection. |
| `arrival-to-depot-path-and-stabling-position` | Owns Arrival To Depot Path And Stabling Position evidence or action and preserves its declared relationship to the current selection. |
| `unit-specific-cleaning-inspection-and-maintenance-window` | Owns Unit Specific Cleaning Inspection And Maintenance Window evidence or action and preserves its declared relationship to the current selection. |
| `depot-exit-to-next-service-continuity` | Owns Depot Exit To Next Service Continuity evidence or action and preserves its declared relationship to the current selection. |
| `broken-unit-chain-and-formation-coverage-gaps` | Owns Broken Unit Chain And Formation Coverage Gaps evidence or action and preserves its declared relationship to the current selection. |
| `identity-specific-swap-or-resequence-scenarios` | Owns Identity Specific Swap Or Resequence Scenarios evidence or action and preserves its declared relationship to the current selection. |
| `whole-circulation-release-and-depot-handoff` | Owns Whole Circulation Release And Depot Handoff evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Service-leg requirements, parallel unit chains, formation events, depot/maintenance windows, broken continuity and swap scenarios remain aligned; only the bounded circulation canvas owns horizontal overflow.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `circulation-planner` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected unit and broken transition stay pinned; circulation-chain and depot/maintenance evidence alternate while formation and coverage status persist.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Uncovered service formation → named candidate unit → prior service arrival → couple/split membership → depot path and stabling position → that unit's maintenance due-state/window → depot exit and next service → downstream coverage after swap/resequence → complete identity chain → release/handoff; a unit-centered event sequence replaces the Gantt.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `circulation-planner → operating-plan-horizon-and-fleet-policy → service-leg-and-required-formation-graph → named-physical-unit-roster-capability-and-due-state → identity-preserving-unit-to-service-leg-chains ↔ couple-split-and-formation-membership-events → arrival-to-depot-path-and-stabling-position → unit-specific-cleaning-inspection-and-maintenance-window → depot-exit-to-next-service-continuity → broken-unit-chain-and-formation-coverage-gaps → identity-specific-swap-or-resequence-scenarios → whole-circulation-release-and-depot-handoff`.
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

Task-specific states: Operating plan loading/versioned, unit available/in-service/stabled/failed, capability compatible/incompatible, leg covered/uncovered, connection feasible/tight/broken, coupling/splitting planned/confirmed/failed, maintenance not-due/due/overdue/completed, depot capacity available/full, swap proposed/feasible/new-gap, circulation draft/feasible/released/superseded and depot handoff pending/acknowledged.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `operating-plan-horizon-and-fleet-policy` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `service-leg-and-required-formation-graph` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `service-leg-and-required-formation-graph` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `identity-specific-swap-or-resequence-scenarios` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `whole-circulation-release-and-depot-handoff` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `whole-circulation-release-and-depot-handoff` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `whole-circulation-release-and-depot-handoff` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `operating-plan-horizon-and-fleet-policy` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `whole-circulation-release-and-depot-handoff` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `circulation-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `calendar-resource-scheduler`; this is `AR-RSCMP-90` evidence and must route to an adjacent archetype.
- Reject `fleet-route-dispatch-planner`; this is `AR-RSCMP-91` evidence and must route to an adjacent archetype.
- Reject `critical-path-project-planner`; this is `AR-RSCMP-92` evidence and must route to an adjacent archetype.
- Reject `inventory-replenishment-planner`; this is `AR-RSCMP-93` evidence and must route to an adjacent archetype.

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
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ERA Telematics Applications TSI](https://www.era.europa.eu/content/new-telematics-applications-tsi-enters-force) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Network Rail timetable planning](https://www.networkrail.co.uk/industry-and-commercial/the-timetable/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "rolling-stock-circulation-maintenance-planner",
  "situationCodes": [
    "<matched AR-RSCMP-* codes>"
  ],
  "searchAliases": [
    "rolling stock circulation maintenance",
    "rolling stock circulation maintenance workspace",
    "rolling stock circulation maintenance control"
  ],
  "dominantTask": "Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release.",
  "regions": [
    "circulation-planner",
    "operating-plan-horizon-and-fleet-policy",
    "service-leg-and-required-formation-graph",
    "named-physical-unit-roster-capability-and-due-state",
    "identity-preserving-unit-to-service-leg-chains",
    "couple-split-and-formation-membership-events",
    "arrival-to-depot-path-and-stabling-position",
    "unit-specific-cleaning-inspection-and-maintenance-window",
    "depot-exit-to-next-service-continuity",
    "broken-unit-chain-and-formation-coverage-gaps",
    "identity-specific-swap-or-resequence-scenarios",
    "whole-circulation-release-and-depot-handoff"
  ],
  "regionRelationships": [
    "a fleet type or anonymous spare can never substitute for the named unit whose service, formation, depot and maintenance history must remain continuous."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "circulation-planner -> operating-plan-horizon-and-fleet-policy -> service-leg-and-required-formation-graph -> named-physical-unit-roster-capability-and-due-state -> identity-preserving-unit-to-service-leg-chains -> couple-split-and-formation-membership-events -> arrival-to-depot-path-and-stabling-position -> unit-specific-cleaning-inspection-and-maintenance-window -> depot-exit-to-next-service-continuity -> broken-unit-chain-and-formation-coverage-gaps -> identity-specific-swap-or-resequence-scenarios -> whole-circulation-release-and-depot-handoff",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "circulation-planner",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Operating plan loading/versioned",
    "unit available/in-service/stabled/failed",
    "capability compatible/incompatible",
    "leg covered/uncovered",
    "connection feasible/tight/broken",
    "coupling/splitting planned/confirmed/failed",
    "maintenance not-due/due/overdue/completed",
    "depot capacity available/full",
    "swap proposed/feasible/new-gap",
    "circulation draft/feasible/released/superseded",
    "depot handoff pending/acknowledged"
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

