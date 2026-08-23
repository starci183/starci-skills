# Peer instruction revote session

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `peer-instruction-revote-session` |
| Family | Work |
| Dominant task | Run one live peer-instruction round in which learners answer privately, the first response set is frozen and concealed, peers discuss reasoning, learners independently revote, and the facilitator interprets response shift before explaining or advancing |
| Search aliases | peer instruction, private revote, response shift |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `peer-instruction-session` owns the complete dominant task and recovery boundary.
- Run one live peer-instruction round in which learners answer privately, the first response set is frozen and concealed, peers discuss reasoning, learners independently revote, and the facilitator interprets response shift before explaining or advancing
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PIR-01` | Run one live peer-instruction round in which learners answer privately, the first response set is frozen and concealed, peers discuss reasoning, learners independently revote, and the facilitator interprets response shift before explaining or advancing | Required positive evidence. |
| `AR-PIR-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-PIR-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-PIR-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-PIR-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-PIR-91` | Reject cho assessment attempt, single-question step, survey/poll, collaborative ideation convergence, generic meeting or consensus workspace; two immutable identity-paired response passes, first-result concealment, intervening peer reasoning and delta interpretation are mandatory, and no consensus answer is produced | Reject. |
| `AR-PIR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `peer-instruction-revote-session` if and only if `AR-PIR-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-PIR-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
peer-instruction-session
├─ concept-question-and-round-policy
├─ private-first-response-capture
├─ immutable-concealed-first-response-set
├─ facilitator-threshold-gate
├─ peer-discussion-assignment
├─ private-revote-capture
├─ learner-paired-and-cohort-response-shift
└─ explanation-and-next-round
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `peer-instruction-session` | Owns the dominant task, complete state, and recovery boundary for peer-instruction-revote-session. |
| `concept-question-and-round-policy` | Owns concept question and round policy; preserves the required relationship with upstream `peer-instruction-session` and downstream `private-first-response-capture`, and does not absorb another region's owner. |
| `private-first-response-capture` | Owns private first response capture; preserves the required relationship with upstream `concept-question-and-round-policy` and downstream `immutable-concealed-first-response-set`, and does not absorb another region's owner. |
| `immutable-concealed-first-response-set` | Owns immutable concealed first response set; preserves the required relationship with upstream `private-first-response-capture` and downstream `facilitator-threshold-gate`, and does not absorb another region's owner. |
| `facilitator-threshold-gate` | Owns facilitator threshold gate; preserves the required relationship with upstream `immutable-concealed-first-response-set` and downstream `peer-discussion-assignment`, and does not absorb another region's owner. |
| `peer-discussion-assignment` | Owns peer discussion assignment; preserves the required relationship with upstream `facilitator-threshold-gate` and downstream `private-revote-capture`, and does not absorb another region's owner. |
| `private-revote-capture` | Owns private revote capture; preserves the required relationship with upstream `peer-discussion-assignment` and downstream `learner-paired-and-cohort-response-shift`, and does not absorb another region's owner. |
| `learner-paired-and-cohort-response-shift` | Owns learner paired and cohort response shift; preserves the required relationship with upstream `private-revote-capture` and downstream `explanation-and-next-round`, and does not absorb another region's owner. |
| `explanation-and-next-round` | Owns explanation and next round; preserves the required relationship with upstream `learner-paired-and-cohort-response-shift`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Question/response stage, role-scoped facilitator controls, participation coverage and the authorized first-versus-revote distribution coexist; early distributions remain concealed from learners
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Active phase and response controls remain primary; coverage and facilitator controls become role-scoped drawers, while paired numeric summaries replace the comparison chart after revoting
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Concept → private first response → locked receipt/gate → discussion → private revote → personal and cohort shift → explanation; only the current phase is operable and no mini dashboard remains
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `peer-instruction-session → concept-question-and-round-policy → private-first-response-capture → immutable-concealed-first-response-set → facilitator-threshold-gate → peer-discussion-assignment → private-revote-capture → learner-paired-and-cohort-response-shift → explanation-and-next-round`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes session scheduled/live/paused/ended, learner joined/reconnecting/absent, first answer draft/submitted/locked, coverage insufficient/sufficient, distribution concealed/released, discussion assigned/active/overtime, revote unopened/open/submitted/missing, response unchanged/changed, explanation pending/released and next round ready/blocked; expiry preserves entries and accommodation.

## State obligations

Task-specific states: session scheduled/live/paused/ended, learner joined/reconnecting/absent, first answer draft/submitted/locked, coverage insufficient/sufficient, distribution concealed/released, discussion assigned/active/overtime, revote unopened/open/submitted/missing, response unchanged/changed, explanation pending/released and next round ready/blocked; expiry preserves entries and accommodation.

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

- Template must prove a private first vote, immutable receipt, threshold-controlled discussion, independent revote, accessible learner-paired and cohort delta, reconnect recovery, explanation release and phase-by-phase compact parity without leaking early results
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho assessment attempt, single-question step, survey/poll, collaborative ideation convergence, generic meeting or consensus workspace; two immutable identity-paired response passes, first-result concealment, intervening peer reasoning and delta interpretation are mandatory, and no consensus answer is produced
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PIR-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Harvard ABLConnect peer instruction](https://ablconnect.harvard.edu/peer-instruction-research) | Provides official evidence for concept question and round policy. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Cornell peer discussion polling](https://teaching.cornell.edu/teaching-resources/active-collaborative-learning/collaborative-learning/incorporating-short-peer) | Provides official evidence for private first response capture. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [1EdTech QTI](https://www.1edtech.org/standards/qti/index) | Provides official evidence for immutable concealed first response set. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `peer-instruction-revote-session`. |
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
{"archetypeId":"peer-instruction-revote-session","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
