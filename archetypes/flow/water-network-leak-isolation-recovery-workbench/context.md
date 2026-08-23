# Water Network Leak Isolation Recovery Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `water-network-leak-isolation-recovery-workbench` |
| Family | Flow |
| Dominant task | Confirm a leak in a pressurized water network, derive a hydraulic valve cut set that actually disconnects the failed segment, accept its named customer and critical-service impacts, then repair, flush, prove quality and repressurize in controlled stages. |
| Search aliases | `water`, `network`, `isolation`, `recovery`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Confirm a leak in a pressurized water network, derive a hydraulic valve cut set that actually disconnects the failed segment, accept its named customer and critical-service impacts, then repair, flush, prove quality and repressurize in controlled stages.
- The required region graph remains `leak-recovery → distribution-network-district-and-supply-source-topology → pressure-flow-anomaly-evidence → failed-pipe-hypothesis → candidate-valve-cut-set-generator ↔ hydraulic-connectivity-pressure-and-customer-impact-simulation → named-customer-critical-service-and-advisory-ledger → safe-valve-isolation-order → repair-and-contamination-control → flush-path-volume-and-quality-sample-gate → staged-repressurization-and-pressure-verification → restored-service-receipt`.
- The mandatory relationship remains: a cut set is valid only when it hydraulically severs the failed segment and exposes every downstream service consequence before field execution.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must compare two hydraulic cut sets, reject one that leaves the failed pipe connected or harms a named critical service, acknowledge the feasible set's customer impact, execute its valve order, hold repressurization on a failed quality sample, pass the retest and restore supply in verified pressure stages.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-07-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-07-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-07-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-07-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-07-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-07-90` | The dominant task is actually `map-led-situation-monitor`. | Reject. |
| `AR-B13-07-91` | The dominant task is actually `grid-outage-restoration-switching-board`. | Reject. |
| `AR-B13-07-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `water-network-leak-isolation-recovery-workbench` only when `AR-B13-07-01` through `AR-B13-07-05` are evidenced and none of `AR-B13-07-90` through `AR-B13-07-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
leak-recovery
└─ distribution-network-district-and-supply-source-topology
   └─ pressure-flow-anomaly-evidence
      └─ failed-pipe-hypothesis
         └─ candidate-valve-cut-set-generator
            ↔─ hydraulic-connectivity-pressure-and-customer-impact-simulation
               └─ named-customer-critical-service-and-advisory-ledger
                  └─ safe-valve-isolation-order
                     └─ repair-and-contamination-control
                        └─ flush-path-volume-and-quality-sample-gate
                           └─ staged-repressurization-and-pressure-verification
                              └─ restored-service-receipt
