# Peer review exchange cycle

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `peer-review-exchange-cycle` |
| Family | Flow |
| Dominant task | Run a reciprocal peer-review cycle by allocating artifacts, protecting identity rules, gating review phases, resolving missing reviews and releasing feedback fairly |
| Search aliases | reciprocal review, anonymous allocation, feedback release |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `peer-review-cycle` owns the complete dominant task and recovery boundary.
- Run a reciprocal peer-review cycle by allocating artifacts, protecting identity rules, gating review phases, resolving missing reviews and releasing feedback fairly
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PRE-01` | Run a reciprocal peer-review cycle by allocating artifacts, protecting identity rules, gating review phases, resolving missing reviews and releasing feedback fairly | Required positive evidence. |
| `AR-PRE-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-PRE-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-PRE-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-PRE-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-PRE-91` | Reject cho task list, rubric grading studio, comment thread or approval workflow; reciprocal allocation, anonymity policy, phase gates and coverage recovery are mandatory | Reject. |
| `AR-PRE-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `peer-review-exchange-cycle` if and only if `AR-PRE-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-PRE-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
peer-review-cycle
├─ assignment-and-phase-policy
├─ participant-artifact-pool
├─ allocation-and-anonymity-map
├─ assigned-review-work
├─ submission-and-quality-check
├─ coverage-and-exception-board
└─ feedback-release-and-author-response
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `peer-review-cycle` | Owns the dominant task, complete state, and recovery boundary for peer-review-exchange-cycle. |
| `assignment-and-phase-policy` | Owns assignment and phase policy; preserves the required relationship with upstream `peer-review-cycle` and downstream `participant-artifact-pool`, and does not absorb another region's owner. |
| `participant-artifact-pool` | Owns participant artifact pool; preserves the required relationship with upstream `assignment-and-phase-policy` and downstream `allocation-and-anonymity-map`, and does not absorb another region's owner. |
| `allocation-and-anonymity-map` | Owns allocation and anonymity map; preserves the required relationship with upstream `participant-artifact-pool` and downstream `assigned-review-work`, and does not absorb another region's owner. |
| `assigned-review-work` | Owns assigned review work; preserves the required relationship with upstream `allocation-and-anonymity-map` and downstream `submission-and-quality-check`, and does not absorb another region's owner. |
| `submission-and-quality-check` | Owns submission and quality check; preserves the required relationship with upstream `assigned-review-work` and downstream `coverage-and-exception-board`, and does not absorb another region's owner. |
| `coverage-and-exception-board` | Owns coverage and exception board; preserves the required relationship with upstream `submission-and-quality-check` and downstream `feedback-release-and-author-response`, and does not absorb another region's owner. |
| `feedback-release-and-author-response` | Owns feedback release and author response; preserves the required relationship with upstream `coverage-and-exception-board`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Cycle status, allocation map, selected review work and coverage/exception rail remain visible to authorized roles
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Assigned review work remains primary; allocation and coverage become role-scoped drawers
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Assigned artifact → rubric/evidence review → submit → next assignment → release status → author response; identities remain masked wherever policy requires
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `peer-review-cycle → assignment-and-phase-policy → participant-artifact-pool → allocation-and-anonymity-map → assigned-review-work → submission-and-quality-check → coverage-and-exception-board → feedback-release-and-author-response`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes enrollment open/locked, artifact missing, allocation pending/conflict, identity masked/revealed, review draft/submitted/late, quality check failed, coverage incomplete, feedback held/released and author response.

## State obligations

Task-specific states: enrollment open/locked, artifact missing, allocation pending/conflict, identity masked/revealed, review draft/submitted/late, quality check failed, coverage incomplete, feedback held/released and author response.

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

- Template must allocate reviews without leaking identity, block feedback before phase release, recover a missing reviewer and let authors respond to released feedback
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho task list, rubric grading studio, comment thread or approval workflow; reciprocal allocation, anonymity policy, phase gates and coverage recovery are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PRE-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Moodle Workshop activity](https://docs.moodle.org/405/en/Workshop_activity) | Provides official evidence for assignment and phase policy. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [1EdTech LTI](https://www.1edtech.org/standards/lti) | Provides official evidence for participant artifact pool. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `peer-review-exchange-cycle`. |
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
{"archetypeId":"peer-review-exchange-cycle","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
