# Portfolio health matrix

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `portfolio-health-matrix` |
| Family | Overview |
| Dominant task | Scan a portfolio hierarchy across common health dimensions, find an outlier, and drill into the accountable unit. |
| Search aliases | `portfolio matrix`, `hierarchical health grid`, `unit dimension matrix`, `portfolio outliers` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Row identity preserves parent-child roll-up and every health value keeps its dimension header.
- The region graph remains `portfolio-monitor` → `scope-period-filters` → `hierarchy-summary` → `unit-by-dimension-matrix` → `exception-list` → `selected-unit-drilldown`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PH-01` | The dominant task is: Scan a portfolio hierarchy across common health dimensions, find an outlier, and drill into the accountable unit. | Candidate evidence. |
| `AR-PH-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-PH-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-PH-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-PH-90` | a flat comparison decision | Reject. |
| `AR-PH-91` | a heterogeneous card dashboard | Reject. |
| `AR-PH-92` | permissions matrix editing | Reject. |
| `AR-PH-93` | a goal tree with one progress measure | Reject. |

### Selection rule

Select `portfolio-health-matrix` only when `AR-PH-01`, `AR-PH-02`, and `AR-PH-03` are evidenced and none of `AR-PH-90`, `AR-PH-91`, `AR-PH-92`, or `AR-PH-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
portfolio-monitor
└─ scope-period-filters
   └─ hierarchy-summary
      └─ unit-by-dimension-matrix
         └─ exception-list
            └─ selected-unit-drilldown
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `portfolio-monitor` | Owns the page-level portfolio monitor task and all descendant state. | Root of the graph. |
| `scope-period-filters` | Owns scope period filters evidence or action without borrowing product semantics. | Follows `portfolio-monitor` in semantic order and retains the same selection context. |
| `hierarchy-summary` | Owns hierarchy summary evidence or action without borrowing product semantics. | Follows `scope-period-filters` in semantic order and retains the same selection context. |
| `unit-by-dimension-matrix` | Owns unit by dimension matrix evidence or action without borrowing product semantics. | Follows `hierarchy-summary` in semantic order and retains the same selection context. |
| `exception-list` | Owns exception list evidence or action without borrowing product semantics. | Follows `unit-by-dimension-matrix` in semantic order and retains the same selection context. |
| `selected-unit-drilldown` | Owns selected unit drilldown evidence or action without borrowing product semantics. | Follows `exception-list` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep hierarchy and the full matrix together while exceptions and selected detail support the scan.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `unit-by-dimension-matrix` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Group or collapse dimensions explicitly and move drilldown to an overlay without silently removing a dimension.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `unit-by-dimension-matrix` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Choose a dimension or unit first, then inspect grouped summaries and exceptions with an explicit switch.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `unit-by-dimension-matrix` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `portfolio-monitor` → `scope-period-filters` → `hierarchy-summary` → `unit-by-dimension-matrix` → `exception-list` → `selected-unit-drilldown`.
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
| Initial / loading | `scope-period-filters` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `hierarchy-summary` | Expose the complete dominant task with row identity preserves parent-child roll-up and every health value keeps its dimension header. |
| Empty / not applicable | `unit-by-dimension-matrix` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `exception-list` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-unit-drilldown` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-unit-drilldown` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-unit-drilldown` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `scope-period-filters` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-unit-drilldown` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `portfolio-monitor` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: roll-up loading, partial roll-up, no units, unknown metric, not-applicable metric, collapsed branch, stale unit, selected outlier, threshold context, permission-redacted child.

## Boundaries

### Accept

- Accept when peer units share the same health dimensions.
- Accept when hierarchy roll-up affects interpretation.
- Accept when outliers must retain accountable unit identity.

### Reject

- Reject a flat comparison decision; this is `AR-PH-90` evidence and must route to an adjacent archetype.
- Reject a heterogeneous card dashboard; this is `AR-PH-91` evidence and must route to an adjacent archetype.
- Reject permissions matrix editing; this is `AR-PH-92` evidence and must route to an adjacent archetype.
- Reject a goal tree with one progress measure; this is `AR-PH-93` evidence and must route to an adjacent archetype.

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
| [WAI-ARIA APG — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports hierarchical row expansion and keyboard-operable grid relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Supports explicit hierarchy, progress, status, and drilldown semantics across enterprise data surfaces. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Atlassian Support — Jira Align custom hierarchy domain health](https://support.atlassian.com/jira-align/kb/jira-align-api-endpoints-for-accessing-custom-room-data/) | Supports hierarchical domains with explicit health records and relations as task-specific evidence. | Does not impose Jira Align nouns, API shape, scoring policy, or layout on this archetype. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "portfolio-health-matrix",
  "situationCodes": ["<matched AR-PH-* codes>"],
  "searchAliases": ["portfolio matrix","hierarchical health grid","unit dimension matrix","portfolio outliers"],
  "dominantTask": "Scan a portfolio hierarchy across common health dimensions, find an outlier, and drill into the accountable unit.",
  "regions": ["portfolio-monitor","scope-period-filters","hierarchy-summary","unit-by-dimension-matrix","exception-list","selected-unit-drilldown"],
  "regionRelationships": ["portfolio-monitor precedes scope-period-filters precedes hierarchy-summary precedes unit-by-dimension-matrix precedes exception-list precedes selected-unit-drilldown"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "portfolio-monitor → scope-period-filters → hierarchy-summary → unit-by-dimension-matrix → exception-list → selected-unit-drilldown",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "unit-by-dimension-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["roll-up loading", "partial roll-up", "no units", "unknown metric", "not-applicable metric", "collapsed branch", "stale unit", "selected outlier", "threshold context", "permission-redacted child"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
