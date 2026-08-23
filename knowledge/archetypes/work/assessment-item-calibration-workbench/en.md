# Assessment item calibration workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `assessment-item-calibration-workbench` |
| Family | Work |
| Dominant task | Calibrate versioned assessment items from cohort response behavior, then retain, revise or retire each item and release a calibrated bank |
| Search aliases | item calibration, DIF review, calibrated bank |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `assessment-form-cohort-and-model` owns the complete dominant task and recovery boundary.
- Calibrate versioned assessment items from cohort response behavior, then retain, revise or retire each item and release a calibrated bank
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-AIC-01` | Calibrate versioned assessment items from cohort response behavior, then retain, revise or retire each item and release a calibrated bank | Required positive evidence. |
| `AR-AIC-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-AIC-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-AIC-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-AIC-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-AIC-91` | Reject cho rubric grading, learner assessment attempt, scenario dashboard or generic analytics drilldown; item-version lineage, response-model fit, item characteristic/information evidence, DIF and downstream form impact are mandatory | Reject. |
| `AR-AIC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `assessment-item-calibration-workbench` if and only if `AR-AIC-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-AIC-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
assessment-form-cohort-and-model
├─ item-bank-version
├─ selected-item-content-and-key
├─ option-response-distribution (peer synchronization)
├─ model-fit-and-item-characteristic-information
├─ differential-functioning-and-exposure
├─ retain-revise-or-retire
├─ downstream-form-information-impact
└─ calibrated-bank-release
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `assessment-form-cohort-and-model` | Owns the dominant task, complete state, and recovery boundary for assessment-item-calibration-workbench. |
| `item-bank-version` | Owns item bank version; preserves the required relationship with upstream `assessment-form-cohort-and-model` and downstream `selected-item-content-and-key`, and does not absorb another region's owner. |
| `selected-item-content-and-key` | Owns selected item content and key; preserves the required relationship with upstream `item-bank-version` and downstream `option-response-distribution`, and does not absorb another region's owner. |
| `option-response-distribution` | Owns option response distribution; preserves the required relationship with upstream `selected-item-content-and-key` and downstream `model-fit-and-item-characteristic-information`, and does not absorb another region's owner. |
| `model-fit-and-item-characteristic-information` | Owns model fit and item characteristic information; preserves the required relationship with upstream `option-response-distribution` and downstream `differential-functioning-and-exposure`, and does not absorb another region's owner. |
| `differential-functioning-and-exposure` | Owns differential functioning and exposure; preserves the required relationship with upstream `model-fit-and-item-characteristic-information` and downstream `retain-revise-or-retire`, and does not absorb another region's owner. |
| `retain-revise-or-retire` | Owns retain revise or retire; preserves the required relationship with upstream `differential-functioning-and-exposure` and downstream `downstream-form-information-impact`, and does not absorb another region's owner. |
| `downstream-form-information-impact` | Owns downstream form information impact; preserves the required relationship with upstream `retain-revise-or-retire` and downstream `calibrated-bank-release`, and does not absorb another region's owner. |
| `calibrated-bank-release` | Owns calibrated bank release; preserves the required relationship with upstream `downstream-form-information-impact`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Flagged-item queue, selected content/key, response/model evidence, DIF/exposure and decision/form-impact rail coexist
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Flagged items and calibration evidence remain primary; content/key becomes an anchored drawer while decision state and downstream form impact persist
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Flagged item → stem/key/options → numeric option table → model fit and item information → DIF/exposure → retain/revise/retire → form impact → release; charts are optional companions to complete tables
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `assessment-form-cohort-and-model → item-bank-version → selected-item-content-and-key → option-response-distribution → model-fit-and-item-characteristic-information → differential-functioning-and-exposure → retain-revise-or-retire → downstream-form-information-impact → calibrated-bank-release`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes item draft/active/retired, sample sufficient/insufficient, distractor functioning/nonfunctioning, model fitting/failed, parameter stable/unstable, DIF clear/flagged/reviewing, exposure safe/high, decision draft/approved/rejected, bank dirty and release pending/conflict/success.

## State obligations

Task-specific states: item draft/active/retired, sample sufficient/insufficient, distractor functioning/nonfunctioning, model fitting/failed, parameter stable/unstable, DIF clear/flagged/reviewing, exposure safe/high, decision draft/approved/rejected, bank dirty and release pending/conflict/success.

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

- Template must flag one item, expose numeric response and uncertainty evidence, detect insufficient sample or DIF, revise the lifecycle decision, show downstream form-information impact and release only a coherent calibrated version
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho rubric grading, learner assessment attempt, scenario dashboard or generic analytics drilldown; item-version lineage, response-model fit, item characteristic/information evidence, DIF and downstream form impact are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-AIC-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [1EdTech QTI](https://www.1edtech.org/standards/qti/index) | Provides official evidence for item bank version. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [OECD PISA 2022 Technical Report](https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/03/pisa-2022-technical-report_599753f0/01820d6d-en.pdf) | Provides official evidence for selected item content and key. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Testing Standards](https://www.testingstandards.net/) | Provides official evidence for option response distribution. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `assessment-item-calibration-workbench`. |
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
{"archetypeId":"assessment-item-calibration-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
