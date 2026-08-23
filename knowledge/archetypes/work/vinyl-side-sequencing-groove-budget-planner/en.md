# Vinyl side sequencing groove budget planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `vinyl-side-sequencing-groove-budget-planner` |
| Family | Work |
| Dominant task | Sequence masters across physical record sides by forecasting radial groove use and cutting risk, then choose order, edits, level or format changes before sending a traceable side master to the cutting engineer. |
| Search aliases | vinyl sequencing, groove budget, side master planner |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `vinyl-sequencing` owns the complete dominant task, work state, and recovery boundary.
- Sequence masters across physical record sides by forecasting radial groove use and cutting risk, then choose order, edits, level or format changes before sending a traceable side master to the cutting engineer.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `VIN-01` | Sequence masters across physical record sides by forecasting radial groove use and cutting risk, then choose order, edits, level or format changes before sending a traceable side master to the cutting engineer. | Required positive evidence. |
| `VIN-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `VIN-03` | Template must move a track between sides through buttons or keyboard as well as drag, recompute its radial position and remaining budget, expose an inner-groove risk, compare at least two corrective counterfactuals, record the cutting engineer's choice and approve versioned side manifests. | Require the domain-specific proof path. |
| `VIN-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `VIN-05` | Task-specific states: master missing/current/revised, side under/near/over budget, track outer/mid/inner radius, gap or lock groove valid/invalid, bass/stereo/sibilance risk low/raised/blocking, counterfactual unsolved/viable, engineer note open/answered, test cut pending/pass/fail and manifest approved/superseded. | Require state and recovery coverage. |
| `VIN-90` | Reject cho `multi-track-timeline-workbench`, `audio-mix-routing-console`, load packing or a calendar scheduler; physical disc side membership, radial groove consumption, inner-radius-dependent cutting risk, format/level/order counterfactuals and a cutting-side master manifest are mandatory. | Reject. |
| `VIN-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `VIN-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `vinyl-side-sequencing-groove-budget-planner` if and only if `VIN-01`–`05` are evidenced and none of `VIN-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
vinyl-sequencing
├─ release-format-disc-size-speed-and-lathe-profile (downstream)
├─ track-master-register-and-technical-analysis (downstream)
├─ side-a-side-b-membership-and-running-order (downstream)
├─ per-side-duration-gap-and-lock-groove-ledger (downstream)
├─ radial-groove-budget-and-inner-radius-projection (downstream)
├─ level-low-frequency-stereo-phase-and-sibilance-risks (peer synchronization)
├─ reorder-edit-level-or-format-counterfactuals (downstream)
├─ cutting-engineer-notes-and-side-master-manifest (downstream)
└─ test-cut-approval-and-pressing-handoff (downstream)
```

