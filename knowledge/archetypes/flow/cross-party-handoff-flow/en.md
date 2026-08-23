# Cross-party handoff flow

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cross-party-handoff-flow` |
| Family | `flow` |
| Dominant task | Package work context, select an eligible recipient, set access and expiry, and transfer responsibility through explicit acceptance. |
| Search aliases | `responsibility handoff`, `recipient acceptance transfer`, `secure work package transfer` |
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
| `CHF-01` | Package work context, select an eligible recipient, set access and expiry, and transfer responsibility through explicit acceptance. | required positive |
| `CHF-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `CHF-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `CHF-90` | Reject approval routing, dual-list transfer, or simple share dialogs. | reject |
| `CHF-91` | Reject support composers or operational row assignment actions. | reject |

### Selection rule

- Return `accept` only when `CHF-01` and `CHF-02` are evidenced and no 90–99 code is present.
- Return `reject` when `CHF-90` or `CHF-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
handoff-flow
├─ work-package-summary
├─ recipient-search-and-eligibility
├─ access-and-redaction-scope
├─ expiry-and-return-policy
├─ recipient-preview
├─ send-handoff
└─ acceptance-tracker
```

- **Shared relationship:** The sender-owned package and recipient-owned acceptance are separate transaction owners; access and expiry qualify the preview; the tracker replaces the composer after send.
- `handoff-flow -> work-package-summary`: `work-package-summary` consumes the named context or revision from `handoff-flow` and exposes an explicit return or reconciliation path.
- `work-package-summary -> recipient-search-and-eligibility`: `recipient-search-and-eligibility` consumes the named context or revision from `work-package-summary` and exposes an explicit return or reconciliation path.
- `recipient-search-and-eligibility -> access-and-redaction-scope`: `access-and-redaction-scope` consumes the named context or revision from `recipient-search-and-eligibility` and exposes an explicit return or reconciliation path.
- `access-and-redaction-scope -> expiry-and-return-policy`: `expiry-and-return-policy` consumes the named context or revision from `access-and-redaction-scope` and exposes an explicit return or reconciliation path.
- `expiry-and-return-policy -> recipient-preview`: `recipient-preview` consumes the named context or revision from `expiry-and-return-policy` and exposes an explicit return or reconciliation path.
- `recipient-preview -> send-handoff`: `send-handoff` consumes the named context or revision from `recipient-preview` and exposes an explicit return or reconciliation path.
- `send-handoff -> acceptance-tracker`: `acceptance-tracker` consumes the named context or revision from `send-handoff` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `handoff-flow` | Owns the complete handoff flow transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `work-package-summary` | Owns the derived work package summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `recipient-search-and-eligibility` | Owns the recipient search and eligibility input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `access-and-redaction-scope` | Owns the access and redaction scope input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `expiry-and-return-policy` | Owns the expiry and return policy input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `recipient-preview` | Owns the derived recipient preview state; it names its source revision and cannot contradict the input or evidence owners. |
| `send-handoff` | Owns the send handoff input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `acceptance-tracker` | Owns the durable acceptance tracker evidence and its provenance; it does not silently mutate the current input owner. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Package configuration is primary and recipient preview supports it; the tracker replaces the composer only after send.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Preview moves before Send while eligibility and access consequences remain adjacent to recipient selection.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Package, recipient, access and expiry, preview, send, and acceptance tracking form a state-preserving sequence.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `handoff-flow` → `work-package-summary` → `recipient-search-and-eligibility` → `access-and-redaction-scope` → `expiry-and-return-policy` → `recipient-preview` → `send-handoff` → `acceptance-tracker`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `recipient searching` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `recipient eligible` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `recipient ineligible` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `package incomplete` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `package stale` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `redaction warning` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `invitation pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `accepted` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `declined` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `expired` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `revoked` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `resend` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `return` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `ownership conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `focus to tracker` | Move focus only after an explicit action or failed submit, then restore the exact trigger and semantic context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when sender configuration and recipient acceptance are separate transaction owners.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject approval routing, dual-list transfer, or simple share dialogs.
- Reject support composers or operational row assignment actions.
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
| [Google Account Help — Share a copy of your data](https://support.google.com/accounts/answer/14452558?hl=en) | Recipient trust, data scope, access duration, and responsibility transfer need explicit review. | It does not define another product’s handoff authority. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Record statuses, approvals, and activity can remain separately identified. | It does not define a process gate or handoff contract. |
| [GitHub Docs — Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) | A responsibility transfer names eligibility, recipient acceptance, transferred scope, and invitation expiry. | It does not define another product’s package, access policy, or acceptance period. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submissions support review, correction, and confirmation. | It does not define the domain consequence or approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "cross-party-handoff-flow",
  "situationCodes": [
    "CHF-01",
    "CHF-02",
    "CHF-03"
  ],
  "searchAliases": [
    "responsibility handoff",
    "recipient acceptance transfer",
    "secure work package transfer"
  ],
  "dominantTask": "Package work context, select an eligible recipient, set access and expiry, and transfer responsibility through explicit acceptance.",
  "regions": [
    "handoff-flow",
    "work-package-summary",
    "recipient-search-and-eligibility",
    "access-and-redaction-scope",
    "expiry-and-return-policy",
    "recipient-preview",
    "send-handoff",
    "acceptance-tracker"
  ],
  "regionRelationships": [
    "handoff-flow -> work-package-summary",
    "work-package-summary -> recipient-search-and-eligibility",
    "recipient-search-and-eligibility -> access-and-redaction-scope",
    "access-and-redaction-scope -> expiry-and-return-policy",
    "expiry-and-return-policy -> recipient-preview",
    "recipient-preview -> send-handoff",
    "send-handoff -> acceptance-tracker"
  ],
  "responsive": {
    "wide": "Package configuration is primary and recipient preview supports it; the tracker replaces the composer only after send.",
    "intermediate": "Preview moves before Send while eligibility and access consequences remain adjacent to recipient selection.",
    "compact": "Package, recipient, access and expiry, preview, send, and acceptance tracking form a state-preserving sequence.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "handoff-flow -> work-package-summary -> recipient-search-and-eligibility -> access-and-redaction-scope -> expiry-and-return-policy -> recipient-preview -> send-handoff -> acceptance-tracker",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "recipient searching",
    "recipient eligible",
    "recipient ineligible",
    "package incomplete",
    "package stale",
    "redaction warning",
    "invitation pending",
    "accepted",
    "declined",
    "expired",
    "revoked",
    "resend",
    "return",
    "ownership conflict",
    "focus to tracker"
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
