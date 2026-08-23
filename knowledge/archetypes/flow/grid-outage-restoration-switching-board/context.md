# Grid Outage Restoration Switching Board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `grid-outage-restoration-switching-board` |
| Family | Flow |
| Dominant task | Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes. |
| Search aliases | `outage`, `restoration`, `switching`, `board` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes.
- The required region graph remains `restoration-board → outage-boundary-and-control-authority → deenergized-network-topology → black-start-source-and-cranking-load-register → source-to-cranking-load-path-graph → candidate-energized-island-boundaries → ordered-switching-plan ↔ clearance-tag-ground-and-work-party-veto-register → current-step-command → telemetry-and-field-verification → derived-energized-island-topology → critical-load-restoration-and-as-operated-log`.
- The mandatory relationship remains: a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must start one black-start source, extend a cranking path into an island, block a tempting switch through an active clearance impact cone, clear and authorize the corrected step, prove voltage/frequency plus field state and update the island boundary only after verification.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-02-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-02-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-02-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-02-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-02-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-02-90` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-B13-02-91` | The dominant task is actually `dependency-topology-monitor`. | Reject. |
| `AR-B13-02-92` | The dominant task is actually `guided-setup-checklist`. | Reject. |
| `AR-B13-02-93` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-02-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `grid-outage-restoration-switching-board` only when `AR-B13-02-01` through `AR-B13-02-05` are evidenced and none of `AR-B13-02-90` through `AR-B13-02-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
restoration-board
└─ outage-boundary-and-control-authority
   └─ deenergized-network-topology
      └─ black-start-source-and-cranking-load-register
         └─ source-to-cranking-load-path-graph
            └─ candidate-energized-island-boundaries
               └─ ordered-switching-plan
                  ↔─ clearance-tag-ground-and-work-party-veto-register
                     └─ current-step-command
                        └─ telemetry-and-field-verification
                           └─ derived-energized-island-topology
                              └─ critical-load-restoration-and-as-operated-log
```

- Required relationship: a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `restoration-board` | Owns evidence, state, and action for restoration board without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `outage-boundary-and-control-authority` | Owns evidence, state, and action for outage boundary and control authority without borrowing product semantics. | Follows `restoration-board` in semantic order and receives its verified context. |
| `deenergized-network-topology` | Owns evidence, state, and action for deenergized network topology without borrowing product semantics. | Follows `outage-boundary-and-control-authority` in semantic order and receives its verified context. |
| `black-start-source-and-cranking-load-register` | Owns evidence, state, and action for black start source and cranking load register without borrowing product semantics. | Follows `deenergized-network-topology` in semantic order and receives its verified context. |
| `source-to-cranking-load-path-graph` | Owns evidence, state, and action for source to cranking load path graph without borrowing product semantics. | Follows `black-start-source-and-cranking-load-register` in semantic order and receives its verified context. |
| `candidate-energized-island-boundaries` | Owns evidence, state, and action for candidate energized island boundaries without borrowing product semantics. | Follows `source-to-cranking-load-path-graph` in semantic order and receives its verified context. |
| `ordered-switching-plan` | Owns evidence, state, and action for ordered switching plan without borrowing product semantics. | Follows `candidate-energized-island-boundaries` in semantic order and receives its verified context. |
| `clearance-tag-ground-and-work-party-veto-register` | Owns evidence, state, and action for clearance tag ground and work party veto register without borrowing product semantics. | Synchronizes bidirectionally with `ordered-switching-plan` in the same selection context. |
| `current-step-command` | Owns evidence, state, and action for current step command without borrowing product semantics. | Follows `clearance-tag-ground-and-work-party-veto-register` in semantic order and receives its verified context. |
| `telemetry-and-field-verification` | Owns evidence, state, and action for telemetry and field verification without borrowing product semantics. | Follows `current-step-command` in semantic order and receives its verified context. |
| `derived-energized-island-topology` | Owns evidence, state, and action for derived energized island topology without borrowing product semantics. | Follows `telemetry-and-field-verification` in semantic order and receives its verified context. |
| `critical-load-restoration-and-as-operated-log` | Owns evidence, state, and action for critical load restoration and as operated log without borrowing product semantics. | Follows `derived-energized-island-topology` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** De-energized/current island topology, selected cranking path, switching plan, clearance-veto register, active command and electrical verification remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The active island boundary, current cranking path and next step remain primary; alternate sources, other islands, full clearance evidence and as-operated history become synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Black-start source → next cranking-path segment → target island boundary or cranking load → clearance/ground impact cone → issue or hold → voltage/frequency/field proof → derived island topology → next path segment; the network transforms into one executable path spine plus an island switcher, not a stack of topology cards.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `restoration-board → outage-boundary-and-control-authority → deenergized-network-topology → black-start-source-and-cranking-load-register → source-to-cranking-load-path-graph → candidate-energized-island-boundaries → ordered-switching-plan ↔ clearance-tag-ground-and-work-party-veto-register → current-step-command → telemetry-and-field-verification → derived-energized-island-topology → critical-load-restoration-and-as-operated-log`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must start one black-start source, extend a cranking path into an island, block a tempting switch through an active clearance impact cone, clear and authorize the corrected step, prove voltage/frequency plus field state and update the island boundary only after verification.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `outage-boundary-and-control-authority` | Identify the pending owner and preserve its semantic position. |
| Ready | `deenergized-network-topology` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `black-start-source-and-cranking-load-register` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `source-to-cranking-load-path-graph` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `candidate-energized-island-boundaries` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `derived-energized-island-topology` | Prevent duplicate action and announce progress without moving focus. |
| Success | `critical-load-restoration-and-as-operated-log` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `outage-boundary-and-control-authority` | Keep the last safe value and require explicit recovery. |
| Focus transition | `critical-load-restoration-and-as-operated-log` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `restoration-board` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: topology unknown/deenergized/partially energized/restored, black-start source unavailable/starting/stable, cranking path blocked/open/energized, island proposed/forming/stable/unstable/joinable, clearance active/released/conflicting, switching step planned/vetoed/authorized/issued/failed/verified, telemetry stale/disagreeing, unexpected energization, rollback/hold and restoration transfer complete.

