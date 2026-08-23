# Query builder workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `query-builder-workbench` |
| Family | Work |
| Dominant task | Construct a structured query from fields, operators, values, and grouped Boolean clauses, execute it, and revise from result or error evidence. |
| Search aliases | visual query builder, clause groups, schema filter, result preview |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `query-workbench` owns the complete dominant task and its recovery boundary.
- Construct a structured query from fields, operators, values, and grouped Boolean clauses, execute it, and revise from result or error evidence.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-QBW-01` | Construct a structured query from fields, operators, values, and grouped Boolean clauses, execute it, and revise from result or error evidence. | Required positive evidence. |
| `AR-QBW-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-QBW-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-QBW-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-QBW-90` | The actual task is owned by simple filters or rule builders. | Reject. |
| `AR-QBW-91` | Reject simple search/filter forms, effect-bearing rule builders, raw SQL/code editors, and analytics where query construction is hidden. | Reject. |
| `AR-QBW-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `query-builder-workbench` if and only if `AR-QBW-01` through `AR-QBW-04` are evidenced, every required region and relationship is present, and none of `AR-QBW-90` through `AR-QBW-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
query-workbench
├─ data-scope-and-schema
├─ clause-builder
│  └─ group-and-boolean-structure
├─ query-summary-or-text
├─ validation-and-execution-controls
└─ result-preview
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `query-workbench` | Owns one data scope, structured query draft, execution, and revision loop. |
| `data-scope-and-schema` | Constrains fields, types, operators, freshness, and permission for all clauses. |
| `clause-builder` | Owns editable field-operator-value intent, order, and per-clause validation. |
| `group-and-boolean-structure` | Owns AND/OR nesting, group boundaries, and clause membership. |
| `query-summary-or-text` | Provides one synchronized readout of the structured query, never a second unsynchronized editor. |
| `validation-and-execution-controls` | Own validation, pending protection, cancel/timeout, and focusable error summary. |
| `result-preview` | Owns zero/success/error execution evidence and links it back to query state. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep clause structure and result preview simultaneous; make schema supporting; keep the query summary synchronized.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Clause groups and preview tables may scroll within their owners; the page and query summary never own horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make schema a drawer; stack or resize builder and preview around the current subtask; keep execution status and data scope visible.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Clause groups and preview tables may scroll within their owners; the page and query summary never own horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Build one group at a time; show query summary before Run; make preview the next stage and Back restore the exact clause and focus state.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Clause groups and preview tables may scroll within their owners; the page and query summary never own horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `query-workbench → data-scope-and-schema → clause-builder → group-and-boolean-structure → query-summary-or-text → validation-and-execution-controls → result-preview`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes schema loading, empty query, clause add/remove/reorder, invalid operator/value, nested group, validation, run pending/success/error/timeout, zero results, stale schema, and saved-query conflict.

## State obligations

Task-specific states: schema loading, empty query, clause add/remove/reorder, invalid operator/value, nested group, validation, run pending/success/error/timeout, zero results, stale schema, and saved-query conflict.

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

- Editable clauses and Boolean groups are the source of query intent, and execution preview supplies evidence for revision.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject simple search/filter forms, effect-bearing rule builders, raw SQL/code editors, and analytics where query construction is hidden.
- Reject when simple filters or rule builders owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-QBW-90`, `AR-QBW-91`, or `AR-QBW-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [MongoDB Compass query builder](https://www.mongodb.com/docs/compass/schema/) | Fields and values can construct compound filters whose execution changes a result set. | It does not make MongoDB syntax, schema, or layout product truth. |
| [IBM Carbon filtering pattern](https://carbondesignsystem.com/patterns/filtering/) | Filters expose active criteria and result changes in the same dataset context. | It does not choose product filters or query semantics. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [W3C APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | A modal surface moves focus inside, contains it, closes predictably, and restores the trigger. | It does not decide when a supporting region must be modal. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `query-builder-workbench`. |
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
  "archetypeId": "query-builder-workbench",
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
