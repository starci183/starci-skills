# Linear multi-step application

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `linear-multi-step-application` |
| Family | `flow` |
| Dominant task | Complete a long application with a stable section order while preserving progress, drafts, and return paths. |
| Search aliases | `linear application`, `fixed-step form`, `chaptered application` |
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
| `LMA-01` | Complete a long application with a stable section order while preserving progress, drafts, and return paths. | required positive |
| `LMA-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `LMA-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `LMA-90` | Reject flexible-order task completion and flows shorter than three sections. | reject |
| `LMA-91` | Reject quizzes, centered tasks, or a multi-session task list. | reject |

### Selection rule

- Return `accept` only when `LMA-01` and `LMA-02` are evidenced and no 90–99 code is present.
- Return `reject` when `LMA-90` or `LMA-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
linear-application
├─ application-context
├─ step-progress
├─ current-section
├─ question-sequence
├─ back-save-continue-actions
└─ persistent-help
```

- **Shared relationship:** The step indicator reports fixed chapters rather than arbitrary navigation; the current question sequence owns edits; Back, save, and Continue preserve one ordered draft.
- `linear-application -> application-context`: `application-context` consumes the named context or revision from `linear-application` and exposes an explicit return or reconciliation path.
- `application-context -> step-progress`: `step-progress` consumes the named context or revision from `application-context` and exposes an explicit return or reconciliation path.
- `step-progress -> current-section`: `current-section` consumes the named context or revision from `step-progress` and exposes an explicit return or reconciliation path.
- `current-section -> question-sequence`: `question-sequence` consumes the named context or revision from `current-section` and exposes an explicit return or reconciliation path.
- `question-sequence -> back-save-continue-actions`: `back-save-continue-actions` consumes the named context or revision from `question-sequence` and exposes an explicit return or reconciliation path.
- `back-save-continue-actions -> persistent-help`: `persistent-help` consumes the named context or revision from `back-save-continue-actions` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `linear-application` | Owns the complete linear application transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `application-context` | Owns the application context orientation and immutable basis that qualifies every downstream decision. |
| `step-progress` | Owns the derived step progress state; it names its source revision and cannot contradict the input or evidence owners. |
| `current-section` | Owns the current section input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `question-sequence` | Owns the question sequence input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `back-save-continue-actions` | Owns the back save continue actions input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `persistent-help` | Owns the persistent help recovery route and preserves the exact state, trigger, and return position. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** A labeled step indicator precedes a narrow form column; sections do not become side-by-side forms.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Step labels reduce to distinguishing chapter names while the form retains readable measure and action order.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Progress becomes Step n of m and one coherent question group remains primary without a horizontal step scroller.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `linear-application` → `application-context` → `step-progress` → `current-section` → `question-sequence` → `back-save-continue-actions` → `persistent-help`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `initial` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `resumed` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `chapter complete` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `chapter current` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `chapter upcoming` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `conditional branch` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `draft saving` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `draft saved/error` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `timeout warning` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `stale answer dependency` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `submit handoff` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use for three or more fixed-order sections that require save and return.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject flexible-order task completion and flows shorter than three sections.
- Reject quizzes, centered tasks, or a multi-session task list.
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
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transactions preserve progress, review, and recovery. | It does not define a product workflow or fixed step count. |
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | A question keeps its label, answer, Back path, and Continue action coherent. | It does not authorize copying GOV.UK visual treatment. |
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context can orient a person without becoming arbitrary navigation. | It does not define process authority or responsive geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "linear-multi-step-application",
  "situationCodes": [
    "LMA-01",
    "LMA-02",
    "LMA-03"
  ],
  "searchAliases": [
    "linear application",
    "fixed-step form",
    "chaptered application"
  ],
  "dominantTask": "Complete a long application with a stable section order while preserving progress, drafts, and return paths.",
  "regions": [
    "linear-application",
    "application-context",
    "step-progress",
    "current-section",
    "question-sequence",
    "back-save-continue-actions",
    "persistent-help"
  ],
  "regionRelationships": [
    "linear-application -> application-context",
    "application-context -> step-progress",
    "step-progress -> current-section",
    "current-section -> question-sequence",
    "question-sequence -> back-save-continue-actions",
    "back-save-continue-actions -> persistent-help"
  ],
  "responsive": {
    "wide": "A labeled step indicator precedes a narrow form column; sections do not become side-by-side forms.",
    "intermediate": "Step labels reduce to distinguishing chapter names while the form retains readable measure and action order.",
    "compact": "Progress becomes Step n of m and one coherent question group remains primary without a horizontal step scroller.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "linear-application -> application-context -> step-progress -> current-section -> question-sequence -> back-save-continue-actions -> persistent-help",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "initial",
    "resumed",
    "chapter complete",
    "chapter current",
    "chapter upcoming",
    "conditional branch",
    "draft saving",
    "draft saved/error",
    "timeout warning",
    "stale answer dependency",
    "submit handoff"
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
