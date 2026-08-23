# Distributed Energy Interconnection Study Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `distributed-energy-interconnection-study-workbench` |
| Family | Work |
| Dominant task | Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade. |
| Search aliases | `distributed`, `energy`, `interconnection`, `study`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade.
- The required region graph remains `interconnection-study → project-export-envelope-and-rule-version → point-of-interconnection → ordered-source-to-feeder-point-element-path ↔ model-input-completeness → ordered-technical-screen-gates → unlocked-study-case-set → feeder-element-by-case-violation-matrix → selected-cell-electrical-evidence → mitigation-or-upgrade-and-rerun → cost-schedule-owner-and-conditional-verdict → agreement-conditions-and-model-receipt`.
- The mandatory relationship remains: screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must select a feeder point, traverse its ordered element path, block a downstream study until prerequisite screens finish, populate at least two cases across multiple elements, trace one violating cell, validate its mitigation by rerun and issue a conditional verdict with explicit export envelope and upgrade owner.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-04-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-04-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-04-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-04-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-04-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-04-90` | The dominant task is actually `waitlist-offer-allocation-board`. | Reject. |
| `AR-B13-04-91` | The dominant task is actually `regulatory-filing-package-validator`. | Reject. |
| `AR-B13-04-92` | The dominant task is actually `jurisdiction-authority-resolution`. | Reject. |
| `AR-B13-04-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `distributed-energy-interconnection-study-workbench` only when `AR-B13-04-01` through `AR-B13-04-05` are evidenced and none of `AR-B13-04-90` through `AR-B13-04-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
interconnection-study
└─ project-export-envelope-and-rule-version
   └─ point-of-interconnection
      └─ ordered-source-to-feeder-point-element-path
         ↔─ model-input-completeness
            └─ ordered-technical-screen-gates
               └─ unlocked-study-case-set
                  └─ feeder-element-by-case-violation-matrix
                     └─ selected-cell-electrical-evidence
                        └─ mitigation-or-upgrade-and-rerun
                           └─ cost-schedule-owner-and-conditional-verdict
                              └─ agreement-conditions-and-model-receipt
```

- Required relationship: screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `interconnection-study` | Owns evidence, state, and action for interconnection study without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `project-export-envelope-and-rule-version` | Owns evidence, state, and action for project export envelope and rule version without borrowing product semantics. | Follows `interconnection-study` in semantic order and receives its verified context. |
| `point-of-interconnection` | Owns evidence, state, and action for point of interconnection without borrowing product semantics. | Follows `project-export-envelope-and-rule-version` in semantic order and receives its verified context. |
| `ordered-source-to-feeder-point-element-path` | Owns evidence, state, and action for ordered source to feeder point element path without borrowing product semantics. | Follows `point-of-interconnection` in semantic order and receives its verified context. |
| `model-input-completeness` | Owns evidence, state, and action for model input completeness without borrowing product semantics. | Synchronizes bidirectionally with `ordered-source-to-feeder-point-element-path` in the same selection context. |
| `ordered-technical-screen-gates` | Owns evidence, state, and action for ordered technical screen gates without borrowing product semantics. | Follows `model-input-completeness` in semantic order and receives its verified context. |
| `unlocked-study-case-set` | Owns evidence, state, and action for unlocked study case set without borrowing product semantics. | Follows `ordered-technical-screen-gates` in semantic order and receives its verified context. |
| `feeder-element-by-case-violation-matrix` | Owns evidence, state, and action for feeder element by case violation matrix without borrowing product semantics. | Follows `unlocked-study-case-set` in semantic order and receives its verified context. |
| `selected-cell-electrical-evidence` | Owns evidence, state, and action for selected cell electrical evidence without borrowing product semantics. | Follows `feeder-element-by-case-violation-matrix` in semantic order and receives its verified context. |
| `mitigation-or-upgrade-and-rerun` | Owns evidence, state, and action for mitigation or upgrade and rerun without borrowing product semantics. | Follows `selected-cell-electrical-evidence` in semantic order and receives its verified context. |
| `cost-schedule-owner-and-conditional-verdict` | Owns evidence, state, and action for cost schedule owner and conditional verdict without borrowing product semantics. | Follows `mitigation-or-upgrade-and-rerun` in semantic order and receives its verified context. |
| `agreement-conditions-and-model-receipt` | Owns evidence, state, and action for agreement conditions and model receipt without borrowing product semantics. | Follows `cost-schedule-owner-and-conditional-verdict` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Feeder-point path, ordered screen gates, element×case violation matrix, selected evidence, mitigation rerun and conditional verdict remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The current screen or selected element×case violation remains primary; feeder context, complete case matrix, input manifest and agreement conditions move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Project envelope → feeder point and ordered element path → next required screen → unlocked study case → violating element×case cell → mitigation/rerun → owner and condition → verdict; the map becomes a feeder-path sequence and the matrix becomes a scoped case route rather than stacked tables.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `interconnection-study → project-export-envelope-and-rule-version → point-of-interconnection → ordered-source-to-feeder-point-element-path ↔ model-input-completeness → ordered-technical-screen-gates → unlocked-study-case-set → feeder-element-by-case-violation-matrix → selected-cell-electrical-evidence → mitigation-or-upgrade-and-rerun → cost-schedule-owner-and-conditional-verdict → agreement-conditions-and-model-receipt`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must select a feeder point, traverse its ordered element path, block a downstream study until prerequisite screens finish, populate at least two cases across multiple elements, trace one violating cell, validate its mitigation by rerun and issue a conditional verdict with explicit export envelope and upgrade owner.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `project-export-envelope-and-rule-version` | Identify the pending owner and preserve its semantic position. |
| Ready | `point-of-interconnection` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `ordered-source-to-feeder-point-element-path` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `model-input-completeness` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `ordered-technical-screen-gates` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `cost-schedule-owner-and-conditional-verdict` | Prevent duplicate action and announce progress without moving focus. |
| Success | `agreement-conditions-and-model-receipt` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `project-export-envelope-and-rule-version` | Keep the last safe value and require explicit recovery. |
| Focus transition | `agreement-conditions-and-model-receipt` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `interconnection-study` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: application incomplete/ready/withdrawn, feeder model current/stale/restricted, screen locked/not-required/queued/running/pass/fail/indeterminate, study case locked/nonconvergent/complete, element×case cell within/violating/waived, mitigation untested/validated, upgrade estimate draft/accepted/disputed, restudy triggered and agreement issued/expired.

