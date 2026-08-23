# Rail Possession Access Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rail-possession-access-planner` |
| Family | Work |
| Dominant task | Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line. |
| Search aliases | `possession`, `access`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line.
- The required region graph remains `rail-possession → corridor-service-and-access-window → exact-track-possession-limits ↔ protecting-signal-point-and-block-boundaries → possession-authority-and-take-sequence → nested-worksite-boundary-and-authority-tree → engineering-train-access-and-movement-plan → live-worksite-people-plant-train-and-exception-register → child-worksite-clearance-receipts → protection-removal-and-possession-give-up-authority → service-handback-record`.
- The mandatory relationship remains: outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must define outer possession limits, place protection, take the possession under one authority, open at least two nested worksites under distinct owners, admit an engineering train, block give-up on one missing child receipt, clear each owner in order and record accepted handback without relying on drag.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-10-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-10-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-10-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-10-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-10-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-10-90` | The dominant task is actually `railway-movement-authority-control-console`. | Reject. |
| `AR-B13-10-91` | The dominant task is actually `rail-disruption-timetable-recovery-workbench`. | Reject. |
| `AR-B13-10-92` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-B13-10-93` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-10-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `rail-possession-access-planner` only when `AR-B13-10-01` through `AR-B13-10-05` are evidenced and none of `AR-B13-10-90` through `AR-B13-10-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
rail-possession
└─ corridor-service-and-access-window
   └─ exact-track-possession-limits
      ↔─ protecting-signal-point-and-block-boundaries
         └─ possession-authority-and-take-sequence
            └─ nested-worksite-boundary-and-authority-tree
               └─ engineering-train-access-and-movement-plan
                  └─ live-worksite-people-plant-train-and-exception-register
                     └─ child-worksite-clearance-receipts
                        └─ protection-removal-and-possession-give-up-authority
                           └─ service-handback-record
```

- Required relationship: outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `rail-possession` | Owns evidence, state, and action for rail possession without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `corridor-service-and-access-window` | Owns evidence, state, and action for corridor service and access window without borrowing product semantics. | Follows `rail-possession` in semantic order and receives its verified context. |
| `exact-track-possession-limits` | Owns evidence, state, and action for exact track possession limits without borrowing product semantics. | Follows `corridor-service-and-access-window` in semantic order and receives its verified context. |
| `protecting-signal-point-and-block-boundaries` | Owns evidence, state, and action for protecting signal point and block boundaries without borrowing product semantics. | Synchronizes bidirectionally with `exact-track-possession-limits` in the same selection context. |
| `possession-authority-and-take-sequence` | Owns evidence, state, and action for possession authority and take sequence without borrowing product semantics. | Follows `protecting-signal-point-and-block-boundaries` in semantic order and receives its verified context. |
| `nested-worksite-boundary-and-authority-tree` | Owns evidence, state, and action for nested worksite boundary and authority tree without borrowing product semantics. | Follows `possession-authority-and-take-sequence` in semantic order and receives its verified context. |
| `engineering-train-access-and-movement-plan` | Owns evidence, state, and action for engineering train access and movement plan without borrowing product semantics. | Follows `nested-worksite-boundary-and-authority-tree` in semantic order and receives its verified context. |
| `live-worksite-people-plant-train-and-exception-register` | Owns evidence, state, and action for live worksite people plant train and exception register without borrowing product semantics. | Follows `engineering-train-access-and-movement-plan` in semantic order and receives its verified context. |
| `child-worksite-clearance-receipts` | Owns evidence, state, and action for child worksite clearance receipts without borrowing product semantics. | Follows `live-worksite-people-plant-train-and-exception-register` in semantic order and receives its verified context. |
| `protection-removal-and-possession-give-up-authority` | Owns evidence, state, and action for protection removal and possession give up authority without borrowing product semantics. | Follows `child-worksite-clearance-receipts` in semantic order and receives its verified context. |
| `service-handback-record` | Owns evidence, state, and action for service handback record without borrowing product semantics. | Follows `protection-removal-and-possession-give-up-authority` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Exact track limits, protection, authority hierarchy, nested worksites/trains and current take-or-give step remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The possession boundary and active worksite authority remain primary; sibling worksites, full topology, notices and handback history move to synchronized routes while the containment hierarchy stays visible.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Possession identity/window → exact outer limits and protection → take authority → choose nested worksite → worksite owner/people/plant/train status → child-clearance receipt → remaining child blockers → remove protection → give-up authority → handback; the topology transforms into an authority-containment path rather than stacked worksite cards.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `rail-possession → corridor-service-and-access-window → exact-track-possession-limits ↔ protecting-signal-point-and-block-boundaries → possession-authority-and-take-sequence → nested-worksite-boundary-and-authority-tree → engineering-train-access-and-movement-plan → live-worksite-people-plant-train-and-exception-register → child-worksite-clearance-receipts → protection-removal-and-possession-give-up-authority → service-handback-record`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must define outer possession limits, place protection, take the possession under one authority, open at least two nested worksites under distinct owners, admit an engineering train, block give-up on one missing child receipt, clear each owner in order and record accepted handback without relying on drag.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `corridor-service-and-access-window` | Identify the pending owner and preserve its semantic position. |
| Ready | `exact-track-possession-limits` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `protecting-signal-point-and-block-boundaries` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `possession-authority-and-take-sequence` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `nested-worksite-boundary-and-authority-tree` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `protection-removal-and-possession-give-up-authority` | Prevent duplicate action and announce progress without moving focus. |
| Success | `service-handback-record` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `corridor-service-and-access-window` | Keep the last safe value and require explicit recovery. |
| Focus transition | `service-handback-record` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `rail-possession` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: access window draft/confirmed/curtailed, outer limits valid/conflicting, protection planned/placed/verified/removed, possession authority unreachable/confirmed/transferred, possession requested/granted/refused, worksite authority unassigned/accepted/transferred, worksite not-open/open/suspended/clear, engineering train outside/inside/stabled/clear, overrun predicted/active, child receipt missing/accepted, give-up blocked/accepted and service restored.

