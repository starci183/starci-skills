# Retention obligation disposition workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | retention-obligation-disposition-workbench |
| Family | work |
| Dominant task | Apply retention authority to record cohorts, resolve holds, preview delete, transfer, or anonymize outcomes, and produce an execution certificate. |
| Search aliases | retention-obligation-disposition-workbench; records disposition; hold veto; disposition certificate |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Apply retention authority to record cohorts, resolve holds, preview delete, transfer, or anonymize outcomes, and produce an execution certificate.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ROD-01 | Apply retention authority to record cohorts, resolve holds, preview delete, transfer, or anonymize outcomes, and produce an execution certificate. | required positive evidence |
| AR-ROD-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-ROD-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-ROD-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-ROD-90 | Reject retention-policy authoring, generic batch operations, account closure, and data export. | reject |
| AR-ROD-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-ROD-01, AR-ROD-02, and AR-ROD-03 are evidenced, neither AR-ROD-90 nor AR-ROD-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
disposition-workbench
├─ record-cohort-inventory
├─ retention-authority-clock
├─ hold-exception-register
├─ eligible-disposition-queue
├─ delete-transfer-anonymize-preview
├─ approval-execution
└─ certificate
~~~

Critical relationship: Active holds veto otherwise eligible execution; every irreversible result traces to retention authority, cohort version, approval, and certificate.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| disposition-workbench | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains record-cohort-inventory, retention-authority-clock, hold-exception-register, eligible-disposition-queue, delete-transfer-anonymize-preview, approval-execution, certificate while preserving each region's independent owner. |
| record-cohort-inventory | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from disposition-workbench and gates retention-authority-clock without merging authority. |
| retention-authority-clock | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from record-cohort-inventory and gates hold-exception-register without merging authority. |
| hold-exception-register | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from retention-authority-clock and gates eligible-disposition-queue without merging authority. |
| eligible-disposition-queue | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from hold-exception-register and gates delete-transfer-anonymize-preview without merging authority. |
| delete-transfer-anonymize-preview | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from eligible-disposition-queue and gates approval-execution without merging authority. |
| approval-execution | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Receives context from delete-transfer-anonymize-preview and gates certificate without merging authority. |
| certificate | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from approval-execution and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep cohorts, authority clocks, hold evidence, eligible queue, and disposition preview simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Make eligible queue and selected exception primary while clock and hold summary persist.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage cohort, authority clock and holds, disposition preview, approval, execution, then certificate.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate.

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
| domain states | Preserve the complete domain catalog: cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject retention-policy authoring, generic batch operations, account closure, and data export. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [NARA — Records Scheduling and Appraisal](https://www.archives.gov/records-mgmt/sch-appraisal) | Supports approved disposition authority and temporary or permanent outcomes. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [NIST — SP 800-88 Rev. 2](https://csrc.nist.gov/pubs/sp/800/88/r2/final) | Supports current sanitization and disposal controls. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports accessible execution, failure, and certificate announcements. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "retention-obligation-disposition-workbench",
  "matchedSituationCodes": [
    "AR-ROD-01",
    "AR-ROD-02",
    "AR-ROD-03"
  ],
  "aliases": [
    "retention-obligation-disposition-workbench",
    "records disposition",
    "hold veto",
    "disposition certificate"
  ],
  "dominantTask": "Apply retention authority to record cohorts, resolve holds, preview delete, transfer, or anonymize outcomes, and produce an execution certificate.",
  "regions": [
    "disposition-workbench",
    "record-cohort-inventory",
    "retention-authority-clock",
    "hold-exception-register",
    "eligible-disposition-queue",
    "delete-transfer-anonymize-preview",
    "approval-execution",
    "certificate"
  ],
  "relationships": [
    "Active holds veto otherwise eligible execution; every irreversible result traces to retention authority, cohort version, approval, and certificate."
  ],
  "responsive": {
    "wide": "Keep cohorts, authority clocks, hold evidence, eligible queue, and disposition preview simultaneously visible.",
    "intermediate": "Make eligible queue and selected exception primary while clock and hold summary persist.",
    "compact": "Stage cohort, authority clock and holds, disposition preview, approval, execution, then certificate.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "disposition-workbench → record-cohort-inventory → retention-authority-clock → hold-exception-register → eligible-disposition-queue → delete-transfer-anonymize-preview → approval-execution → certificate",
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
    "cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate"
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

