# Multi program eligibility screening

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-program-eligibility-screening` |
| Family | Discovery |
| Dominant task | Screen one person or household against multiple independent programs using a shared fact model while preserving program-specific criteria, unknowns and next steps |
| Search aliases | benefit screening, shared facts, program verdicts |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `eligibility-screening` owns the complete dominant task and recovery boundary.
- Screen one person or household against multiple independent programs using a shared fact model while preserving program-specific criteria, unknowns and next steps
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MPE-01` | Screen one person or household against multiple independent programs using a shared fact model while preserving program-specific criteria, unknowns and next steps | Required positive evidence. |
| `AR-MPE-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-MPE-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-MPE-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-MPE-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-MPE-91` | Reject cho `multi-service-life-event-orchestrator`, troubleshooting wizard, service hub, plan comparison or application flow; one read-only fact set must produce side-by-side eligible/ineligible/unknown verdicts from autonomous program rule sets, with no downstream service submissions, handoffs or receipts | Reject. |
| `AR-MPE-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `multi-program-eligibility-screening` if and only if `AR-MPE-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-MPE-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
eligibility-screening
├─ person-household-facts
├─ program-catalog-and-scope
├─ program-criteria-evaluators
├─ eligible-possibly-not-eligible-results
├─ missing-fact-and-evidence-plan
└─ comparison-and-next-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `eligibility-screening` | Owns the dominant task, complete state, and recovery boundary for multi-program-eligibility-screening. |
| `person-household-facts` | Owns person household facts; preserves the required relationship with upstream `eligibility-screening` and downstream `program-catalog-and-scope`, and does not absorb another region's owner. |
| `program-catalog-and-scope` | Owns program catalog and scope; preserves the required relationship with upstream `person-household-facts` and downstream `program-criteria-evaluators`, and does not absorb another region's owner. |
| `program-criteria-evaluators` | Owns program criteria evaluators; preserves the required relationship with upstream `program-catalog-and-scope` and downstream `eligible-possibly-not-eligible-results`, and does not absorb another region's owner. |
| `eligible-possibly-not-eligible-results` | Owns eligible possibly not eligible results; preserves the required relationship with upstream `program-criteria-evaluators` and downstream `missing-fact-and-evidence-plan`, and does not absorb another region's owner. |
| `missing-fact-and-evidence-plan` | Owns missing fact and evidence plan; preserves the required relationship with upstream `eligible-possibly-not-eligible-results` and downstream `comparison-and-next-actions`, and does not absorb another region's owner. |
| `comparison-and-next-actions` | Owns comparison and next actions; preserves the required relationship with upstream `missing-fact-and-evidence-plan`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Shared facts, program result matrix and selected criteria explanation remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Result matrix becomes primary; facts and selected program evidence use synchronized drawers
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Facts summary → program result list → selected program criteria/unknowns → evidence or next action; no wide matrix is required
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `eligibility-screening → person-household-facts → program-catalog-and-scope → program-criteria-evaluators → eligible-possibly-not-eligible-results → missing-fact-and-evidence-plan → comparison-and-next-actions`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes facts incomplete/stale, program loading/closed, criterion met/not-met/unknown, conflicting evidence, eligible/possibly/not-eligible, manual review, application unavailable and screening saved.

## State obligations

Task-specific states: facts incomplete/stale, program loading/closed, criterion met/not-met/unknown, conflicting evidence, eligible/possibly/not-eligible, manual review, application unavailable and screening saved.

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

- Template must evaluate at least three programs, explain each verdict separately, request one missing fact without erasing completed evidence and route an uncertain result to manual review
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `multi-service-life-event-orchestrator`, troubleshooting wizard, service hub, plan comparison or application flow; one read-only fact set must produce side-by-side eligible/ineligible/unknown verdicts from autonomous program rule sets, with no downstream service submissions, handoffs or receipts
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-MPE-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [USAGov Benefit Finder](https://www.usa.gov/benefit-finder) | Provides official evidence for person household facts. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [GOV.UK benefits calculators](https://www.gov.uk/benefits-calculators) | Provides official evidence for program catalog and scope. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `multi-program-eligibility-screening`. |
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
{"archetypeId":"multi-program-eligibility-screening","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
