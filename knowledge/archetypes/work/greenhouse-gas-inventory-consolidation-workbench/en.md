# Greenhouse Gas Inventory Consolidation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `greenhouse-gas-inventory-consolidation-workbench` |
| Family | Work |
| Dominant task | Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation. |
| Search aliases | `greenhouse`, `inventory`, `consolidation`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation.
- The required region graph remains `ghg-inventory → reporting-period-standard-consolidation-approach-and-base-year → organizational-boundary-and-entity-control-tree → entity-owned-emission-source-register → scope-category-method-and-activity-factor-lineage → entity-subtotal-and-group-consolidation-rollup ↔ paired-intercompany-activity-and-elimination-ledger → structural-methodology-and-significance-trigger-register → base-year-recalculation-replay-and-comparability-bridge → completeness-uncertainty-and-verification-issues → approved-inventory-and-disclosure-export`.
- The mandatory relationship remains: the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must change one entity-control boundary, reclassify and calculate a source from visible activity/factor lineage, match both sides of an intercompany activity before elimination, record the structural trigger, replay the base year with a comparability bridge and clear verification before release.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-14-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-14-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-14-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-14-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-14-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-14-90` | The dominant task is actually `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-14-91` | The dominant task is actually `financial-consolidation-elimination-workbench`. | Reject. |
| `AR-B13-14-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `greenhouse-gas-inventory-consolidation-workbench` only when `AR-B13-14-01` through `AR-B13-14-05` are evidenced and none of `AR-B13-14-90` through `AR-B13-14-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
ghg-inventory
└─ reporting-period-standard-consolidation-approach-and-base-year
   └─ organizational-boundary-and-entity-control-tree
      └─ entity-owned-emission-source-register
         └─ scope-category-method-and-activity-factor-lineage
            └─ entity-subtotal-and-group-consolidation-rollup
               ↔─ paired-intercompany-activity-and-elimination-ledger
                  └─ structural-methodology-and-significance-trigger-register
                     └─ base-year-recalculation-replay-and-comparability-bridge
                        └─ completeness-uncertainty-and-verification-issues
                           └─ approved-inventory-and-disclosure-export
```