The binding relationship expression is `vinyl-sequencing → release-format-disc-size-speed-and-lathe-profile → track-master-register-and-technical-analysis → side-a-side-b-membership-and-running-order → per-side-duration-gap-and-lock-groove-ledger → radial-groove-budget-and-inner-radius-projection ↔ level-low-frequency-stereo-phase-and-sibilance-risks → reorder-edit-level-or-format-counterfactuals → cutting-engineer-notes-and-side-master-manifest → test-cut-approval-and-pressing-handoff`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `vinyl-sequencing` | vinyl-sequencing owns its evidence and state and the dominant-task boundary and passes stable identity to `release-format-disc-size-speed-and-lathe-profile`. It does not absorb another region's owner. |
| `release-format-disc-size-speed-and-lathe-profile` | release-format-disc-size-speed-and-lathe-profile owns its evidence and state; it preserves the → relationship from upstream `vinyl-sequencing` and passes stable identity to `track-master-register-and-technical-analysis`. It does not absorb another region's owner. |
| `track-master-register-and-technical-analysis` | track-master-register-and-technical-analysis owns its evidence and state; it preserves the → relationship from upstream `release-format-disc-size-speed-and-lathe-profile` and passes stable identity to `side-a-side-b-membership-and-running-order`. It does not absorb another region's owner. |
| `side-a-side-b-membership-and-running-order` | side-a-side-b-membership-and-running-order owns its evidence and state; it preserves the → relationship from upstream `track-master-register-and-technical-analysis` and passes stable identity to `per-side-duration-gap-and-lock-groove-ledger`. It does not absorb another region's owner. |
| `per-side-duration-gap-and-lock-groove-ledger` | per-side-duration-gap-and-lock-groove-ledger owns its evidence and state; it preserves the → relationship from upstream `side-a-side-b-membership-and-running-order` and passes stable identity to `radial-groove-budget-and-inner-radius-projection`. It does not absorb another region's owner. |
| `radial-groove-budget-and-inner-radius-projection` | radial-groove-budget-and-inner-radius-projection owns its evidence and state; it preserves the → relationship from upstream `per-side-duration-gap-and-lock-groove-ledger` and passes stable identity to `level-low-frequency-stereo-phase-and-sibilance-risks`. It does not absorb another region's owner. |
| `level-low-frequency-stereo-phase-and-sibilance-risks` | level-low-frequency-stereo-phase-and-sibilance-risks owns its evidence and state; it preserves the ↔ relationship from upstream `radial-groove-budget-and-inner-radius-projection` and passes stable identity to `reorder-edit-level-or-format-counterfactuals`. It does not absorb another region's owner. |
| `reorder-edit-level-or-format-counterfactuals` | reorder-edit-level-or-format-counterfactuals owns its evidence and state; it preserves the → relationship from upstream `level-low-frequency-stereo-phase-and-sibilance-risks` and passes stable identity to `cutting-engineer-notes-and-side-master-manifest`. It does not absorb another region's owner. |
| `cutting-engineer-notes-and-side-master-manifest` | cutting-engineer-notes-and-side-master-manifest owns its evidence and state; it preserves the → relationship from upstream `reorder-edit-level-or-format-counterfactuals` and passes stable identity to `test-cut-approval-and-pressing-handoff`. It does not absorb another region's owner. |
| `test-cut-approval-and-pressing-handoff` | test-cut-approval-and-pressing-handoff owns its evidence and state; it preserves the → relationship from upstream `cutting-engineer-notes-and-side-master-manifest` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Both ordered sides, radial budget projection, track technical risks, counterfactual comparison and cutting notes remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected side and its limiting inner-groove track remain primary; other side, complete analysis and format alternatives move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Side → ordered track → cumulative radial position and remaining groove budget → position-specific cut risk → reorder/edit/level/format alternative → engineer note → handoff; no waveform timeline is required.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `vinyl-sequencing → release-format-disc-size-speed-and-lathe-profile → track-master-register-and-technical-analysis → side-a-side-b-membership-and-running-order → per-side-duration-gap-and-lock-groove-ledger → radial-groove-budget-and-inner-radius-projection ↔ level-low-frequency-stereo-phase-and-sibilance-risks → reorder-edit-level-or-format-counterfactuals → cutting-engineer-notes-and-side-master-manifest → test-cut-approval-and-pressing-handoff`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: master missing/current/revised, side under/near/over budget, track outer/mid/inner radius, gap or lock groove valid/invalid, bass/stereo/sibilance risk low/raised/blocking, counterfactual unsolved/viable, engineer note open/answered, test cut pending/pass/fail and manifest approved/superseded.

## State obligations

Task-specific states: master missing/current/revised, side under/near/over budget, track outer/mid/inner radius, gap or lock groove valid/invalid, bass/stereo/sibilance risk low/raised/blocking, counterfactual unsolved/viable, engineer note open/answered, test cut pending/pass/fail and manifest approved/superseded.

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

- Template must move a track between sides through buttons or keyboard as well as drag, recompute its radial position and remaining budget, expose an inner-groove risk, compare at least two corrective counterfactuals, record the cutting engineer's choice and approve versioned side manifests.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `multi-track-timeline-workbench`, `audio-mix-routing-console`, load packing or a calendar scheduler; physical disc side membership, radial groove consumption, inner-radius-dependent cutting risk, format/level/order counterfactuals and a cutting-side master manifest are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `VIN-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Ableton's mastering-for-vinyl guidance](https://www.ableton.com/en/blog/mastering-tracks-for-vinyl-record/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Mixonic Vinyl Audio Guidelines](https://www.mixonic.com/VinylAudioGuidelines.pdf) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `vinyl-side-sequencing-groove-budget-planner`. |
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
{"archetypeId":"vinyl-side-sequencing-groove-budget-planner","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
