# Dual list transfer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dual-list-transfer` |
| Family | Work |
| Dominant task | Move items between available and selected peer sets while preserving independent filters, membership state, eligibility, order, and commit recovery. |
| Search aliases | transfer list, available selected, membership chooser, pick list |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `transfer-workbench` owns the complete dominant task and its recovery boundary.
- Move items between available and selected peer sets while preserving independent filters, membership state, eligibility, order, and commit recovery.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-DLT-01` | Move items between available and selected peer sets while preserving independent filters, membership state, eligibility, order, and commit recovery. | Required positive evidence. |
| `AR-DLT-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-DLT-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-DLT-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-DLT-90` | The actual task is owned by one-list multiselect or batch operations. | Reject. |
| `AR-DLT-91` | Reject one-list multiselect, batch table actions, permission matrices, shopping carts, and drag-only sorting within one collection. | Reject. |
| `AR-DLT-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `dual-list-transfer` if and only if `AR-DLT-01` through `AR-DLT-04` are evidenced, every required region and relationship is present, and none of `AR-DLT-90` through `AR-DLT-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
transfer-workbench
├─ transfer-scope-and-summary
├─ source-and-destination-filters
├─ available-collection
├─ transfer-controls
├─ selected-collection
└─ validation-and-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `transfer-workbench` | Owns one membership transition, both collection contexts, draft ordering, and commit boundary. |
| `transfer-scope-and-summary` | Names source scope, destination purpose, independent counts, limit, and unsaved state. |
| `source-and-destination-filters` | Own independent queries and no-match states without changing membership. |
| `available-collection` | Owns source membership, eligibility, selection, and Add actions. |
| `transfer-controls` | Express add/remove direction in text, provide keyboard actions, and never depend on arrows alone. |
| `selected-collection` | Owns destination membership, order, limit, selection, and Remove actions. |
| `validation-and-commit` | Checks ineligible, duplicate, stale, and limit states; owns pending, partial failure, retry, and success. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep both peer collections simultaneous with independent counts and search plus explicit Add/Remove controls; expose direction and order with text.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Each collection owns bounded vertical list overflow; no horizontal page overflow or drag-only transfer axis is permitted.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Keep both panes only while labels and actions fit; otherwise prioritize the active side and keep destination count/summary persistent.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Each collection owns bounded vertical list overflow; no horizontal page overflow or drag-only transfer axis is permitted.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use named Available and Selected stages; expose Add/Remove locally on each item; review selected membership before commit; Back preserves both filters and scroll positions.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Each collection owns bounded vertical list overflow; no horizontal page overflow or drag-only transfer axis is permitted.

### Reflow

- DOM order, reading order, and meaningful focus order are `transfer-workbench → transfer-scope-and-summary → source-and-destination-filters → available-collection → transfer-controls → selected-collection → validation-and-commit`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes available/selected loading, empty, and error independently; item selected; add/remove pending; duplicate/ineligible; destination limit; order change; filter no-match; stale membership; commit pending/partial failure; retry; and success.

## State obligations

Task-specific states: available/selected loading, empty, and error independently; item selected; add/remove pending; duplicate/ineligible; destination limit; order change; filter no-match; stale membership; commit pending/partial failure; retry; and success.

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

- Two peer collections retain independent context and explicit membership transition in both directions before one validated commit.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject one-list multiselect, batch table actions, permission matrices, shopping carts, and drag-only sorting within one collection.
- Reject when one-list multiselect or batch operations owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-DLT-90`, `AR-DLT-91`, or `AR-DLT-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [PatternFly dual list selector](https://www.patternfly.org/components/dual-list-selector/) | Peer lists retain membership, selection, and explicit transfer direction. | It does not define product items, limits, commit semantics, or geometry. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `dual-list-transfer`. |
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
  "archetypeId": "dual-list-transfer",
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