- Required relationship: the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `ghg-inventory` | Owns evidence, state, and action for ghg inventory without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `reporting-period-standard-consolidation-approach-and-base-year` | Owns evidence, state, and action for reporting period standard consolidation approach and base year without borrowing product semantics. | Follows `ghg-inventory` in semantic order and receives its verified context. |
| `organizational-boundary-and-entity-control-tree` | Owns evidence, state, and action for organizational boundary and entity control tree without borrowing product semantics. | Follows `reporting-period-standard-consolidation-approach-and-base-year` in semantic order and receives its verified context. |
| `entity-owned-emission-source-register` | Owns evidence, state, and action for entity owned emission source register without borrowing product semantics. | Follows `organizational-boundary-and-entity-control-tree` in semantic order and receives its verified context. |
| `scope-category-method-and-activity-factor-lineage` | Owns evidence, state, and action for scope category method and activity factor lineage without borrowing product semantics. | Follows `entity-owned-emission-source-register` in semantic order and receives its verified context. |
| `entity-subtotal-and-group-consolidation-rollup` | Owns evidence, state, and action for entity subtotal and group consolidation rollup without borrowing product semantics. | Follows `scope-category-method-and-activity-factor-lineage` in semantic order and receives its verified context. |
| `paired-intercompany-activity-and-elimination-ledger` | Owns evidence, state, and action for paired intercompany activity and elimination ledger without borrowing product semantics. | Synchronizes bidirectionally with `entity-subtotal-and-group-consolidation-rollup` in the same selection context. |
| `structural-methodology-and-significance-trigger-register` | Owns evidence, state, and action for structural methodology and significance trigger register without borrowing product semantics. | Follows `paired-intercompany-activity-and-elimination-ledger` in semantic order and receives its verified context. |
| `base-year-recalculation-replay-and-comparability-bridge` | Owns evidence, state, and action for base year recalculation replay and comparability bridge without borrowing product semantics. | Follows `structural-methodology-and-significance-trigger-register` in semantic order and receives its verified context. |
| `completeness-uncertainty-and-verification-issues` | Owns evidence, state, and action for completeness uncertainty and verification issues without borrowing product semantics. | Follows `base-year-recalculation-replay-and-comparability-bridge` in semantic order and receives its verified context. |
| `approved-inventory-and-disclosure-export` | Owns evidence, state, and action for approved inventory and disclosure export without borrowing product semantics. | Follows `completeness-uncertainty-and-verification-issues` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Entity-control boundary, source calculations, consolidation rollup, paired intercompany eliminations, base-year replay and verification issues remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The selected entity/source and consolidated result remain primary; its counterparty elimination and any base-year trigger stay synchronized while the full tree and other methodology evidence move to routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Reporting period and consolidation approach → entity path → source activity/factor lineage → scope/category → linked counterparty elimination → structural or method trigger → base-year replay/comparability result → verification; the hierarchy transforms into an entity path with exact linked records rather than stacked ledgers.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `ghg-inventory → reporting-period-standard-consolidation-approach-and-base-year → organizational-boundary-and-entity-control-tree → entity-owned-emission-source-register → scope-category-method-and-activity-factor-lineage → entity-subtotal-and-group-consolidation-rollup ↔ paired-intercompany-activity-and-elimination-ledger → structural-methodology-and-significance-trigger-register → base-year-recalculation-replay-and-comparability-bridge → completeness-uncertainty-and-verification-issues → approved-inventory-and-disclosure-export`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must change one entity-control boundary, reclassify and calculate a source from visible activity/factor lineage, match both sides of an intercompany activity before elimination, record the structural trigger, replay the base year with a comparability bridge and clear verification before release.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `reporting-period-standard-consolidation-approach-and-base-year` | Identify the pending owner and preserve its semantic position. |
| Ready | `organizational-boundary-and-entity-control-tree` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `entity-owned-emission-source-register` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `scope-category-method-and-activity-factor-lineage` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `entity-subtotal-and-group-consolidation-rollup` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `completeness-uncertainty-and-verification-issues` | Prevent duplicate action and announce progress without moving focus. |
| Success | `approved-inventory-and-disclosure-export` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `reporting-period-standard-consolidation-approach-and-base-year` | Keep the last safe value and require explicit recovery. |
| Focus transition | `approved-inventory-and-disclosure-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `ghg-inventory` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: boundary draft/approved/changed, entity included/excluded/partial, source missing/actual/estimated/not-applicable, scope disputed/resolved, factor current/superseded, unit conversion pass/fail, intercompany pair unmatched/matched/eliminated/reopened, recalculation trigger absent/proposed/approved, base-year replay queued/complete/failed, verification issue open/cleared and inventory draft/assured/published/revised.

## Boundaries

### Accept

- Accept when the dominant task is: Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `process-mass-balance-analyzer`, `financial-consolidation-elimination-workbench`, bridge waterfall or spreadsheet accounting; GHG-specific consolidation approach, scope/category classification, activity-to-factor lineage, paired intercompany activity elimination and trigger-driven base-year replay are mandatory—financial journal consolidation or physical conservation alone is insufficient.
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
| [WAI-ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GHG Protocol Corporate Standard FAQ](https://ghgprotocol.org/corporate-standard-frequently-asked-questions) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GHG Protocol standards update](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA GHG Emission Factors Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ISO 14064-1:2018](https://www.iso.org/standard/66453.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "greenhouse-gas-inventory-consolidation-workbench",
  "situationCodes": [
    "<matched AR-B13-14-* codes>"
  ],
  "searchAliases": [
    "greenhouse",
    "inventory",
    "consolidation",
    "workbench"
  ],
  "dominantTask": "Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation.",
  "regions": [
    "ghg-inventory",
    "reporting-period-standard-consolidation-approach-and-base-year",
    "organizational-boundary-and-entity-control-tree",
    "entity-owned-emission-source-register",
    "scope-category-method-and-activity-factor-lineage",
    "entity-subtotal-and-group-consolidation-rollup",
    "paired-intercompany-activity-and-elimination-ledger",
    "structural-methodology-and-significance-trigger-register",
    "base-year-recalculation-replay-and-comparability-bridge",
    "completeness-uncertainty-and-verification-issues",
    "approved-inventory-and-disclosure-export"
  ],
  "relationships": [
    "the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage."
  ],
  "responsive": {
    "wide": "Entity-control boundary, source calculations, consolidation rollup, paired intercompany eliminations, base-year replay and verification issues remain simultaneously visible.",
    "intermediate": "The selected entity/source and consolidated result remain primary; its counterparty elimination and any base-year trigger stay synchronized while the full tree and other methodology evidence move to routes.",
    "compact": "Reporting period and consolidation approach → entity path → source activity/factor lineage → scope/category → linked counterparty elimination → structural or method trigger → base-year replay/comparability result → verification; the hierarchy transforms into an entity path with exact linked records rather than stacked ledgers.",
    "reflow": [
      "ghg-inventory",
      "reporting-period-standard-consolidation-approach-and-base-year",
      "organizational-boundary-and-entity-control-tree",
      "entity-owned-emission-source-register",
      "scope-category-method-and-activity-factor-lineage",
      "entity-subtotal-and-group-consolidation-rollup",
      "paired-intercompany-activity-and-elimination-ledger",
      "structural-methodology-and-significance-trigger-register",
      "base-year-recalculation-replay-and-comparability-bridge",
      "completeness-uncertainty-and-verification-issues",
      "approved-inventory-and-disclosure-export"
    ]
  },
  "stateObligations": "boundary draft/approved/changed, entity included/excluded/partial, source missing/actual/estimated/not-applicable, scope disputed/resolved, factor current/superseded, unit conversion pass/fail, intercompany pair unmatched/matched/eliminated/reopened, recalculation trigger absent/proposed/approved, base-year replay queued/complete/failed, verification issue open/cleared and inventory draft/assured/published/revised.",
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
