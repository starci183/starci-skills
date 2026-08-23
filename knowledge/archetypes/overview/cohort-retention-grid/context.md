# Cohort retention grid

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cohort-retention-grid` |
| Family | Overview |
| Dominant task | Compare cohorts by relative age to detect retention or change patterns without calendar-date distortion. |
| Search aliases | `cohort grid`, `retention matrix`, `cohort age analysis`, `cohort heatmap with values` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Every cell retains cohort identity, relative age, numeric value, and applicability without color dependence.
- The region graph remains `cohort-analysis` → `definition-period-filters` → `cohort-by-age-grid` → `legend-and-baseline` → `cohort-trend-detail` → `selected-cell-explanation`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CR-01` | The dominant task is: Compare cohorts by relative age to detect retention or change patterns without calendar-date distortion. | Candidate evidence. |
| `AR-CR-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-CR-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-CR-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-CR-90` | a calendar heatmap | Reject. |
| `AR-CR-91` | a flat benchmark | Reject. |
| `AR-CR-92` | funnel stages | Reject. |
| `AR-CR-93` | a decorative color grid without exact values | Reject. |

### Selection rule

Select `cohort-retention-grid` only when `AR-CR-01`, `AR-CR-02`, and `AR-CR-03` are evidenced and none of `AR-CR-90`, `AR-CR-91`, `AR-CR-92`, or `AR-CR-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
cohort-analysis
└─ definition-period-filters
   └─ cohort-by-age-grid
      └─ legend-and-baseline
         └─ cohort-trend-detail
            └─ selected-cell-explanation
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `cohort-analysis` | Owns the page-level cohort analysis task and all descendant state. | Root of the graph. |
| `definition-period-filters` | Owns definition period filters evidence or action without borrowing product semantics. | Follows `cohort-analysis` in semantic order and retains the same selection context. |
| `cohort-by-age-grid` | Owns cohort by age grid evidence or action without borrowing product semantics. | Follows `definition-period-filters` in semantic order and retains the same selection context. |
| `legend-and-baseline` | Owns legend and baseline evidence or action without borrowing product semantics. | Follows `cohort-by-age-grid` in semantic order and retains the same selection context. |
| `cohort-trend-detail` | Owns cohort trend detail evidence or action without borrowing product semantics. | Follows `legend-and-baseline` in semantic order and retains the same selection context. |
| `selected-cell-explanation` | Owns selected cell explanation evidence or action without borrowing product semantics. | Follows `cohort-trend-detail` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the bounded cohort-by-age grid with frozen identities, exact values, legend, and selected-cell explanation.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `cohort-by-age-grid` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Narrow the visible age range or emphasize one cohort while explicitly preserving access to older periods.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `cohort-by-age-grid` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Choose a cohort or age slice and show exact trend values; the matrix remains an optional instructed scroller.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `cohort-by-age-grid` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `cohort-analysis` → `definition-period-filters` → `cohort-by-age-grid` → `legend-and-baseline` → `cohort-trend-detail` → `selected-cell-explanation`.
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
| Initial / loading | `definition-period-filters` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `cohort-by-age-grid` | Expose the complete dominant task with every cell retains cohort identity, relative age, numeric value, and applicability without color dependence. |
| Empty / not applicable | `legend-and-baseline` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `cohort-trend-detail` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-cell-explanation` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-cell-explanation` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-cell-explanation` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `definition-period-filters` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-cell-explanation` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `cohort-analysis` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: incomplete young cohort, missing cell, not-applicable cell, low sample, definition changed, baseline loading, selected cell, filter reset, export pending.

## Boundaries

### Accept

- Accept when rows are cohorts and columns are relative age.
- Accept when incomplete young cohorts remain distinguishable.
- Accept when exact values and headers support every visual cue.

### Reject

- Reject a calendar heatmap; this is `AR-CR-90` evidence and must route to an adjacent archetype.
- Reject a flat benchmark; this is `AR-CR-91` evidence and must route to an adjacent archetype.
- Reject funnel stages; this is `AR-CR-92` evidence and must route to an adjacent archetype.
- Reject a decorative color grid without exact values; this is `AR-CR-93` evidence and must route to an adjacent archetype.

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
| [Google Analytics — Cohort exploration](https://support.google.com/analytics/answer/9670133?hl=en) | Supports cohort inclusion, relative daily or weekly age, return criteria, and cohort-table cells. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "cohort-retention-grid",
  "situationCodes": ["<matched AR-CR-* codes>"],
  "searchAliases": ["cohort grid","retention matrix","cohort age analysis","cohort heatmap with values"],
  "dominantTask": "Compare cohorts by relative age to detect retention or change patterns without calendar-date distortion.",
  "regions": ["cohort-analysis","definition-period-filters","cohort-by-age-grid","legend-and-baseline","cohort-trend-detail","selected-cell-explanation"],
  "regionRelationships": ["cohort-analysis precedes definition-period-filters precedes cohort-by-age-grid precedes legend-and-baseline precedes cohort-trend-detail precedes selected-cell-explanation"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "cohort-analysis → definition-period-filters → cohort-by-age-grid → legend-and-baseline → cohort-trend-detail → selected-cell-explanation",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "cohort-by-age-grid",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["incomplete young cohort", "missing cell", "not-applicable cell", "low sample", "definition changed", "baseline loading", "selected cell", "filter reset", "export pending"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