```

- Required relationship: a cut set is valid only when it hydraulically severs the failed segment and exposes every downstream service consequence before field execution.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `leak-recovery` | Owns evidence, state, and action for leak recovery without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `distribution-network-district-and-supply-source-topology` | Owns evidence, state, and action for distribution network district and supply source topology without borrowing product semantics. | Follows `leak-recovery` in semantic order and receives its verified context. |
| `pressure-flow-anomaly-evidence` | Owns evidence, state, and action for pressure flow anomaly evidence without borrowing product semantics. | Follows `distribution-network-district-and-supply-source-topology` in semantic order and receives its verified context. |
| `failed-pipe-hypothesis` | Owns evidence, state, and action for failed pipe hypothesis without borrowing product semantics. | Follows `pressure-flow-anomaly-evidence` in semantic order and receives its verified context. |
| `candidate-valve-cut-set-generator` | Owns evidence, state, and action for candidate valve cut set generator without borrowing product semantics. | Follows `failed-pipe-hypothesis` in semantic order and receives its verified context. |
| `hydraulic-connectivity-pressure-and-customer-impact-simulation` | Owns evidence, state, and action for hydraulic connectivity pressure and customer impact simulation without borrowing product semantics. | Synchronizes bidirectionally with `candidate-valve-cut-set-generator` in the same selection context. |
| `named-customer-critical-service-and-advisory-ledger` | Owns evidence, state, and action for named customer critical service and advisory ledger without borrowing product semantics. | Follows `hydraulic-connectivity-pressure-and-customer-impact-simulation` in semantic order and receives its verified context. |
| `safe-valve-isolation-order` | Owns evidence, state, and action for safe valve isolation order without borrowing product semantics. | Follows `named-customer-critical-service-and-advisory-ledger` in semantic order and receives its verified context. |
| `repair-and-contamination-control` | Owns evidence, state, and action for repair and contamination control without borrowing product semantics. | Follows `safe-valve-isolation-order` in semantic order and receives its verified context. |
| `flush-path-volume-and-quality-sample-gate` | Owns evidence, state, and action for flush path volume and quality sample gate without borrowing product semantics. | Follows `repair-and-contamination-control` in semantic order and receives its verified context. |
| `staged-repressurization-and-pressure-verification` | Owns evidence, state, and action for staged repressurization and pressure verification without borrowing product semantics. | Follows `flush-path-volume-and-quality-sample-gate` in semantic order and receives its verified context. |
| `restored-service-receipt` | Owns evidence, state, and action for restored service receipt without borrowing product semantics. | Follows `staged-repressurization-and-pressure-verification` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Hydraulic topology, candidate cut sets, named customer-impact ledger, valve sequence and repair-to-quality-to-repressurization path remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The failed segment, selected cut set and affected critical services remain primary; alternate cuts, complete network and later recovery evidence move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Failed segment → candidate hydraulic cut set → disconnected customer/critical-service set → valve order → isolation proof → repair → flush route and volume → quality sample → staged repressurization → service receipt; the map becomes a cut-set path plus customer-impact route rather than a generic stack.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `leak-recovery → distribution-network-district-and-supply-source-topology → pressure-flow-anomaly-evidence → failed-pipe-hypothesis → candidate-valve-cut-set-generator ↔ hydraulic-connectivity-pressure-and-customer-impact-simulation → named-customer-critical-service-and-advisory-ledger → safe-valve-isolation-order → repair-and-contamination-control → flush-path-volume-and-quality-sample-gate → staged-repressurization-and-pressure-verification → restored-service-receipt`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must compare two hydraulic cut sets, reject one that leaves the failed pipe connected or harms a named critical service, acknowledge the feasible set's customer impact, execute its valve order, hold repressurization on a failed quality sample, pass the retest and restore supply in verified pressure stages.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `distribution-network-district-and-supply-source-topology` | Identify the pending owner and preserve its semantic position. |
| Ready | `pressure-flow-anomaly-evidence` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `failed-pipe-hypothesis` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `candidate-valve-cut-set-generator` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `hydraulic-connectivity-pressure-and-customer-impact-simulation` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `staged-repressurization-and-pressure-verification` | Prevent duplicate action and announce progress without moving focus. |
| Success | `restored-service-receipt` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `distribution-network-district-and-supply-source-topology` | Keep the last safe value and require explicit recovery. |
| Focus transition | `restored-service-receipt` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `leak-recovery` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: sensors loading/stale/disagreeing, leak suspected/confirmed/false, valve operable/inaccessible/unknown, cut set disconnected/incomplete/isolating/overbroad, hydraulic solve converged/failed, customer unaffected/interrupted/advised, critical service protected/escalated, isolation issued/verified, repair pending/complete, contamination risk, flush incomplete/complete, quality sample pending/pass/fail, repressurization held/staged/verified and supply restored.

## Boundaries

### Accept

- Accept when the dominant task is: Confirm a leak in a pressurized water network, derive a hydraulic valve cut set that actually disconnects the failed segment, accept its named customer and critical-service impacts, then repair, flush, prove quality and repressurize in controlled stages.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `map-led-situation-monitor`, `grid-outage-restoration-switching-board`, guided troubleshooting or generic work order; a pressurized hydraulic cut set, named customer and critical-service impact, ordered isolation, repair, flush-volume path, quality gate and staged repressurization are mandatory.
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
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA EPANET](https://www.epa.gov/water-research/epanet) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WHO leakage management and control](https://www.who.int/publications/i/item/WHO-SDE-WSH-01.1) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WHO sanitary inspection for piped distribution](https://cdn.who.int/media/docs/default-source/wash-documents/water-safety-and-quality/water-safety-planning/sanitary-inspection-packages/9.-piped-distribution---network_web.pdf?download=true) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "water-network-leak-isolation-recovery-workbench",
  "situationCodes": [
    "<matched AR-B13-07-* codes>"
  ],
  "searchAliases": [
    "water",
    "network",
    "isolation",
    "recovery",
    "workbench"
  ],
  "dominantTask": "Confirm a leak in a pressurized water network, derive a hydraulic valve cut set that actually disconnects the failed segment, accept its named customer and critical-service impacts, then repair, flush, prove quality and repressurize in controlled stages.",
  "regions": [
    "leak-recovery",
    "distribution-network-district-and-supply-source-topology",
    "pressure-flow-anomaly-evidence",
    "failed-pipe-hypothesis",
    "candidate-valve-cut-set-generator",
    "hydraulic-connectivity-pressure-and-customer-impact-simulation",
    "named-customer-critical-service-and-advisory-ledger",
    "safe-valve-isolation-order",
    "repair-and-contamination-control",
    "flush-path-volume-and-quality-sample-gate",
    "staged-repressurization-and-pressure-verification",
    "restored-service-receipt"
  ],
  "relationships": [
    "a cut set is valid only when it hydraulically severs the failed segment and exposes every downstream service consequence before field execution."
  ],
  "responsive": {
    "wide": "Hydraulic topology, candidate cut sets, named customer-impact ledger, valve sequence and repair-to-quality-to-repressurization path remain simultaneously visible.",
    "intermediate": "The failed segment, selected cut set and affected critical services remain primary; alternate cuts, complete network and later recovery evidence move to synchronized routes.",
    "compact": "Failed segment → candidate hydraulic cut set → disconnected customer/critical-service set → valve order → isolation proof → repair → flush route and volume → quality sample → staged repressurization → service receipt; the map becomes a cut-set path plus customer-impact route rather than a generic stack.",
    "reflow": [
      "leak-recovery",
      "distribution-network-district-and-supply-source-topology",
      "pressure-flow-anomaly-evidence",
      "failed-pipe-hypothesis",
      "candidate-valve-cut-set-generator",
      "hydraulic-connectivity-pressure-and-customer-impact-simulation",
      "named-customer-critical-service-and-advisory-ledger",
      "safe-valve-isolation-order",
      "repair-and-contamination-control",
      "flush-path-volume-and-quality-sample-gate",
      "staged-repressurization-and-pressure-verification",
      "restored-service-receipt"
    ]
  },
  "stateObligations": "sensors loading/stale/disagreeing, leak suspected/confirmed/false, valve operable/inaccessible/unknown, cut set disconnected/incomplete/isolating/overbroad, hydraulic solve converged/failed, customer unaffected/interrupted/advised, critical service protected/escalated, isolation issued/verified, repair pending/complete, contamination risk, flush incomplete/complete, quality sample pending/pass/fail, repressurization held/staged/verified and supply restored.",
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
