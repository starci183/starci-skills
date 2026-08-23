# Consent signature ceremony

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `consent-signature-ceremony` |
| Family | `flow` |
| Dominant task | Review the correct instrument version, acknowledge required clauses, verify signer capacity, and commit a signature with audit evidence. |
| Search aliases | `binding signature flow`, `consent instrument ceremony`, `audited e-signature` |
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
| `CSC-01` | Review the correct instrument version, acknowledge required clauses, verify signer capacity, and commit a signature with audit evidence. | required positive |
| `CSC-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `CSC-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `CSC-90` | Reject generic irreversible confirmation or split-reference entry. | reject |
| `CSC-91` | Reject simple terms checkboxes, document readers, or approval requests. | reject |

### Selection rule

- Return `accept` only when `CSC-01` and `CSC-02` are evidenced and no 90–99 code is present.
- Return `reject` when `CSC-90` or `CSC-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
signature-ceremony
├─ instrument-identity-and-version
├─ readable-instrument
├─ required-clause-acknowledgements
├─ signer-identity-and-capacity
├─ signature-input
└─ final-commit-and-audit-evidence
```

- **Shared relationship:** Instrument identity and clause acknowledgements remain independent evidence owners; signer capacity and signature bind to the reviewed version; commit creates separate audit evidence.
- `signature-ceremony -> instrument-identity-and-version`: `instrument-identity-and-version` consumes the named context or revision from `signature-ceremony` and exposes an explicit return or reconciliation path.
- `instrument-identity-and-version -> readable-instrument`: `readable-instrument` consumes the named context or revision from `instrument-identity-and-version` and exposes an explicit return or reconciliation path.
- `readable-instrument -> required-clause-acknowledgements`: `required-clause-acknowledgements` consumes the named context or revision from `readable-instrument` and exposes an explicit return or reconciliation path.
- `required-clause-acknowledgements -> signer-identity-and-capacity`: `signer-identity-and-capacity` consumes the named context or revision from `required-clause-acknowledgements` and exposes an explicit return or reconciliation path.
- `signer-identity-and-capacity -> signature-input`: `signature-input` consumes the named context or revision from `signer-identity-and-capacity` and exposes an explicit return or reconciliation path.
- `signature-input -> final-commit-and-audit-evidence`: `final-commit-and-audit-evidence` consumes the named context or revision from `signature-input` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `signature-ceremony` | Owns the complete signature ceremony transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `instrument-identity-and-version` | Owns the durable instrument identity and version evidence and its provenance; it does not silently mutate the current input owner. |
| `readable-instrument` | Owns the durable readable instrument evidence and its provenance; it does not silently mutate the current input owner. |
| `required-clause-acknowledgements` | Owns the required clause acknowledgements input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `signer-identity-and-capacity` | Owns the signer identity and capacity orientation and immutable basis that qualifies every downstream decision. |
| `signature-input` | Owns the signature input input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `final-commit-and-audit-evidence` | Owns the durable final commit and audit evidence evidence and its provenance; it does not silently mutate the current input owner. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** The readable instrument is primary and the acknowledgement rail is allowed only while all clause context remains reachable.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Signature follows instrument and required clauses while disclosures support navigation without hiding unread requirements.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** Instrument sections, acknowledgements, signer verification, signature, and final review form one preserved sequence.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `signature-ceremony` → `instrument-identity-and-version` → `readable-instrument` → `required-clause-acknowledgements` → `signer-identity-and-capacity` → `signature-input` → `final-commit-and-audit-evidence`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `instrument loading` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `version changed` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `clause unread` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `clause acknowledged` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `signer mismatch` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `signature invalid` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `commit pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `duplicate prevented` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `commit success` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `commit failure` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `invitation revoked` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `invitation expired` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `audit record` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when instrument version, clause acknowledgement, signer capacity, and audit evidence are separate obligations.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject generic irreversible confirmation or split-reference entry.
- Reject simple terms checkboxes, document readers, or approval requests.
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
| [NIST SP 800-63A-4 — Identity Proofing and Enrollment](https://csrc.nist.gov/pubs/sp/800/63/A/4/final) | Signer identity evidence and assurance level remain distinct from the instrument. | It does not define legal consent or signature UI. |
| [NIST SP 800-89 — Digital Signature Applications](https://csrc.nist.gov/pubs/sp/800/89/final) | Signature assurance includes signer identity, key possession, and verifiable evidence. | It does not establish legal effect or clause content. |
| [GOV.UK Design System — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Review keeps correction paths attached to the information being committed. | It does not establish legal effect, signer capacity, or instrument validity. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submissions support review, correction, and confirmation. | It does not define the domain consequence or approval rule. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus follows relationships and preserves operability. | It does not select this archetype or define product facts. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "consent-signature-ceremony",
  "situationCodes": [
    "CSC-01",
    "CSC-02",
    "CSC-03"
  ],
  "searchAliases": [
    "binding signature flow",
    "consent instrument ceremony",
    "audited e-signature"
  ],
  "dominantTask": "Review the correct instrument version, acknowledge required clauses, verify signer capacity, and commit a signature with audit evidence.",
  "regions": [
    "signature-ceremony",
    "instrument-identity-and-version",
    "readable-instrument",
    "required-clause-acknowledgements",
    "signer-identity-and-capacity",
    "signature-input",
    "final-commit-and-audit-evidence"
  ],
  "regionRelationships": [
    "signature-ceremony -> instrument-identity-and-version",
    "instrument-identity-and-version -> readable-instrument",
    "readable-instrument -> required-clause-acknowledgements",
    "required-clause-acknowledgements -> signer-identity-and-capacity",
    "signer-identity-and-capacity -> signature-input",
    "signature-input -> final-commit-and-audit-evidence"
  ],
  "responsive": {
    "wide": "The readable instrument is primary and the acknowledgement rail is allowed only while all clause context remains reachable.",
    "intermediate": "Signature follows instrument and required clauses while disclosures support navigation without hiding unread requirements.",
    "compact": "Instrument sections, acknowledgements, signer verification, signature, and final review form one preserved sequence.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "signature-ceremony -> instrument-identity-and-version -> readable-instrument -> required-clause-acknowledgements -> signer-identity-and-capacity -> signature-input -> final-commit-and-audit-evidence",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "instrument loading",
    "version changed",
    "clause unread",
    "clause acknowledged",
    "signer mismatch",
    "signature invalid",
    "commit pending",
    "duplicate prevented",
    "commit success",
    "commit failure",
    "invitation revoked",
    "invitation expired",
    "audit record"
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
