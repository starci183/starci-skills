# Multi item return resolution

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-item-return-resolution` |
| Family | Flow |
| Dominant task | Resolve a return containing multiple line items by evaluating item-specific eligibility, selecting heterogeneous outcomes, coordinating logistics and reconciling refund value |
| Search aliases | multi-line return, mixed refund, reverse logistics |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `return-resolution` owns the complete dominant task and recovery boundary.
- Resolve a return containing multiple line items by evaluating item-specific eligibility, selecting heterogeneous outcomes, coordinating logistics and reconciling refund value
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MIR-01` | Resolve a return containing multiple line items by evaluating item-specific eligibility, selecting heterogeneous outcomes, coordinating logistics and reconciling refund value | Required positive evidence. |
| `AR-MIR-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-MIR-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-MIR-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-MIR-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-MIR-91` | Reject cho checkout, generic refund form, order detail or batch action table; per-line eligibility/outcome plus conserved refund reconciliation and reverse logistics are mandatory | Reject. |
| `AR-MIR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `multi-item-return-resolution` if and only if `AR-MIR-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-MIR-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
return-resolution
├─ order-and-return-window
├─ line-item-return-board
├─ selected-item-condition-reason-evidence
├─ item-eligibility-and-outcome
├─ shipment-dropoff-or-no-return-logistics
├─ refund-credit-exchange-ledger
└─ review-submit-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `return-resolution` | Owns the dominant task, complete state, and recovery boundary for multi-item-return-resolution. |
| `order-and-return-window` | Owns order and return window; preserves the required relationship with upstream `return-resolution` and downstream `line-item-return-board`, and does not absorb another region's owner. |
| `line-item-return-board` | Owns line item return board; preserves the required relationship with upstream `order-and-return-window` and downstream `selected-item-condition-reason-evidence`, and does not absorb another region's owner. |
| `selected-item-condition-reason-evidence` | Owns selected item condition reason evidence; preserves the required relationship with upstream `line-item-return-board` and downstream `item-eligibility-and-outcome`, and does not absorb another region's owner. |
| `item-eligibility-and-outcome` | Owns item eligibility and outcome; preserves the required relationship with upstream `selected-item-condition-reason-evidence` and downstream `shipment-dropoff-or-no-return-logistics`, and does not absorb another region's owner. |
| `shipment-dropoff-or-no-return-logistics` | Owns shipment dropoff or no return logistics; preserves the required relationship with upstream `item-eligibility-and-outcome` and downstream `refund-credit-exchange-ledger`, and does not absorb another region's owner. |
| `refund-credit-exchange-ledger` | Owns refund credit exchange ledger; preserves the required relationship with upstream `shipment-dropoff-or-no-return-logistics` and downstream `review-submit-receipt`, and does not absorb another region's owner. |
| `review-submit-receipt` | Owns review submit receipt; preserves the required relationship with upstream `refund-credit-exchange-ledger`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Line items, selected item resolution, logistics and refund ledger remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Line board and selected outcome remain primary; logistics/refund summary stays adjacent or below
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Item list → item reason/evidence → eligible outcomes → logistics → next item → total refund/review → submit; heterogeneous statuses remain visible
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `return-resolution → order-and-return-window → line-item-return-board → selected-item-condition-reason-evidence → item-eligibility-and-outcome → shipment-dropoff-or-no-return-logistics → refund-credit-exchange-ledger → review-submit-receipt`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes order loading, item eligible/ineligible/conditional, reason/evidence incomplete, quantity conflict, refund/exchange/credit selected, label pending/failure, mixed logistics, amount mismatch, submit pending and partial acceptance.

## State obligations

Task-specific states: order loading, item eligible/ineligible/conditional, reason/evidence incomplete, quantity conflict, refund/exchange/credit selected, label pending/failure, mixed logistics, amount mismatch, submit pending and partial acceptance.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow Cancel when safe, and announce progress. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must resolve at least three lines differently, explain one ineligible outcome, reconcile refund totals, generate mixed logistics and recover a failed label without duplicate submission
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho checkout, generic refund form, order detail or batch action table; per-line eligibility/outcome plus conserved refund reconciliation and reverse logistics are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-MIR-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Shopify returns and exchanges](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns) | Provides official evidence for order and return window. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [FTC returns and refunds](https://consumer.ftc.gov/articles/solving-problems-business-returns-refunds-and-other-resolutions) | Provides official evidence for line item return board. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `multi-item-return-resolution`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{"archetypeId":"multi-item-return-resolution","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
