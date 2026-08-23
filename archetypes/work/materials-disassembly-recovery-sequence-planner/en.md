# Materials Disassembly Recovery Sequence Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `materials-disassembly-recovery-sequence-planner` |
| Family | Work |
| Dominant task | Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal. |
| Search aliases | `materials`, `disassembly`, `recovery`, `sequence`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal.
- The required region graph remains `disassembly-planner → product-assembly-version-and-recovery-goal → bill-of-materials-hierarchy ↔ connection-access-and-dependency-graph → hazard-tool-and-destructive-step-constraints → reversible-disassembly-sequence → component-condition-and-recovery-yield → reuse-remanufacture-recycle-disposal-routes → residual-waste-value-and-compliance-summary → validated-instructions-and-passport-export`.
- The mandatory relationship remains: removing one component changes what becomes accessible and which recovery routes remain possible.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must expose a blocked component, choose a prerequisite removal through buttons rather than drag, require a hazard control and tool, record damage that changes the recovery route, recalculate yield and export the validated sequence.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-19-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-19-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-19-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-19-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-19-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-19-90` | The dominant task is actually `workflow-automation-builder`. | Reject. |
| `AR-B13-19-91` | The dominant task is actually `print-signature-imposition-planner`. | Reject. |
| `AR-B13-19-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `materials-disassembly-recovery-sequence-planner` only when `AR-B13-19-01` through `AR-B13-19-05` are evidenced and none of `AR-B13-19-90` through `AR-B13-19-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
disassembly-planner
└─ product-assembly-version-and-recovery-goal
   └─ bill-of-materials-hierarchy
      ↔─ connection-access-and-dependency-graph
         └─ hazard-tool-and-destructive-step-constraints
            └─ reversible-disassembly-sequence
               └─ component-condition-and-recovery-yield
                  └─ reuse-remanufacture-recycle-disposal-routes
                     └─ residual-waste-value-and-compliance-summary
                        └─ validated-instructions-and-passport-export
```

