# Shift handoff acknowledgement board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `shift-handoff-acknowledgement-board` |
| Family | Flow |
| Dominant task | Transfer responsibility for a shift cohort by presenting unresolved items, risks and context, collecting per-item receiving acknowledgements, and closing the outgoing shift only when coverage is explicit |
| Search aliases | shift transfer, item acknowledgement, coverage close |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `shift-handoff` owns the complete dominant task and recovery boundary.
- Transfer responsibility for a shift cohort by presenting unresolved items, risks and context, collecting per-item receiving acknowledgements, and closing the outgoing shift only when coverage is explicit
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SHA-01` | Transfer responsibility for a shift cohort by presenting unresolved items, risks and context, collecting per-item receiving acknowledgements, and closing the outgoing shift only when coverage is explicit | Required positive evidence. |
| `AR-SHA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-SHA-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-SHA-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-SHA-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-SHA-91` | Reject cho cross-party handoff, task board, inbox or checklist; one shift cohort, per-item receiving proof and a global closure gate are mandatory | Reject. |
| `AR-SHA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `shift-handoff-acknowledgement-board` if and only if `AR-SHA-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-SHA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
shift-handoff
├─ outgoing-incoming-shift-identity
├─ cohort-summary
├─ handoff-item-board
├─ selected-item-context-and-risk
├─ receiver-acknowledgement-per-item
├─ exception-and-question-loop
└─ coverage-summary-and-global-close
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `shift-handoff` | Owns the dominant task, complete state, and recovery boundary for shift-handoff-acknowledgement-board. |
| `outgoing-incoming-shift-identity` | Owns outgoing incoming shift identity; preserves the required relationship with upstream `shift-handoff` and downstream `cohort-summary`, and does not absorb another region's owner. |
| `cohort-summary` | Owns cohort summary; preserves the required relationship with upstream `outgoing-incoming-shift-identity` and downstream `handoff-item-board`, and does not absorb another region's owner. |
| `handoff-item-board` | Owns handoff item board; preserves the required relationship with upstream `cohort-summary` and downstream `selected-item-context-and-risk`, and does not absorb another region's owner. |
| `selected-item-context-and-risk` | Owns selected item context and risk; preserves the required relationship with upstream `handoff-item-board` and downstream `receiver-acknowledgement-per-item`, and does not absorb another region's owner. |
| `receiver-acknowledgement-per-item` | Owns receiver acknowledgement per item; preserves the required relationship with upstream `selected-item-context-and-risk` and downstream `exception-and-question-loop`, and does not absorb another region's owner. |
| `exception-and-question-loop` | Owns exception and question loop; preserves the required relationship with upstream `receiver-acknowledgement-per-item` and downstream `coverage-summary-and-global-close`, and does not absorb another region's owner. |
| `coverage-summary-and-global-close` | Owns coverage summary and global close; preserves the required relationship with upstream `exception-and-question-loop`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Cohort board, selected item detail, acknowledgements and closure summary remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Cohort and acknowledgement status remain primary; item detail becomes a drawer
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Risk-prioritized item list → item context → acknowledge/question/reject → coverage summary → global close; unresolved items remain reachable
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `shift-handoff → outgoing-incoming-shift-identity → cohort-summary → handoff-item-board → selected-item-context-and-risk → receiver-acknowledgement-per-item → exception-and-question-loop → coverage-summary-and-global-close`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes handoff not-started/in-progress/closed, item ready/incomplete/high-risk, receiver absent, acknowledged/questioned/rejected, context stale, partial coverage, close blocked and late correction.

## State obligations

Task-specific states: handoff not-started/in-progress/closed, item ready/incomplete/high-risk, receiver absent, acknowledged/questioned/rejected, context stale, partial coverage, close blocked and late correction.

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

- Template must acknowledge items independently, open a clarification loop, block global close on uncovered risk and preserve incoming/outgoing responsibility evidence
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho cross-party handoff, task board, inbox or checklist; one shift cohort, per-item receiving proof and a global closure gate are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SHA-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [WHO patient handovers](https://cdn.who.int/media/docs/default-source/patient-safety/patient-safety-solutions/ps-solution3-communication-during-patient-handovers.pdf?sfvrsn=7a54c664_8) | Provides official evidence for outgoing incoming shift identity. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [AHRQ TeamSTEPPS handoff](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html) | Provides official evidence for cohort summary. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `shift-handoff-acknowledgement-board`. |
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
{"archetypeId":"shift-handoff-acknowledgement-board","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
