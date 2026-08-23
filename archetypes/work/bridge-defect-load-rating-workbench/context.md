# Bridge Defect Load Rating Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `bridge-defect-load-rating-workbench` |
| Family | Work |
| Dominant task | Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision. |
| Search aliases | `bridge`, `defect`, `rating`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision.
- The required region graph remains `bridge-rating → bridge-version-and-inspection-scope → component-hierarchy ↔ defect-location-measurement-and-evidence → section-and-member-property-reduction → rating-vehicle-and-load-effect-cases → capacity-demand-factor-ledger → controlling-member-and-load-path → posting-repair-or-reinspection-scenarios → engineer-review-and-versioned-rating`.
- The mandatory relationship remains: each rating result must trace through one load case and defect-adjusted component capacity.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must select a measured defect, reduce the affected section property, rerun two load cases, expose the governing factor and component, compare posting with repair and preserve the engineer-approved rating version.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-11-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-11-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-11-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-11-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-11-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-11-90` | The dominant task is actually `finite-element-mesh-convergence-workbench`. | Reject. |
| `AR-B13-11-91` | The dominant task is actually `evidence-led-case-resolution-dossier`. | Reject. |
| `AR-B13-11-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `bridge-defect-load-rating-workbench` only when `AR-B13-11-01` through `AR-B13-11-05` are evidenced and none of `AR-B13-11-90` through `AR-B13-11-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
bridge-rating
└─ bridge-version-and-inspection-scope
   └─ component-hierarchy
      ↔─ defect-location-measurement-and-evidence
         └─ section-and-member-property-reduction
            └─ rating-vehicle-and-load-effect-cases
               └─ capacity-demand-factor-ledger
                  └─ controlling-member-and-load-path
                     └─ posting-repair-or-reinspection-scenarios
                        └─ engineer-review-and-versioned-rating
```

- Required relationship: each rating result must trace through one load case and defect-adjusted component capacity.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `bridge-rating` | Owns evidence, state, and action for bridge rating without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `bridge-version-and-inspection-scope` | Owns evidence, state, and action for bridge version and inspection scope without borrowing product semantics. | Follows `bridge-rating` in semantic order and receives its verified context. |
| `component-hierarchy` | Owns evidence, state, and action for component hierarchy without borrowing product semantics. | Follows `bridge-version-and-inspection-scope` in semantic order and receives its verified context. |
| `defect-location-measurement-and-evidence` | Owns evidence, state, and action for defect location measurement and evidence without borrowing product semantics. | Synchronizes bidirectionally with `component-hierarchy` in the same selection context. |
| `section-and-member-property-reduction` | Owns evidence, state, and action for section and member property reduction without borrowing product semantics. | Follows `defect-location-measurement-and-evidence` in semantic order and receives its verified context. |
| `rating-vehicle-and-load-effect-cases` | Owns evidence, state, and action for rating vehicle and load effect cases without borrowing product semantics. | Follows `section-and-member-property-reduction` in semantic order and receives its verified context. |
| `capacity-demand-factor-ledger` | Owns evidence, state, and action for capacity demand factor ledger without borrowing product semantics. | Follows `rating-vehicle-and-load-effect-cases` in semantic order and receives its verified context. |
| `controlling-member-and-load-path` | Owns evidence, state, and action for controlling member and load path without borrowing product semantics. | Follows `capacity-demand-factor-ledger` in semantic order and receives its verified context. |
| `posting-repair-or-reinspection-scenarios` | Owns evidence, state, and action for posting repair or reinspection scenarios without borrowing product semantics. | Follows `controlling-member-and-load-path` in semantic order and receives its verified context. |
| `engineer-review-and-versioned-rating` | Owns evidence, state, and action for engineer review and versioned rating without borrowing product semantics. | Follows `posting-repair-or-reinspection-scenarios` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Component hierarchy, defect evidence, rating cases, capacity-demand factors and decision scenarios remain visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Controlling component, evidence and rating result remain primary; bridge overview, all load cases and decision history move to drawers.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Bridge → controlling component → defect measurement → adjusted property → governing vehicle/load case → rating factor → post, repair or reinspect; drawing selection has a component-list alternative.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `bridge-rating → bridge-version-and-inspection-scope → component-hierarchy ↔ defect-location-measurement-and-evidence → section-and-member-property-reduction → rating-vehicle-and-load-effect-cases → capacity-demand-factor-ledger → controlling-member-and-load-path → posting-repair-or-reinspection-scenarios → engineer-review-and-versioned-rating`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must select a measured defect, reduce the affected section property, rerun two load cases, expose the governing factor and component, compare posting with repair and preserve the engineer-approved rating version.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `bridge-version-and-inspection-scope` | Identify the pending owner and preserve its semantic position. |
| Ready | `component-hierarchy` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `defect-location-measurement-and-evidence` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `section-and-member-property-reduction` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `rating-vehicle-and-load-effect-cases` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `posting-repair-or-reinspection-scenarios` | Prevent duplicate action and announce progress without moving focus. |
| Success | `engineer-review-and-versioned-rating` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `bridge-version-and-inspection-scope` | Keep the last safe value and require explicit recovery. |
| Focus transition | `engineer-review-and-versioned-rating` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `bridge-rating` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: inspection current/overdue/incomplete, defect unconfirmed/measured/progressing, evidence loading/unavailable, component property provisional/approved, load case queued/running/invalid, rating pass/restricted/critical, controlling case changed, posting proposed/issued, repair scenario unverified and engineer review signed/rejected/superseded.