- Required relationship: removing one component changes what becomes accessible and which recovery routes remain possible.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `disassembly-planner` | Owns evidence, state, and action for disassembly planner without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `product-assembly-version-and-recovery-goal` | Owns evidence, state, and action for product assembly version and recovery goal without borrowing product semantics. | Follows `disassembly-planner` in semantic order and receives its verified context. |
| `bill-of-materials-hierarchy` | Owns evidence, state, and action for bill of materials hierarchy without borrowing product semantics. | Follows `product-assembly-version-and-recovery-goal` in semantic order and receives its verified context. |
| `connection-access-and-dependency-graph` | Owns evidence, state, and action for connection access and dependency graph without borrowing product semantics. | Synchronizes bidirectionally with `bill-of-materials-hierarchy` in the same selection context. |
| `hazard-tool-and-destructive-step-constraints` | Owns evidence, state, and action for hazard tool and destructive step constraints without borrowing product semantics. | Follows `connection-access-and-dependency-graph` in semantic order and receives its verified context. |
| `reversible-disassembly-sequence` | Owns evidence, state, and action for reversible disassembly sequence without borrowing product semantics. | Follows `hazard-tool-and-destructive-step-constraints` in semantic order and receives its verified context. |
| `component-condition-and-recovery-yield` | Owns evidence, state, and action for component condition and recovery yield without borrowing product semantics. | Follows `reversible-disassembly-sequence` in semantic order and receives its verified context. |
| `reuse-remanufacture-recycle-disposal-routes` | Owns evidence, state, and action for reuse remanufacture recycle disposal routes without borrowing product semantics. | Follows `component-condition-and-recovery-yield` in semantic order and receives its verified context. |
| `residual-waste-value-and-compliance-summary` | Owns evidence, state, and action for residual waste value and compliance summary without borrowing product semantics. | Follows `reuse-remanufacture-recycle-disposal-routes` in semantic order and receives its verified context. |
| `validated-instructions-and-passport-export` | Owns evidence, state, and action for validated instructions and passport export without borrowing product semantics. | Follows `residual-waste-value-and-compliance-summary` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Assembly/dependency graph, ordered steps, selected joint/constraint, component recovery routes and yield summary remain visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Current sequence and selected component remain primary; full assembly graph, tool bank and residual summary move to drawers.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Assembly → next removable component → joint/tool/hazard proof → remove or choose alternative → record condition → recovery route → unlocked successor; graph editing has move buttons and a topological list alternative.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `disassembly-planner → product-assembly-version-and-recovery-goal → bill-of-materials-hierarchy ↔ connection-access-and-dependency-graph → hazard-tool-and-destructive-step-constraints → reversible-disassembly-sequence → component-condition-and-recovery-yield → reuse-remanufacture-recycle-disposal-routes → residual-waste-value-and-compliance-summary → validated-instructions-and-passport-export`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must expose a blocked component, choose a prerequisite removal through buttons rather than drag, require a hazard control and tool, record damage that changes the recovery route, recalculate yield and export the validated sequence.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `product-assembly-version-and-recovery-goal` | Identify the pending owner and preserve its semantic position. |
| Ready | `bill-of-materials-hierarchy` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `connection-access-and-dependency-graph` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `hazard-tool-and-destructive-step-constraints` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `reversible-disassembly-sequence` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `residual-waste-value-and-compliance-summary` | Prevent duplicate action and announce progress without moving focus. |
| Success | `validated-instructions-and-passport-export` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `product-assembly-version-and-recovery-goal` | Keep the last safe value and require explicit recovery. |
| Focus transition | `validated-instructions-and-passport-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `disassembly-planner` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: assembly version unknown/current/superseded, connection known/unknown/inaccessible, step blocked/available/destructive, tool unavailable/ready, hazard unidentified/controlled, component intact/damaged/contaminated, route eligible/ineligible/pending test, yield estimated/confirmed, sequence invalid/valid and instructions draft/reviewed/exported.

## Boundaries

### Accept

- Accept when the dominant task is: Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `workflow-automation-builder`, `print-signature-imposition-planner`, sample lineage or inventory replenishment; physical connection/access dependencies, hazard- and tool-constrained removal, component condition and recovery-route yield are mandatory.
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
| [ISO 20887:2020](https://www.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/06/93/69370.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [European Commission Digital Product Passport](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EU Ecodesign Regulation guidance](https://environment.ec.europa.eu/news/new-eu-sustainability-rules-explained-ecodesign-regulation-faqs-2024-09-27_en) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "materials-disassembly-recovery-sequence-planner",
  "situationCodes": [
    "<matched AR-B13-19-* codes>"
  ],
  "searchAliases": [
    "materials",
    "disassembly",
    "recovery",
    "sequence",
    "planner"
  ],
  "dominantTask": "Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal.",
  "regions": [
    "disassembly-planner",
    "product-assembly-version-and-recovery-goal",
    "bill-of-materials-hierarchy",
    "connection-access-and-dependency-graph",
    "hazard-tool-and-destructive-step-constraints",
    "reversible-disassembly-sequence",
    "component-condition-and-recovery-yield",
    "reuse-remanufacture-recycle-disposal-routes",
    "residual-waste-value-and-compliance-summary",
    "validated-instructions-and-passport-export"
  ],
  "relationships": [
    "removing one component changes what becomes accessible and which recovery routes remain possible."
  ],
  "responsive": {
    "wide": "Assembly/dependency graph, ordered steps, selected joint/constraint, component recovery routes and yield summary remain visible.",
    "intermediate": "Current sequence and selected component remain primary; full assembly graph, tool bank and residual summary move to drawers.",
    "compact": "Assembly → next removable component → joint/tool/hazard proof → remove or choose alternative → record condition → recovery route → unlocked successor; graph editing has move buttons and a topological list alternative.",
    "reflow": [
      "disassembly-planner",
      "product-assembly-version-and-recovery-goal",
      "bill-of-materials-hierarchy",
      "connection-access-and-dependency-graph",
      "hazard-tool-and-destructive-step-constraints",
      "reversible-disassembly-sequence",
      "component-condition-and-recovery-yield",
      "reuse-remanufacture-recycle-disposal-routes",
      "residual-waste-value-and-compliance-summary",
      "validated-instructions-and-passport-export"
    ]
  },
  "stateObligations": "assembly version unknown/current/superseded, connection known/unknown/inaccessible, step blocked/available/destructive, tool unavailable/ready, hazard unidentified/controlled, component intact/damaged/contaminated, route eligible/ineligible/pending test, yield estimated/confirmed, sequence invalid/valid and instructions draft/reviewed/exported.",
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
