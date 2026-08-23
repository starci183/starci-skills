# Statistical process control overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `statistical-process-control-overview` |
| Family | Overview |
| Dominant task | Distinguish common-cause variation from rule-based process anomalies and inspect evidence around one violation. |
| Search aliases | `SPC overview`, `control chart monitor`, `process anomaly chart`, `control limits` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Control limits, rule identity, point value, and investigation status remain textual and explicit.
- The region graph remains `process-control` → `process-metric-period-context` → `control-chart-with-limits` → `rule-violation-markers` → `process-capability-distribution` → `anomaly-register` → `selected-anomaly-evidence`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SP-01` | The dominant task is: Distinguish common-cause variation from rule-based process anomalies and inspect evidence around one violation. | Candidate evidence. |
| `AR-SP-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-SP-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-SP-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-SP-90` | a generic KPI trend | Reject. |
| `AR-SP-91` | a live status timeline | Reject. |
| `AR-SP-92` | a benchmark distribution | Reject. |
| `AR-SP-93` | an editable process workflow | Reject. |

### Selection rule

Select `statistical-process-control-overview` only when `AR-SP-01`, `AR-SP-02`, and `AR-SP-03` are evidenced and none of `AR-SP-90`, `AR-SP-91`, `AR-SP-92`, or `AR-SP-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
process-control
└─ process-metric-period-context
   └─ control-chart-with-limits
      └─ rule-violation-markers
         └─ process-capability-distribution
            └─ anomaly-register
               └─ selected-anomaly-evidence
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `process-control` | Owns the page-level process control task and all descendant state. | Root of the graph. |
| `process-metric-period-context` | Owns process metric period context evidence or action without borrowing product semantics. | Follows `process-control` in semantic order and retains the same selection context. |
| `control-chart-with-limits` | Owns control chart with limits evidence or action without borrowing product semantics. | Follows `process-metric-period-context` in semantic order and retains the same selection context. |
| `rule-violation-markers` | Owns rule violation markers evidence or action without borrowing product semantics. | Follows `control-chart-with-limits` in semantic order and retains the same selection context. |
| `process-capability-distribution` | Owns process capability distribution evidence or action without borrowing product semantics. | Follows `rule-violation-markers` in semantic order and retains the same selection context. |
| `anomaly-register` | Owns anomaly register evidence or action without borrowing product semantics. | Follows `process-capability-distribution` in semantic order and retains the same selection context. |
| `selected-anomaly-evidence` | Owns selected anomaly evidence evidence or action without borrowing product semantics. | Follows `anomaly-register` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the control chart primary with explicit limits, rule markers, capability evidence, and anomaly detail.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `control-chart-with-limits` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Retain a readable chart run, raise the anomaly register, and move selected evidence into a drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `control-chart-with-limits` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Start with anomalies, then show selected point context, a compact chart segment, and capability summary.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `control-chart-with-limits` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `process-control` → `process-metric-period-context` → `control-chart-with-limits` → `rule-violation-markers` → `process-capability-distribution` → `anomaly-register` → `selected-anomaly-evidence`.
- Text, zoom, long translation, and enlarged controls trigger the same named topology changes.
- No CSS ordering changes the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap; hidden detail has an explicit accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected entity, filters, data state, and pending or completed result.
- Dynamic updates announce one contextual status message without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `process-metric-period-context` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `control-chart-with-limits` | Expose the complete dominant task with control limits, rule identity, point value, and investigation status remain textual and explicit. |
| Empty / not applicable | `rule-violation-markers` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `process-capability-distribution` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-anomaly-evidence` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-anomaly-evidence` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-anomaly-evidence` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `process-metric-period-context` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-anomaly-evidence` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `process-control` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: baseline calculating, baseline locked, in control, rule violation, limit shift, missing point, late data, selected anomaly, disabled rule, insufficient sample, investigation status.

## Boundaries

### Accept

- Accept when a stable process baseline defines control limits.
- Accept when rule violations differ from ordinary variation.
- Accept when selected anomalies require local evidence.

### Reject

- Reject a generic KPI trend; this is `AR-SP-90` evidence and must route to an adjacent archetype.
- Reject a live status timeline; this is `AR-SP-91` evidence and must route to an adjacent archetype.
- Reject a benchmark distribution; this is `AR-SP-92` evidence and must route to an adjacent archetype.
- Reject an editable process workflow; this is `AR-SP-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved. Differences limited to nouns, card count, density, color, component, or state are `duplicate-or-variation`, not a new archetype.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, eligibility, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [NIST/SEMATECH — What are control charts?](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc31.htm) | Supports center lines, upper and lower control limits, and assignable-cause investigation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Supports accessible component states, selection, feedback, and coordinated data controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "statistical-process-control-overview",
  "situationCodes": ["<matched AR-SP-* codes>"],
  "searchAliases": ["SPC overview","control chart monitor","process anomaly chart","control limits"],
  "dominantTask": "Distinguish common-cause variation from rule-based process anomalies and inspect evidence around one violation.",
  "regions": ["process-control","process-metric-period-context","control-chart-with-limits","rule-violation-markers","process-capability-distribution","anomaly-register","selected-anomaly-evidence"],
  "regionRelationships": ["process-control precedes process-metric-period-context precedes control-chart-with-limits precedes rule-violation-markers precedes process-capability-distribution precedes anomaly-register precedes selected-anomaly-evidence"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "process-control → process-metric-period-context → control-chart-with-limits → rule-violation-markers → process-capability-distribution → anomaly-register → selected-anomaly-evidence",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "control-chart-with-limits",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["baseline calculating", "baseline locked", "in control", "rule violation", "limit shift", "missing point", "late data", "selected anomaly", "disabled rule", "insufficient sample", "investigation status"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
