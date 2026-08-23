# Power System Protection Coordination Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `power-system-protection-coordination-workbench` |
| Family | Work |
| Dominant task | Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change. |
| Search aliases | `power`, `system`, `protection`, `coordination`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change.
- The required region graph remains `protection-coordination → one-line-and-study-case → fault-location-and-nested-primary-backup-trip-paths → protection-zone-and-device-chain ↔ time-current-selectivity-view → selected-device-settings → adjacent-pair-selectivity-margin-ledger → all-fault-sweep-and-miscoordination-queue → approved-setting-package`.
- The mandatory relationship remains: each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must select a fault, traverse at least three nested primary/backup devices, expose numeric margin for every adjacent pair, edit one setting through labeled controls, reveal a regression on another fault during the complete sweep and restore the prior approved package.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-01-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-01-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-01-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-01-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-01-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-01-90` | The dominant task is actually `dependency-topology-monitor`. | Reject. |
| `AR-B13-01-91` | The dominant task is actually `rule-builder-workbench`. | Reject. |
| `AR-B13-01-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `power-system-protection-coordination-workbench` only when `AR-B13-01-01` through `AR-B13-01-05` are evidenced and none of `AR-B13-01-90` through `AR-B13-01-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
protection-coordination
└─ one-line-and-study-case
   └─ fault-location-and-nested-primary-backup-trip-paths
      └─ protection-zone-and-device-chain
         ↔─ time-current-selectivity-view
            └─ selected-device-settings
               └─ adjacent-pair-selectivity-margin-ledger
                  └─ all-fault-sweep-and-miscoordination-queue
                     └─ approved-setting-package
```

