# Capacity allocation overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `capacity-allocation-overview` |
| Family | Overview |
| Dominant task | Recognize overload, underuse, and availability gaps across resources before opening an allocation workbench. |
| Search aliases | `capacity overview`, `resource load lanes`, `demand supply balance`, `allocation diagnosis` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Demand, availability, and load use one declared capacity unit across the horizon.
- The region graph remains `capacity-overview` → `horizon-scope-controls` → `aggregate-demand-supply` → `resource-capacity-lanes` → `imbalance-exceptions` → `selected-resource-breakdown`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CA-01` | The dominant task is: Recognize overload, underuse, and availability gaps across resources before opening an allocation workbench. | Candidate evidence. |
| `AR-CA-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-CA-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-CA-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-CA-90` | direct drag booking or collision resolution | Reject. |
| `AR-CA-91` | schedule-event browsing | Reject. |
| `AR-CA-92` | metrics without a common capacity unit | Reject. |
| `AR-CA-93` | a generic utilization KPI dashboard | Reject. |

### Selection rule

Select `capacity-allocation-overview` only when `AR-CA-01`, `AR-CA-02`, and `AR-CA-03` are evidenced and none of `AR-CA-90`, `AR-CA-91`, `AR-CA-92`, or `AR-CA-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
capacity-overview
└─ horizon-scope-controls
   └─ aggregate-demand-supply
      └─ resource-capacity-lanes
         └─ imbalance-exceptions
            └─ selected-resource-breakdown
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `capacity-overview` | Owns the page-level capacity overview task and all descendant state. | Root of the graph. |
| `horizon-scope-controls` | Owns horizon scope controls evidence or action without borrowing product semantics. | Follows `capacity-overview` in semantic order and retains the same selection context. |
| `aggregate-demand-supply` | Owns aggregate demand supply evidence or action without borrowing product semantics. | Follows `horizon-scope-controls` in semantic order and retains the same selection context. |
| `resource-capacity-lanes` | Owns resource capacity lanes evidence or action without borrowing product semantics. | Follows `aggregate-demand-supply` in semantic order and retains the same selection context. |
| `imbalance-exceptions` | Owns imbalance exceptions evidence or action without borrowing product semantics. | Follows `resource-capacity-lanes` in semantic order and retains the same selection context. |
| `selected-resource-breakdown` | Owns selected resource breakdown evidence or action without borrowing product semantics. | Follows `imbalance-exceptions` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep aggregate demand and supply with resource-by-period lanes while selected breakdown supports diagnosis.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `resource-capacity-lanes` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Shorten the horizon or group resources and raise exceptions before moving detail to an overlay.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `resource-capacity-lanes` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Start with imbalance exceptions and open capacity-by-period detail for one selected resource.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `resource-capacity-lanes` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `capacity-overview` → `horizon-scope-controls` → `aggregate-demand-supply` → `resource-capacity-lanes` → `imbalance-exceptions` → `selected-resource-breakdown`.
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
| Initial / loading | `horizon-scope-controls` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `aggregate-demand-supply` | Expose the complete dominant task with demand, availability, and load use one declared capacity unit across the horizon. |
| Empty / not applicable | `resource-capacity-lanes` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `imbalance-exceptions` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-resource-breakdown` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-resource-breakdown` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-resource-breakdown` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `horizon-scope-controls` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-resource-breakdown` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `capacity-overview` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: capacity loading, unknown capacity, zero demand, over threshold, under threshold, unavailable period, forecast versus actual, stale allocation, permission-limited resource.

## Boundaries

### Accept

- Accept when resources share a measurable capacity unit.
- Accept when imbalance across a horizon drives diagnosis.
- Accept when editing allocation occurs in a separate workbench.

### Reject

- Reject direct drag booking or collision resolution; this is `AR-CA-90` evidence and must route to an adjacent archetype.
- Reject schedule-event browsing; this is `AR-CA-91` evidence and must route to an adjacent archetype.
- Reject metrics without a common capacity unit; this is `AR-CA-92` evidence and must route to an adjacent archetype.
- Reject a generic utilization KPI dashboard; this is `AR-CA-93` evidence and must route to an adjacent archetype.

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
| [Atlassian — Capacity planning introduction](https://success.atlassian.com/solution-paths/agile-at-scale/program-discovery/program-discovery-07-capacity/intro-capacity) | Supports common capacity units, historical evidence, and demand-versus-availability decisions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Supports explicit status, disclosure, selection, and action-state patterns in dense work surfaces. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "capacity-allocation-overview",
  "situationCodes": ["<matched AR-CA-* codes>"],
  "searchAliases": ["capacity overview","resource load lanes","demand supply balance","allocation diagnosis"],
  "dominantTask": "Recognize overload, underuse, and availability gaps across resources before opening an allocation workbench.",
  "regions": ["capacity-overview","horizon-scope-controls","aggregate-demand-supply","resource-capacity-lanes","imbalance-exceptions","selected-resource-breakdown"],
  "regionRelationships": ["capacity-overview precedes horizon-scope-controls precedes aggregate-demand-supply precedes resource-capacity-lanes precedes imbalance-exceptions precedes selected-resource-breakdown"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "capacity-overview → horizon-scope-controls → aggregate-demand-supply → resource-capacity-lanes → imbalance-exceptions → selected-resource-breakdown",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "resource-capacity-lanes",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["capacity loading", "unknown capacity", "zero demand", "over threshold", "under threshold", "unavailable period", "forecast versus actual", "stale allocation", "permission-limited resource"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
