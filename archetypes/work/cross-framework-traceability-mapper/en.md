# Cross-framework traceability mapper

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | cross-framework-traceability-mapper |
| Family | work |
| Dominant task | Create and approve auditable many-to-many relations between two control, requirement, or standards frameworks. |
| Search aliases | cross-framework-traceability-mapper; framework crosswalk; control mapping; many-to-many traceability |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Create and approve auditable many-to-many relations between two control, requirement, or standards frameworks.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CFT-01 | Create and approve auditable many-to-many relations between two control, requirement, or standards frameworks. | required positive evidence |
| AR-CFT-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-CFT-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-CFT-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-CFT-90 | Reject import mapping, row transformation, comparison matrices, knowledge graphs, taxonomy editors, and reconciliation diffs. | reject |
| AR-CFT-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CFT-01, AR-CFT-02, and AR-CFT-03 are evidenced, neither AR-CFT-90 nor AR-CFT-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
traceability-mapper
├─ framework-a-tree
├─ mapping-workspace
├─ framework-b-tree
├─ relation-evidence-inspector
├─ coverage-gap-summary
└─ mapping-approval
~~~

Critical relationship: Both versioned framework hierarchies and typed relation evidence are independent owners; coverage is derived only from approved mappings.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| traceability-mapper | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains framework-a-tree, mapping-workspace, framework-b-tree, relation-evidence-inspector, coverage-gap-summary, mapping-approval while preserving each region's independent owner. |
| framework-a-tree | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from traceability-mapper and gates mapping-workspace without merging authority. |
| mapping-workspace | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from framework-a-tree and gates framework-b-tree without merging authority. |
| framework-b-tree | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from mapping-workspace and gates relation-evidence-inspector without merging authority. |
| relation-evidence-inspector | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from framework-b-tree and gates coverage-gap-summary without merging authority. |
| coverage-gap-summary | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from relation-evidence-inspector and gates mapping-approval without merging authority. |
| mapping-approval | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from coverage-gap-summary and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep both framework trees, the mapping workspace, selected relation evidence, and coverage simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Keep one tree visible; open the target picker and evidence in a sheet while coverage persists.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage one source control, candidate targets, relation type and evidence, coverage result, then approval; never squeeze dual hierarchies.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show consistent fictional data and the current selection. | Focus remains at the activating control. | Preserve selection through transformation. |
| empty/not-applicable | Explain why content is empty and the valid next step. | Move to recovery only when continuation requires it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error focuses the summary; retry returns to the exact action. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Preserve the complete domain catalog: framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject import mapping, row transformation, comparison matrices, knowledge graphs, taxonomy editors, and reconciliation diffs. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

### Boundary verdict

The valid result is accept, reject, duplicate-or-variation, or needs-evidence under the Situation-code rule; visual preference is not evidence.

## Handoff

- Grammar receives real facts, semantic owners, permissions, states, and action consequences.
- Principles receives exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets, and focus accommodation.
- Direction receives visual character; the template is only one conforming realization.

## Non-binding research evidence

### Evidence boundary

The official sources below are advisory evidence. They are not product truth, do not imply that a source organization names this synthesized archetype, and do not authorize copying geometry, component trees, nouns, or breakpoints.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [NIST — IR 8477 concept mappings](https://csrc.nist.gov/pubs/ir/8477/final) | Supports typed mappings, degrees of relationship, and mapping evidence. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [SAP Fiori — Floorplan overview](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Supports choosing task-specific floorplans without copying their geometry. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports keyboard semantics for versioned hierarchical choices. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "cross-framework-traceability-mapper",
  "matchedSituationCodes": [
    "AR-CFT-01",
    "AR-CFT-02",
    "AR-CFT-03"
  ],
  "aliases": [
    "cross-framework-traceability-mapper",
    "framework crosswalk",
    "control mapping",
    "many-to-many traceability"
  ],
  "dominantTask": "Create and approve auditable many-to-many relations between two control, requirement, or standards frameworks.",
  "regions": [
    "traceability-mapper",
    "framework-a-tree",
    "mapping-workspace",
    "framework-b-tree",
    "relation-evidence-inspector",
    "coverage-gap-summary",
    "mapping-approval"
  ],
  "relationships": [
    "Both versioned framework hierarchies and typed relation evidence are independent owners; coverage is derived only from approved mappings."
  ],
  "responsive": {
    "wide": "Keep both framework trees, the mapping workspace, selected relation evidence, and coverage simultaneously visible.",
    "intermediate": "Keep one tree visible; open the target picker and evidence in a sheet while coverage persists.",
    "compact": "Stage one source control, candidate targets, relation type and evidence, coverage result, then approval; never squeeze dual hierarchies.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "traceability-mapper → framework-a-tree → mapping-workspace → framework-b-tree → relation-evidence-inspector → coverage-gap-summary → mapping-approval",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition",
    "framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.

