# Motion capture skeleton retargeting workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `motion-capture-skeleton-retargeting-workbench` |
| Family | Work |
| Dominant task | Retarget a motion take from one source skeleton to a differently proportioned target by mapping joint hierarchies and axes, enforcing anatomical constraints and repairing contact errors before a reproducible bake. |
| Search aliases | motion retargeting, skeleton mapping, contact repair |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `retargeting-workbench` owns the complete dominant task, work state, and recovery boundary.
- Retarget a motion take from one source skeleton to a differently proportioned target by mapping joint hierarchies and axes, enforcing anatomical constraints and repairing contact errors before a reproducible bake.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `MOC-01` | Retarget a motion take from one source skeleton to a differently proportioned target by mapping joint hierarchies and axes, enforcing anatomical constraints and repairing contact errors before a reproducible bake. | Required positive evidence. |
| `MOC-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `MOC-03` | Template must map one ambiguous source-target joint, expose an axis or rest-pose mismatch, show a measurable foot-slide or penetration interval, correct it through numeric and keyboard-operable controls, rerun the contact proof and export a baked motion whose source, target and mapping versions are recorded. | Require the domain-specific proof path. |
| `MOC-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `MOC-05` | Task-specific states: take loaded/missing, skeleton characterized/incomplete, rest pose matched/diverged, joint mapped/unmapped/ambiguous, axis valid/flipped, root motion preserved/rebased, constraint within/exceeded, contact planted/sliding/penetrating, correction draft/accepted, bake queued/failed/complete and regression pass/fail. | Require state and recovery coverage. |
| `MOC-90` | Reject cho `canvas-inspector-studio`, `multi-track-timeline-editor`, `finite-element-mesh-convergence-workbench` or `media-annotation-workbench`; two explicit skeleton hierarchies, joint/axis correspondence, rest-pose and proportion compensation, anatomical constraints, contact-error metrics and reproducible rebaking are mandatory. | Reject. |
| `MOC-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `MOC-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `motion-capture-skeleton-retargeting-workbench` if and only if `MOC-01`–`05` are evidenced and none of `MOC-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
retargeting-workbench
├─ source-motion-take-and-target-character-version (downstream)
├─ source-skeleton-hierarchy-and-rest-pose (downstream)
├─ target-skeleton-hierarchy-and-rest-pose (peer synchronization)
├─ joint-correspondence-and-axis-map (downstream)
├─ scale-proportion-root-motion-and-action-space-compensation (downstream)
├─ joint-limit-twist-and-reach-constraints (downstream)
├─ contact-foot-slide-and-penetration-error-profiles (downstream)
├─ correction-pass-and-before-after-motion (downstream)
└─ bake-export-and-regression-proof (downstream)
```