## Boundaries

### Accept

- Accept when the dominant task is: Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `live-operations-command-center`, `dependency-topology-monitor`, `guided-setup-checklist` or `permit-to-work-isolation-control-room`; black-start sources, source-to-cranking-load paths, explicit island boundaries, clearance-veto topology, stepwise electrical verification and derived energized islands are mandatory.
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
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC EOP-005-3](https://www.nerc.com/globalassets/standards/reliability-runtime/standards/eop/eop-005-3.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OSHA 1910.269](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.269) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PJM Manual 36 — System Restoration](https://learn.pjm.com/-/media/DotCom/documents/manuals/m36.ashx) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "grid-outage-restoration-switching-board",
  "situationCodes": [
    "<matched AR-B13-02-* codes>"
  ],
  "searchAliases": [
    "outage",
    "restoration",
    "switching",
    "board"
  ],
  "dominantTask": "Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes.",
  "regions": [
    "restoration-board",
    "outage-boundary-and-control-authority",
    "deenergized-network-topology",
    "black-start-source-and-cranking-load-register",
    "source-to-cranking-load-path-graph",
    "candidate-energized-island-boundaries",
    "ordered-switching-plan",
    "clearance-tag-ground-and-work-party-veto-register",
    "current-step-command",
    "telemetry-and-field-verification",
    "derived-energized-island-topology",
    "critical-load-restoration-and-as-operated-log"
  ],
  "relationships": [
    "a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance."
  ],
  "responsive": {
    "wide": "De-energized/current island topology, selected cranking path, switching plan, clearance-veto register, active command and electrical verification remain simultaneously visible.",
    "intermediate": "The active island boundary, current cranking path and next step remain primary; alternate sources, other islands, full clearance evidence and as-operated history become synchronized routes.",
    "compact": "Black-start source → next cranking-path segment → target island boundary or cranking load → clearance/ground impact cone → issue or hold → voltage/frequency/field proof → derived island topology → next path segment; the network transforms into one executable path spine plus an island switcher, not a stack of topology cards.",
    "reflow": [
      "restoration-board",
      "outage-boundary-and-control-authority",
      "deenergized-network-topology",
      "black-start-source-and-cranking-load-register",
      "source-to-cranking-load-path-graph",
      "candidate-energized-island-boundaries",
      "ordered-switching-plan",
      "clearance-tag-ground-and-work-party-veto-register",
      "current-step-command",
      "telemetry-and-field-verification",
      "derived-energized-island-topology",
      "critical-load-restoration-and-as-operated-log"
    ]
  },
  "stateObligations": "topology unknown/deenergized/partially energized/restored, black-start source unavailable/starting/stable, cranking path blocked/open/energized, island proposed/forming/stable/unstable/joinable, clearance active/released/conflicting, switching step planned/vetoed/authorized/issued/failed/verified, telemetry stale/disagreeing, unexpected energization, rollback/hold and restoration transfer complete.",
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
