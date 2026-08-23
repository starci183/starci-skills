# Security Constrained Grid Dispatch Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `security-constrained-grid-dispatch-workbench` |
| Family | Work |
| Dominant task | Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements. |
| Search aliases | `security`, `constrained`, `dispatch`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements.
- The required region graph remains `grid-dispatch → operating-interval-state-estimate-and-network-version → node-injection-withdrawal-balance-ledger ↔ resource-offer-ramp-capacity-and-reserve-register → base-and-contingency-branch-flow-constraint-cube → feasible-resource-and-load-dispatch → nodal-balance-and-reserve-receipt → binding-element-contingency-and-congestion-attribution → nodal-price-and-resource-impact-explanation → approve-publish-and-rerun`.
- The mandatory relationship remains: nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must alter one resource limit, expose a binding monitored-element/contingency pair, rebalance affected nodes through a feasible redispatch, prove system and reserve conservation, attribute one congestion component to that exact pair and retain the superseded interval solution.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-03-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-03-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-03-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-03-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-03-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-03-90` | The dominant task is actually `capacity-allocation-overview`. | Reject. |
| `AR-B13-03-91` | The dominant task is actually `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-03-92` | The dominant task is actually `market-depth-order-entry-monitor`. | Reject. |
| `AR-B13-03-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `security-constrained-grid-dispatch-workbench` only when `AR-B13-03-01` through `AR-B13-03-05` are evidenced and none of `AR-B13-03-90` through `AR-B13-03-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
grid-dispatch
└─ operating-interval-state-estimate-and-network-version
   └─ node-injection-withdrawal-balance-ledger
      ↔─ resource-offer-ramp-capacity-and-reserve-register
         └─ base-and-contingency-branch-flow-constraint-cube
            └─ feasible-resource-and-load-dispatch
               └─ nodal-balance-and-reserve-receipt
                  └─ binding-element-contingency-and-congestion-attribution
                     └─ nodal-price-and-resource-impact-explanation
                        └─ approve-publish-and-rerun
```

- Required relationship: nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `grid-dispatch` | Owns evidence, state, and action for grid dispatch without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `operating-interval-state-estimate-and-network-version` | Owns evidence, state, and action for operating interval state estimate and network version without borrowing product semantics. | Follows `grid-dispatch` in semantic order and receives its verified context. |
| `node-injection-withdrawal-balance-ledger` | Owns evidence, state, and action for node injection withdrawal balance ledger without borrowing product semantics. | Follows `operating-interval-state-estimate-and-network-version` in semantic order and receives its verified context. |
| `resource-offer-ramp-capacity-and-reserve-register` | Owns evidence, state, and action for resource offer ramp capacity and reserve register without borrowing product semantics. | Synchronizes bidirectionally with `node-injection-withdrawal-balance-ledger` in the same selection context. |
| `base-and-contingency-branch-flow-constraint-cube` | Owns evidence, state, and action for base and contingency branch flow constraint cube without borrowing product semantics. | Follows `resource-offer-ramp-capacity-and-reserve-register` in semantic order and receives its verified context. |
| `feasible-resource-and-load-dispatch` | Owns evidence, state, and action for feasible resource and load dispatch without borrowing product semantics. | Follows `base-and-contingency-branch-flow-constraint-cube` in semantic order and receives its verified context. |
| `nodal-balance-and-reserve-receipt` | Owns evidence, state, and action for nodal balance and reserve receipt without borrowing product semantics. | Follows `feasible-resource-and-load-dispatch` in semantic order and receives its verified context. |
| `binding-element-contingency-and-congestion-attribution` | Owns evidence, state, and action for binding element contingency and congestion attribution without borrowing product semantics. | Follows `nodal-balance-and-reserve-receipt` in semantic order and receives its verified context. |
| `nodal-price-and-resource-impact-explanation` | Owns evidence, state, and action for nodal price and resource impact explanation without borrowing product semantics. | Follows `binding-element-contingency-and-congestion-attribution` in semantic order and receives its verified context. |
| `approve-publish-and-rerun` | Owns evidence, state, and action for approve publish and rerun without borrowing product semantics. | Follows `nodal-price-and-resource-impact-explanation` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Nodal balance ledger, resource limits, base/contingency constraint cube, dispatch solution, reserve receipt and congestion attribution remain simultaneously inspectable.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Dispatch quantities, selected node and binding element-contingency pair remain primary; complete topology, offers and other contingency cases move to contextual routes while causal attribution stays synchronized.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Operating interval → unbalanced node or binding element-contingency pair → contributing injections/withdrawals and resource limits → corrective redispatch → nodal and reserve receipt → congestion attribution → publish or rerun; node/resource matrices transform into one causal constraint path with scoped lists.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `grid-dispatch → operating-interval-state-estimate-and-network-version → node-injection-withdrawal-balance-ledger ↔ resource-offer-ramp-capacity-and-reserve-register → base-and-contingency-branch-flow-constraint-cube → feasible-resource-and-load-dispatch → nodal-balance-and-reserve-receipt → binding-element-contingency-and-congestion-attribution → nodal-price-and-resource-impact-explanation → approve-publish-and-rerun`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must alter one resource limit, expose a binding monitored-element/contingency pair, rebalance affected nodes through a feasible redispatch, prove system and reserve conservation, attribute one congestion component to that exact pair and retain the superseded interval solution.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `operating-interval-state-estimate-and-network-version` | Identify the pending owner and preserve its semantic position. |
| Ready | `node-injection-withdrawal-balance-ledger` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `resource-offer-ramp-capacity-and-reserve-register` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `base-and-contingency-branch-flow-constraint-cube` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `feasible-resource-and-load-dispatch` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `nodal-price-and-resource-impact-explanation` | Prevent duplicate action and announce progress without moving focus. |
| Success | `approve-publish-and-rerun` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `operating-interval-state-estimate-and-network-version` | Keep the last safe value and require explicit recovery. |
| Focus transition | `approve-publish-and-rerun` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `grid-dispatch` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: state estimate loading/stale/invalid, node balanced/unbalanced, demand forecast current/revised, offer accepted/mitigated/unavailable, resource ramp- or capacity-limited, contingency pending/active/invalid, monitored element within/binding/exceeded, solve queued/running/infeasible/feasible, reserve shortfall, congestion attribution complete/disputed, dispatch published/superseded and manual intervention audited.

