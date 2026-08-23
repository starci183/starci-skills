# Ranked choice round tabulation audit

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `ranked-choice-round-tabulation-audit` |
| Family | Work |
| Dominant task | Reproduce and audit a ranked-choice contest round by round from versioned cast-vote preferences, applying validity, threshold, transfer, exhaustion, and tie rules until the terminal result is proven. |
| Search aliases | `ranked choice recount`, `round transfer audit`, `cast vote record tabulation` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Reproduce and audit a ranked-choice contest round by round from versioned cast-vote preferences, applying validity, threshold, transfer, exhaustion, and tie rules until the terminal result is proven.
- Each round derives only from the prior continuing-candidate set and immutable normalized ballot preferences under one rule version; every transfer, exhaustion, tie decision, and receipt remains reproducible.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RCT-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-RCT-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-RCT-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-RCT-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-RCT-90` | The dominant task is actually constrained quota allocation. | Reject. |
| `AR-RCT-91` | The dominant task is actually signed contribution waterfall. | Reject. |
| `AR-RCT-92` | The dominant task is actually case-resolution dossier. | Reject. |
| `AR-RCT-93` | The dominant task is actually generic election dashboard. | Reject. |

### Selection rule

Select `ranked-choice-round-tabulation-audit` if and only if `AR-RCT-01` through `AR-RCT-04` are evidenced and none of `AR-RCT-90` through `AR-RCT-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
ranked-choice-audit
|-- jurisdiction-contest-rule-and-input-version
|-- ballot-style-and-cast-vote-record-set
|   `-- validity-adjudication-and-preference-normalization
|-- continuing-candidate-set
|-- round-tally-and-threshold-proof
|   <-> ballot-transfer-exhaustion-and-tie-resolution-ledger
|-- elected-or-eliminated-transition
|-- next-round-or-terminal-result
`-- reproducibility-export-recount-and-certification-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `ranked-choice-audit` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `jurisdiction-contest-rule-and-input-version` | Owns Jurisdiction Contest Rule And Input Version evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `ballot-style-and-cast-vote-record-set` | Owns Ballot Style And Cast Vote Record Set evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `validity-adjudication-and-preference-normalization` | Owns Validity Adjudication And Preference Normalization evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `continuing-candidate-set` | Owns Continuing Candidate Set evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `round-tally-and-threshold-proof` | Owns Round Tally And Threshold Proof evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `ballot-transfer-exhaustion-and-tie-resolution-ledger` | Owns Ballot Transfer Exhaustion And Tie Resolution Ledger evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `elected-or-eliminated-transition` | Owns Elected Or Eliminated Transition evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `next-round-or-terminal-result` | Owns Next Round Or Terminal Result evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |
| `reproducibility-export-recount-and-certification-receipt` | Owns Reproducibility Export Recount And Certification Receipt evidence, action, and state; preserves its declared relationship to the current selection without borrowing product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Candidate status, current and prior round tallies, threshold proof, selected ballot transfer, exhaustion, tie rule, and round lineage remain visible together.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `round-tally-and-threshold-proof` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The current round and transition proof remain primary; cast-vote roster, all prior rounds, quarantine evidence, and certification history move to synchronized drawers.
- **Navigation replacement:** A synchronized drawer replaces the displaced region and preserves the selected object, query, state, scroll context, and exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `round-tally-and-threshold-proof` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44 CSS-pixel targets, and unobscured focus.
- **Topology response:** Contest and input version → current round → continuing candidates → selected tally or ballot transfer → threshold or tie decision → elect, eliminate, or continue → next round and audit receipt; the matrix becomes a round navigator.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** Only the current-task receipt or blocking action may persist; it reserves space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `round-tally-and-threshold-proof` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `ranked-choice-audit -> jurisdiction-contest-rule-and-input-version -> ballot-style-and-cast-vote-record-set -> validity-adjudication-and-preference-normalization -> continuing-candidate-set -> round-tally-and-threshold-proof -> ballot-transfer-exhaustion-and-tie-resolution-ledger -> elected-or-eliminated-transition -> next-round-or-terminal-result -> reproducibility-export-recount-and-certification-receipt`.
- Long labels, localization, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, input, pending result, and error context.
- Pointer actions have keyboard equivalents; color is never the only signal.
- Dynamic updates announce one contextual status without stealing focus.

