# Critical path project planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `critical-path-project-planner` |
| Family | Work |
| Dominant task | Author task dependencies and durations, calculate float, and adjust a schedule until milestone feasibility is acceptable. |
| Search aliases | `critical path planner`, `dependency schedule`, `float analysis` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Author task dependencies and durations, calculate float, and adjust a schedule until milestone feasibility is acceptable.
- The task hierarchy and dependency-time graph share task identity while float analysis owns feasibility.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CPP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-CPP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-CPP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-CPP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-CPP-90` | The dominant task is actually status timeline. | Reject. |
| `AR-CPP-91` | The dominant task is actually calendar resource scheduler. | Reject. |
| `AR-CPP-92` | The dominant task is actually kanban. | Reject. |
| `AR-CPP-93` | The dominant task is actually prerequisite pathway. | Reject. |

### Selection rule

Select `critical-path-project-planner` if and only if `AR-CPP-01` through `AR-CPP-04` are evidenced and none of `AR-CPP-90` through `AR-CPP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
critical-path-planner -> project-milestones -> task-hierarchy-grid -> dependency-time-graph -> critical-path-float-analysis -> scenario-changes -> baseline-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `critical-path-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `project-milestones` | Owns Project Milestones evidence or action and preserves its declared relationship to the current selection. |
| `task-hierarchy-grid` | Owns Task Hierarchy Grid evidence or action and preserves its declared relationship to the current selection. |
| `dependency-time-graph` | Owns Dependency Time Graph evidence or action and preserves its declared relationship to the current selection. |
| `critical-path-float-analysis` | Owns Critical Path Float Analysis evidence or action and preserves its declared relationship to the current selection. |
| `scenario-changes` | Owns Scenario Changes evidence or action and preserves its declared relationship to the current selection. |
| `baseline-commit` | Owns Baseline Commit evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** The synchronized task grid and dependency timeline remain visible with critical-path evidence.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `task-hierarchy-grid` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** One representation becomes primary and the other a synchronized detail pane.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `task-hierarchy-grid` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Milestone and task list → dependency chain → task editor → float and milestone impact → baseline review; no miniature Gantt.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `task-hierarchy-grid` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `critical-path-planner -> project-milestones -> task-hierarchy-grid -> dependency-time-graph -> critical-path-float-analysis -> scenario-changes -> baseline-commit`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: task loading, duration unknown, dependency valid, dependency cyclic, critical, noncritical, float positive, float zero, float negative, milestone feasible, milestone missed, scenario dirty, baseline commit, baseline conflict.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `project-milestones` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `task-hierarchy-grid` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `task-hierarchy-grid` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `scenario-changes` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `baseline-commit` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `baseline-commit` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `baseline-commit` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `project-milestones` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `baseline-commit` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `critical-path-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Author task dependencies and durations, calculate float, and adjust a schedule until milestone feasibility is acceptable.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject status timeline; this is `AR-CPP-90` evidence and must route to an adjacent archetype.
- Reject calendar resource scheduler; this is `AR-CPP-91` evidence and must route to an adjacent archetype.
- Reject kanban; this is `AR-CPP-92` evidence and must route to an adjacent archetype.
- Reject prerequisite pathway; this is `AR-CPP-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [PMI — Critical path schedule](https://www.pmi.org/learning/library/2019/04/07/15/30/moving-work-breakdown-structure-critical-path-6978) | Dependencies, activity duration, float, and critical-path calculation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Atlassian — Manage dependencies](https://support.atlassian.com/jira-software-cloud/docs/view-and-manage-dependencies-in-advanced-roadmaps/) | Authoring and reviewing cross-task dependencies. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "critical-path-project-planner",
  "situationCodes": ["<matched AR-CPP-* codes>"],
  "searchAliases": ["critical path planner","dependency schedule","float analysis"],
  "dominantTask": "Author task dependencies and durations, calculate float, and adjust a schedule until milestone feasibility is acceptable.",
  "regions": ["critical-path-planner","project-milestones","task-hierarchy-grid","dependency-time-graph","critical-path-float-analysis","scenario-changes","baseline-commit"],
  "regionRelationships": ["The task hierarchy and dependency-time graph share task identity while float analysis owns feasibility."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "critical-path-planner -> project-milestones -> task-hierarchy-grid -> dependency-time-graph -> critical-path-float-analysis -> scenario-changes -> baseline-commit",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "task-hierarchy-grid",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["task loading","duration unknown","dependency valid","dependency cyclic","critical","noncritical","float positive","float zero","float negative","milestone feasible","milestone missed","scenario dirty","baseline commit","baseline conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

