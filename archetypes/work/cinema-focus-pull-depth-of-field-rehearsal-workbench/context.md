# Cinema focus pull depth of field rehearsal workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cinema-focus-pull-depth-of-field-rehearsal-workbench` |
| Family | Work |
| Dominant task | Plan and rehearse one cinema focus pull by combining camera and subject distance trajectories with calibrated lens/motor response, frame-indexed focus marks and near/far depth-of-field envelopes, then compare measured lens data with the plan before declaring the take ready. |
| Search aliases | focus pull rehearsal, depth of field map, lens data comparison |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `focus-rehearsal` owns the complete dominant task, work state, and recovery boundary.
- Plan and rehearse one cinema focus pull by combining camera and subject distance trajectories with calibrated lens/motor response, frame-indexed focus marks and near/far depth-of-field envelopes, then compare measured lens data with the plan before declaring the take ready.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `FOC-01` | Plan and rehearse one cinema focus pull by combining camera and subject distance trajectories with calibrated lens/motor response, frame-indexed focus marks and near/far depth-of-field envelopes, then compare measured lens data with the plan before declaring the take ready. | Required positive evidence. |
| `FOC-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `FOC-03` | Template must bind a camera, sensor, calibrated lens/motor and aperture, map moving camera and subject distances to at least three focus marks, calculate one near/far depth-of-field envelope, expose a miss caused by pull rate or backlash, compare an aperture/blocking/rack alternative, ingest measured rehearsal lens data and approve or return take readiness with version evidence. | Require the domain-specific proof path. |
| `FOC-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `FOC-05` | Task-specific states: shot version current/superseded, lens and motor calibrated/stale, trajectory measured/estimated/changed, focus mark queued/rehearsed/hit/missed, depth-of-field envelope safe/marginal/outside, pull rate feasible/exceeded, backlash compensated/unresolved, aperture locked/change-proposed, blocking fixed/revised, rack direction planned/reversed, measured lens data aligned/diverged and take readiness pending/approved/returned. | Require state and recovery coverage. |
| `FOC-90` | Reject cho `multi-track-timeline-editor`, `media-annotation-workbench`, `spatial-route-itinerary-explorer` or `motion-capture-skeleton-retargeting-workbench`; camera/subject distance trajectories, a calibrated lens-and-motor map, frame-indexed focus marks, near/far depth-of-field geometry, pull-rate/backlash limits and measured rehearsal comparison are mandatory. | Reject. |
| `FOC-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `FOC-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `cinema-focus-pull-depth-of-field-rehearsal-workbench` if and only if `FOC-01`–`05` are evidenced and none of `FOC-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
focus-rehearsal
├─ shot-camera-sensor-lens-aperture-and-take-version (downstream)
├─ camera-path-and-subject-distance-trajectories (downstream)
├─ calibrated-lens-scale-and-motor-map (downstream)
├─ frame-indexed-focus-mark-sequence (downstream)
├─ near-far-depth-of-field-envelope (downstream)
├─ subject-miss-intervals-and-pull-rate-backlash-limits (downstream)
├─ aperture-blocking-mark-or-rack-counterfactuals (downstream)
├─ measured-rehearsal-lens-data-vs-plan (downstream)
└─ approved-focus-map-and-take-readiness (downstream)
```

