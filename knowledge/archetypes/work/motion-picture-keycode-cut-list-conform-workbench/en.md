# Motion picture keycode cut list conform workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `motion-picture-keycode-cut-list-conform-workbench` |
| Family | Work |
| Dominant task | Match a picture edit back to motion-picture film stock by translating each edit event's timecode into edge-number frame ranges, generating physical cut and change lists and proving frame-continuous conform order. |
| Search aliases | KEYKODE matchback, film cut list, physical conform |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `film-conform` owns the complete dominant task, work state, and recovery boundary.
- Match a picture edit back to motion-picture film stock by translating each edit event's timecode into edge-number frame ranges, generating physical cut and change lists and proving frame-continuous conform order.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `KEY-01` | Match a picture edit back to motion-picture film stock by translating each edit event's timecode into edge-number frame ranges, generating physical cut and change lists and proving frame-continuous conform order. | Required positive evidence. |
| `KEY-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `KEY-03` | Template must select one edit event, match its source timecode to roll and keycode frames, reveal a one-perforation slip or insufficient handle, regenerate the affected cut/change instruction, verify continuity against adjacent events and issue a versioned conform receipt. | Require the domain-specific proof path. |
| `KEY-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `KEY-05` | Task-specific states: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned. | Require state and recovery coverage. |
| `KEY-90` | Reject cho `multi-track-timeline-editor`, `reconciliation-diff-workbench`, `data-import-mapping-pipeline` or `print-signature-imposition-planner`; film gauge/perforation/frame-rate authority, timecode-to-edge-number correlation, roll-level cut instructions, handles/dupes/opticals and frame-continuous physical assembly are mandatory. | Reject. |
| `KEY-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `KEY-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `motion-picture-keycode-cut-list-conform-workbench` if and only if `KEY-01`–`05` are evidenced and none of `KEY-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
film-conform
├─ project-gauge-perforation-frame-rate-and-edit-version (downstream)
├─ source-roll-reel-keycode-and-timecode-correlation (downstream)
├─ edit-event-decision-list (downstream)
├─ event-to-keycode-frame-range-matchback (downstream)
├─ cut-list-change-list-and-optical-blocks (downstream)
├─ dupe-handle-perf-slip-and-missing-keycode-ledger (downstream)
├─ physical-negative-or-di-assembly-order (downstream)
├─ frame-count-continuity-and-conform-reconciliation (downstream)
└─ approved-list-and-conform-receipt (downstream)
```

The binding relationship expression is `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `film-conform` | film-conform owns its evidence and state and the dominant-task boundary and passes stable identity to `project-gauge-perforation-frame-rate-and-edit-version`. It does not absorb another region's owner. |
| `project-gauge-perforation-frame-rate-and-edit-version` | project-gauge-perforation-frame-rate-and-edit-version owns its evidence and state; it preserves the → relationship from upstream `film-conform` and passes stable identity to `source-roll-reel-keycode-and-timecode-correlation`. It does not absorb another region's owner. |
| `source-roll-reel-keycode-and-timecode-correlation` | source-roll-reel-keycode-and-timecode-correlation owns its evidence and state; it preserves the → relationship from upstream `project-gauge-perforation-frame-rate-and-edit-version` and passes stable identity to `edit-event-decision-list`. It does not absorb another region's owner. |
| `edit-event-decision-list` | edit-event-decision-list owns its evidence and state; it preserves the → relationship from upstream `source-roll-reel-keycode-and-timecode-correlation` and passes stable identity to `event-to-keycode-frame-range-matchback`. It does not absorb another region's owner. |
| `event-to-keycode-frame-range-matchback` | event-to-keycode-frame-range-matchback owns its evidence and state; it preserves the → relationship from upstream `edit-event-decision-list` and passes stable identity to `cut-list-change-list-and-optical-blocks`. It does not absorb another region's owner. |
| `cut-list-change-list-and-optical-blocks` | cut-list-change-list-and-optical-blocks owns its evidence and state; it preserves the → relationship from upstream `event-to-keycode-frame-range-matchback` and passes stable identity to `dupe-handle-perf-slip-and-missing-keycode-ledger`. It does not absorb another region's owner. |
| `dupe-handle-perf-slip-and-missing-keycode-ledger` | dupe-handle-perf-slip-and-missing-keycode-ledger owns its evidence and state; it preserves the → relationship from upstream `cut-list-change-list-and-optical-blocks` and passes stable identity to `physical-negative-or-di-assembly-order`. It does not absorb another region's owner. |
| `physical-negative-or-di-assembly-order` | physical-negative-or-di-assembly-order owns its evidence and state; it preserves the → relationship from upstream `dupe-handle-perf-slip-and-missing-keycode-ledger` and passes stable identity to `frame-count-continuity-and-conform-reconciliation`. It does not absorb another region's owner. |
| `frame-count-continuity-and-conform-reconciliation` | frame-count-continuity-and-conform-reconciliation owns its evidence and state; it preserves the → relationship from upstream `physical-negative-or-di-assembly-order` and passes stable identity to `approved-list-and-conform-receipt`. It does not absorb another region's owner. |
| `approved-list-and-conform-receipt` | approved-list-and-conform-receipt owns its evidence and state; it preserves the → relationship from upstream `frame-count-continuity-and-conform-reconciliation` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Edit events, roll/reel correlation, keycode ranges, cut/change lists, physical assembly order and continuity exceptions remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected edit event and timecode-to-keycode matchback remain primary; full reel map, optical blocks and conform history move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Edit event → source timecode → roll/reel and keycode frame range → cut/optical/handle instruction → physical assembly position → frame-continuity verification → approve or correct; no waveform or freeform timeline is required.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned.

## State obligations

Task-specific states: edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned.

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

- Template must select one edit event, match its source timecode to roll and keycode frames, reveal a one-perforation slip or insufficient handle, regenerate the affected cut/change instruction, verify continuity against adjacent events and issue a versioned conform receipt.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `multi-track-timeline-editor`, `reconciliation-diff-workbench`, `data-import-mapping-pipeline` or `print-signature-imposition-planner`; film gauge/perforation/frame-rate authority, timecode-to-edge-number correlation, roll-level cut instructions, handles/dupes/opticals and frame-continuous physical assembly are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `KEY-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Kodak KEYKODE edge-number guidance](https://www.kodak.com/en/motion/page/keykode-numbers/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Avid FilmScribe User's Guide](https://resources.avid.com/SupportFiles/attach/FilmScr_UG_10_2.pdf) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `motion-picture-keycode-cut-list-conform-workbench`. |
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
{"archetypeId":"motion-picture-keycode-cut-list-conform-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