## Boundaries

### Accept

- Accept when the dominant task is: Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `railway-movement-authority-control-console`, `rail-disruption-timetable-recovery-workbench`, `calendar-resource-scheduler` or `permit-to-work-isolation-control-room`; exact possession limits, outer take/give authority, nested worksite authorities, engineering-train access and child-clearance-vetoed handback are mandatory.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources are current official pages verified during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [RSSB GERT8000-T3 Issue 13](https://www.rssb.co.uk/standards-catalogue/CatalogueItem/gert8000-t3-iss-13) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Network Rail Operational Rules](https://www.networkrail.co.uk/industry-and-commercial/information-for-operators/operational-rules/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "rail-possession-access-planner",
  "situationCodes": [
    "<matched AR-B13-10-* codes>"
  ],
  "searchAliases": [
    "possession",
    "access",
    "planner"
  ],
  "dominantTask": "Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line.",
  "regions": [
    "rail-possession",
    "corridor-service-and-access-window",
    "exact-track-possession-limits",
    "protecting-signal-point-and-block-boundaries",
    "possession-authority-and-take-sequence",
    "nested-worksite-boundary-and-authority-tree",
    "engineering-train-access-and-movement-plan",
    "live-worksite-people-plant-train-and-exception-register",
    "child-worksite-clearance-receipts",
    "protection-removal-and-possession-give-up-authority",
    "service-handback-record"
  ],
  "relationships": [
    "outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes."
  ],
  "responsive": {
    "wide": "Exact track limits, protection, authority hierarchy, nested worksites/trains and current take-or-give step remain simultaneously visible.",
    "intermediate": "The possession boundary and active worksite authority remain primary; sibling worksites, full topology, notices and handback history move to synchronized routes while the containment hierarchy stays visible.",
    "compact": "Possession identity/window → exact outer limits and protection → take authority → choose nested worksite → worksite owner/people/plant/train status → child-clearance receipt → remaining child blockers → remove protection → give-up authority → handback; the topology transforms into an authority-containment path rather than stacked worksite cards.",
    "reflow": [
      "rail-possession",
      "corridor-service-and-access-window",
      "exact-track-possession-limits",
      "protecting-signal-point-and-block-boundaries",
      "possession-authority-and-take-sequence",
      "nested-worksite-boundary-and-authority-tree",
      "engineering-train-access-and-movement-plan",
      "live-worksite-people-plant-train-and-exception-register",
      "child-worksite-clearance-receipts",
      "protection-removal-and-possession-give-up-authority",
      "service-handback-record"
    ]
  },
  "stateObligations": "access window draft/confirmed/curtailed, outer limits valid/conflicting, protection planned/placed/verified/removed, possession authority unreachable/confirmed/transferred, possession requested/granted/refused, worksite authority unassigned/accepted/transferred, worksite not-open/open/suspended/clear, engineering train outside/inside/stabled/clear, overrun predicted/active, child receipt missing/accepted, give-up blocked/accepted and service restored.",
  "boundaryVerdict": "accept | reject | needs-evidence | duplicate-or-variation",
  "grammarHandoff": "Bind product-specific owners, labels, permissions, actions, and truthful states.",
  "principlesHandoff": "Resolve exact geometry, measure, spacing, alignment, overflow, and relationship-driven transitions.",
  "confidence": "high | medium | low",
  "evidenceClasses": [
    "dominant-task",
    "region-graph",
    "responsive-parity",
    "state-family",
    "boundary",
    "official-research"
  ]
}
```
