# Nonlinear task-list application

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `nonlinear-task-list-application` |
| Family | `flow` |
| Dominant task | Plan, complete, and resume multiple flexibly ordered tasks across sessions while respecting explicit dependencies. |
| Search aliases | `application task list`, `flexible section completion`, `multi-session task application` |
| Authority | Product-neutral macro topology and behavior contract. |

### Invariants

- The archetype owns only the dominant task, required regions, region relationships, responsive transformations, interaction parity, and state families.
- Grammar owns product nouns, semantic owners, domain rules, and state transitions.
- Principles own exact geometry, measure, gap, alignment, overflow values, and responsive thresholds.
- Direction owns visual character; the template is only one neutral conforming realization.
- Reading order, DOM order, and focus order retain one semantic sequence across every topology.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `NTA-01` | Plan, complete, and resume multiple flexibly ordered tasks across sessions while respecting explicit dependencies. | required positive |
| `NTA-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `NTA-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `NTA-90` | Reject a fixed linear sequence or an operations dashboard. | reject |
| `NTA-91` | Reject guided technical setup, settings hubs, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `NTA-01` and `NTA-02` are evidenced and no 90–99 code is present.
- Return `reject` when `NTA-90` or `NTA-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
task-application
├─ transaction-context
├─ overall-progress
├─ grouped-task-lists
├─ task-status-and-dependencies
├─ final-submit-readiness
└─ help
```

- **Shared relationship:** Each task name, status, and dependency form one semantic unit; overall progress derives from those units; final readiness derives only from required task outcomes.
- `task-application -> transaction-context`: `transaction-context` consumes the named context or revision from `task-application` and exposes an explicit return or reconciliation path.
- `transaction-context -> overall-progress`: `overall-progress` consumes the named context or revision from `transaction-context` and exposes an explicit return or reconciliation path.
- `overall-progress -> grouped-task-lists`: `grouped-task-lists` consumes the named context or revision from `overall-progress` and exposes an explicit return or reconciliation path.
- `grouped-task-lists -> task-status-and-dependencies`: `task-status-and-dependencies` consumes the named context or revision from `grouped-task-lists` and exposes an explicit return or reconciliation path.
- `task-status-and-dependencies -> final-submit-readiness`: `final-submit-readiness` consumes the named context or revision from `task-status-and-dependencies` and exposes an explicit return or reconciliation path.
- `final-submit-readiness -> help`: `help` consumes the named context or revision from `final-submit-readiness` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `task-application` | Owns the complete task application transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `transaction-context` | Owns the transaction context orientation and immutable basis that qualifies every downstream decision. |
| `overall-progress` | Owns the derived overall progress state; it names its source revision and cannot contradict the input or evidence owners. |
| `grouped-task-lists` | Owns the grouped task lists input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `task-status-and-dependencies` | Owns the derived task status and dependencies state; it names its source revision and cannot contradict the input or evidence owners. |
| `final-submit-readiness` | Owns the derived final submit readiness state; it names its source revision and cannot contradict the input or evidence owners. |
| `help` | Owns the help recovery route and preserves the exact state, trigger, and return position. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Grouped task lists keep each task name, hint, and status together in the primary content column.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Status may wrap below the task name but remains in the same semantic task unit.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** One column preserves group, task, status, locked reason, and next available task before readiness.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `task-application` → `transaction-context` → `overall-progress` → `grouped-task-lists` → `task-status-and-dependencies` → `final-submit-readiness` → `help`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `not started` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `in progress` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `completed` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `cannot start` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `not applicable` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `dependency locked` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `section stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `returning session` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `readiness blocked` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `submit pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `submit conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when required sections may be completed in more than one valid order across sessions.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject a fixed linear sequence or an operations dashboard.
- Reject guided technical setup, settings hubs, or centered tasks.
- Reject when the difference is only a product noun, card count, density, color, component, or state variation.

### Boundary verdict

- Default `needs-evidence`; `accept` is valid only under the executable selection rule above.

## Handoff

- **Grammar:** Supplies product actors, nouns, semantic owners, domain rules, eligibility, transitions, and consequences.
- **Principles:** Resolve exact grid, measure, gap, size, alignment, overflow, sticky offsets, and content-driven thresholds.
- **Direction:** Resolve visual character without changing topology or ownership.

## Non-binding research evidence

### Evidence boundary

The sources below are advisory comparison evidence. They are not product truth, do not select a Grammar owner, do not authorize copied geometry or component trees, and do not override Source authority.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [GOV.UK Design System — Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) | Flexible task completion exposes status and readiness across sessions. | It does not define product dependencies. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transactions preserve progress, review, and recovery. | It does not define a product workflow or fixed step count. |
| [NHS service manual — Check answers](https://service-manual.nhs.uk/design-system/patterns/check-answers) | Review preserves answer-to-change association before submission. | It does not define non-health product truth. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "nonlinear-task-list-application",
  "situationCodes": [
    "NTA-01",
    "NTA-02",
    "NTA-03"
  ],
  "searchAliases": [
    "application task list",
    "flexible section completion",
    "multi-session task application"
  ],
  "dominantTask": "Plan, complete, and resume multiple flexibly ordered tasks across sessions while respecting explicit dependencies.",
  "regions": [
    "task-application",
    "transaction-context",
    "overall-progress",
    "grouped-task-lists",
    "task-status-and-dependencies",
    "final-submit-readiness",
    "help"
  ],
  "regionRelationships": [
    "task-application -> transaction-context",
    "transaction-context -> overall-progress",
    "overall-progress -> grouped-task-lists",
    "grouped-task-lists -> task-status-and-dependencies",
    "task-status-and-dependencies -> final-submit-readiness",
    "final-submit-readiness -> help"
  ],
  "responsive": {
    "wide": "Grouped task lists keep each task name, hint, and status together in the primary content column.",
    "intermediate": "Status may wrap below the task name but remains in the same semantic task unit.",
    "compact": "One column preserves group, task, status, locked reason, and next available task before readiness.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "task-application -> transaction-context -> overall-progress -> grouped-task-lists -> task-status-and-dependencies -> final-submit-readiness -> help",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "not started",
    "in progress",
    "completed",
    "cannot start",
    "not applicable",
    "dependency locked",
    "section stale",
    "returning session",
    "readiness blocked",
    "submit pending",
    "submit conflict"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product actors and nouns",
    "semantic owners",
    "domain rules and transitions"
  ],
  "principlesHandoff": [
    "exact geometry and thresholds",
    "measure and spacing",
    "sticky offsets and overflow values"
  ],
  "confidence": "high",
  "evidence": [
    "dominant-task",
    "region-relationship",
    "responsive-failure",
    "state-family",
    "official-research"
  ]
}
```

Do not return a class, token, component, source path, fixed breakpoint, or invented product fact.
