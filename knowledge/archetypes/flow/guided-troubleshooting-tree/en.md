# Guided troubleshooting tree

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `guided-troubleshooting-tree` |
| Family | `flow` |
| Dominant task | Diagnose an issue through branching questions, accumulate evidence, and reach a resolution or escalation. |
| Search aliases | `diagnostic question tree`, `guided issue diagnosis`, `branching troubleshooting flow` |
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
| `GTT-01` | Diagnose an issue through branching questions, accumulate evidence, and reach a resolution or escalation. | required positive |
| `GTT-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `GTT-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `GTT-90` | Reject FAQs, surveys, scored quizzes, or linear applications. | reject |
| `GTT-91` | Reject arbitrary tree visualizations or standalone centered tasks. | reject |

### Selection rule

- Return `accept` only when `GTT-01` and `GTT-02` are evidenced and no 90–99 code is present.
- Return `reject` when `GTT-90` or `GTT-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
troubleshooter
├─ issue-context
├─ current-diagnostic-question
├─ answer-branches
├─ accumulated-evidence-path
├─ recommended-resolution
└─ escalation-and-reset
```

- **Shared relationship:** Every answer extends one accumulated evidence path; changing an upstream answer invalidates downstream evidence; resolution or escalation consumes the reviewed path.
- `troubleshooter -> issue-context`: `issue-context` consumes the named context or revision from `troubleshooter` and exposes an explicit return or reconciliation path.
- `issue-context -> current-diagnostic-question`: `current-diagnostic-question` consumes the named context or revision from `issue-context` and exposes an explicit return or reconciliation path.
- `current-diagnostic-question -> answer-branches`: `answer-branches` consumes the named context or revision from `current-diagnostic-question` and exposes an explicit return or reconciliation path.
- `answer-branches -> accumulated-evidence-path`: `accumulated-evidence-path` consumes the named context or revision from `answer-branches` and exposes an explicit return or reconciliation path.
- `accumulated-evidence-path -> recommended-resolution`: `recommended-resolution` consumes the named context or revision from `accumulated-evidence-path` and exposes an explicit return or reconciliation path.
- `recommended-resolution -> escalation-and-reset`: `escalation-and-reset` consumes the named context or revision from `recommended-resolution` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `troubleshooter` | Owns the complete troubleshooter transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `issue-context` | Owns the issue context orientation and immutable basis that qualifies every downstream decision. |
| `current-diagnostic-question` | Owns the current diagnostic question input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `answer-branches` | Owns the answer branches input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `accumulated-evidence-path` | Owns the durable accumulated evidence path evidence and its provenance; it does not silently mutate the current input owner. |
| `recommended-resolution` | Owns the recommended resolution input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `escalation-and-reset` | Owns the escalation and reset input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** The current question is primary while known facts may support it without revealing distracting future branches.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The evidence path becomes a summary disclosure while the current question keeps full readable width.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** One diagnostic step owns the screen; Back restores the exact branch answer and resolution retains review and reset.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `troubleshooter` → `issue-context` → `current-diagnostic-question` → `answer-branches` → `accumulated-evidence-path` → `recommended-resolution` → `escalation-and-reset`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `no issue selected` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `branch loading` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `invalid answer` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `contradictory answer` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `dead end` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `insufficient evidence` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `resolution available` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `resolution failed` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `escalation unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `escalation pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `knowledge stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `reset confirmation` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when each answer selects the next diagnostic question and the accumulated path governs resolution.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject FAQs, surveys, scored quizzes, or linear applications.
- Reject arbitrary tree visualizations or standalone centered tasks.
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
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | A question keeps its label, answer, Back path, and Continue action coherent. | It does not authorize copying GOV.UK visual treatment. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transactions preserve progress, review, and recovery. | It does not define a product workflow or fixed step count. |
| [W3C WAI-ARIA APG — Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | A collapsed evidence path retains explicit keyboard activation and expanded state. | It does not define diagnostic branches or resolution truth. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "guided-troubleshooting-tree",
  "situationCodes": [
    "GTT-01",
    "GTT-02",
    "GTT-03"
  ],
  "searchAliases": [
    "diagnostic question tree",
    "guided issue diagnosis",
    "branching troubleshooting flow"
  ],
  "dominantTask": "Diagnose an issue through branching questions, accumulate evidence, and reach a resolution or escalation.",
  "regions": [
    "troubleshooter",
    "issue-context",
    "current-diagnostic-question",
    "answer-branches",
    "accumulated-evidence-path",
    "recommended-resolution",
    "escalation-and-reset"
  ],
  "regionRelationships": [
    "troubleshooter -> issue-context",
    "issue-context -> current-diagnostic-question",
    "current-diagnostic-question -> answer-branches",
    "answer-branches -> accumulated-evidence-path",
    "accumulated-evidence-path -> recommended-resolution",
    "recommended-resolution -> escalation-and-reset"
  ],
  "responsive": {
    "wide": "The current question is primary while known facts may support it without revealing distracting future branches.",
    "intermediate": "The evidence path becomes a summary disclosure while the current question keeps full readable width.",
    "compact": "One diagnostic step owns the screen; Back restores the exact branch answer and resolution retains review and reset.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "troubleshooter -> issue-context -> current-diagnostic-question -> answer-branches -> accumulated-evidence-path -> recommended-resolution -> escalation-and-reset",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "no issue selected",
    "branch loading",
    "invalid answer",
    "contradictory answer",
    "dead end",
    "insufficient evidence",
    "resolution available",
    "resolution failed",
    "escalation unavailable",
    "escalation pending",
    "knowledge stale",
    "reset confirmation"
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
