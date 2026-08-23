# Referral negotiation exchange

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `referral-negotiation-exchange` |
| Family | Flow |
| Dominant task | Negotiate a referral between sender and potential recipient by clarifying need, capacity, acceptance requirements and alternatives before responsibility transfers |
| Search aliases | referral counter, recipient capacity, transfer receipt |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `referral-exchange` owns the complete dominant task and recovery boundary.
- Negotiate a referral between sender and potential recipient by clarifying need, capacity, acceptance requirements and alternatives before responsibility transfers
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-RNE-01` | Negotiate a referral between sender and potential recipient by clarifying need, capacity, acceptance requirements and alternatives before responsibility transfers | Required positive evidence. |
| `AR-RNE-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-RNE-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-RNE-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-RNE-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-RNE-91` | Reject cho multi-party consensus, support chat, completed cross-party handoff, provider directory or appointment booking; one sender and one candidate recipient must exchange structured capability/requirement offers and counters until that recipient accepts or declines a binding service commitment—there is no shared proposal or group consensus rule | Reject. |
| `AR-RNE-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `referral-negotiation-exchange` if and only if `AR-RNE-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-RNE-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
referral-exchange
├─ referral-need-and-urgency
├─ sender-evidence-package
├─ recipient-capability-and-capacity
├─ requirement-question-counter-loop
├─ alternative-recipient-or-service-options
├─ acceptance-decline-expiry
└─ responsibility-transfer-and-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `referral-exchange` | Owns the dominant task, complete state, and recovery boundary for referral-negotiation-exchange. |
| `referral-need-and-urgency` | Owns referral need and urgency; preserves the required relationship with upstream `referral-exchange` and downstream `sender-evidence-package`, and does not absorb another region's owner. |
| `sender-evidence-package` | Owns sender evidence package; preserves the required relationship with upstream `referral-need-and-urgency` and downstream `recipient-capability-and-capacity`, and does not absorb another region's owner. |
| `recipient-capability-and-capacity` | Owns recipient capability and capacity; preserves the required relationship with upstream `sender-evidence-package` and downstream `requirement-question-counter-loop`, and does not absorb another region's owner. |
| `requirement-question-counter-loop` | Owns requirement question counter loop; preserves the required relationship with upstream `recipient-capability-and-capacity` and downstream `alternative-recipient-or-service-options`, and does not absorb another region's owner. |
| `alternative-recipient-or-service-options` | Owns alternative recipient or service options; preserves the required relationship with upstream `requirement-question-counter-loop` and downstream `acceptance-decline-expiry`, and does not absorb another region's owner. |
| `acceptance-decline-expiry` | Owns acceptance decline expiry; preserves the required relationship with upstream `alternative-recipient-or-service-options` and downstream `responsibility-transfer-and-receipt`, and does not absorb another region's owner. |
| `responsibility-transfer-and-receipt` | Owns responsibility transfer and receipt; preserves the required relationship with upstream `acceptance-decline-expiry`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Referral evidence, recipient response/capability and negotiation thread remain visible with the disposition rail
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Active negotiation and requirements own the workspace; evidence and alternatives become drawers
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Need summary → recipient requirements/questions → sender response/evidence → accept/decline/alternative → transfer receipt; chronology does not replace structured requirements
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `referral-exchange → referral-need-and-urgency → sender-evidence-package → recipient-capability-and-capacity → requirement-question-counter-loop → alternative-recipient-or-service-options → acceptance-decline-expiry → responsibility-transfer-and-receipt`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes draft/sent/viewed, evidence incomplete, recipient capacity unknown/full, question open/answered, counter proposed, accepted/declined/expired, alternate pending and transfer failed/completed.

## State obligations

Task-specific states: draft/sent/viewed, evidence incomplete, recipient capacity unknown/full, question open/answered, counter proposed, accepted/declined/expired, alternate pending and transfer failed/completed.

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

- Template must surface a recipient requirement, attach responsive evidence, propose an alternative on capacity failure and transfer responsibility only after explicit acceptance
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho multi-party consensus, support chat, completed cross-party handoff, provider directory or appointment booking; one sender and one candidate recipient must exchange structured capability/requirement offers and counters until that recipient accepts or declines a binding service commitment—there is no shared proposal or group consensus rule
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-RNE-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [NHS e-Referral Service](https://digital.nhs.uk/services/e-referral-service) | Provides official evidence for referral need and urgency. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [HL7 FHIR ServiceRequest](https://hl7.org/fhir/servicerequest.html) | Provides official evidence for sender evidence package. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `referral-negotiation-exchange`. |
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
{"archetypeId":"referral-negotiation-exchange","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
