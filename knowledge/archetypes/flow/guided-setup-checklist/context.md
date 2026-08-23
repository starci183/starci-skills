# Guided setup checklist

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `guided-setup-checklist` |
| Family | `flow` |
| Dominant task | Complete and verify a configuration through prerequisite-aware steps, instructions, verification, and unblock paths. |
| Search aliases | `verified setup guide`, `configuration checklist`, `setup step verifier` |
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
| `GSC-01` | Complete and verify a configuration through prerequisite-aware steps, instructions, verification, and unblock paths. | required positive |
| `GSC-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `GSC-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `GSC-90` | Reject application task lists or linear form wizards. | reject |
| `GSC-91` | Reject formal gated records, static instructions, or centered tasks. | reject |

### Selection rule

- Return `accept` only when `GSC-01` and `GSC-02` are evidenced and no 90–99 code is present.
- Return `reject` when `GSC-90` or `GSC-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
setup-guide
├─ setup-goal-and-prerequisites
├─ setup-step-list
├─ current-step-instructions
├─ verification-result
├─ unblock-help
└─ completion
```

- **Shared relationship:** Prerequisites gate reachable steps; the current instructions own the attempted setup action; verification, not self-declared completion, owns each completed status.
- `setup-guide -> setup-goal-and-prerequisites`: `setup-goal-and-prerequisites` consumes the named context or revision from `setup-guide` and exposes an explicit return or reconciliation path.
- `setup-goal-and-prerequisites -> setup-step-list`: `setup-step-list` consumes the named context or revision from `setup-goal-and-prerequisites` and exposes an explicit return or reconciliation path.
- `setup-step-list -> current-step-instructions`: `current-step-instructions` consumes the named context or revision from `setup-step-list` and exposes an explicit return or reconciliation path.
- `current-step-instructions -> verification-result`: `verification-result` consumes the named context or revision from `current-step-instructions` and exposes an explicit return or reconciliation path.
- `verification-result -> unblock-help`: `unblock-help` consumes the named context or revision from `verification-result` and exposes an explicit return or reconciliation path.
- `unblock-help -> completion`: `completion` consumes the named context or revision from `unblock-help` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `setup-guide` | Owns the complete setup guide transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `setup-goal-and-prerequisites` | Owns the setup goal and prerequisites orientation and immutable basis that qualifies every downstream decision. |
| `setup-step-list` | Owns the setup step list input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `current-step-instructions` | Owns the current step instructions input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `verification-result` | Owns the derived verification result state; it names its source revision and cannot contradict the input or evidence owners. |
| `unblock-help` | Owns the unblock help recovery route and preserves the exact state, trigger, and return position. |
| `completion` | Owns the completion commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** The step list and current instructions remain simultaneous while verification owns completion.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The step list becomes a compact summary while current instructions, Verify, and failure help stay together.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** The step list is an overview screen and the current step is a task screen with exact status return.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `setup-guide` → `setup-goal-and-prerequisites` → `setup-step-list` → `current-step-instructions` → `verification-result` → `unblock-help` → `completion`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `prerequisite missing` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `not started` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `current` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `completed` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `skipped` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `not applicable` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `verification pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `verification pass` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `verification fail` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `external dependency unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `stale verification` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `retry` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `permission unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `completion` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when completion is proven by verification rather than self-declared checkboxes.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject application task lists or linear form wizards.
- Reject formal gated records, static instructions, or centered tasks.
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
| [U.S. Web Design System — Process list](https://designsystem.digital.gov/components/process-list/) | A sequence can expose ordered stages and explanatory state. | It does not prove that a process is user-controlled. |
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context can orient a person without becoming arbitrary navigation. | It does not define process authority or responsive geometry. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Task status and progress controls require visible, operable state. | It does not define setup prerequisites or verification. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "guided-setup-checklist",
  "situationCodes": [
    "GSC-01",
    "GSC-02",
    "GSC-03"
  ],
  "searchAliases": [
    "verified setup guide",
    "configuration checklist",
    "setup step verifier"
  ],
  "dominantTask": "Complete and verify a configuration through prerequisite-aware steps, instructions, verification, and unblock paths.",
  "regions": [
    "setup-guide",
    "setup-goal-and-prerequisites",
    "setup-step-list",
    "current-step-instructions",
    "verification-result",
    "unblock-help",
    "completion"
  ],
  "regionRelationships": [
    "setup-guide -> setup-goal-and-prerequisites",
    "setup-goal-and-prerequisites -> setup-step-list",
    "setup-step-list -> current-step-instructions",
    "current-step-instructions -> verification-result",
    "verification-result -> unblock-help",
    "unblock-help -> completion"
  ],
  "responsive": {
    "wide": "The step list and current instructions remain simultaneous while verification owns completion.",
    "intermediate": "The step list becomes a compact summary while current instructions, Verify, and failure help stay together.",
    "compact": "The step list is an overview screen and the current step is a task screen with exact status return.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "setup-guide -> setup-goal-and-prerequisites -> setup-step-list -> current-step-instructions -> verification-result -> unblock-help -> completion",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "prerequisite missing",
    "not started",
    "current",
    "completed",
    "skipped",
    "not applicable",
    "verification pending",
    "verification pass",
    "verification fail",
    "external dependency unavailable",
    "stale verification",
    "retry",
    "permission unavailable",
    "completion"
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
