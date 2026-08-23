# Chain of custody transfer ledger

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `chain-of-custody-transfer-ledger` |
| Family | Flow |
| Dominant task | Execute repeated custody transfers while preserving current custodian, seal, and condition evidence in an append-only provenance chain. |
| Search aliases | `custody transfer ledger`, `chain of custody`, `signed handoff history` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Execute repeated custody transfers while preserving current custodian, seal, and condition evidence in an append-only provenance chain.
- Each accepted transfer appends one receipt and updates exactly one canonical current custodian.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CCT-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-CCT-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-CCT-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-CCT-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-CCT-90` | The dominant task is actually one-time cross-party handoff. | Reject. |
| `AR-CCT-91` | The dominant task is actually audit timeline. | Reject. |
| `AR-CCT-92` | The dominant task is actually sample lineage explorer. | Reject. |
| `AR-CCT-93` | The dominant task is actually package tracking. | Reject. |

### Selection rule

Select `chain-of-custody-transfer-ledger` if and only if `AR-CCT-01` through `AR-CCT-04` are evidenced and none of `AR-CCT-90` through `AR-CCT-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `custody-ledger` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `item-batch-identity` | Owns Item Batch Identity evidence or action and preserves its declared relationship to the current selection. |
| `current-custodian-condition` | Owns Current Custodian Condition evidence or action and preserves its declared relationship to the current selection. |
| `transfer-event-chain` | Owns Transfer Event Chain evidence or action and preserves its declared relationship to the current selection. |
| `pending-handoff` | Owns Pending Handoff evidence or action and preserves its declared relationship to the current selection. |
| `recipient-verification` | Owns Recipient Verification evidence or action and preserves its declared relationship to the current selection. |
| `seal-condition-evidence` | Owns Seal Condition Evidence evidence or action and preserves its declared relationship to the current selection. |
| `accept-reject-exception` | Owns Accept Reject Exception evidence or action and preserves its declared relationship to the current selection. |
| `signed-receipt-and-current-state` | Owns Signed Receipt And Current State evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Event chain, current state, and pending transfer remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `transfer-event-chain` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The event chain collapses to a rail while pending verification stays primary.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `transfer-event-chain` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Current custody → pending handoff → verification and evidence → accept or reject → signed receipt; history remains reachable.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `transfer-event-chain` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state`.
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

Task-specific states: custody current, custody unknown, transfer draft, transfer pending, transfer accepted, transfer rejected, recipient verified, recipient failed, seal intact, seal broken, seal unknown, condition unchanged, condition damaged, receipt signing, receipt failure, exception.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `item-batch-identity` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `current-custodian-condition` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `current-custodian-condition` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `accept-reject-exception` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `signed-receipt-and-current-state` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `signed-receipt-and-current-state` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `signed-receipt-and-current-state` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `item-batch-identity` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `signed-receipt-and-current-state` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `custody-ledger` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Execute repeated custody transfers while preserving current custodian, seal, and condition evidence in an append-only provenance chain.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject one-time cross-party handoff; this is `AR-CCT-90` evidence and must route to an adjacent archetype.
- Reject audit timeline; this is `AR-CCT-91` evidence and must route to an adjacent archetype.
- Reject sample lineage explorer; this is `AR-CCT-92` evidence and must route to an adjacent archetype.
- Reject package tracking; this is `AR-CCT-93` evidence and must route to an adjacent archetype.

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
| [GS1 — Global Traceability Standard](https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard) | Time-ordered custody parties, traceability events, and key evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "chain-of-custody-transfer-ledger",
  "situationCodes": ["<matched AR-CCT-* codes>"],
  "searchAliases": ["custody transfer ledger","chain of custody","signed handoff history"],
  "dominantTask": "Execute repeated custody transfers while preserving current custodian, seal, and condition evidence in an append-only provenance chain.",
  "regions": ["custody-ledger","item-batch-identity","current-custodian-condition","transfer-event-chain","pending-handoff","recipient-verification","seal-condition-evidence","accept-reject-exception","signed-receipt-and-current-state"],
  "regionRelationships": ["Each accepted transfer appends one receipt and updates exactly one canonical current custodian."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "transfer-event-chain",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["custody current","custody unknown","transfer draft","transfer pending","transfer accepted","transfer rejected","recipient verified","recipient failed","seal intact","seal broken","seal unknown","condition unchanged","condition damaged","receipt signing","receipt failure","exception"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

