# Collateral margin call substitution workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `collateral-margin-call-substitution-workbench` |
| Family | Work |
| Dominant task | Satisfy a margin requirement or execute a collateral substitution by selecting eligible assets whose haircut-adjusted value covers the call without releasing existing collateral before replacement settlement is final. |
| Search aliases | margin call coverage, collateral substitution, deliver-before-release |
| Authority | Product-neutral page-topology authority; it does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `collateral-substitution` owns the complete dominant task and recovery boundary.
- Candidate adjusted value feeds the coverage ledger; replacement delivery and old-asset release form a dependency pair, and the release gate opens only after custodian settlement confirms continuous coverage.
- Every required region retains its named owner.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft input, pending work, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CMS-01` | Satisfy a margin requirement or execute a collateral substitution by selecting eligible assets whose haircut-adjusted value covers the call without releasing existing collateral before replacement settlement is final. | Required positive evidence. |
| `AR-CMS-02` | Every required region and relationship is necessary for completion. | Require the complete graph. |
| `AR-CMS-03` | The named wide, intermediate, and compact transformations preserve the same work state. | Require responsive parity. |
| `AR-CMS-04` | Failure, pending, conflict, permission, or recovery can occur after state exists. | Retain state and focus meaning. |
| `AR-CMS-90` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |
| `AR-CMS-91` | Reject capacity-allocation-overview, dual-list-transfer, waitlist-offer-allocation-board, or inventory-replenishment-planner when agreement-specific requirement, adjusted eligibility, concentration, held state, deliver-before-release dependency, and custodian proof are absent. | Reject. |
| `AR-CMS-92` | The candidate differs only by noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `collateral-margin-call-substitution-workbench` if and only if `AR-CMS-01` through `04` are evidenced, all required regions and relationships are present, and none of `AR-CMS-90` through `92` is present. Return `needs-evidence` when dominant task, owner relationship, overflow owner, or completion consequence is unproved. Return `reject` when a rejection code is present.

## Region graph

```text
collateral-substitution
  ├─ agreement-counterparty-call-date-and-dispute-state
  ├─ exposure-threshold-and-margin-requirement
  ├─ pledged-collateral-inventory
  ├─ candidate-asset-eligibility-haircut-fx-and-concentration-checks
  ├─ coverage-and-buffer-ledger
  ├─ proposed-deliver-release-pair
  ├─ custodian-settlement-and-timing-dependency
  ├─ confirmed-substitution-and-updated-shortfall
  └─ call-closure-and-dispute-receipt