## Boundaries

### Accept

- Accept when the dominant task is: Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `capacity-allocation-overview`, `scenario-sensitivity-modeler`, `market-depth-order-entry-monitor` or generic live operations; simultaneous nodal balance, base-and-contingency network constraints, dispatchable resource limits, reserve receipt and element-plus-contingency congestion attribution are mandatory.
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
| [FERC 2024 Energy Primer](https://www.ferc.gov/media/energy-primer-handbook-energy-market-basics) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PJM Manual 11](https://learn.pjm.com/pjmfiles/directory/manuals/m11/index.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC BAL-002-3](https://www.nerc.com/standards/reliability-runtime/standards/bal/bal-002-3) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "security-constrained-grid-dispatch-workbench",
  "situationCodes": [
    "<matched AR-B13-03-* codes>"
  ],
  "searchAliases": [
    "security",
    "constrained",
    "dispatch",
    "workbench"
  ],
  "dominantTask": "Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements.",
  "regions": [
    "grid-dispatch",
    "operating-interval-state-estimate-and-network-version",
    "node-injection-withdrawal-balance-ledger",
    "resource-offer-ramp-capacity-and-reserve-register",
    "base-and-contingency-branch-flow-constraint-cube",
    "feasible-resource-and-load-dispatch",
    "nodal-balance-and-reserve-receipt",
    "binding-element-contingency-and-congestion-attribution",
    "nodal-price-and-resource-impact-explanation",
    "approve-publish-and-rerun"
  ],
  "relationships": [
    "nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it."
  ],
  "responsive": {
    "wide": "Nodal balance ledger, resource limits, base/contingency constraint cube, dispatch solution, reserve receipt and congestion attribution remain simultaneously inspectable.",
    "intermediate": "Dispatch quantities, selected node and binding element-contingency pair remain primary; complete topology, offers and other contingency cases move to contextual routes while causal attribution stays synchronized.",
    "compact": "Operating interval → unbalanced node or binding element-contingency pair → contributing injections/withdrawals and resource limits → corrective redispatch → nodal and reserve receipt → congestion attribution → publish or rerun; node/resource matrices transform into one causal constraint path with scoped lists.",
    "reflow": [
      "grid-dispatch",
      "operating-interval-state-estimate-and-network-version",
      "node-injection-withdrawal-balance-ledger",
      "resource-offer-ramp-capacity-and-reserve-register",
      "base-and-contingency-branch-flow-constraint-cube",
      "feasible-resource-and-load-dispatch",
      "nodal-balance-and-reserve-receipt",
      "binding-element-contingency-and-congestion-attribution",
      "nodal-price-and-resource-impact-explanation",
      "approve-publish-and-rerun"
    ]
  },
  "stateObligations": "state estimate loading/stale/invalid, node balanced/unbalanced, demand forecast current/revised, offer accepted/mitigated/unavailable, resource ramp- or capacity-limited, contingency pending/active/invalid, monitored element within/binding/exceeded, solve queued/running/infeasible/feasible, reserve shortfall, congestion attribution complete/disputed, dispatch published/superseded and manual intervention audited.",
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
