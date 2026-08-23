# Flight procedure obstacle clearance designer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `flight-procedure-obstacle-clearance-designer` |
| Family | Work |
| Dominant task | Construct and independently validate an instrument flight procedure by defining ordered segments and protection areas, evaluating terrain and obstacles, deriving minima and encoding the publishable procedure. |
| Search aliases | `flight procedure obstacle clearance`, `flight procedure obstacle clearance workspace`, `flight procedure obstacle clearance control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Construct and independently validate an instrument flight procedure by defining ordered segments and protection areas, evaluating terrain and obstacles, deriving minima and encoding the publishable procedure.
- segment geometry, protection surfaces, obstacle evaluation and encoded output retain one traceable coordinate authority.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FPOCD-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-FPOCD-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-FPOCD-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-FPOCD-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-FPOCD-90` | The dominant task is actually `spatial-route-itinerary-explorer`. | Reject. |
| `AR-FPOCD-91` | The dominant task is actually `flight-dispatch-release-workbench`. | Reject. |
| `AR-FPOCD-92` | The dominant task is actually `canvas-inspector-studio`. | Reject. |
| `AR-FPOCD-93` | The dominant task is actually `geospatial-raster-layer-analysis-workbench`. | Reject. |

### Selection rule

Select `flight-procedure-obstacle-clearance-designer` if and only if `AR-FPOCD-01` through `AR-FPOCD-04` are evidenced and none of `AR-FPOCD-90` through `AR-FPOCD-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
procedure-designer → aerodrome-runway-navigation-and-criteria-version → ordered-procedure-segment-model ↔ geographic-centerline-and-protection-surfaces → obstacle-and-terrain-inventory → penetration-and-required-clearance-calculation → minima-and-gradient-ledger → coded-path-and-chart-data → independent-validation-findings → approved-publication-package
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `procedure-designer` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `aerodrome-runway-navigation-and-criteria-version` | Owns Aerodrome Runway Navigation And Criteria Version evidence or action and preserves its declared relationship to the current selection. |
| `ordered-procedure-segment-model` | Owns Ordered Procedure Segment Model evidence or action and preserves its declared relationship to the current selection. |
| `geographic-centerline-and-protection-surfaces` | Owns Geographic Centerline And Protection Surfaces evidence or action and preserves its declared relationship to the current selection. |
| `obstacle-and-terrain-inventory` | Owns Obstacle And Terrain Inventory evidence or action and preserves its declared relationship to the current selection. |
| `penetration-and-required-clearance-calculation` | Owns Penetration And Required Clearance Calculation evidence or action and preserves its declared relationship to the current selection. |
| `minima-and-gradient-ledger` | Owns Minima And Gradient Ledger evidence or action and preserves its declared relationship to the current selection. |
| `coded-path-and-chart-data` | Owns Coded Path And Chart Data evidence or action and preserves its declared relationship to the current selection. |
| `independent-validation-findings` | Owns Independent Validation Findings evidence or action and preserves its declared relationship to the current selection. |
| `approved-publication-package` | Owns Approved Publication Package evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Segment model, geographic construction, selected obstacle calculation, minima ledger, encoded path and validation findings remain simultaneously inspectable; the geographic construction alone owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `geographic-centerline-and-protection-surfaces` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected segment and its controlling obstacle remain pinned while construction, calculation and coded-output views alternate; validation status stays visible.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Procedure segment → protection-area parameters → controlling obstacles → clearance/minima result → coded path → independent finding → approve/revise; a segment-by-segment numeric cross-section replaces the full geographic construction.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `procedure-designer → aerodrome-runway-navigation-and-criteria-version → ordered-procedure-segment-model ↔ geographic-centerline-and-protection-surfaces → obstacle-and-terrain-inventory → penetration-and-required-clearance-calculation → minima-and-gradient-ledger → coded-path-and-chart-data → independent-validation-findings → approved-publication-package`.
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

Task-specific states: Criteria loading/current/superseded, segment incomplete/valid, navigation data current/stale, obstacle unassessed/clear/penetrating/controlling, clearance pass/fail, minima provisional/final, coded path invalid/valid, validation open/resolved/waived with authority, package draft/approved/published and amendment superseding.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `aerodrome-runway-navigation-and-criteria-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `ordered-procedure-segment-model` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `ordered-procedure-segment-model` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `independent-validation-findings` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `approved-publication-package` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `approved-publication-package` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `approved-publication-package` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `aerodrome-runway-navigation-and-criteria-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `approved-publication-package` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `procedure-designer` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Construct and independently validate an instrument flight procedure by defining ordered segments and protection areas, evaluating terrain and obstacles, deriving minima and encoding the publishable procedure.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `spatial-route-itinerary-explorer`; this is `AR-FPOCD-90` evidence and must route to an adjacent archetype.
- Reject `flight-dispatch-release-workbench`; this is `AR-FPOCD-91` evidence and must route to an adjacent archetype.
- Reject `canvas-inspector-studio`; this is `AR-FPOCD-92` evidence and must route to an adjacent archetype.
- Reject `geospatial-raster-layer-analysis-workbench`; this is `AR-FPOCD-93` evidence and must route to an adjacent archetype.

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
| [FAA Order 8260.3G — TERPS](https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.current/documentNumber/8260.3) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ICAO Instrument Flight Procedures resources](https://www.icao.int/operational-safety/flightprocedure) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "flight-procedure-obstacle-clearance-designer",
  "situationCodes": [
    "<matched AR-FPOCD-* codes>"
  ],
  "searchAliases": [
    "flight procedure obstacle clearance",
    "flight procedure obstacle clearance workspace",
    "flight procedure obstacle clearance control"
  ],
  "dominantTask": "Construct and independently validate an instrument flight procedure by defining ordered segments and protection areas, evaluating terrain and obstacles, deriving minima and encoding the publishable procedure.",
  "regions": [
    "procedure-designer",
    "aerodrome-runway-navigation-and-criteria-version",
    "ordered-procedure-segment-model",
    "geographic-centerline-and-protection-surfaces",
    "obstacle-and-terrain-inventory",
    "penetration-and-required-clearance-calculation",
    "minima-and-gradient-ledger",
    "coded-path-and-chart-data",
    "independent-validation-findings",
    "approved-publication-package"
  ],
  "regionRelationships": [
    "segment geometry, protection surfaces, obstacle evaluation and encoded output retain one traceable coordinate authority."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "procedure-designer -> aerodrome-runway-navigation-and-criteria-version -> ordered-procedure-segment-model -> geographic-centerline-and-protection-surfaces -> obstacle-and-terrain-inventory -> penetration-and-required-clearance-calculation -> minima-and-gradient-ledger -> coded-path-and-chart-data -> independent-validation-findings -> approved-publication-package",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "geographic-centerline-and-protection-surfaces",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Criteria loading/current/superseded",
    "segment incomplete/valid",
    "navigation data current/stale",
    "obstacle unassessed/clear/penetrating/controlling",
    "clearance pass/fail",
    "minima provisional/final",
    "coded path invalid/valid",
    "validation open/resolved/waived with authority",
    "package draft/approved/published",
    "amendment superseding"
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

