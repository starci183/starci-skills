# Memory Consistency Litmus Explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `memory-consistency-litmus-explorer` |
| Family | Work |
| Dominant task | Determine whether a concurrent program outcome is permitted under a selected memory model and explain the ordering relation, read source or fence responsible. |
| Search aliases | `memory model litmus`, `allowed outcome witness`, `happens-before explorer`, `fence legality` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Determine whether a concurrent program outcome is permitted under a selected memory model and explain the ordering relation, read source or fence responsible.
- The required region graph remains `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MC-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-MC-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-MC-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-MC-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-MC-05` | Template must switch models, classify an outcome, expose a textual read-from/happens-before witness, show how adding a fence changes legality and preserve the selected outcome. | Required evidence. |
| `AR-MC-90` | distributed trace monitor | Reject. |
| `AR-MC-91` | code runner | Reject. |
| `AR-MC-92` | dependency graph | Reject. |
| `AR-MC-93` | log viewer | Reject. |

### Selection rule

Select `memory-consistency-litmus-explorer` only when `AR-MC-01` through `AR-MC-05` are evidenced and no `AR-MC-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
litmus-explorer
   `-- litmus-program
      `-- per-thread-program-order-lanes
         `-- memory-model-selector
            `-- candidate-outcome-set
               `-- selected-outcome
                  `-- happens-before-and-read-from-witness
                     `-- rule-or-fence-explanation
```

Declared relationship expression: `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `litmus-explorer` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `litmus-program` | Owns litmus program evidence, action, state, and recovery. | Follows `litmus-explorer` in semantic order and consumes its exact selected context. |
| `per-thread-program-order-lanes` | Owns per thread program order lanes evidence, action, state, and recovery. | Follows `litmus-program` in semantic order and consumes its exact selected context. |
| `memory-model-selector` | Owns memory model selector evidence, action, state, and recovery. | Follows `per-thread-program-order-lanes` in semantic order and consumes its exact selected context. |
| `candidate-outcome-set` | Owns candidate outcome set evidence, action, state, and recovery. | Follows `memory-model-selector` in semantic order and consumes its exact selected context. |
| `selected-outcome` | Owns selected outcome evidence, action, state, and recovery. | Follows `candidate-outcome-set` in semantic order and consumes its exact selected context. |
| `happens-before-and-read-from-witness` | Owns happens before and read from witness evidence, action, state, and recovery. | Follows `selected-outcome` in semantic order and consumes its exact selected context. |
| `rule-or-fence-explanation` | Owns rule or fence explanation evidence, action, state, and recovery. | Follows `happens-before-and-read-from-witness` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Thread lanes, outcome matrix, selected relation witness and rule explanation remain linked.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `per-thread-program-order-lanes` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Thread lanes stack above outcomes; the selected witness opens beside them while model rules use a drawer.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `per-thread-program-order-lanes` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Outcome list → selected per-thread witness sequence → relations → satisfied/violated rule explanation; graph transforms to an accessible relation ledger.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `per-thread-program-order-lanes` is optional and bounded.

### Reflow

- Semantic and DOM order is `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`.
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
| Initial / loading | `litmus-program` | Identify pending scope and preserve semantic position. |
| Ready | `per-thread-program-order-lanes` | Expose the complete dominant task and current version. |
| Empty / not applicable | `memory-model-selector` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `candidate-outcome-set` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `happens-before-and-read-from-witness` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `rule-or-fence-explanation` | Prevent duplicate action and announce progress without moving focus. |
| Success | `rule-or-fence-explanation` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `litmus-program` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `rule-or-fence-explanation` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `litmus-explorer` | Preserve selected entity, query, state, and recovery when topology changes. |
| program parsing/error | `litmus-program` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| model loading | `per-thread-program-order-lanes` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| outcome allowed/forbidden/unknown | `memory-model-selector` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| exploration running/partial | `candidate-outcome-set` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| witness found/missing | `selected-outcome` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| relation cycle | `happens-before-and-read-from-witness` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| fence added | `rule-or-fence-explanation` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| result stale and share/export. | `rule-or-fence-explanation` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must switch models, classify an outcome, expose a textual read-from/happens-before witness, show how adding a fence changes legality and preserve the selected outcome.

### Reject

- Reject distributed trace monitor; this is `AR-MC-90` evidence and must route to an adjacent archetype.
- Reject code runner; this is `AR-MC-91` evidence and must route to an adjacent archetype.
- Reject dependency graph; this is `AR-MC-92` evidence and must route to an adjacent archetype.
- Reject log viewer; this is `AR-MC-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-MC-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [RISC-V — RVWMO](https://docs.riscv.org/reference/isa/unpriv/rvwmo.html) | Supports memory ordering rules and legal executions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Linux Kernel — Litmus Tests](https://docs.kernel.org/dev-tools/lkmm/docs/litmus-tests.html) | Supports litmus outcomes, witnesses, and fences. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Accessible Tables](https://www.w3.org/WAI/tutorials/tables/) | Supports structural equivalents for outcome matrices. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "memory-consistency-litmus-explorer",
  "situationCodes": [
    "<matched AR-MC-* codes>"
  ],
  "searchAliases": [
    "memory model litmus",
    "allowed outcome witness",
    "happens-before explorer",
    "fence legality"
  ],
  "dominantTask": "Determine whether a concurrent program outcome is permitted under a selected memory model and explain the ordering relation, read source or fence responsible.",
  "regions": [
    "litmus-explorer",
    "litmus-program",
    "per-thread-program-order-lanes",
    "memory-model-selector",
    "candidate-outcome-set",
    "selected-outcome",
    "happens-before-and-read-from-witness",
    "rule-or-fence-explanation"
  ],
  "regionRelationships": [
    "litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "per-thread-program-order-lanes",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "program parsing/error",
    "model loading",
    "outcome allowed/forbidden/unknown",
    "exploration running/partial",
    "witness found/missing",
    "relation cycle",
    "fence added",
    "result stale and share/export."
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

