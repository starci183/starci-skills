# Collective bargaining package negotiation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `collective-bargaining-package-negotiation-workbench` |
| Family | Work |
| Dominant task | Reconcile exactly two recognized bargaining sides’ versioned mandates into one whole collective-agreement package through issue-specific offers/counters, combined costing, tentative agreements and each side’s independent ratification |
| Search aliases | bargaining package, bilateral counter, tentative agreement |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `bargaining-workbench` owns the complete dominant task and recovery boundary.
- Reconcile exactly two recognized bargaining sides’ versioned mandates into one whole collective-agreement package through issue-specific offers/counters, combined costing, tentative agreements and each side’s independent ratification
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CBN-01` | Reconcile exactly two recognized bargaining sides’ versioned mandates into one whole collective-agreement package through issue-specific offers/counters, combined costing, tentative agreements and each side’s independent ratification | Required positive evidence. |
| `AR-CBN-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-CBN-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-CBN-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-CBN-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-CBN-91` | Reject cho `multi-party-consensus-workbench`, referral negotiation, multi-creditor hardship, meeting facilitation, chat or generic contract editor; exactly two sides, private mandate boundaries, immutable bilateral package counters, non-final tentative issue agreements, cross-issue package consistency and two independent terminal ratifications are mandatory—no quorum/shared proposal, recipient acceptance or independently settled creditor decides the result | Reject. |
| `AR-CBN-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `collective-bargaining-package-negotiation-workbench` if and only if `AR-CBN-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-CBN-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
bargaining-workbench
├─ recognized-two-party-bargaining-unit-and-private-mandates
├─ governed-issue-register
├─ immutable-versioned-offer-counteroffer-ledger
├─ costing-and-operational-impact (peer synchronization)
├─ tentative-issue-agreement-set
├─ unresolved-package-dependencies-and-reservations
├─ whole-package-consolidation
├─ independent-party-ratification-authorities
└─ signed-collective-agreement-and-implementation-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `bargaining-workbench` | Owns the dominant task, complete state, and recovery boundary for collective-bargaining-package-negotiation-workbench. |
| `recognized-two-party-bargaining-unit-and-private-mandates` | Owns recognized two party bargaining unit and private mandates; preserves the required relationship with upstream `bargaining-workbench` and downstream `governed-issue-register`, and does not absorb another region's owner. |
| `governed-issue-register` | Owns governed issue register; preserves the required relationship with upstream `recognized-two-party-bargaining-unit-and-private-mandates` and downstream `immutable-versioned-offer-counteroffer-ledger`, and does not absorb another region's owner. |
| `immutable-versioned-offer-counteroffer-ledger` | Owns immutable versioned offer counteroffer ledger; preserves the required relationship with upstream `governed-issue-register` and downstream `costing-and-operational-impact`, and does not absorb another region's owner. |
| `costing-and-operational-impact` | Owns costing and operational impact; preserves the required relationship with upstream `immutable-versioned-offer-counteroffer-ledger` and downstream `tentative-issue-agreement-set`, and does not absorb another region's owner. |
| `tentative-issue-agreement-set` | Owns tentative issue agreement set; preserves the required relationship with upstream `costing-and-operational-impact` and downstream `unresolved-package-dependencies-and-reservations`, and does not absorb another region's owner. |
| `unresolved-package-dependencies-and-reservations` | Owns unresolved package dependencies and reservations; preserves the required relationship with upstream `tentative-issue-agreement-set` and downstream `whole-package-consolidation`, and does not absorb another region's owner. |
| `whole-package-consolidation` | Owns whole package consolidation; preserves the required relationship with upstream `unresolved-package-dependencies-and-reservations` and downstream `independent-party-ratification-authorities`, and does not absorb another region's owner. |
| `independent-party-ratification-authorities` | Owns independent party ratification authorities; preserves the required relationship with upstream `whole-package-consolidation` and downstream `signed-collective-agreement-and-implementation-record`, and does not absorb another region's owner. |
| `signed-collective-agreement-and-implementation-record` | Owns signed collective agreement and implementation record; preserves the required relationship with upstream `independent-party-ratification-authorities`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Issue register, active bilateral offer lineage, combined costing and tentative/package status remain visible; no issue appears final while whole-package reservations remain open
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Active issue/counter and global package impact stay primary; mandates and prior versions become role-scoped drawers while tentative-versus-ratified state persists
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Mandate boundary → package version/counter → issue deltas/tentatives → combined impact → unresolved dependency → whole-package validation → each side’s ratification → signed record; chronology never replaces issue ownership
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `bargaining-workbench → recognized-two-party-bargaining-unit-and-private-mandates → governed-issue-register → immutable-versioned-offer-counteroffer-ledger → costing-and-operational-impact → tentative-issue-agreement-set → unresolved-package-dependencies-and-reservations → whole-package-consolidation → independent-party-ratification-authorities → signed-collective-agreement-and-implementation-record`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes side recognized/authority-unverified, mandate private/released/expired, issue open/offered/countered/withdrawn/tentatively-agreed/reserved, proposal version stale, package impact calculating/over-mandate, tentative set consistent/conflicted, impasse/mediation, ratification pending/approved/rejected and agreement signed/superseded.

## State obligations

Task-specific states: side recognized/authority-unverified, mandate private/released/expired, issue open/offered/countered/withdrawn/tentatively-agreed/reserved, proposal version stale, package impact calculating/over-mandate, tentative set consistent/conflicted, impasse/mediation, ratification pending/approved/rejected and agreement signed/superseded.

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

- Template must exchange two versioned counters, tentatively agree one issue without finalizing it, show another issue pushing the package beyond mandate, reopen/reserve it, require both ratifications and preserve issue/version/package state through compact stages
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `multi-party-consensus-workbench`, referral negotiation, multi-creditor hardship, meeting facilitation, chat or generic contract editor; exactly two sides, private mandate boundaries, immutable bilateral package counters, non-final tentative issue agreements, cross-issue package consistency and two independent terminal ratifications are mandatory—no quorum/shared proposal, recipient acceptance or independently settled creditor decides the result
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CBN-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [ILO collective bargaining](https://www.ilo.org/topics-and-sectors/collective-bargaining-and-labour-relations) | Provides official evidence for recognized two party bargaining unit and private mandates. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [NLRB employer and union obligations](https://www.nlrb.gov/about-nlrb/rights-we-protect/your-rights/employer-union-rights-and-obligations) | Provides official evidence for governed issue register. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [GOV.UK collective bargaining](https://www.gov.uk/working-with-trade-unions/collective-bargaining) | Provides official evidence for immutable versioned offer counteroffer ledger. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `collective-bargaining-package-negotiation-workbench`. |
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
{"archetypeId":"collective-bargaining-package-negotiation-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
