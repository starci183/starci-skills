# Load and balance packing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `load-and-balance-packing-workbench` |
| Family | Work |
| Dominant task | Place cargo into compartments or containers while satisfying weight, center-of-gravity, compatibility, securing, and unloading-order constraints. |
| Search aliases | `cargo load planner`, `weight and balance`, `compartment packing` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Place cargo into compartments or containers while satisfying weight, center-of-gravity, compatibility, securing, and unloading-order constraints.
- Placement geometry and the global weight and center-of-gravity envelope jointly own plan validity.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-LBP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-LBP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-LBP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-LBP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-LBP-90` | The dominant task is actually seat reservation. | Reject. |
| `AR-LBP-91` | The dominant task is actually quota allocation. | Reject. |
| `AR-LBP-92` | The dominant task is actually dual-list transfer. | Reject. |
| `AR-LBP-93` | The dominant task is actually generic canvas. | Reject. |

### Selection rule

Select `load-and-balance-packing-workbench` if and only if `AR-LBP-01` through `AR-LBP-04` are evidenced and none of `AR-LBP-90` through `AR-LBP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `load-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `cargo-pool` | Owns Cargo Pool evidence or action and preserves its declared relationship to the current selection. |
| `compartment-spatial-plan` | Owns Compartment Spatial Plan evidence or action and preserves its declared relationship to the current selection. |
| `placement-manifest` | Owns Placement Manifest evidence or action and preserves its declared relationship to the current selection. |
| `weight-balance-envelope` | Owns Weight Balance Envelope evidence or action and preserves its declared relationship to the current selection. |
| `compatibility-securing-checks` | Owns Compatibility Securing Checks evidence or action and preserves its declared relationship to the current selection. |
| `unload-sequence` | Owns Unload Sequence evidence or action and preserves its declared relationship to the current selection. |
| `approval` | Owns Approval evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Cargo pool, spatial plan, and live balance and constraint rail remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `compartment-spatial-plan` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Cargo becomes a drawer while the plan and balance evidence remain primary.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `compartment-spatial-plan` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Compartment → candidate cargo → placement controls → balance and constraint result → manifest and unload review; buttons replace drag.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `compartment-spatial-plan` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: cargo unplaced, cargo placed, compartment open, compartment full, weight within envelope, weight outside envelope, CG within envelope, CG outside envelope, incompatibility, securing missing, unload blocked, plan dirty, approval pending, approval failure, approval success.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `cargo-pool` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `compartment-spatial-plan` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `compartment-spatial-plan` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `unload-sequence` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `approval` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `approval` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `approval` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `cargo-pool` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `approval` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `load-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Place cargo into compartments or containers while satisfying weight, center-of-gravity, compatibility, securing, and unloading-order constraints.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject seat reservation; this is `AR-LBP-90` evidence and must route to an adjacent archetype.
- Reject quota allocation; this is `AR-LBP-91` evidence and must route to an adjacent archetype.
- Reject dual-list transfer; this is `AR-LBP-92` evidence and must route to an adjacent archetype.
- Reject generic canvas; this is `AR-LBP-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [FAA — Weight and Balance Handbook](https://www.faa.gov/sites/faa.gov/files/2023-09/Weight_Balance_Handbook.pdf) | Weight, moment, and center-of-gravity envelope calculations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IATA — Unit Load Devices](https://www.iata.org/en/programs/cargo/cargo-operations/unit-load-devices/) | Cargo restraint, handling, and load-device safety. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "load-and-balance-packing-workbench",
  "situationCodes": ["<matched AR-LBP-* codes>"],
  "searchAliases": ["cargo load planner","weight and balance","compartment packing"],
  "dominantTask": "Place cargo into compartments or containers while satisfying weight, center-of-gravity, compatibility, securing, and unloading-order constraints.",
  "regions": ["load-workbench","cargo-pool","compartment-spatial-plan","placement-manifest","weight-balance-envelope","compatibility-securing-checks","unload-sequence","approval"],
  "regionRelationships": ["Placement geometry and the global weight and center-of-gravity envelope jointly own plan validity."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "compartment-spatial-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["cargo unplaced","cargo placed","compartment open","compartment full","weight within envelope","weight outside envelope","CG within envelope","CG outside envelope","incompatibility","securing missing","unload blocked","plan dirty","approval pending","approval failure","approval success"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

