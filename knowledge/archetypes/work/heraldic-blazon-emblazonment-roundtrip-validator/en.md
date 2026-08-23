# Heraldic blazon emblazonment roundtrip validator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `heraldic-blazon-emblazonment-roundtrip-validator` |
| Family | Work |
| Dominant task | Validate that a jurisdictionally normalized heraldic blazon and its emblazonment express the same arms by resolving clause semantics into a scene, recapturing that scene and explaining every roundtrip difference. |
| Search aliases | blazon validator, emblazonment roundtrip, heraldic recapture |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `heraldic-roundtrip` owns the complete dominant task, work state, and recovery boundary.
- Validate that a jurisdictionally normalized heraldic blazon and its emblazonment express the same arms by resolving clause semantics into a scene, recapturing that scene and explaining every roundtrip difference.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `HER-01` | Validate that a jurisdictionally normalized heraldic blazon and its emblazonment express the same arms by resolving clause semantics into a scene, recapturing that scene and explaining every roundtrip difference. | Required positive evidence. |
| `HER-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `HER-03` | Template must parse one blazon clause, map it to a labeled charge relationship, expose the same structure without the image, recapture a deliberately wrong tincture or position, explain the rule and semantic delta, correct it without dragging and approve an equivalent register proof. | Require the domain-specific proof path. |
| `HER-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `HER-05` | Task-specific states: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned. | Require state and recovery coverage. |
| `HER-90` | Reject cho `canvas-inspector-workspace`, `media-annotation-review-console`, `reconciliation-diff-workbench` or a generic illustration editor; jurisdictional grant authority, normalized blazon semantics, deterministic semantic scene, accessible structural recapture and heraldic rule equivalence are mandatory. | Reject. |
| `HER-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `HER-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `heraldic-blazon-emblazonment-roundtrip-validator` if and only if `HER-01`–`05` are evidenced and none of `HER-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
heraldic-roundtrip
├─ jurisdiction-grant-and-register-authority (downstream)
├─ normalized-blazon-clause-tree (downstream)
├─ tincture-ordinary-charge-attitude-and-marshalling-semantics (downstream)
├─ deterministic-emblazonment-scene-graph (downstream)
├─ accessible-structural-description (peer synchronization)
├─ visual-to-semantic-recapture (downstream)
├─ tincture-rule-positional-and-difference-mark-validation (downstream)
├─ blazon-vs-recaptured-roundtrip-delta (downstream)
└─ herald-review-and-register-proof (downstream)
```

The binding relationship expression is `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `heraldic-roundtrip` | heraldic-roundtrip owns its evidence and state and the dominant-task boundary and passes stable identity to `jurisdiction-grant-and-register-authority`. It does not absorb another region's owner. |
| `jurisdiction-grant-and-register-authority` | jurisdiction-grant-and-register-authority owns its evidence and state; it preserves the → relationship from upstream `heraldic-roundtrip` and passes stable identity to `normalized-blazon-clause-tree`. It does not absorb another region's owner. |
| `normalized-blazon-clause-tree` | normalized-blazon-clause-tree owns its evidence and state; it preserves the → relationship from upstream `jurisdiction-grant-and-register-authority` and passes stable identity to `tincture-ordinary-charge-attitude-and-marshalling-semantics`. It does not absorb another region's owner. |
| `tincture-ordinary-charge-attitude-and-marshalling-semantics` | tincture-ordinary-charge-attitude-and-marshalling-semantics owns its evidence and state; it preserves the → relationship from upstream `normalized-blazon-clause-tree` and passes stable identity to `deterministic-emblazonment-scene-graph`. It does not absorb another region's owner. |
| `deterministic-emblazonment-scene-graph` | deterministic-emblazonment-scene-graph owns its evidence and state; it preserves the → relationship from upstream `tincture-ordinary-charge-attitude-and-marshalling-semantics` and passes stable identity to `accessible-structural-description`. It does not absorb another region's owner. |
| `accessible-structural-description` | accessible-structural-description owns its evidence and state; it preserves the ↔ relationship from upstream `deterministic-emblazonment-scene-graph` and passes stable identity to `visual-to-semantic-recapture`. It does not absorb another region's owner. |
| `visual-to-semantic-recapture` | visual-to-semantic-recapture owns its evidence and state; it preserves the → relationship from upstream `accessible-structural-description` and passes stable identity to `tincture-rule-positional-and-difference-mark-validation`. It does not absorb another region's owner. |
| `tincture-rule-positional-and-difference-mark-validation` | tincture-rule-positional-and-difference-mark-validation owns its evidence and state; it preserves the → relationship from upstream `visual-to-semantic-recapture` and passes stable identity to `blazon-vs-recaptured-roundtrip-delta`. It does not absorb another region's owner. |
| `blazon-vs-recaptured-roundtrip-delta` | blazon-vs-recaptured-roundtrip-delta owns its evidence and state; it preserves the → relationship from upstream `tincture-rule-positional-and-difference-mark-validation` and passes stable identity to `herald-review-and-register-proof`. It does not absorb another region's owner. |
| `herald-review-and-register-proof` | herald-review-and-register-proof owns its evidence and state; it preserves the → relationship from upstream `blazon-vs-recaptured-roundtrip-delta` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Blazon clause tree, semantic armorial scene, emblazonment, accessible description, recaptured semantics and rule/delta ledger remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active clause-to-scene relationship and roundtrip delta remain primary; full rendering, register context and validation history move to synchronized panels.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Grant and clause → resolved tincture/ordinary/charge relation → accessible structural description → recaptured clause → heraldic rule check → roundtrip delta → accept or correct; the image is supportive and never the only carrier of structure.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned.

## State obligations

Task-specific states: grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned.

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

- Template must parse one blazon clause, map it to a labeled charge relationship, expose the same structure without the image, recapture a deliberately wrong tincture or position, explain the rule and semantic delta, correct it without dragging and approve an equivalent register proof.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `canvas-inspector-workspace`, `media-annotation-review-console`, `reconciliation-diff-workbench` or a generic illustration editor; jurisdictional grant authority, normalized blazon semantics, deterministic semantic scene, accessible structural recapture and heraldic rule equivalence are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `HER-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [College of Arms official guidance and records](https://www.college-of-arms.gov.uk/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Canadian Heraldic Authority Public Register](https://www.gg.ca/en/heraldry/public-register/project/1698) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `heraldic-blazon-emblazonment-roundtrip-validator`. |
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
{"archetypeId":"heraldic-blazon-emblazonment-roundtrip-validator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
