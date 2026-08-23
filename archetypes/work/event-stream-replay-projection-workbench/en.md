# Event stream replay projection workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `event-stream-replay-projection-workbench` |
| Family | Work |
| Dominant task | Replay an immutable event stream from a selected snapshot or cursor, compare derived projection state, and locate the first invariant divergence. |
| Search aliases | `event replay debugger`, `projection divergence`, `event sourcing replay` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Replay an immutable event stream from a selected snapshot or cursor, compare derived projection state, and locate the first invariant divergence.
- The replay cursor, derived projections, and invariant results remain peer owners for the first divergence.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ERP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-ERP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-ERP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-ERP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-ERP-90` | The dominant task is actually audit timeline. | Reject. |
| `AR-ERP-91` | The dominant task is actually streaming log viewer. | Reject. |
| `AR-ERP-92` | The dominant task is actually job-run detail. | Reject. |
| `AR-ERP-93` | The dominant task is actually notebook reproducibility audit. | Reject. |

### Selection rule

Select `event-stream-replay-projection-workbench` if and only if `AR-ERP-01` through `AR-ERP-04` are evidenced and none of `AR-ERP-90` through `AR-ERP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `replay-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `stream-snapshot-and-code-version` | Owns Stream Snapshot And Code Version evidence or action and preserves its declared relationship to the current selection. |
| `ordered-event-stream` | Owns Ordered Event Stream evidence or action and preserves its declared relationship to the current selection. |
| `replay-cursor-and-controls` | Owns Replay Cursor And Controls evidence or action and preserves its declared relationship to the current selection. |
| `materialized-projection-set` | Owns Materialized Projection Set evidence or action and preserves its declared relationship to the current selection. |
| `invariant-check-results` | Owns Invariant Check Results evidence or action and preserves its declared relationship to the current selection. |
| `first-divergence-point` | Owns First Divergence Point evidence or action and preserves its declared relationship to the current selection. |
| `selected-event-payload` | Owns Selected Event Payload evidence or action and preserves its declared relationship to the current selection. |
| `sandbox-outcome` | Owns Sandbox Outcome evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Event stream, projections, and invariant evidence remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `ordered-event-stream` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Stream and replay stay primary; projections alternate while the cursor persists.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `ordered-event-stream` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Replay summary → first divergence → selected event → projection before and after → invariant result.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `ordered-event-stream` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome`.
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

Task-specific states: snapshot absent, snapshot stale, replay idle, replay running, replay paused, replay failed, replay complete, event unsupported, projection loading, projection diverged, invariant pass, invariant fail, cursor moved, sandbox reset.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `stream-snapshot-and-code-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `ordered-event-stream` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `ordered-event-stream` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `selected-event-payload` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `sandbox-outcome` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `sandbox-outcome` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `sandbox-outcome` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `stream-snapshot-and-code-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `sandbox-outcome` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `replay-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Replay an immutable event stream from a selected snapshot or cursor, compare derived projection state, and locate the first invariant divergence.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject audit timeline; this is `AR-ERP-90` evidence and must route to an adjacent archetype.
- Reject streaming log viewer; this is `AR-ERP-91` evidence and must route to an adjacent archetype.
- Reject job-run detail; this is `AR-ERP-92` evidence and must route to an adjacent archetype.
- Reject notebook reproducibility audit; this is `AR-ERP-93` evidence and must route to an adjacent archetype.

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
| [Microsoft Azure — Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) | Append-only streams, replay, snapshots, and materialized projections. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [AWS — Event sourcing pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing-pattern.html) | Ordered events and reconstructed state. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "event-stream-replay-projection-workbench",
  "situationCodes": ["<matched AR-ERP-* codes>"],
  "searchAliases": ["event replay debugger","projection divergence","event sourcing replay"],
  "dominantTask": "Replay an immutable event stream from a selected snapshot or cursor, compare derived projection state, and locate the first invariant divergence.",
  "regions": ["replay-workbench","stream-snapshot-and-code-version","ordered-event-stream","replay-cursor-and-controls","materialized-projection-set","invariant-check-results","first-divergence-point","selected-event-payload","sandbox-outcome"],
  "regionRelationships": ["The replay cursor, derived projections, and invariant results remain peer owners for the first divergence."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "ordered-event-stream",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["snapshot absent","snapshot stale","replay idle","replay running","replay paused","replay failed","replay complete","event unsupported","projection loading","projection diverged","invariant pass","invariant fail","cursor moved","sandbox reset"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

