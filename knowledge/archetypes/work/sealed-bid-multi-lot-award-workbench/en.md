# Sealed bid multi lot award workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `sealed-bid-multi-lot-award-workbench` |
| Family | Work |
| Dominant task | Open a version-bound set of sealed bids only after the deadline, test bidder and bid responsiveness, allocate multiple lots under disclosed cross-lot constraints and produce an auditable award without post-opening negotiation |
| Search aliases | sealed bid, multi-lot award, responsiveness matrix |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `sealed-award-workbench` owns the complete dominant task and recovery boundary.
- Open a version-bound set of sealed bids only after the deadline, test bidder and bid responsiveness, allocate multiple lots under disclosed cross-lot constraints and produce an auditable award without post-opening negotiation
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SBA-01` | Open a version-bound set of sealed bids only after the deadline, test bidder and bid responsiveness, allocate multiple lots under disclosed cross-lot constraints and produce an auditable award without post-opening negotiation | Required positive evidence. |
| `AR-SBA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-SBA-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-SBA-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-SBA-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-SBA-91` | Reject cho market-depth order entry, waitlist/quota allocation, comparison matrix, filing validator, generic procurement scoring, auction or negotiated proposal workspace; deadline-bound concealment, authorized opening, no post-opening bargaining, responsiveness to one immutable invitation and disclosed multi-lot allocation rules are mandatory | Reject. |
| `AR-SBA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `sealed-bid-multi-lot-award-workbench` if and only if `AR-SBA-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-SBA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
sealed-award-workbench
├─ solicitation-version-lot-and-award-rules
├─ sealed-submission-register
├─ deadline-and-authorized-opening-ceremony
├─ bidder-responsibility-and-bid-responsiveness
├─ bid-by-lot-price-factor-matrix
├─ cross-lot-award-constraints (peer synchronization)
├─ lowest-valid-aggregate-award-scenario
├─ conflict-recusal-and-approval
└─ award-unsuccessful-notices-and-opening-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `sealed-award-workbench` | Owns the dominant task, complete state, and recovery boundary for sealed-bid-multi-lot-award-workbench. |
| `solicitation-version-lot-and-award-rules` | Owns solicitation version lot and award rules; preserves the required relationship with upstream `sealed-award-workbench` and downstream `sealed-submission-register`, and does not absorb another region's owner. |
| `sealed-submission-register` | Owns sealed submission register; preserves the required relationship with upstream `solicitation-version-lot-and-award-rules` and downstream `deadline-and-authorized-opening-ceremony`, and does not absorb another region's owner. |
| `deadline-and-authorized-opening-ceremony` | Owns deadline and authorized opening ceremony; preserves the required relationship with upstream `sealed-submission-register` and downstream `bidder-responsibility-and-bid-responsiveness`, and does not absorb another region's owner. |
| `bidder-responsibility-and-bid-responsiveness` | Owns bidder responsibility and bid responsiveness; preserves the required relationship with upstream `deadline-and-authorized-opening-ceremony` and downstream `bid-by-lot-price-factor-matrix`, and does not absorb another region's owner. |
| `bid-by-lot-price-factor-matrix` | Owns bid by lot price factor matrix; preserves the required relationship with upstream `bidder-responsibility-and-bid-responsiveness` and downstream `cross-lot-award-constraints`, and does not absorb another region's owner. |
| `cross-lot-award-constraints` | Owns cross lot award constraints; preserves the required relationship with upstream `bid-by-lot-price-factor-matrix` and downstream `lowest-valid-aggregate-award-scenario`, and does not absorb another region's owner. |
| `lowest-valid-aggregate-award-scenario` | Owns lowest valid aggregate award scenario; preserves the required relationship with upstream `cross-lot-award-constraints` and downstream `conflict-recusal-and-approval`, and does not absorb another region's owner. |
| `conflict-recusal-and-approval` | Owns conflict recusal and approval; preserves the required relationship with upstream `lowest-valid-aggregate-award-scenario` and downstream `award-unsuccessful-notices-and-opening-record`, and does not absorb another region's owner. |
| `award-unsuccessful-notices-and-opening-record` | Owns award unsuccessful notices and opening record; preserves the required relationship with upstream `conflict-recusal-and-approval`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Sealed/opening status, bid-by-lot matrix, responsiveness exceptions and candidate award scenario remain visible; only the matrix owns bounded two-axis overflow and each exclusion links to its exact rule
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Lot-ranked evaluation and proposed awards stay primary; opening history and bidder evidence become synchronized drawers while solicitation version, lot caps and recusals persist
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Solicitation/opening receipt → lot → responsive bid evidence → global cross-lot allocation impact → exception/recusal → proposed award → approval/notices; grouped lot records replace the matrix and preserve the candidate allocation
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `bid-by-lot-price-factor-matrix` owns bounded two-axis overflow; the page owns none.

### Reflow

- DOM order, reading order và meaningful focus order are `sealed-award-workbench → solicitation-version-lot-and-award-rules → sealed-submission-register → deadline-and-authorized-opening-ceremony → bidder-responsibility-and-bid-responsiveness → bid-by-lot-price-factor-matrix → cross-lot-award-constraints → lowest-valid-aggregate-award-scenario → conflict-recusal-and-approval → award-unsuccessful-notices-and-opening-record`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes before-deadline concealed/late/withdrawn, opening locked/authorized/opened/interrupted, bidder responsible/ineligible/unknown, bid responsive/nonresponsive/irregular, lot valid/no-valid-bid/ceased, constraint satisfied/violated, scenario calculating/stale, recusal required, award draft/approved/blocked and notices/opening record issued.

## State obligations

Task-specific states: before-deadline concealed/late/withdrawn, opening locked/authorized/opened/interrupted, bidder responsible/ineligible/unknown, bid responsive/nonresponsive/irregular, lot valid/no-valid-bid/ceased, constraint satisfied/violated, scenario calculating/stale, recusal required, award draft/approved/blocked and notices/opening record issued.

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

- Template must conceal bids before deadline, perform an authorized opening, mark one nonresponsive bid, recompute a multi-lot award under a supplier cap, block conflicted approval and issue accessible opening, award and unsuccessful-notice records with compact parity
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho market-depth order entry, waitlist/quota allocation, comparison matrix, filing validator, generic procurement scoring, auction or negotiated proposal workspace; deadline-bound concealment, authorized opening, no post-opening bargaining, responsiveness to one immutable invitation and disclosed multi-lot allocation rules are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-SBA-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Acquisition.gov FAR Part 14](https://www.acquisition.gov/far/part-14) | Provides official evidence for solicitation version lot and award rules. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [European Commission eForms](https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/eforms_en) | Provides official evidence for sealed submission register. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [GOV.UK lots guidance](https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-lots-html) | Provides official evidence for deadline and authorized opening ceremony. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `sealed-bid-multi-lot-award-workbench`. |
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
{"archetypeId":"sealed-bid-multi-lot-award-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