```

Candidate adjusted value feeds the coverage ledger; replacement delivery and old-asset release form a dependency pair, and the release gate opens only after custodian settlement confirms continuous coverage.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `collateral-substitution` | Owns the complete requirement, eligibility, continuous coverage, settlement, and closure task. |
| `agreement-counterparty-call-date-and-dispute-state` | Binds the call to agreement, counterparty, date, and dispute state. |
| `exposure-threshold-and-margin-requirement` | Derives the amount that must be covered. |
| `pledged-collateral-inventory` | Owns currently held, pending, and releasable collateral. |
| `candidate-asset-eligibility-haircut-fx-and-concentration-checks` | Owns eligibility and adjusted-value evidence per candidate. |
| `coverage-and-buffer-ledger` | Proves continuous coverage before and after every proposed movement. |
| `proposed-deliver-release-pair` | Binds replacement delivery and old-asset release as one ordered dependency pair. |
| `custodian-settlement-and-timing-dependency` | Owns acknowledgement, failure, retry, and the release gate. |
| `confirmed-substitution-and-updated-shortfall` | Recalculates coverage only from confirmed settlement state. |
| `call-closure-and-dispute-receipt` | Closes or reopens the call with complete coverage and dispute evidence. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison no longer leaves enough measure for profiles, evidence, controls, and unobscured focus.
- **Topology response:** Margin calculation, held and candidate collateral, eligibility evidence, coverage ledger, paired movements, and settlement status remain visible together.
- **Navigation replacement:** None while direct region access remains operable.
- **Sticky boundary:** Only current scope or the primary receipt may persist after reserving space.
- **Overflow owner:** One intrinsically tabular or graph region may own bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without compressing the dominant relationship.
- **Topology response:** Requirement, selected asset, and coverage effect remain primary; full inventory, agreement clauses, and custodian history move to synchronized drawers.
- **Navigation replacement:** A labeled contextual drawer opens the exact supporting region and preserves selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary receipt may persist; short height returns it to normal flow.
- **Overflow owner:** The same bounded evidence region remains the sole overflow owner.

### Compact

- **Failure trigger:** Peer regions can no longer remain simultaneously readable and operable.
- **Topology response:** Call and agreement → requirement → candidate → eligibility, haircut, FX, concentration → deliver/release pair → settle replacement → release old asset → close or dispute; allocation exposes add/remove and ordered-list controls instead of drag-only operation.
- **Navigation replacement:** A labeled stage navigator exposes one primary pane at a time and returns focus to the entered stage heading.
- **Sticky boundary:** The relationship receipt may persist only with reserved space and yields at short height.
- **Overflow owner:** A numeric table becomes a labeled route or remains one bounded navigator; the page never scrolls horizontally.

### Reflow

- DOM order, reading order, and meaningful focus order follow `collateral-substitution → agreement-counterparty-call-date-and-dispute-state → exposure-threshold-and-margin-requirement → pledged-collateral-inventory → candidate-asset-eligibility-haircut-fx-and-concentration-checks → coverage-and-buffer-ledger → proposed-deliver-release-pair → custodian-settlement-and-timing-dependency → confirmed-substitution-and-updated-shortfall → call-closure-and-dispute-receipt`.
- CSS never reorders semantic content.
- Long labels, translation, enlarged text, and zoom wrap without losing actions or state.
- A modal drawer focuses its heading, contains modal focus, supports Escape and Cancel, and returns to the exact trigger.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag or gesture has an add, remove, or ordered-list alternative.
- A topology change retains selection, completed steps, pending guards, errors, and recovery.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Multi-error validation retains input and moves focus to a summary.
- Task parity includes exposure current/disputed; call draft/sent/agreed; collateral held/pending/released; asset eligible/ineligible/conditionally eligible; price or FX current/stale; concentration inside/exceeded; coverage short/sufficient/excess; substitution proposed/matched/settling/failed/complete; custodian acknowledged/rejected; dispute open/resolved; call closed/reopened.

## State obligations

Task-specific states: exposure current/disputed; call draft/sent/agreed; collateral held/pending/released; asset eligible/ineligible/conditionally eligible; price or FX current/stale; concentration inside/exceeded; coverage short/sufficient/excess; substitution proposed/matched/settling/failed/complete; custodian acknowledged/rejected; dispute open/resolved; call closed/reopened.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, evidence state, and valid actions in text. |
| Empty / not-applicable | Distinguish true empty, no-match, excluded, and non-applicable states with a next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction; read-only differs from disabled and retains context. |
| Pending | Prevent duplicate action, retain context, allow safe cancellation, and announce progress. |
| Success | Confirm the exact changed scope and update dependent receipts. |
| Stale / conflict | Compare versions, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus; modal close returns to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes lower-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Calculate a call, reject ineligible and concentration-breaching assets, apply haircut and FX, form a sufficient ordered substitution pair, block early release, recover settlement failure, and close fully covered.
- Accept a variation only when dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject capacity-allocation-overview, dual-list-transfer, waitlist-offer-allocation-board, or inventory-replenishment-planner when agreement-specific requirement, adjusted eligibility, concentration, held state, deliver-before-release dependency, and custodian proof are absent.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CMS-90`, `91`, or `92`. Return `needs-evidence` when business truth does not prove dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

Research is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment. Binding product claims still route through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [BCBS-IOSCO margin requirements](https://www.bis.org/bcbs/publ/d499.htm) | Margin, eligible collateral, haircuts, and risk-control context. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [BCBS-IOSCO 2025 implementation review](https://www.bis.org/bcbs/publ/d606.htm) | Current implementation evidence and operational margin context. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [SWIFT securities settlement and reconciliation](https://www.swift.com/securities/settlement-and-reconciliation) | Collateral-exchange settlement and acknowledgement context. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Single-pointer and keyboard alternatives to drag allocation. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Announcements for coverage and settlement state. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `collateral-margin-call-substitution-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry and fit thresholds left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"collateral-margin-call-substitution-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