The binding relationship expression is `retargeting-workbench → source-motion-take-and-target-character-version → source-skeleton-hierarchy-and-rest-pose ↔ target-skeleton-hierarchy-and-rest-pose → joint-correspondence-and-axis-map → scale-proportion-root-motion-and-action-space-compensation → joint-limit-twist-and-reach-constraints → contact-foot-slide-and-penetration-error-profiles → correction-pass-and-before-after-motion → bake-export-and-regression-proof`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `retargeting-workbench` | retargeting-workbench owns its evidence and state and the dominant-task boundary and passes stable identity to `source-motion-take-and-target-character-version`. It does not absorb another region's owner. |
| `source-motion-take-and-target-character-version` | source-motion-take-and-target-character-version owns its evidence and state; it preserves the → relationship from upstream `retargeting-workbench` and passes stable identity to `source-skeleton-hierarchy-and-rest-pose`. It does not absorb another region's owner. |
| `source-skeleton-hierarchy-and-rest-pose` | source-skeleton-hierarchy-and-rest-pose owns its evidence and state; it preserves the → relationship from upstream `source-motion-take-and-target-character-version` and passes stable identity to `target-skeleton-hierarchy-and-rest-pose`. It does not absorb another region's owner. |
| `target-skeleton-hierarchy-and-rest-pose` | target-skeleton-hierarchy-and-rest-pose owns its evidence and state; it preserves the ↔ relationship from upstream `source-skeleton-hierarchy-and-rest-pose` and passes stable identity to `joint-correspondence-and-axis-map`. It does not absorb another region's owner. |
| `joint-correspondence-and-axis-map` | joint-correspondence-and-axis-map owns its evidence and state; it preserves the → relationship from upstream `target-skeleton-hierarchy-and-rest-pose` and passes stable identity to `scale-proportion-root-motion-and-action-space-compensation`. It does not absorb another region's owner. |
| `scale-proportion-root-motion-and-action-space-compensation` | scale-proportion-root-motion-and-action-space-compensation owns its evidence and state; it preserves the → relationship from upstream `joint-correspondence-and-axis-map` and passes stable identity to `joint-limit-twist-and-reach-constraints`. It does not absorb another region's owner. |
| `joint-limit-twist-and-reach-constraints` | joint-limit-twist-and-reach-constraints owns its evidence and state; it preserves the → relationship from upstream `scale-proportion-root-motion-and-action-space-compensation` and passes stable identity to `contact-foot-slide-and-penetration-error-profiles`. It does not absorb another region's owner. |
| `contact-foot-slide-and-penetration-error-profiles` | contact-foot-slide-and-penetration-error-profiles owns its evidence and state; it preserves the → relationship from upstream `joint-limit-twist-and-reach-constraints` and passes stable identity to `correction-pass-and-before-after-motion`. It does not absorb another region's owner. |
| `correction-pass-and-before-after-motion` | correction-pass-and-before-after-motion owns its evidence and state; it preserves the → relationship from upstream `contact-foot-slide-and-penetration-error-profiles` and passes stable identity to `bake-export-and-regression-proof`. It does not absorb another region's owner. |
| `bake-export-and-regression-proof` | bake-export-and-regression-proof owns its evidence and state; it preserves the → relationship from upstream `correction-pass-and-before-after-motion` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Source and target hierarchies, correspondence map, synchronized motion, joint constraints, contact-error profile and before/after proof remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active source-target joint pair and error interval remain primary; full hierarchies, 3D preview and export settings move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Error interval → implicated target joint → mapped source joint and axes → rest-pose/proportion compensation → constraint correction → contact rerun → before/after metrics → bake; hierarchy trees and numeric transform lists replace an obligatory canvas.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `retargeting-workbench → source-motion-take-and-target-character-version → source-skeleton-hierarchy-and-rest-pose ↔ target-skeleton-hierarchy-and-rest-pose → joint-correspondence-and-axis-map → scale-proportion-root-motion-and-action-space-compensation → joint-limit-twist-and-reach-constraints → contact-foot-slide-and-penetration-error-profiles → correction-pass-and-before-after-motion → bake-export-and-regression-proof`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: take loaded/missing, skeleton characterized/incomplete, rest pose matched/diverged, joint mapped/unmapped/ambiguous, axis valid/flipped, root motion preserved/rebased, constraint within/exceeded, contact planted/sliding/penetrating, correction draft/accepted, bake queued/failed/complete and regression pass/fail.

## State obligations

Task-specific states: take loaded/missing, skeleton characterized/incomplete, rest pose matched/diverged, joint mapped/unmapped/ambiguous, axis valid/flipped, root motion preserved/rebased, constraint within/exceeded, contact planted/sliding/penetrating, correction draft/accepted, bake queued/failed/complete and regression pass/fail.

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

- Template must map one ambiguous source-target joint, expose an axis or rest-pose mismatch, show a measurable foot-slide or penetration interval, correct it through numeric and keyboard-operable controls, rerun the contact proof and export a baked motion whose source, target and mapping versions are recorded.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `canvas-inspector-studio`, `multi-track-timeline-editor`, `finite-element-mesh-convergence-workbench` or `media-annotation-workbench`; two explicit skeleton hierarchies, joint/axis correspondence, rest-pose and proportion compensation, anatomical constraints, contact-error metrics and reproducible rebaking are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `MOC-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Autodesk MotionBuilder retargeting guidance](https://help.autodesk.com/cloudhelp/2026/ENU/MotionBuilder-Reference/files/Character-Settings-Reference/GUID-877F937B-21C2-472F-AA43-0099DBF08B75.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Khronos glTF 2.0 skin and animation specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `motion-capture-skeleton-retargeting-workbench`. |
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
{"archetypeId":"motion-capture-skeleton-retargeting-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
