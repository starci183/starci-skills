# Funnel path analysis

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `funnel-path-analysis` |
| Family | Overview |
| Dominant task | Find conversion and drop-off in an ordered stage path and drill into the segment or transition causing loss. |
| Search aliases | `conversion funnel`, `stage drop-off`, `ordered path analysis`, `transition loss` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Stage order and each transition denominator remain visible in every topology.
- The region graph remains `funnel-analysis` → `cohort-period-filters` → `ordered-stage-funnel` → `transition-metrics` → `dropoff-priority` → `selected-transition-breakdown`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FA-01` | The dominant task is: Find conversion and drop-off in an ordered stage path and drill into the segment or transition causing loss. | Candidate evidence. |
| `AR-FA-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-FA-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-FA-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-FA-90` | a lifecycle operational board | Reject. |
| `AR-FA-91` | a cohort-by-age grid | Reject. |
| `AR-FA-92` | a generic KPI dashboard | Reject. |
| `AR-FA-93` | a nonlinear path graph | Reject. |

### Selection rule

Select `funnel-path-analysis` only when `AR-FA-01`, `AR-FA-02`, and `AR-FA-03` are evidenced and none of `AR-FA-90`, `AR-FA-91`, `AR-FA-92`, or `AR-FA-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
funnel-analysis
└─ cohort-period-filters
   └─ ordered-stage-funnel
      └─ transition-metrics
         └─ dropoff-priority
            └─ selected-transition-breakdown
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `funnel-analysis` | Owns the page-level funnel analysis task and all descendant state. | Root of the graph. |
| `cohort-period-filters` | Owns cohort period filters evidence or action without borrowing product semantics. | Follows `funnel-analysis` in semantic order and retains the same selection context. |
| `ordered-stage-funnel` | Owns ordered stage funnel evidence or action without borrowing product semantics. | Follows `cohort-period-filters` in semantic order and retains the same selection context. |
| `transition-metrics` | Owns transition metrics evidence or action without borrowing product semantics. | Follows `ordered-stage-funnel` in semantic order and retains the same selection context. |
| `dropoff-priority` | Owns dropoff priority evidence or action without borrowing product semantics. | Follows `transition-metrics` in semantic order and retains the same selection context. |
| `selected-transition-breakdown` | Owns selected transition breakdown evidence or action without borrowing product semantics. | Follows `dropoff-priority` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the ordered funnel and transition metrics together with denominators visible beside selected breakdown.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** No region owns horizontal overflow; the page reflows vertically.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Preserve stage labels and denominators while detail moves below or into a drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** No region gains horizontal overflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use an ordered stage list with count, rate, and drop-off for every transition; the chart becomes optional.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The compact sequence uses page scrolling only.

### Reflow

- Semantic and DOM order is `funnel-analysis` → `cohort-period-filters` → `ordered-stage-funnel` → `transition-metrics` → `dropoff-priority` → `selected-transition-breakdown`.
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
| Initial / loading | `cohort-period-filters` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `ordered-stage-funnel` | Expose the complete dominant task with stage order and each transition denominator remain visible in every topology. |
| Empty / not applicable | `transition-metrics` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `dropoff-priority` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-transition-breakdown` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-transition-breakdown` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-transition-breakdown` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `cohort-period-filters` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-transition-breakdown` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `funnel-analysis` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: loading, no traffic, partial stages, denominator changed, segment apply, segment reset, selected transition, sparse result, comparison unavailable.

## Boundaries

### Accept

- Accept when the path has an evidenced ordered stage definition.
- Accept when drop-off depends on adjacent denominators.
- Accept when segment drilldown preserves stage order.

### Reject

- Reject a lifecycle operational board; this is `AR-FA-90` evidence and must route to an adjacent archetype.
- Reject a cohort-by-age grid; this is `AR-FA-91` evidence and must route to an adjacent archetype.
- Reject a generic KPI dashboard; this is `AR-FA-92` evidence and must route to an adjacent archetype.
- Reject a nonlinear path graph; this is `AR-FA-93` evidence and must route to an adjacent archetype.

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
| [Google Analytics — Funnel exploration](https://support.google.com/analytics/answer/9327974?hl=en) | Supports ordered funnel steps, entry rules, drop-off, segment comparison, and elapsed transitions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | Supports status, filtering, feedback, and resilient task-flow conventions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Supports accessible component states, selection, feedback, and coordinated data controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "funnel-path-analysis",
  "situationCodes": ["<matched AR-FA-* codes>"],
  "searchAliases": ["conversion funnel","stage drop-off","ordered path analysis","transition loss"],
  "dominantTask": "Find conversion and drop-off in an ordered stage path and drill into the segment or transition causing loss.",
  "regions": ["funnel-analysis","cohort-period-filters","ordered-stage-funnel","transition-metrics","dropoff-priority","selected-transition-breakdown"],
  "regionRelationships": ["funnel-analysis precedes cohort-period-filters precedes ordered-stage-funnel precedes transition-metrics precedes dropoff-priority precedes selected-transition-breakdown"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "funnel-analysis → cohort-period-filters → ordered-stage-funnel → transition-metrics → dropoff-priority → selected-transition-breakdown",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["loading", "no traffic", "partial stages", "denominator changed", "segment apply", "segment reset", "selected transition", "sparse result", "comparison unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