- Required relationship: each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `protection-coordination` | Owns evidence, state, and action for protection coordination without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `one-line-and-study-case` | Owns evidence, state, and action for one line and study case without borrowing product semantics. | Follows `protection-coordination` in semantic order and receives its verified context. |
| `fault-location-and-nested-primary-backup-trip-paths` | Owns evidence, state, and action for fault location and nested primary backup trip paths without borrowing product semantics. | Follows `one-line-and-study-case` in semantic order and receives its verified context. |
| `protection-zone-and-device-chain` | Owns evidence, state, and action for protection zone and device chain without borrowing product semantics. | Follows `fault-location-and-nested-primary-backup-trip-paths` in semantic order and receives its verified context. |
| `time-current-selectivity-view` | Owns evidence, state, and action for time current selectivity view without borrowing product semantics. | Synchronizes bidirectionally with `protection-zone-and-device-chain` in the same selection context. |
| `selected-device-settings` | Owns evidence, state, and action for selected device settings without borrowing product semantics. | Follows `time-current-selectivity-view` in semantic order and receives its verified context. |
| `adjacent-pair-selectivity-margin-ledger` | Owns evidence, state, and action for adjacent pair selectivity margin ledger without borrowing product semantics. | Follows `selected-device-settings` in semantic order and receives its verified context. |
| `all-fault-sweep-and-miscoordination-queue` | Owns evidence, state, and action for all fault sweep and miscoordination queue without borrowing product semantics. | Follows `adjacent-pair-selectivity-margin-ledger` in semantic order and receives its verified context. |
| `approved-setting-package` | Owns evidence, state, and action for approved setting package without borrowing product semantics. | Follows `all-fault-sweep-and-miscoordination-queue` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** One-line topology, selected nested trip path, time-current evidence, settings editor, pairwise margin ledger and all-fault sweep status remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The selected fault path and active primary-backup pair remain primary; other pair curves, setting provenance and the sweep queue move to synchronized drawers without changing the fault context.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Study case → fault location → nested device chain → one adjacent primary-backup pair → curve and numeric margin evidence → setting change → every remaining pair on the path → all-fault sweep → approve or rollback; the whole one-line becomes a semantic trip-path route rather than stacked desktop regions.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `protection-coordination → one-line-and-study-case → fault-location-and-nested-primary-backup-trip-paths → protection-zone-and-device-chain ↔ time-current-selectivity-view → selected-device-settings → adjacent-pair-selectivity-margin-ledger → all-fault-sweep-and-miscoordination-queue → approved-setting-package`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must select a fault, traverse at least three nested primary/backup devices, expose numeric margin for every adjacent pair, edit one setting through labeled controls, reveal a regression on another fault during the complete sweep and restore the prior approved package.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `one-line-and-study-case` | Identify the pending owner and preserve its semantic position. |
| Ready | `fault-location-and-nested-primary-backup-trip-paths` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `protection-zone-and-device-chain` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `time-current-selectivity-view` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-device-settings` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `all-fault-sweep-and-miscoordination-queue` | Prevent duplicate action and announce progress without moving focus. |
| Success | `approved-setting-package` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `one-line-and-study-case` | Keep the last safe value and require explicit recovery. |
| Focus transition | `approved-setting-package` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `protection-coordination` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: model loading/invalid, study case current/stale, fault calculated/failed, trip path complete/ambiguous, device in-service/bypassed/unknown, primary-backup pair coordinated/marginal/miscoordinated, setting draft/invalid/pending approval, sweep queued/running/partial/complete/regressed and package approved/rejected/rolled back.

## Boundaries

### Accept

- Accept when the dominant task is: Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `dependency-topology-monitor`, `rule-builder-workbench`, constrained allocation, traffic-signal timing or a generic one-line viewer; nested electrical fault paths, protection zones, time-current or equivalent selectivity evidence, pairwise margins across every adjacent device and one all-fault validation sweep are mandatory.
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
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC PRC-027-1](https://www.nerc.com/standards/reliability-runtime/standards/prc/prc-027-1) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE integrated distribution system planning](https://www.energy.gov/oe/integrated-distribution-system-planning) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "power-system-protection-coordination-workbench",
  "situationCodes": [
    "<matched AR-B13-01-* codes>"
  ],
  "searchAliases": [
    "power",
    "system",
    "protection",
    "coordination",
    "workbench"
  ],
  "dominantTask": "Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change.",
  "regions": [
    "protection-coordination",
    "one-line-and-study-case",
    "fault-location-and-nested-primary-backup-trip-paths",
    "protection-zone-and-device-chain",
    "time-current-selectivity-view",
    "selected-device-settings",
    "adjacent-pair-selectivity-margin-ledger",
    "all-fault-sweep-and-miscoordination-queue",
    "approved-setting-package"
  ],
  "relationships": [
    "each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package."
  ],
  "responsive": {
    "wide": "One-line topology, selected nested trip path, time-current evidence, settings editor, pairwise margin ledger and all-fault sweep status remain simultaneously visible.",
    "intermediate": "The selected fault path and active primary-backup pair remain primary; other pair curves, setting provenance and the sweep queue move to synchronized drawers without changing the fault context.",
    "compact": "Study case → fault location → nested device chain → one adjacent primary-backup pair → curve and numeric margin evidence → setting change → every remaining pair on the path → all-fault sweep → approve or rollback; the whole one-line becomes a semantic trip-path route rather than stacked desktop regions.",
    "reflow": [
      "protection-coordination",
      "one-line-and-study-case",
      "fault-location-and-nested-primary-backup-trip-paths",
      "protection-zone-and-device-chain",
      "time-current-selectivity-view",
      "selected-device-settings",
      "adjacent-pair-selectivity-margin-ledger",
      "all-fault-sweep-and-miscoordination-queue",
      "approved-setting-package"
    ]
  },
  "stateObligations": "model loading/invalid, study case current/stale, fault calculated/failed, trip path complete/ambiguous, device in-service/bypassed/unknown, primary-backup pair coordinated/marginal/miscoordinated, setting draft/invalid/pending approval, sweep queued/running/partial/complete/regressed and package approved/rejected/rolled back.",
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
