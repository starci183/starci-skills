# Editorial rundown control board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `editorial-rundown-control-board` |
| Family | Overview |
| Dominant task | Operate a live editorial rundown by sequencing segments, confirming readiness, issuing cues, recording actual timing and adapting the remaining program without losing editorial intent |
| Search aliases | live rundown, cue control, as-run log |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `rundown-control` owns the complete dominant task and recovery boundary.
- Operate a live editorial rundown by sequencing segments, confirming readiness, issuing cues, recording actual timing and adapting the remaining program without losing editorial intent
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-ERB-01` | Operate a live editorial rundown by sequencing segments, confirming readiness, issuing cues, recording actual timing and adapting the remaining program without losing editorial intent | Required positive evidence. |
| `AR-ERB-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-ERB-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-ERB-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-ERB-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-ERB-91` | Reject cho timeline monitor, generic queue, meeting agenda or video player; live cue issuance, role readiness, current-next ownership and as-run reconciliation are mandatory | Reject. |
| `AR-ERB-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `editorial-rundown-control-board` if and only if `AR-ERB-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-ERB-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
rundown-control
├─ program-clock-and-live-state
├─ segment-rundown
├─ current-next-on-deck
├─ selected-segment-cues-and-assets
├─ role-readiness-matrix
├─ actual-versus-planned-time
├─ hold-skip-reorder-controls
└─ as-run-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `rundown-control` | Owns the dominant task, complete state, and recovery boundary for editorial-rundown-control-board. |
| `program-clock-and-live-state` | Owns program clock and live state; preserves the required relationship with upstream `rundown-control` and downstream `segment-rundown`, and does not absorb another region's owner. |
| `segment-rundown` | Owns segment rundown; preserves the required relationship with upstream `program-clock-and-live-state` and downstream `current-next-on-deck`, and does not absorb another region's owner. |
| `current-next-on-deck` | Owns current next on deck; preserves the required relationship with upstream `segment-rundown` and downstream `selected-segment-cues-and-assets`, and does not absorb another region's owner. |
| `selected-segment-cues-and-assets` | Owns selected segment cues and assets; preserves the required relationship with upstream `current-next-on-deck` and downstream `role-readiness-matrix`, and does not absorb another region's owner. |
| `role-readiness-matrix` | Owns role readiness matrix; preserves the required relationship with upstream `selected-segment-cues-and-assets` and downstream `actual-versus-planned-time`, and does not absorb another region's owner. |
| `actual-versus-planned-time` | Owns actual versus planned time; preserves the required relationship with upstream `role-readiness-matrix` and downstream `hold-skip-reorder-controls`, and does not absorb another region's owner. |
| `hold-skip-reorder-controls` | Owns hold skip reorder controls; preserves the required relationship with upstream `actual-versus-planned-time` and downstream `as-run-log`, and does not absorb another region's owner. |
| `as-run-log` | Owns as run log; preserves the required relationship with upstream `hold-skip-reorder-controls`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Rundown, current/next stage, readiness rail and program clock/as-run status remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Current and next segments own the main view; full rundown becomes a drawer and readiness moves below
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Now → next → cue/confirm → record outcome → advance; complete rundown and as-run history are secondary routes, with no compressed timeline dependency
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `rundown-control → program-clock-and-live-state → segment-rundown → current-next-on-deck → selected-segment-cues-and-assets → role-readiness-matrix → actual-versus-planned-time → hold-skip-reorder-controls → as-run-log`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes off-air/rehearsal/live/paused, segment ready/blocked/skipped, asset missing, role unconfirmed, cue pending/acknowledged, over/under time, rundown changed and as-run logging failure.

## State obligations

Task-specific states: off-air/rehearsal/live/paused, segment ready/blocked/skipped, asset missing, role unconfirmed, cue pending/acknowledged, over/under time, rundown changed and as-run logging failure.

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

- Template must cue the current segment, acknowledge a role, handle a blocked next segment, update planned versus actual time and preserve the live state when the rundown drawer opens
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho timeline monitor, generic queue, meeting agenda or video player; live cue issuance, role readiness, current-next ownership and as-run reconciliation are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-ERB-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [BBC editorial guidelines](https://www.bbc.com/editorialguidelines/) | Provides official evidence for program clock and live state. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [EBU production technology](https://tech.ebu.ch/) | Provides official evidence for segment rundown. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `editorial-rundown-control-board`. |
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
{"archetypeId":"editorial-rundown-control-board","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