The binding relationship expression is `focus-rehearsal → shot-camera-sensor-lens-aperture-and-take-version → camera-path-and-subject-distance-trajectories → calibrated-lens-scale-and-motor-map → frame-indexed-focus-mark-sequence → near-far-depth-of-field-envelope → subject-miss-intervals-and-pull-rate-backlash-limits → aperture-blocking-mark-or-rack-counterfactuals → measured-rehearsal-lens-data-vs-plan → approved-focus-map-and-take-readiness`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `focus-rehearsal` | focus-rehearsal owns its evidence and state and the dominant-task boundary and passes stable identity to `shot-camera-sensor-lens-aperture-and-take-version`. It does not absorb another region's owner. |
| `shot-camera-sensor-lens-aperture-and-take-version` | shot-camera-sensor-lens-aperture-and-take-version owns its evidence and state; it preserves the → relationship from upstream `focus-rehearsal` and passes stable identity to `camera-path-and-subject-distance-trajectories`. It does not absorb another region's owner. |
| `camera-path-and-subject-distance-trajectories` | camera-path-and-subject-distance-trajectories owns its evidence and state; it preserves the → relationship from upstream `shot-camera-sensor-lens-aperture-and-take-version` and passes stable identity to `calibrated-lens-scale-and-motor-map`. It does not absorb another region's owner. |
| `calibrated-lens-scale-and-motor-map` | calibrated-lens-scale-and-motor-map owns its evidence and state; it preserves the → relationship from upstream `camera-path-and-subject-distance-trajectories` and passes stable identity to `frame-indexed-focus-mark-sequence`. It does not absorb another region's owner. |
| `frame-indexed-focus-mark-sequence` | frame-indexed-focus-mark-sequence owns its evidence and state; it preserves the → relationship from upstream `calibrated-lens-scale-and-motor-map` and passes stable identity to `near-far-depth-of-field-envelope`. It does not absorb another region's owner. |
| `near-far-depth-of-field-envelope` | near-far-depth-of-field-envelope owns its evidence and state; it preserves the → relationship from upstream `frame-indexed-focus-mark-sequence` and passes stable identity to `subject-miss-intervals-and-pull-rate-backlash-limits`. It does not absorb another region's owner. |
| `subject-miss-intervals-and-pull-rate-backlash-limits` | subject-miss-intervals-and-pull-rate-backlash-limits owns its evidence and state; it preserves the → relationship from upstream `near-far-depth-of-field-envelope` and passes stable identity to `aperture-blocking-mark-or-rack-counterfactuals`. It does not absorb another region's owner. |
| `aperture-blocking-mark-or-rack-counterfactuals` | aperture-blocking-mark-or-rack-counterfactuals owns its evidence and state; it preserves the → relationship from upstream `subject-miss-intervals-and-pull-rate-backlash-limits` and passes stable identity to `measured-rehearsal-lens-data-vs-plan`. It does not absorb another region's owner. |
| `measured-rehearsal-lens-data-vs-plan` | measured-rehearsal-lens-data-vs-plan owns its evidence and state; it preserves the → relationship from upstream `aperture-blocking-mark-or-rack-counterfactuals` and passes stable identity to `approved-focus-map-and-take-readiness`. It does not absorb another region's owner. |
| `approved-focus-map-and-take-readiness` | approved-focus-map-and-take-readiness owns its evidence and state; it preserves the → relationship from upstream `measured-rehearsal-lens-data-vs-plan` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Shot setup, camera/subject trajectories, calibrated lens map, frame-indexed focus marks, depth-of-field envelopes, miss intervals, counterfactuals and measured rehearsal overlay remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active critical frame interval and its subject-distance-to-focus proof remain primary; full trajectories, calibration history and alternate blocking/aperture choices move to synchronized panels without losing the selected mark.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Critical frame → camera and subject distance → focus mark → near/far depth-of-field envelope → pull rate and backlash → subject miss → aperture, blocking or rack alternative → measured rehearsal → approve; curves become an ordered critical-frame route and retain the same decision/action parity without horizontal scrolling.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `focus-rehearsal → shot-camera-sensor-lens-aperture-and-take-version → camera-path-and-subject-distance-trajectories → calibrated-lens-scale-and-motor-map → frame-indexed-focus-mark-sequence → near-far-depth-of-field-envelope → subject-miss-intervals-and-pull-rate-backlash-limits → aperture-blocking-mark-or-rack-counterfactuals → measured-rehearsal-lens-data-vs-plan → approved-focus-map-and-take-readiness`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: shot version current/superseded, lens and motor calibrated/stale, trajectory measured/estimated/changed, focus mark queued/rehearsed/hit/missed, depth-of-field envelope safe/marginal/outside, pull rate feasible/exceeded, backlash compensated/unresolved, aperture locked/change-proposed, blocking fixed/revised, rack direction planned/reversed, measured lens data aligned/diverged and take readiness pending/approved/returned.

## State obligations

Task-specific states: shot version current/superseded, lens and motor calibrated/stale, trajectory measured/estimated/changed, focus mark queued/rehearsed/hit/missed, depth-of-field envelope safe/marginal/outside, pull rate feasible/exceeded, backlash compensated/unresolved, aperture locked/change-proposed, blocking fixed/revised, rack direction planned/reversed, measured lens data aligned/diverged and take readiness pending/approved/returned.

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

- Template must bind a camera, sensor, calibrated lens/motor and aperture, map moving camera and subject distances to at least three focus marks, calculate one near/far depth-of-field envelope, expose a miss caused by pull rate or backlash, compare an aperture/blocking/rack alternative, ingest measured rehearsal lens data and approve or return take readiness with version evidence.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `multi-track-timeline-editor`, `media-annotation-workbench`, `spatial-route-itinerary-explorer` or `motion-capture-skeleton-retargeting-workbench`; camera/subject distance trajectories, a calibrated lens-and-motor map, frame-indexed focus marks, near/far depth-of-field geometry, pull-rate/backlash limits and measured rehearsal comparison are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `FOC-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [ARRI Lens Data System FAQ](https://www.arri.com/en/learn-help/learn-help-camera-system/frequently-asked-questions/lens-data-system-faq) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [ZEISS eXtended Data for cinematography](https://www.zeiss.com/photonics-and-optics/en/cinematography/know-how-hub/extended-data.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `cinema-focus-pull-depth-of-field-rehearsal-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, joint-axis, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"cinema-focus-pull-depth-of-field-rehearsal-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
