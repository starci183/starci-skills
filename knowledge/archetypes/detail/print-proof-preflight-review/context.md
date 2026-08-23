# Print proof preflight review

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `print-proof-preflight-review` |
| Family | Detail |
| Dominant task | Inspect a print-ready artifact against deterministic production constraints, locate each failure on the proof, repair or waive it with evidence, and gate release |
| Search aliases | print proof, preflight gate, production issue location |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `preflight-review` owns the complete dominant task and recovery boundary.
- Inspect a print-ready artifact against deterministic production constraints, locate each failure on the proof, repair or waive it with evidence, and gate release
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PPR-01` | Inspect a print-ready artifact against deterministic production constraints, locate each failure on the proof, repair or waive it with evidence, and gate release | Required positive evidence. |
| `AR-PPR-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-PPR-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-PPR-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-PPR-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-PPR-91` | Reject cho evidence dossier, media annotation, generic document preview, print imposition or human QA checklist; machine-evaluable production constraints, failures located on the exact output page/region, correction rerun and binary release block are mandatory—no claim/evidence adjudication owns acceptance | Reject. |
| `AR-PPR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `print-proof-preflight-review` if and only if `AR-PPR-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-PPR-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
preflight-review
├─ job-and-output-profile
├─ proof-page-navigator
├─ rendered-proof-stage (peer synchronization)
├─ issue-ledger
├─ selected-issue-location-and-rule
├─ repair-or-waiver
└─ release-gate-and-report
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `preflight-review` | Owns the dominant task, complete state, and recovery boundary for print-proof-preflight-review. |
| `job-and-output-profile` | Owns job and output profile; preserves the required relationship with upstream `preflight-review` and downstream `proof-page-navigator`, and does not absorb another region's owner. |
| `proof-page-navigator` | Owns proof page navigator; preserves the required relationship with upstream `job-and-output-profile` and downstream `rendered-proof-stage`, and does not absorb another region's owner. |
| `rendered-proof-stage` | Owns rendered proof stage; preserves the required relationship with upstream `proof-page-navigator` and downstream `issue-ledger`, and does not absorb another region's owner. |
| `issue-ledger` | Owns issue ledger; preserves the required relationship with upstream `rendered-proof-stage` and downstream `selected-issue-location-and-rule`, and does not absorb another region's owner. |
| `selected-issue-location-and-rule` | Owns selected issue location and rule; preserves the required relationship with upstream `issue-ledger` and downstream `repair-or-waiver`, and does not absorb another region's owner. |
| `repair-or-waiver` | Owns repair or waiver; preserves the required relationship with upstream `selected-issue-location-and-rule` and downstream `release-gate-and-report`, and does not absorb another region's owner. |
| `release-gate-and-report` | Owns release gate and report; preserves the required relationship with upstream `repair-or-waiver`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Page navigator, proof, issue ledger and selected rule evidence coexist
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Page navigator becomes a drawer while proof and active issue remain side by side; the release gate stays adjacent
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Issue-first queue → affected proof excerpt → rule and repair → next issue → release summary; full-page proof is an optional zoomed region with bounded overflow
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `preflight-review → job-and-output-profile → proof-page-navigator → rendered-proof-stage → issue-ledger → selected-issue-location-and-rule → repair-or-waiver → release-gate-and-report`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes proof rendering, no pages, issue open/fixed/waived, font/image/color/profile failure, stale proof after repair, waiver unauthorized, release blocked/ready and report export.

## State obligations

Task-specific states: proof rendering, no pages, issue open/fixed/waived, font/image/color/profile failure, stale proof after repair, waiver unauthorized, release blocked/ready and report export.

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

- Template must select an issue from the ledger, reveal its exact proof location and rule, demonstrate repair versus authorized waiver and keep release blocked until all blockers resolve
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho evidence dossier, media annotation, generic document preview, print imposition or human QA checklist; machine-evaluable production constraints, failures located on the exact output page/region, correction rerun and binary release block are mandatory—no claim/evidence adjudication owns acceptance
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PPR-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Adobe Acrobat preflight reports](https://helpx.adobe.com/acrobat/using/preflight-reports-acrobat-pro.html) | Provides official evidence for job and output profile. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [PDF Association PDF/X](https://pdfa.org/resource/iso-15930-pdfx/) | Provides official evidence for proof page navigator. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `print-proof-preflight-review`. |
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
{"archetypeId":"print-proof-preflight-review","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
