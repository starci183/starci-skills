# Cycle count variance reconciliation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cycle-count-variance-reconciliation-workbench` |
| Family | Work |
| Dominant task | Run blind physical counts, controlled recounts, and approved inventory adjustments without exposing expected quantities before submission. |
| Search aliases | `blind cycle count`, `inventory variance recount`, `count adjustment approval` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Run blind physical counts, controlled recounts, and approved inventory adjustments without exposing expected quantities before submission.
- Blind acquisition precedes every variance, recount, evidence, approval, and posting owner.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CCV-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-CCV-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-CCV-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-CCV-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-CCV-90` | The dominant task is actually generic reconciliation diff. | Reject. |
| `AR-CCV-91` | The dominant task is actually spreadsheet. | Reject. |
| `AR-CCV-92` | The dominant task is actually inventory table. | Reject. |
| `AR-CCV-93` | The dominant task is actually review-submit ledger. | Reject. |

### Selection rule

Select `cycle-count-variance-reconciliation-workbench` if and only if `AR-CCV-01` through `AR-CCV-04` are evidenced and none of `AR-CCV-90` through `AR-CCV-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
cycle-count-workbench -> count-scope-location-queue -> blind-count-entry -> count-submission -> expected-vs-counted-reveal -> variance-recount-decision -> evidence -> adjustment-approval -> inventory-posting-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `cycle-count-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `count-scope-location-queue` | Owns Count Scope Location Queue evidence or action and preserves its declared relationship to the current selection. |
| `blind-count-entry` | Owns Blind Count Entry evidence or action and preserves its declared relationship to the current selection. |
| `count-submission` | Owns Count Submission evidence or action and preserves its declared relationship to the current selection. |
| `expected-vs-counted-reveal` | Owns Expected Vs Counted Reveal evidence or action and preserves its declared relationship to the current selection. |
| `variance-recount-decision` | Owns Variance Recount Decision evidence or action and preserves its declared relationship to the current selection. |
| `evidence` | Owns Evidence evidence or action and preserves its declared relationship to the current selection. |
| `adjustment-approval` | Owns Adjustment Approval evidence or action and preserves its declared relationship to the current selection. |
| `inventory-posting-receipt` | Owns Inventory Posting Receipt evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Location queue, count or reconcile workspace, and evidence and approval remain simultaneously visible without leaking expected quantity.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `count-scope-location-queue` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The queue becomes a drawer while the active count or variance stays primary.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `count-scope-location-queue` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Location → blind entry → submit → variance or recount → evidence → approval and posting; expected value never appears early.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `count-scope-location-queue` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `cycle-count-workbench -> count-scope-location-queue -> blind-count-entry -> count-submission -> expected-vs-counted-reveal -> variance-recount-decision -> evidence -> adjustment-approval -> inventory-posting-receipt`.
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

Task-specific states: location pending, location counting, location submitted, blind value draft, reveal locked, reveal open, variance none, variance high, recount requested, recount completed, evidence missing, adjustment pending, adjustment denied, adjustment approved, posting failure, posting success.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `count-scope-location-queue` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `blind-count-entry` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `blind-count-entry` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `adjustment-approval` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `inventory-posting-receipt` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `inventory-posting-receipt` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `inventory-posting-receipt` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `count-scope-location-queue` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `inventory-posting-receipt` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `cycle-count-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Run blind physical counts, controlled recounts, and approved inventory adjustments without exposing expected quantities before submission.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject generic reconciliation diff; this is `AR-CCV-90` evidence and must route to an adjacent archetype.
- Reject spreadsheet; this is `AR-CCV-91` evidence and must route to an adjacent archetype.
- Reject inventory table; this is `AR-CCV-92` evidence and must route to an adjacent archetype.
- Reject review-submit ledger; this is `AR-CCV-93` evidence and must route to an adjacent archetype.

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
| [Oracle WMS 26B — Cycle count inventory updates](https://docs.oracle.com/en/cloud/saas/warehouse-management/26b/owmol/reinitiate-in-progress-deferred-cycle-counts.html) | Deferred cycle counts, recount, adjustment approval, and inventory update controls. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Oracle WMS 26B — Online Help](https://docs.oracle.com/en/cloud/saas/warehouse-management/26b/owmol/index.html) | Current warehouse-management cycle-count context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "cycle-count-variance-reconciliation-workbench",
  "situationCodes": ["<matched AR-CCV-* codes>"],
  "searchAliases": ["blind cycle count","inventory variance recount","count adjustment approval"],
  "dominantTask": "Run blind physical counts, controlled recounts, and approved inventory adjustments without exposing expected quantities before submission.",
  "regions": ["cycle-count-workbench","count-scope-location-queue","blind-count-entry","count-submission","expected-vs-counted-reveal","variance-recount-decision","evidence","adjustment-approval","inventory-posting-receipt"],
  "regionRelationships": ["Blind acquisition precedes every variance, recount, evidence, approval, and posting owner."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "cycle-count-workbench -> count-scope-location-queue -> blind-count-entry -> count-submission -> expected-vs-counted-reveal -> variance-recount-decision -> evidence -> adjustment-approval -> inventory-posting-receipt",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "count-scope-location-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["location pending","location counting","location submitted","blind value draft","reveal locked","reveal open","variance none","variance high","recount requested","recount completed","evidence missing","adjustment pending","adjustment denied","adjustment approved","posting failure","posting success"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

