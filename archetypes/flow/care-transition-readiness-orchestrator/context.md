# Care transition readiness orchestrator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `care-transition-readiness-orchestrator` |
| Family | Flow |
| Dominant task | Orchestrate readiness for a care transition by aligning clinical, medication, equipment, transport, education and recipient-acceptance owners before the transfer occurs |
| Search aliases | transition readiness, go-no-go, recipient acceptance |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `transition-orchestrator` owns the complete dominant task and recovery boundary.
- Orchestrate readiness for a care transition by aligning clinical, medication, equipment, transport, education and recipient-acceptance owners before the transfer occurs
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CTR-01` | Orchestrate readiness for a care transition by aligning clinical, medication, equipment, transport, education and recipient-acceptance owners before the transfer occurs | Required positive evidence. |
| `AR-CTR-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-CTR-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-CTR-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-CTR-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-CTR-91` | Reject cho evidence-led case dossier, task checklist, referral negotiation, single case handoff or appointment booking; coupled clinical/logistical/social readiness domains must converge into an executable transition and explicit receiving-party acceptance—evidence sufficiency or a case verdict alone cannot complete it | Reject. |
| `AR-CTR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `care-transition-readiness-orchestrator` if and only if `AR-CTR-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-CTR-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
transition-orchestrator
├─ transition-subject-and-target
├─ readiness-domain-board
├─ domain-owner-evidence
├─ dependency-and-blocker-graph
├─ recipient-understanding-and-acceptance
├─ go-no-go-review
└─ transfer-receipt-and-follow-up
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `transition-orchestrator` | Owns the dominant task, complete state, and recovery boundary for care-transition-readiness-orchestrator. |
| `transition-subject-and-target` | Owns transition subject and target; preserves the required relationship with upstream `transition-orchestrator` and downstream `readiness-domain-board`, and does not absorb another region's owner. |
| `readiness-domain-board` | Owns readiness domain board; preserves the required relationship with upstream `transition-subject-and-target` and downstream `domain-owner-evidence`, and does not absorb another region's owner. |
| `domain-owner-evidence` | Owns domain owner evidence; preserves the required relationship with upstream `readiness-domain-board` and downstream `dependency-and-blocker-graph`, and does not absorb another region's owner. |
| `dependency-and-blocker-graph` | Owns dependency and blocker graph; preserves the required relationship with upstream `domain-owner-evidence` and downstream `recipient-understanding-and-acceptance`, and does not absorb another region's owner. |
| `recipient-understanding-and-acceptance` | Owns recipient understanding and acceptance; preserves the required relationship with upstream `dependency-and-blocker-graph` and downstream `go-no-go-review`, and does not absorb another region's owner. |
| `go-no-go-review` | Owns go no go review; preserves the required relationship with upstream `recipient-understanding-and-acceptance` and downstream `transfer-receipt-and-follow-up`, and does not absorb another region's owner. |
| `transfer-receipt-and-follow-up` | Owns transfer receipt and follow up; preserves the required relationship with upstream `go-no-go-review`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Readiness domains, selected evidence, dependency/blocker graph and recipient acceptance remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Domain board and blockers remain primary; detailed evidence and acceptance become synchronized sheets
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Readiness summary → blocking domain → owner/evidence/action → recipient understanding → go/no-go → receipt/follow-up; only one domain is expanded at a time
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `transition-orchestrator → transition-subject-and-target → readiness-domain-board → domain-owner-evidence → dependency-and-blocker-graph → recipient-understanding-and-acceptance → go-no-go-review → transfer-receipt-and-follow-up`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes transition proposed/scheduled/delayed/completed, domain ready/blocked/unknown, owner missing, evidence stale, dependency unresolved, recipient not-ready/accepted, go/no-go pending and post-transfer exception.

## State obligations

Task-specific states: transition proposed/scheduled/delayed/completed, domain ready/blocked/unknown, owner missing, evidence stale, dependency unresolved, recipient not-ready/accepted, go/no-go pending and post-transfer exception.

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

- Template must expose independent readiness owners, trace a blocker dependency, record recipient understanding, prohibit go on missing evidence and issue a transition receipt
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho evidence-led case dossier, task checklist, referral negotiation, single case handoff or appointment booking; coupled clinical/logistical/social readiness domains must converge into an executable transition and explicit receiving-party acceptance—evidence sufficiency or a case verdict alone cannot complete it
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CTR-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [AHRQ care transitions](https://www.ahrq.gov/patient-safety/settings/hospital/resource/guide/index.html) | Provides official evidence for transition subject and target. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [eCFR discharge planning](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-482/subpart-C/section-482.43) | Provides official evidence for readiness domain board. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [HL7 FHIR](https://hl7.org/fhir/) | Provides official evidence for domain owner evidence. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `care-transition-readiness-orchestrator`. |
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
{"archetypeId":"care-transition-readiness-orchestrator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