## State obligations

Task-specific states: input loading/validated/quarantined; ballot valid/overvoted/exhausted/adjudicated; candidate continuing/elected/eliminated/withdrawn; round queued/calculated/challenged/locked; threshold unmet/met; transfer pending/complete; tie unresolved/rule-resolved; result unofficial/recounted/certified; export reproducible/mismatched.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `jurisdiction-contest-rule-and-input-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `ballot-style-and-cast-vote-record-set` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `ballot-style-and-cast-vote-record-set` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `next-round-or-terminal-result` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `reproducibility-export-recount-and-certification-receipt` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `next-round-or-terminal-result` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `reproducibility-export-recount-and-certification-receipt` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `jurisdiction-contest-rule-and-input-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `next-round-or-terminal-result` | Move focus only to a required error summary or modal, then return it to the exact trigger. |
| Responsive presentation | `ranked-choice-audit` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Reproduce and audit a ranked-choice contest round by round from versioned cast-vote preferences, applying validity, threshold, transfer, exhaustion, and tie rules until the terminal result is proven.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject constrained quota allocation; this is `AR-RCT-90` evidence and must route to an adjacent archetype.
- Reject signed contribution waterfall; this is `AR-RCT-91` evidence and must route to an adjacent archetype.
- Reject case-resolution dossier; this is `AR-RCT-92` evidence and must route to an adjacent archetype.
- Reject generic election dashboard; this is `AR-RCT-93` evidence and must route to an adjacent archetype.

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
| [NIST — Cast Vote Records Common Data Format](https://pages.nist.gov/CastVoteRecords/) | Versioned cast-vote records, contest selections, and interoperable audit input structure. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [U.S. Election Assistance Commission — RCV systems guidance](https://www.eac.gov/sites/default/files/2023-10/RCV%20Voting%20Systems%20V3%20Final%2010.20.23.pdf) | Ranked-choice tabulation, round, transfer, exhaustion, and reporting considerations. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Round/candidate tables, explicit row actions, and bounded numeric comparison. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard-complete navigation for interactive round-by-candidate tabular data. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "ranked-choice-round-tabulation-audit",
  "situationCodes": [
    "<matched AR-RCT-* codes>"
  ],
  "searchAliases": [
    "ranked choice recount",
    "round transfer audit",
    "cast vote record tabulation"
  ],
  "dominantTask": "Reproduce and audit a ranked-choice contest round by round from versioned cast-vote preferences, applying validity, threshold, transfer, exhaustion, and tie rules until the terminal result is proven.",
  "regions": [
    "ranked-choice-audit",
    "jurisdiction-contest-rule-and-input-version",
    "ballot-style-and-cast-vote-record-set",
    "validity-adjudication-and-preference-normalization",
    "continuing-candidate-set",
    "round-tally-and-threshold-proof",
    "ballot-transfer-exhaustion-and-tie-resolution-ledger",
    "elected-or-eliminated-transition",
    "next-round-or-terminal-result",
    "reproducibility-export-recount-and-certification-receipt"
  ],
  "regionRelationships": [
    "Each round derives only from the prior continuing-candidate set and immutable normalized ballot preferences under one rule version; every transfer, exhaustion, tie decision, and receipt remains reproducible."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "ranked-choice-audit -> jurisdiction-contest-rule-and-input-version -> ballot-style-and-cast-vote-record-set -> validity-adjudication-and-preference-normalization -> continuing-candidate-set -> round-tally-and-threshold-proof -> ballot-transfer-exhaustion-and-tie-resolution-ledger -> elected-or-eliminated-transition -> next-round-or-terminal-result -> reproducibility-export-recount-and-certification-receipt",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "round-tally-and-threshold-proof",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "input loading/validated/quarantined",
    "ballot valid/overvoted/exhausted/adjudicated",
    "candidate continuing/elected/eliminated/withdrawn",
    "round queued/calculated/challenged/locked",
    "threshold unmet/met",
    "transfer pending/complete",
    "tie unresolved/rule-resolved",
    "result unofficial/recounted/certified",
    "export reproducible/mismatched"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

