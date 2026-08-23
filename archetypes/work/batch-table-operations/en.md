# Batch table operations

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `batch-table-operations` |
| Family | Work |
| Dominant task | Scan structured rows, build a selection set, and commit a set-scoped transaction whose eligibility, consequence, and partial outcome depend on that set while column relationships remain available. |
| Search aliases | bulk transaction, selected rows, batch eligibility, partial outcome ledger |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `batch-workbench` owns the complete dominant task and its recovery boundary.
- Scan structured rows, build a selection set, and commit a set-scoped transaction whose eligibility, consequence, and partial outcome depend on that set while column relationships remain available.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-BTO-01` | Scan structured rows, build a selection set, and commit a set-scoped transaction whose eligibility, consequence, and partial outcome depend on that set while column relationships remain available. | Required positive evidence. |
| `AR-BTO-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-BTO-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-BTO-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-BTO-90` | The actual task is owned by spreadsheet grid editing or operational collection processing. | Reject. |
| `AR-BTO-91` | Reject cell/range editing, formula work, browse-first cards, non-relational lists, and operational queues whose loop is repeated record inspection rather than one set-scoped transaction. | Reject. |
| `AR-BTO-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `batch-table-operations` if and only if `AR-BTO-01` through `AR-BTO-04` are evidenced, every required region and relationship is present, and none of `AR-BTO-90` through `AR-BTO-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
batch-workbench
├─ dataset-context
├─ table-toolbar
├─ relational-table
│  └─ selection-set
├─ batch-eligibility-and-consequence
├─ batch-action-mode
├─ batch-outcome-ledger
└─ pagination-or-expansion
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `batch-workbench` | Bounds one dataset transaction and owns continuity across filtering, selection, commitment, and recovery. |
| `dataset-context` | Names scope and freshness; every downstream region reads this same dataset identity. |
| `table-toolbar` | Changes the relational view and reports applied criteria without owning batch commitment. |
| `relational-table` | Owns column-preserving scan, sort, disclosure, and row identity. |
| `selection-set` | Owns membership, select-all scope, and the exact set passed to eligibility. |
| `batch-eligibility-and-consequence` | Explains eligible and blocked members plus the consequence before commitment. |
| `batch-action-mode` | Owns confirmation, pending protection, and cancellation for the set-scoped transaction. |
| `batch-outcome-ledger` | Maps each submitted row to success, failure, or retry without becoming record detail. |
| `pagination-or-expansion` | Extends the same dataset while retaining selection scope and pagination focus. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Give the relational table most width; keep toolbar, headers, selection, eligibility, and batch mode attached to the same table owner; never confine dense rows in a narrow card rail.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `relational-table` owns horizontal overflow when cross-column comparison is invariant; the outcome ledger may scroll vertically; the page never owns horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Keep identity and decision columns; priority-hide support columns or expose them in row disclosure; keep selection count, eligibility, consequence, and actions in one batch context.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `relational-table` owns horizontal overflow when cross-column comparison is invariant; the outcome ledger may scroll vertically; the page never owns horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Linearize rows only when column comparison is dispensable; otherwise retain one bounded table scroller with identity context and an explicit overflow cue, then open eligibility and outcome as named stages.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `relational-table` owns horizontal overflow when cross-column comparison is invariant; the outcome ledger may scroll vertically; the page never owns horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `batch-workbench → dataset-context → table-toolbar → relational-table → selection-set → batch-eligibility-and-consequence → batch-action-mode → batch-outcome-ledger → pagination-or-expansion`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes dataset loading, true empty, filter no-match, dataset error/retry, row disclosure, none/single/multi/all selection, eligibility blocked, permission-disabled action, batch pending, partial success, row retry, stale row, and pagination focus.

## State obligations

Task-specific states: dataset loading, true empty, filter no-match, dataset error/retry, row disclosure, none/single/multi/all selection, eligibility blocked, permission-disabled action, batch pending, partial success, row retry, stale row, and pagination focus.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, selection or cursor, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, filter no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context needed for understanding. |
| Pending | Prevent duplicates, retain context, expose Cancel when safe, and announce progress without stealing focus. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains required simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage while retaining actions, state, and recovery. |

## Boundaries

### Accept

- Stable columns create relational evidence and a selection set determines one transaction, its eligibility, and its per-row outcome.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cell/range editing, formula work, browse-first cards, non-relational lists, and operational queues whose loop is repeated record inspection rather than one set-scoped transaction.
- Reject when spreadsheet grid editing or operational collection processing owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-BTO-90`, `AR-BTO-91`, or `AR-BTO-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [IBM Carbon filtering pattern](https://carbondesignsystem.com/patterns/filtering/) | Filters expose active criteria and result changes in the same dataset context. | It does not choose product filters or query semantics. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information and function survive narrow width without page-level two-axis scrolling. | It does not decide which intrinsic work region owns bounded overflow. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `batch-table-operations`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "batch-table-operations",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