## Boundaries

### Accept

- Accept when the dominant task is: Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `finite-element-mesh-convergence-workbench`, `evidence-led-case-resolution-dossier`, portfolio health or generic structural viewer; inspection-located deterioration, defect-adjusted member capacity, code-defined rating vehicles, a controlling load path and an issued operational rating are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Bridge Load Rating](https://www.fhwa.dot.gov/bridge/loadrating/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Bridge Inspection resources](https://www.fhwa.dot.gov/bridge/inspection/index.cfm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "bridge-defect-load-rating-workbench",
  "situationCodes": [
    "<matched AR-B13-11-* codes>"
  ],
  "searchAliases": [
    "bridge",
    "defect",
    "rating",
    "workbench"
  ],
  "dominantTask": "Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision.",
  "regions": [
    "bridge-rating",
    "bridge-version-and-inspection-scope",
    "component-hierarchy",
    "defect-location-measurement-and-evidence",
    "section-and-member-property-reduction",
    "rating-vehicle-and-load-effect-cases",
    "capacity-demand-factor-ledger",
    "controlling-member-and-load-path",
    "posting-repair-or-reinspection-scenarios",
    "engineer-review-and-versioned-rating"
  ],
  "relationships": [
    "each rating result must trace through one load case and defect-adjusted component capacity."
  ],
  "responsive": {
    "wide": "Component hierarchy, defect evidence, rating cases, capacity-demand factors and decision scenarios remain visible.",
    "intermediate": "Controlling component, evidence and rating result remain primary; bridge overview, all load cases and decision history move to drawers.",
    "compact": "Bridge → controlling component → defect measurement → adjusted property → governing vehicle/load case → rating factor → post, repair or reinspect; drawing selection has a component-list alternative.",
    "reflow": [
      "bridge-rating",
      "bridge-version-and-inspection-scope",
      "component-hierarchy",
      "defect-location-measurement-and-evidence",
      "section-and-member-property-reduction",
      "rating-vehicle-and-load-effect-cases",
      "capacity-demand-factor-ledger",
      "controlling-member-and-load-path",
      "posting-repair-or-reinspection-scenarios",
      "engineer-review-and-versioned-rating"
    ]
  },
  "stateObligations": "inspection current/overdue/incomplete, defect unconfirmed/measured/progressing, evidence loading/unavailable, component property provisional/approved, load case queued/running/invalid, rating pass/restricted/critical, controlling case changed, posting proposed/issued, repair scenario unverified and engineer review signed/rejected/superseded.",
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
