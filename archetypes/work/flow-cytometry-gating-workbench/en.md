# Flow Cytometry Gating Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `flow-cytometry-gating-workbench` |
| Family | Work |
| Dominant task | Define and validate recursively nested cell populations from multivariate flow-cytometry measurements, with each gate inheriting its parent event set. |
| Search aliases | `population gating tree`, `recursive cell gate`, `parent event inheritance`, `gating QC` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Define and validate recursively nested cell populations from multivariate flow-cytometry measurements, with each gate inheriting its parent event set.
- The required region graph remains `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FG-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-FG-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-FG-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-FG-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-FG-05` | Template must create a child gate with numeric and keyboard alternatives, show inherited event counts, invalidate descendants after parent change and expose compensation/QC evidence. | Required evidence. |
| `AR-FG-90` | media annotation | Reject. |
| `AR-FG-91` | scatterplot viewer | Reject. |
| `AR-FG-92` | generic tree editor | Reject. |
| `AR-FG-93` | image segmentation | Reject. |

### Selection rule

Select `flow-cytometry-gating-workbench` only when `AR-FG-01` through `AR-FG-05` are evidenced and no `AR-FG-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
gating-workbench
   `-- sample-and-channel-selector
      `-- population-gating-hierarchy
         `-- selected-parent-population
            `-- scatter-or-density-projection
               `-- gate-boundary-editor
                  `-- derived-child-statistics
                     `-- compensation-and-qc-rail
```

Declared relationship expression: `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `gating-workbench` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `sample-and-channel-selector` | Owns sample and channel selector evidence, action, state, and recovery. | Follows `gating-workbench` in semantic order and consumes its exact selected context. |
| `population-gating-hierarchy` | Owns population gating hierarchy evidence, action, state, and recovery. | Follows `sample-and-channel-selector` in semantic order and consumes its exact selected context. |
| `selected-parent-population` | Owns selected parent population evidence, action, state, and recovery. | Follows `population-gating-hierarchy` in semantic order and consumes its exact selected context. |
| `scatter-or-density-projection` | Owns scatter or density projection evidence, action, state, and recovery. | Synchronizes bidirectionally with `selected-parent-population` under one selected context. |
| `gate-boundary-editor` | Owns gate boundary editor evidence, action, state, and recovery. | Synchronizes bidirectionally with `scatter-or-density-projection` under one selected context. |
| `derived-child-statistics` | Owns derived child statistics evidence, action, state, and recovery. | Follows `gate-boundary-editor` in semantic order and consumes its exact selected context. |
| `compensation-and-qc-rail` | Owns compensation and qc rail evidence, action, state, and recovery. | Follows `derived-child-statistics` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Gating hierarchy, selected projection/gate, child statistics and compensation/QC remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `scatter-or-density-projection` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Hierarchy becomes a drawer; projection remains primary and statistics/QC move below.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `scatter-or-density-projection` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Population breadcrumb → one projection → numeric threshold or point-list gate editor → child statistics → QC → next child; drawing is never the only input.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `scatter-or-density-projection` is optional and bounded.

### Reflow

- Semantic and DOM order is `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection → gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`.
- Text zoom, long translation, and enlarged controls trigger the same named topology changes.
- CSS never reorders visual content away from keyboard or assistive-technology order.
- Long labels and identifiers wrap; hidden detail has an explicit accessible reveal.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve selected entity, version, filter, pending state, validation result, and recovery point.
- Dynamic updates use one contextual status message without moving focus.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Drag, drawing, fader, spatial, or point movement has button, numeric, or list parity.
- Color, position, geometry, and motion always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `sample-and-channel-selector` | Identify pending scope and preserve semantic position. |
| Ready | `population-gating-hierarchy` | Expose the complete dominant task and current version. |
| Empty / not applicable | `selected-parent-population` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `scatter-or-density-projection` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `derived-child-statistics` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `compensation-and-qc-rail` | Prevent duplicate action and announce progress without moving focus. |
| Success | `compensation-and-qc-rail` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `sample-and-channel-selector` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `compensation-and-qc-rail` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `gating-workbench` | Preserve selected entity, query, state, and recovery when topology changes. |
| sample loading/empty | `sample-and-channel-selector` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| channel unavailable | `population-gating-hierarchy` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| parent population stale | `selected-parent-population` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| gate draft/valid/invalid | `scatter-or-density-projection` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| compensation warning | `gate-boundary-editor` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| too few events | `derived-child-statistics` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| child created/empty | `compensation-and-qc-rail` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| QC pass/fail and export. | `compensation-and-qc-rail` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must create a child gate with numeric and keyboard alternatives, show inherited event counts, invalidate descendants after parent change and expose compensation/QC evidence.

### Reject

- Reject media annotation; this is `AR-FG-90` evidence and must route to an adjacent archetype.
- Reject scatterplot viewer; this is `AR-FG-91` evidence and must route to an adjacent archetype.
- Reject generic tree editor; this is `AR-FG-92` evidence and must route to an adjacent archetype.
- Reject image segmentation; this is `AR-FG-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-FG-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, truthful state meaning, and permitted actions to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, replace the dominant task, or weaken keyboard, focus, responsive, or recovery parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, responsive transformation, interaction, and accessibility obligations. It does not name StarCi owners, select exact geometry, create product facts, or authorize copying a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [ISAC — Data Standards](https://isac-net.org/data-standards/) | Supports gating exchange, populations, compensation, and reproducibility. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST — Cell Phenotype Quantification](https://www.nist.gov/mml/bbd/quantification-cells-specific-phenotypic-characteristics) | Supports gating strategies and measurement QC. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports keyboard navigation for recursive populations. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "flow-cytometry-gating-workbench",
  "situationCodes": [
    "<matched AR-FG-* codes>"
  ],
  "searchAliases": [
    "population gating tree",
    "recursive cell gate",
    "parent event inheritance",
    "gating QC"
  ],
  "dominantTask": "Define and validate recursively nested cell populations from multivariate flow-cytometry measurements, with each gate inheriting its parent event set.",
  "regions": [
    "gating-workbench",
    "sample-and-channel-selector",
    "population-gating-hierarchy",
    "selected-parent-population",
    "scatter-or-density-projection",
    "gate-boundary-editor",
    "derived-child-statistics",
    "compensation-and-qc-rail"
  ],
  "regionRelationships": [
    "gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection → gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "scatter-or-density-projection",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "sample loading/empty",
    "channel unavailable",
    "parent population stale",
    "gate draft/valid/invalid",
    "compensation warning",
    "too few events",
    "child created/empty",
    "QC pass/fail and export."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

