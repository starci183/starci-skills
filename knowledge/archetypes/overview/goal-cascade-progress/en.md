# Goal cascade progress

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `goal-cascade-progress` |
| Family | Overview |
| Dominant task | Understand outcome progress from a parent objective through child goals and results, including contribution and blockers. |
| Search aliases | `goal cascade`, `OKR progress tree`, `objective rollup`, `outcome hierarchy` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Parent roll-up never obscures the contributions and blockers of child outcomes.
- The region graph remains `goal-overview` → `period-owner-context` → `objective-tree` → `rollup-progress` → `at-risk-goals` → `selected-goal-contribution-detail`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-GC-01` | The dominant task is: Understand outcome progress from a parent objective through child goals and results, including contribution and blockers. | Candidate evidence. |
| `AR-GC-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-GC-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-GC-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-GC-90` | a portfolio multi-dimension matrix | Reject. |
| `AR-GC-91` | a generic task checklist | Reject. |
| `AR-GC-92` | a linear stage flow | Reject. |
| `AR-GC-93` | dashboard cards without a cascade | Reject. |

### Selection rule

Select `goal-cascade-progress` only when `AR-GC-01`, `AR-GC-02`, and `AR-GC-03` are evidenced and none of `AR-GC-90`, `AR-GC-91`, `AR-GC-92`, or `AR-GC-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
goal-overview
└─ period-owner-context
   └─ objective-tree
      └─ rollup-progress
         └─ at-risk-goals
            └─ selected-goal-contribution-detail
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `goal-overview` | Owns the page-level goal overview task and all descendant state. | Root of the graph. |
| `period-owner-context` | Owns period owner context evidence or action without borrowing product semantics. | Follows `goal-overview` in semantic order and retains the same selection context. |
| `objective-tree` | Owns objective tree evidence or action without borrowing product semantics. | Follows `period-owner-context` in semantic order and retains the same selection context. |
| `rollup-progress` | Owns rollup progress evidence or action without borrowing product semantics. | Follows `objective-tree` in semantic order and retains the same selection context. |
| `at-risk-goals` | Owns at risk goals evidence or action without borrowing product semantics. | Follows `rollup-progress` in semantic order and retains the same selection context. |
| `selected-goal-contribution-detail` | Owns selected goal contribution detail evidence or action without borrowing product semantics. | Follows `at-risk-goals` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the goal tree, progress, and owner associations together while at-risk detail supports the hierarchy.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** No region owns horizontal overflow; the page reflows vertically.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Reduce secondary columns and move detail to a drawer while progress, owner, and status remain attached to each node.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** No region gains horizontal overflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Drill through the objective path, show a priority summary per row, and restore the expanded path on Back.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The compact sequence uses page scrolling only.

### Reflow

- Semantic and DOM order is `goal-overview` → `period-owner-context` → `objective-tree` → `rollup-progress` → `at-risk-goals` → `selected-goal-contribution-detail`.
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
| Initial / loading | `period-owner-context` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `objective-tree` | Expose the complete dominant task with parent roll-up never obscures the contributions and blockers of child outcomes. |
| Empty / not applicable | `rollup-progress` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `at-risk-goals` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-goal-contribution-detail` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-goal-contribution-detail` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-goal-contribution-detail` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `period-owner-context` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-goal-contribution-detail` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `goal-overview` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: no goals, roll-up calculating, stale roll-up, blocked, at-risk, on-track, missing owner, dependency, archived period, selected goal conflict.

## Boundaries

### Accept

- Accept when parent and child outcomes form a contribution hierarchy.
- Accept when roll-up progress requires child evidence.
- Accept when blockers and owners remain attached to goals.

### Reject

- Reject a portfolio multi-dimension matrix; this is `AR-GC-90` evidence and must route to an adjacent archetype.
- Reject a generic task checklist; this is `AR-GC-91` evidence and must route to an adjacent archetype.
- Reject a linear stage flow; this is `AR-GC-92` evidence and must route to an adjacent archetype.
- Reject dashboard cards without a cascade; this is `AR-GC-93` evidence and must route to an adjacent archetype.

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
| [Atlassian — Use goal status to track objectives and key results](https://support.atlassian.com/platform-experiences/docs/use-goal-status-to-track-objectives-and-key-results/) | Supports parent goals, sub-goals, owners, progress states, and contributing work. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Supports explicit hierarchy, progress, status, and drilldown semantics across enterprise data surfaces. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Supports explicit status, disclosure, selection, and action-state patterns in dense work surfaces. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "goal-cascade-progress",
  "situationCodes": ["<matched AR-GC-* codes>"],
  "searchAliases": ["goal cascade","OKR progress tree","objective rollup","outcome hierarchy"],
  "dominantTask": "Understand outcome progress from a parent objective through child goals and results, including contribution and blockers.",
  "regions": ["goal-overview","period-owner-context","objective-tree","rollup-progress","at-risk-goals","selected-goal-contribution-detail"],
  "regionRelationships": ["goal-overview precedes period-owner-context precedes objective-tree precedes rollup-progress precedes at-risk-goals precedes selected-goal-contribution-detail"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "goal-overview → period-owner-context → objective-tree → rollup-progress → at-risk-goals → selected-goal-contribution-detail",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["no goals", "roll-up calculating", "stale roll-up", "blocked", "at-risk", "on-track", "missing owner", "dependency", "archived period", "selected goal conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
