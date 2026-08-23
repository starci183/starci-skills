# Archaeological stratigraphic phasing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `archaeological-stratigraphic-phasing-workbench` |
| Family | Work |
| Dominant task | Build and defend an archaeological stratigraphic sequence from recorded physical interfaces, detect impossible relationships and group validated contexts into interpretive phases without erasing primary observations. |
| Search aliases | Harris matrix, stratigraphic phasing, context sequence |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `stratigraphic-phasing` owns the complete dominant task, work state, and recovery boundary.
- Build and defend an archaeological stratigraphic sequence from recorded physical interfaces, detect impossible relationships and group validated contexts into interpretive phases without erasing primary observations.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `STR-01` | Build and defend an archaeological stratigraphic sequence from recorded physical interfaces, detect impossible relationships and group validated contexts into interpretive phases without erasing primary observations. | Required positive evidence. |
| `STR-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `STR-03` | Template must add one direct stratigraphic relation from section evidence, reveal a cycle caused by a contradictory edge, offer keyboard and button alternatives to graph dragging, remove or reject the bad edge, apply a dating terminus, propose a phase and export the reviewed acyclic sequence. | Require the domain-specific proof path. |
| `STR-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `STR-05` | Task-specific states: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked. | Require state and recovery coverage. |
| `STR-90` | Reject cho `critical-path-schedule-workbench`, `dependency-topology-monitor`, a generic knowledge graph or causal-root explorer; archaeological contexts, observed physical interfaces, direct earlier/later edges, Harris acyclicity, terminus evidence and interpretation-separated phase grouping are mandatory. | Reject. |
| `STR-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `STR-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `archaeological-stratigraphic-phasing-workbench` if and only if `STR-01`–`05` are evidenced and none of `STR-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
stratigraphic-phasing
├─ excavation-area-recording-version (downstream)
├─ context-register-and-type (downstream)
├─ physical-interface-and-section-evidence (downstream)
├─ direct-earlier-later-relationship-ledger (downstream)
├─ Harris-directed-acyclic-graph (downstream)
├─ contradiction-cycle-and-redundancy-queue (peer synchronization)
├─ dating-finds-and-terminus-evidence (downstream)
├─ phase-grouping-and-interpretive-event-model (downstream)
└─ reviewed-sequence-and-archive-export (downstream)
```

The binding relationship expression is `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `stratigraphic-phasing` | stratigraphic-phasing owns its evidence and state and the dominant-task boundary and passes stable identity to `excavation-area-recording-version`. It does not absorb another region's owner. |
| `excavation-area-recording-version` | excavation-area-recording-version owns its evidence and state; it preserves the → relationship from upstream `stratigraphic-phasing` and passes stable identity to `context-register-and-type`. It does not absorb another region's owner. |
| `context-register-and-type` | context-register-and-type owns its evidence and state; it preserves the → relationship from upstream `excavation-area-recording-version` and passes stable identity to `physical-interface-and-section-evidence`. It does not absorb another region's owner. |
| `physical-interface-and-section-evidence` | physical-interface-and-section-evidence owns its evidence and state; it preserves the → relationship from upstream `context-register-and-type` and passes stable identity to `direct-earlier-later-relationship-ledger`. It does not absorb another region's owner. |
| `direct-earlier-later-relationship-ledger` | direct-earlier-later-relationship-ledger owns its evidence and state; it preserves the → relationship from upstream `physical-interface-and-section-evidence` and passes stable identity to `Harris-directed-acyclic-graph`. It does not absorb another region's owner. |
| `Harris-directed-acyclic-graph` | Harris-directed-acyclic-graph owns its evidence and state; it preserves the → relationship from upstream `direct-earlier-later-relationship-ledger` and passes stable identity to `contradiction-cycle-and-redundancy-queue`. It does not absorb another region's owner. |
| `contradiction-cycle-and-redundancy-queue` | contradiction-cycle-and-redundancy-queue owns its evidence and state; it preserves the ↔ relationship from upstream `Harris-directed-acyclic-graph` and passes stable identity to `dating-finds-and-terminus-evidence`. It does not absorb another region's owner. |
| `dating-finds-and-terminus-evidence` | dating-finds-and-terminus-evidence owns its evidence and state; it preserves the → relationship from upstream `contradiction-cycle-and-redundancy-queue` and passes stable identity to `phase-grouping-and-interpretive-event-model`. It does not absorb another region's owner. |
| `phase-grouping-and-interpretive-event-model` | phase-grouping-and-interpretive-event-model owns its evidence and state; it preserves the → relationship from upstream `dating-finds-and-terminus-evidence` and passes stable identity to `reviewed-sequence-and-archive-export`. It does not absorb another region's owner. |
| `reviewed-sequence-and-archive-export` | reviewed-sequence-and-archive-export owns its evidence and state; it preserves the → relationship from upstream `phase-grouping-and-interpretive-event-model` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Context register, section/interface evidence, Harris graph, selected relationship ledger, contradiction queue and phase interpretation remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The selected context neighborhood and direct relationship evidence remain primary; full graph, dating evidence and phase groups become synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Context → recorded physical interface → direct earlier/later relation → local predecessor/successor chain → contradiction or redundancy → dating bound → phase proposal → review; a semantic relation list replaces the full graph.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked.

## State obligations

Task-specific states: context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked.

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

- Template must add one direct stratigraphic relation from section evidence, reveal a cycle caused by a contradictory edge, offer keyboard and button alternatives to graph dragging, remove or reject the bad edge, apply a dating terminus, propose a phase and export the reviewed acyclic sequence.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `critical-path-schedule-workbench`, `dependency-topology-monitor`, a generic knowledge graph or causal-root explorer; archaeological contexts, observed physical interfaces, direct earlier/later edges, Harris acyclicity, terminus evidence and interpretation-separated phase grouping are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `STR-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Historic England Archaeological Recording Manual](https://historicengland.org.uk/content/docs/research/historic-england-archaeological-recording-manual-2018) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Archaeology Data Service files and metadata guidance](https://archaeologydataservice.ac.uk/help-guidance/instructions-for-depositors/files-and-metadata/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `archaeological-stratigraphic-phasing-workbench`. |
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
{"archetypeId":"archaeological-stratigraphic-phasing-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
