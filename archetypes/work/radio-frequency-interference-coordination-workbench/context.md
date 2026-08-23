# Radio frequency interference coordination workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `radio-frequency-interference-coordination-workbench` |
| Family | Work |
| Dominant task | Coordinate a proposed radio assignment by calculating wanted and unwanted signals at protected receivers, finding pairwise and aggregate interference failures and negotiating technical conditions that make the assignment acceptable. |
| Search aliases | frequency coordination, interference margin, spectrum assignment |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `frequency-coordination` owns the complete dominant task, work state, and recovery boundary.
- Coordinate a proposed radio assignment by calculating wanted and unwanted signals at protected receivers, finding pairwise and aggregate interference failures and negotiating technical conditions that make the assignment acceptable.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `RFI-01` | Coordinate a proposed radio assignment by calculating wanted and unwanted signals at protected receivers, finding pairwise and aggregate interference failures and negotiating technical conditions that make the assignment acceptable. | Required positive evidence. |
| `RFI-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `RFI-03` | Template must enter one proposed transmitter, identify the worst protected receiver, show wanted, pairwise unwanted and aggregate margin values, fail the original channel or power, compare at least two technical alternatives, record an affected party response and issue a conditional coordinated application. | Require the domain-specific proof path. |
| `RFI-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `RFI-05` | Task-specific states: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired. | Require state and recovery coverage. |
| `RFI-90` | Reject cho `capacity-allocation-overview`, `airspace-volume-deconfliction-planner`, `scenario-sensitivity-modeler` or `map-led-situation-monitor`; service-specific spectrum rules, emission and antenna parameters, propagation to protected receivers, pairwise-plus-aggregate interference margins and affected-licensee coordination are mandatory. | Reject. |
| `RFI-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `RFI-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `radio-frequency-interference-coordination-workbench` if and only if `RFI-01`–`05` are evidenced and none of `RFI-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
frequency-coordination
├─ service-band-jurisdiction-and-rule-version (downstream)
├─ existing-and-planned-assignment-register (downstream)
├─ proposed-transmitter-receiver-location-antenna-and-emission (downstream)
├─ propagation-path-and-terrain-model (downstream)
├─ wanted-vs-unwanted-signal-at-protected-receivers (downstream)
├─ pairwise-and-aggregate-interference-margin-matrix (downstream)
├─ channel-power-time-antenna-or-site-counterfactuals (downstream)
├─ affected-party-notice-response-and-agreement (downstream)
└─ coordinated-application-and-condition-record (downstream)
```

The binding relationship expression is `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `frequency-coordination` | frequency-coordination owns its evidence and state and the dominant-task boundary and passes stable identity to `service-band-jurisdiction-and-rule-version`. It does not absorb another region's owner. |
| `service-band-jurisdiction-and-rule-version` | service-band-jurisdiction-and-rule-version owns its evidence and state; it preserves the → relationship from upstream `frequency-coordination` and passes stable identity to `existing-and-planned-assignment-register`. It does not absorb another region's owner. |
| `existing-and-planned-assignment-register` | existing-and-planned-assignment-register owns its evidence and state; it preserves the → relationship from upstream `service-band-jurisdiction-and-rule-version` and passes stable identity to `proposed-transmitter-receiver-location-antenna-and-emission`. It does not absorb another region's owner. |
| `proposed-transmitter-receiver-location-antenna-and-emission` | proposed-transmitter-receiver-location-antenna-and-emission owns its evidence and state; it preserves the → relationship from upstream `existing-and-planned-assignment-register` and passes stable identity to `propagation-path-and-terrain-model`. It does not absorb another region's owner. |
| `propagation-path-and-terrain-model` | propagation-path-and-terrain-model owns its evidence and state; it preserves the → relationship from upstream `proposed-transmitter-receiver-location-antenna-and-emission` and passes stable identity to `wanted-vs-unwanted-signal-at-protected-receivers`. It does not absorb another region's owner. |
| `wanted-vs-unwanted-signal-at-protected-receivers` | wanted-vs-unwanted-signal-at-protected-receivers owns its evidence and state; it preserves the → relationship from upstream `propagation-path-and-terrain-model` and passes stable identity to `pairwise-and-aggregate-interference-margin-matrix`. It does not absorb another region's owner. |
| `pairwise-and-aggregate-interference-margin-matrix` | pairwise-and-aggregate-interference-margin-matrix owns its evidence and state; it preserves the → relationship from upstream `wanted-vs-unwanted-signal-at-protected-receivers` and passes stable identity to `channel-power-time-antenna-or-site-counterfactuals`. It does not absorb another region's owner. |
| `channel-power-time-antenna-or-site-counterfactuals` | channel-power-time-antenna-or-site-counterfactuals owns its evidence and state; it preserves the → relationship from upstream `pairwise-and-aggregate-interference-margin-matrix` and passes stable identity to `affected-party-notice-response-and-agreement`. It does not absorb another region's owner. |
| `affected-party-notice-response-and-agreement` | affected-party-notice-response-and-agreement owns its evidence and state; it preserves the → relationship from upstream `channel-power-time-antenna-or-site-counterfactuals` and passes stable identity to `coordinated-application-and-condition-record`. It does not absorb another region's owner. |
| `coordinated-application-and-condition-record` | coordinated-application-and-condition-record owns its evidence and state; it preserves the → relationship from upstream `affected-party-notice-response-and-agreement` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Assignment register/map, proposed technical parameters, protected receivers, propagation evidence, interference matrix, alternatives and party responses remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The worst protected receiver and its interference contributors remain primary; complete map, assignment roster and correspondence move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Proposal → worst protected receiver → wanted/unwanted signal facts → pairwise and aggregate margin → channel/power/time/antenna/site alternative → affected-party response → condition or rejection; a ranked path list replaces the map.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired.

## State obligations

Task-specific states: rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired.

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

- Template must enter one proposed transmitter, identify the worst protected receiver, show wanted, pairwise unwanted and aggregate margin values, fail the original channel or power, compare at least two technical alternatives, record an affected party response and issue a conditional coordinated application.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `capacity-allocation-overview`, `airspace-volume-deconfliction-planner`, `scenario-sensitivity-modeler` or `map-led-situation-monitor`; service-specific spectrum rules, emission and antenna parameters, propagation to protected receivers, pairwise-plus-aggregate interference margins and affected-licensee coordination are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `RFI-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [ITU Radiocommunication terrestrial coordination guidance](https://www.itu.int/en/ITU-R/terrestrial/Pages/by-categories-faq.aspx?categorizedby=35) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [NTIA United States Frequency Allocation Chart](https://www.ntia.gov/page/united-states-frequency-allocation-chart) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `radio-frequency-interference-coordination-workbench`. |
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
{"archetypeId":"radio-frequency-interference-coordination-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
