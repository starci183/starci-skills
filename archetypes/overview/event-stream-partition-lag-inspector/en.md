# Event stream partition lag inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `event-stream-partition-lag-inspector` |
| Family | Overview |
| Dominant task | Explain consumer delay through partition ownership, log-end versus committed offsets, and rebalance history. |
| Search aliases | `consumer lag inspector`, `partition offset monitor`, `rebalance evidence` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Explain consumer delay through partition ownership, log-end versus committed offsets, and rebalance history.
- Partition coordinates and the committed and log-end offset positions jointly own lag and action consequences.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PLI-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-PLI-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-PLI-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-PLI-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-PLI-90` | The dominant task is actually streaming raw logs. | Reject. |
| `AR-PLI-91` | The dominant task is actually timeline status. | Reject. |
| `AR-PLI-92` | The dominant task is actually SLO console. | Reject. |
| `AR-PLI-93` | The dominant task is actually distributed trace. | Reject. |

### Selection rule

Select `event-stream-partition-lag-inspector` if and only if `AR-PLI-01` through `AR-PLI-04` are evidenced and none of `AR-PLI-90` through `AR-PLI-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `lag-inspector` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `topic-and-consumer-group-context` | Owns Topic And Consumer Group Context evidence or action and preserves its declared relationship to the current selection. |
| `partition-ownership-matrix` | Owns Partition Ownership Matrix evidence or action and preserves its declared relationship to the current selection. |
| `log-end-vs-committed-offsets` | Owns Log End Vs Committed Offsets evidence or action and preserves its declared relationship to the current selection. |
| `lag-heatmap-and-trends` | Owns Lag Heatmap And Trends evidence or action and preserves its declared relationship to the current selection. |
| `rebalance-timeline` | Owns Rebalance Timeline evidence or action and preserves its declared relationship to the current selection. |
| `selected-partition-record-sample` | Owns Selected Partition Record Sample evidence or action and preserves its declared relationship to the current selection. |
| `reset-or-reassign-consequence` | Owns Reset Or Reassign Consequence evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Partition grid, lag curves, and rebalance evidence remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `partition-ownership-matrix` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** A lag-ranked partition table is primary; sample and detail become temporary.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `partition-ownership-matrix` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Lag summary → ranked partitions → selected offset trajectory → owner and rebalance evidence → safe action.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `partition-ownership-matrix` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence`.
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

Task-specific states: group loading, group empty, partition assigned, partition unassigned, consumer healthy, consumer dead, lag rising, lag stable, lag recovering, rebalance active, sample unavailable, reset safe, reset unsafe, action pending.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `topic-and-consumer-group-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `partition-ownership-matrix` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `partition-ownership-matrix` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `selected-partition-record-sample` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `reset-or-reassign-consequence` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `reset-or-reassign-consequence` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `reset-or-reassign-consequence` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `topic-and-consumer-group-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `reset-or-reassign-consequence` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `lag-inspector` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Explain consumer delay through partition ownership, log-end versus committed offsets, and rebalance history.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject streaming raw logs; this is `AR-PLI-90` evidence and must route to an adjacent archetype.
- Reject timeline status; this is `AR-PLI-91` evidence and must route to an adjacent archetype.
- Reject SLO console; this is `AR-PLI-92` evidence and must route to an adjacent archetype.
- Reject distributed trace; this is `AR-PLI-93` evidence and must route to an adjacent archetype.

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
| [Apache Kafka 4.3 — Monitoring](https://kafka.apache.org/43/operations/monitoring/) | Consumer lag metrics and per-partition monitoring. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [AWS MSK — Best practices](https://docs.aws.amazon.com/msk/latest/developerguide/bestpractices.html) | Operational evidence for partitioned stream consumers. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "event-stream-partition-lag-inspector",
  "situationCodes": ["<matched AR-PLI-* codes>"],
  "searchAliases": ["consumer lag inspector","partition offset monitor","rebalance evidence"],
  "dominantTask": "Explain consumer delay through partition ownership, log-end versus committed offsets, and rebalance history.",
  "regions": ["lag-inspector","topic-and-consumer-group-context","partition-ownership-matrix","log-end-vs-committed-offsets","lag-heatmap-and-trends","rebalance-timeline","selected-partition-record-sample","reset-or-reassign-consequence"],
  "regionRelationships": ["Partition coordinates and the committed and log-end offset positions jointly own lag and action consequences."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "partition-ownership-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["group loading","group empty","partition assigned","partition unassigned","consumer healthy","consumer dead","lag rising","lag stable","lag recovering","rebalance active","sample unavailable","reset safe","reset unsafe","action pending"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

