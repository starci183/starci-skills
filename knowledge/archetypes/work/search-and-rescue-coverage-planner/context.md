# Search and rescue coverage planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `search-and-rescue-coverage-planner` |
| Family | Work |
| Dominant task | Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage. |
| Search aliases | `search and rescue coverage`, `search and rescue coverage workspace`, `search and rescue coverage control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage.
- probability of containment, detection and cumulative search effort change after every result.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SARCP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-SARCP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-SARCP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-SARCP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-SARCP-90` | The dominant task is actually `fleet-route-dispatch-planner`. | Reject. |
| `AR-SARCP-91` | The dominant task is actually `map-led-situation-monitor`. | Reject. |
| `AR-SARCP-92` | The dominant task is actually `capacity-allocation-overview`. | Reject. |
| `AR-SARCP-93` | The dominant task is actually `orbital-conjunction-assessment-workbench`. | Reject. |

### Selection rule

Select `search-and-rescue-coverage-planner` if and only if `AR-SARCP-01` through `AR-SARCP-04` are evidenced and none of `AR-SARCP-90` through `AR-SARCP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
sar-coverage-planner → incident-object-survival-and-environment-context → scenario-weight-and-drift-particle-surface → probability-area-segmentation ↔ search-unit-sensor-endurance-register → pattern-track-spacing-and-effort-generator → coverage-pod-pos-calculation → asset-area-assignment-and-brief → executed-track-sighting-or-negative-result → posterior-redistribution-and-next-search-plan
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `sar-coverage-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `incident-object-survival-and-environment-context` | Owns Incident Object Survival And Environment Context evidence or action and preserves its declared relationship to the current selection. |
| `scenario-weight-and-drift-particle-surface` | Owns Scenario Weight And Drift Particle Surface evidence or action and preserves its declared relationship to the current selection. |
| `probability-area-segmentation` | Owns Probability Area Segmentation evidence or action and preserves its declared relationship to the current selection. |
| `search-unit-sensor-endurance-register` | Owns Search Unit Sensor Endurance Register evidence or action and preserves its declared relationship to the current selection. |
| `pattern-track-spacing-and-effort-generator` | Owns Pattern Track Spacing And Effort Generator evidence or action and preserves its declared relationship to the current selection. |
| `coverage-pod-pos-calculation` | Owns Coverage Pod Pos Calculation evidence or action and preserves its declared relationship to the current selection. |
| `asset-area-assignment-and-brief` | Owns Asset Area Assignment And Brief evidence or action and preserves its declared relationship to the current selection. |
| `executed-track-sighting-or-negative-result` | Owns Executed Track Sighting Or Negative Result evidence or action and preserves its declared relationship to the current selection. |
| `posterior-redistribution-and-next-search-plan` | Owns Posterior Redistribution And Next Search Plan evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Probability surface, scenario weights, asset/sensor register, generated patterns, coverage math and assignment plan remain visible; the probability map alone owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `sar-coverage-planner` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected probability area stays primary; map/pattern and asset/coverage calculations alternate while briefing and cumulative POS persist.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Incident evidence → scenario/drift summary → ranked probability areas → available sensor/endurance → proposed effort/pattern → POD/POS → assign/brief → result → redistributed posterior; ranked areas and track facts replace the miniature map.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `sar-coverage-planner → incident-object-survival-and-environment-context → scenario-weight-and-drift-particle-surface → probability-area-segmentation ↔ search-unit-sensor-endurance-register → pattern-track-spacing-and-effort-generator → coverage-pod-pos-calculation → asset-area-assignment-and-brief → executed-track-sighting-or-negative-result → posterior-redistribution-and-next-search-plan`.
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

Task-specific states: Environmental data loading/stale, scenario active/discounted, drift computed/uncertain, asset available/en route/on scene/exhausted, pattern draft/assigned/executing/complete, coverage insufficient/adequate, sighting unverified/confirmed/false, negative search posted, posterior recalculating, next plan feasible/resource-short and case suspended/resolved.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `incident-object-survival-and-environment-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `scenario-weight-and-drift-particle-surface` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `scenario-weight-and-drift-particle-surface` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `executed-track-sighting-or-negative-result` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `posterior-redistribution-and-next-search-plan` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `posterior-redistribution-and-next-search-plan` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `posterior-redistribution-and-next-search-plan` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `incident-object-survival-and-environment-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `posterior-redistribution-and-next-search-plan` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `sar-coverage-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `fleet-route-dispatch-planner`; this is `AR-SARCP-90` evidence and must route to an adjacent archetype.
- Reject `map-led-situation-monitor`; this is `AR-SARCP-91` evidence and must route to an adjacent archetype.
- Reject `capacity-allocation-overview`; this is `AR-SARCP-92` evidence and must route to an adjacent archetype.
- Reject `orbital-conjunction-assessment-workbench`; this is `AR-SARCP-93` evidence and must route to an adjacent archetype.

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
| [U.S. Coast Guard SAROPS](https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/International-Acquisition/SAROPS/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IMO documents relevant to SAR](https://www.imo.org/en/ourwork/safety/pages/imo-documents-relevant-to-sar.aspx) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "search-and-rescue-coverage-planner",
  "situationCodes": [
    "<matched AR-SARCP-* codes>"
  ],
  "searchAliases": [
    "search and rescue coverage",
    "search and rescue coverage workspace",
    "search and rescue coverage control"
  ],
  "dominantTask": "Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage.",
  "regions": [
    "sar-coverage-planner",
    "incident-object-survival-and-environment-context",
    "scenario-weight-and-drift-particle-surface",
    "probability-area-segmentation",
    "search-unit-sensor-endurance-register",
    "pattern-track-spacing-and-effort-generator",
    "coverage-pod-pos-calculation",
    "asset-area-assignment-and-brief",
    "executed-track-sighting-or-negative-result",
    "posterior-redistribution-and-next-search-plan"
  ],
  "regionRelationships": [
    "probability of containment, detection and cumulative search effort change after every result."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "sar-coverage-planner -> incident-object-survival-and-environment-context -> scenario-weight-and-drift-particle-surface -> probability-area-segmentation -> search-unit-sensor-endurance-register -> pattern-track-spacing-and-effort-generator -> coverage-pod-pos-calculation -> asset-area-assignment-and-brief -> executed-track-sighting-or-negative-result -> posterior-redistribution-and-next-search-plan",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "sar-coverage-planner",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Environmental data loading/stale",
    "scenario active/discounted",
    "drift computed/uncertain",
    "asset available/en route/on scene/exhausted",
    "pattern draft/assigned/executing/complete",
    "coverage insufficient/adequate",
    "sighting unverified/confirmed/false",
    "negative search posted",
    "posterior recalculating",
    "next plan feasible/resource-short",
    "case suspended/resolved"
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

