# Well To Well Liquid Transfer Programmer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `well-to-well-liquid-transfer-programmer` |
| Family | Work |
| Dominant task | Program and verify coordinate-addressed liquid transfers while preserving source and destination volume, operation order, tip use and contamination constraints. |
| Search aliases | `microplate transfer program`, `well coordinate transfer`, `tip contamination control`, `volume conservation` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Program and verify coordinate-addressed liquid transfers while preserving source and destination volume, operation order, tip use and contamination constraints.
- The required region graph remains `transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-LT-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-LT-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-LT-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-LT-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-LT-05` | Template must create transfers without drag, update both well volumes, catch overflow and tip-contamination conflicts, reorder with buttons and validate the final executable sequence. | Required evidence. |
| `AR-LT-90` | dual-list transfer | Reject. |
| `AR-LT-91` | spreadsheet | Reject. |
| `AR-LT-92` | generic workflow | Reject. |
| `AR-LT-93` | sample lineage viewer | Reject. |

### Selection rule

Select `well-to-well-liquid-transfer-programmer` only when `AR-LT-01` through `AR-LT-05` are evidenced and no `AR-LT-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
transfer-programmer
   `-- labware-and-reagent-setup
      `-- source-well-grid
         `-- destination-well-grid
            `-- ordered-transfer-program
               `-- selected-transfer-volume-and-tip-policy
                  `-- volume-and-contamination-validator
                     `-- run-review-and-export
```

Declared relationship expression: `transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `transfer-programmer` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `labware-and-reagent-setup` | Owns labware and reagent setup evidence, action, state, and recovery. | Follows `transfer-programmer` in semantic order and consumes its exact selected context. |
| `source-well-grid` | Owns source well grid evidence, action, state, and recovery. | Synchronizes bidirectionally with `labware-and-reagent-setup` under one selected context. |
| `destination-well-grid` | Owns destination well grid evidence, action, state, and recovery. | Synchronizes bidirectionally with `source-well-grid` under one selected context. |
| `ordered-transfer-program` | Owns ordered transfer program evidence, action, state, and recovery. | Follows `destination-well-grid` in semantic order and consumes its exact selected context. |
| `selected-transfer-volume-and-tip-policy` | Owns selected transfer volume and tip policy evidence, action, state, and recovery. | Follows `ordered-transfer-program` in semantic order and consumes its exact selected context. |
| `volume-and-contamination-validator` | Owns volume and contamination validator evidence, action, state, and recovery. | Follows `selected-transfer-volume-and-tip-policy` in semantic order and consumes its exact selected context. |
| `run-review-and-export` | Owns run review and export evidence, action, state, and recovery. | Follows `volume-and-contamination-validator` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Source and destination grids, selected transfer, ordered program and invariant ledger remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `source-well-grid` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Plate grids stack around the transfer program; connector arcs yield while coordinate labels remain explicit.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `source-well-grid` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Select source coordinates → select destinations → set volume/tip policy → review ordered operations → validate/run; persistent totals replace simultaneous miniature plates.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `source-well-grid` is optional and bounded.

### Reflow

- Semantic and DOM order is `transfer-programmer → labware-and-reagent-setup → source-well-grid → destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`.
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
| Initial / loading | `labware-and-reagent-setup` | Identify pending scope and preserve semantic position. |
| Ready | `source-well-grid` | Expose the complete dominant task and current version. |
| Empty / not applicable | `destination-well-grid` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `ordered-transfer-program` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `volume-and-contamination-validator` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `run-review-and-export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `run-review-and-export` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `labware-and-reagent-setup` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `run-review-and-export` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `transfer-programmer` | Preserve selected entity, query, state, and recovery when topology changes. |
| labware loading/mismatch | `labware-and-reagent-setup` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| well empty/over-capacity | `source-well-grid` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| source insufficient | `destination-well-grid` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| destination overflow | `ordered-transfer-program` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| tip policy safe/unsafe | `selected-transfer-volume-and-tip-policy` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| contamination conflict | `volume-and-contamination-validator` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| operation reordered | `run-review-and-export` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| validation stale | `run-review-and-export` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| run blocked and export success. | `run-review-and-export` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must create transfers without drag, update both well volumes, catch overflow and tip-contamination conflicts, reorder with buttons and validate the final executable sequence.

### Reject

- Reject dual-list transfer; this is `AR-LT-90` evidence and must route to an adjacent archetype.
- Reject spreadsheet; this is `AR-LT-91` evidence and must route to an adjacent archetype.
- Reject generic workflow; this is `AR-LT-92` evidence and must route to an adjacent archetype.
- Reject sample lineage viewer; this is `AR-LT-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-LT-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [SLAS — Microplate Standards](https://www.slas.org/resources/standards/ansi-slas-microplate-standards/) | Supports well geometry and plate interoperability. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [SiLA — Core Specification](https://sila-standard.com/wp-content/uploads/2022/03/SiLA-2-Part-A-Overview-Concepts-and-Core-Specification-v1.1.pdf) | Supports executable laboratory operations and validation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard-operable coordinate grids. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "well-to-well-liquid-transfer-programmer",
  "situationCodes": [
    "<matched AR-LT-* codes>"
  ],
  "searchAliases": [
    "microplate transfer program",
    "well coordinate transfer",
    "tip contamination control",
    "volume conservation"
  ],
  "dominantTask": "Program and verify coordinate-addressed liquid transfers while preserving source and destination volume, operation order, tip use and contamination constraints.",
  "regions": [
    "transfer-programmer",
    "labware-and-reagent-setup",
    "source-well-grid",
    "destination-well-grid",
    "ordered-transfer-program",
    "selected-transfer-volume-and-tip-policy",
    "volume-and-contamination-validator",
    "run-review-and-export"
  ],
  "regionRelationships": [
    "transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "transfer-programmer → labware-and-reagent-setup → source-well-grid → destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "source-well-grid",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "labware loading/mismatch",
    "well empty/over-capacity",
    "source insufficient",
    "destination overflow",
    "tip policy safe/unsafe",
    "contamination conflict",
    "operation reordered",
    "validation stale",
    "run blocked and export success."
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