## Boundaries

### Accept

- Accept when the dominant task is: Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `waitlist-offer-allocation-board`, `regulatory-filing-package-validator`, `jurisdiction-authority-resolution` or generic hosting-capacity map; a point-specific ordered feeder path, prerequisite screen cascade, element×case violation matrix, tested mitigation rerun and owned engineering condition are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE DER Interconnection Roadmap](https://www.energy.gov/cmei/i2x/doe-distributed-energy-resource-interconnection-roadmap) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IEEE 1547-2018](https://standards.ieee.org/ieee/1547/5915/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE hosting-capacity atlas](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "distributed-energy-interconnection-study-workbench",
  "situationCodes": [
    "<matched AR-B13-04-* codes>"
  ],
  "searchAliases": [
    "distributed",
    "energy",
    "interconnection",
    "study",
    "workbench"
  ],
  "dominantTask": "Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade.",
  "regions": [
    "interconnection-study",
    "project-export-envelope-and-rule-version",
    "point-of-interconnection",
    "ordered-source-to-feeder-point-element-path",
    "model-input-completeness",
    "ordered-technical-screen-gates",
    "unlocked-study-case-set",
    "feeder-element-by-case-violation-matrix",
    "selected-cell-electrical-evidence",
    "mitigation-or-upgrade-and-rerun",
    "cost-schedule-owner-and-conditional-verdict",
    "agreement-conditions-and-model-receipt"
  ],
  "relationships": [
    "screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition."
  ],
  "responsive": {
    "wide": "Feeder-point path, ordered screen gates, element×case violation matrix, selected evidence, mitigation rerun and conditional verdict remain simultaneously visible.",
    "intermediate": "The current screen or selected element×case violation remains primary; feeder context, complete case matrix, input manifest and agreement conditions move to synchronized routes.",
    "compact": "Project envelope → feeder point and ordered element path → next required screen → unlocked study case → violating element×case cell → mitigation/rerun → owner and condition → verdict; the map becomes a feeder-path sequence and the matrix becomes a scoped case route rather than stacked tables.",
    "reflow": [
      "interconnection-study",
      "project-export-envelope-and-rule-version",
      "point-of-interconnection",
      "ordered-source-to-feeder-point-element-path",
      "model-input-completeness",
      "ordered-technical-screen-gates",
      "unlocked-study-case-set",
      "feeder-element-by-case-violation-matrix",
      "selected-cell-electrical-evidence",
      "mitigation-or-upgrade-and-rerun",
      "cost-schedule-owner-and-conditional-verdict",
      "agreement-conditions-and-model-receipt"
    ]
  },
  "stateObligations": "application incomplete/ready/withdrawn, feeder model current/stale/restricted, screen locked/not-required/queued/running/pass/fail/indeterminate, study case locked/nonconvergent/complete, element×case cell within/violating/waived, mitigation untested/validated, upgrade estimate draft/accepted/disputed, restudy triggered and agreement issued/expired.",
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
