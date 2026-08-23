# Treaty reservation depositary workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | treaty-reservation-depositary-workbench |
| Family | work |
| Dominant task | Administer one multilateral treaty as depositary by validating instruments, registering party actions and reservations, routing objections and withdrawals, deriving entry-into-force effects, and issuing notifications without adjudicating merits. |
| Search aliases | treaty-reservation-depositary-workbench; treaty depositary; reservation objection register; entry into force |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Administer one multilateral treaty as depositary by validating instruments, registering party actions and reservations, routing objections and withdrawals, deriving entry-into-force effects, and issuing notifications without adjudicating merits.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-TRD-01 | Administer one multilateral treaty as depositary by validating instruments, registering party actions and reservations, routing objections and withdrawals, deriving entry-into-force effects, and issuing notifications without adjudicating merits. | required positive evidence |
| AR-TRD-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-TRD-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-TRD-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-TRD-90 | Reject timeline audits, bitemporal detail, filing validation, consensus or voting, chain-of-custody ledgers, and generic legal case dossiers. | reject |
| AR-TRD-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-TRD-01, AR-TRD-02, and AR-TRD-03 are evidenced, neither AR-TRD-90 nor AR-TRD-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
treaty-depositary
├─ authentic-text-final-clauses-and-thresholds
├─ eligible-state-organization-roster
├─ instrument-intake-and-form-check
├─ party-action-ledger
├─ reservation-declaration-register
├─ objection-acceptance-withdrawal-relations
├─ per-party-consent-and-effective-status
├─ global-entry-into-force-calculation
└─ depositary-notification-and-registration-record
~~~

Critical relationship: Party instruments, reservation relations, and threshold-derived status are independent owners; every result traces to an instrument and final clause.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| treaty-depositary | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains authentic-text-final-clauses-and-thresholds, eligible-state-organization-roster, instrument-intake-and-form-check, party-action-ledger, reservation-declaration-register, objection-acceptance-withdrawal-relations, per-party-consent-and-effective-status, global-entry-into-force-calculation, depositary-notification-and-registration-record while preserving each region's independent owner. |
| authentic-text-final-clauses-and-thresholds | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from treaty-depositary and gates eligible-state-organization-roster without merging authority. |
| eligible-state-organization-roster | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from authentic-text-final-clauses-and-thresholds and gates instrument-intake-and-form-check without merging authority. |
| instrument-intake-and-form-check | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from eligible-state-organization-roster and gates party-action-ledger without merging authority. |
| party-action-ledger | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from instrument-intake-and-form-check and gates reservation-declaration-register without merging authority. |
| reservation-declaration-register | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from party-action-ledger and gates objection-acceptance-withdrawal-relations without merging authority. |
| objection-acceptance-withdrawal-relations | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from reservation-declaration-register and gates per-party-consent-and-effective-status without merging authority. |
| per-party-consent-and-effective-status | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from objection-acceptance-withdrawal-relations and gates global-entry-into-force-calculation without merging authority. |
| global-entry-into-force-calculation | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from per-party-consent-and-effective-status and gates depositary-notification-and-registration-record without merging authority. |
| depositary-notification-and-registration-record | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from global-entry-into-force-calculation and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep party actions, selected instrument, reservation-objection relations, and entry-into-force calculations simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Keep party actions and selected relation primary; alternate instrument text and threshold evidence while treaty version and status persist.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage treaty status, party, instrument form check, reservation or declaration, objections or withdrawals, effects, then depositary notification.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete.

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
| domain states | Preserve the complete domain catalog: treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject timeline audits, bitemporal detail, filing validation, consensus or voting, chain-of-custody ledgers, and generic legal case dossiers. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [United Nations — Treaty Collection overview](https://treaties.un.org/pages/overview.aspx?path=overview%2Foverview%2Fpage1_en.xml) | Supports depositary functions, status, reservations, objections, and notifications. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Council of Europe — Treaty Office](https://www.coe.int/en/web/dlapil/treaty-office) | Supports instrument form checks, registration, withdrawals, and notifications. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [OAS — Multilateral treaty depositary register](https://www.oas.org/juridico/english/Sigs/a-42.html) | Supports party actions, reservations, objections, and entry-into-force records. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports ordered compact records instead of squeezed relation graphs. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "treaty-reservation-depositary-workbench",
  "matchedSituationCodes": [
    "AR-TRD-01",
    "AR-TRD-02",
    "AR-TRD-03"
  ],
  "aliases": [
    "treaty-reservation-depositary-workbench",
    "treaty depositary",
    "reservation objection register",
    "entry into force"
  ],
  "dominantTask": "Administer one multilateral treaty as depositary by validating instruments, registering party actions and reservations, routing objections and withdrawals, deriving entry-into-force effects, and issuing notifications without adjudicating merits.",
  "regions": [
    "treaty-depositary",
    "authentic-text-final-clauses-and-thresholds",
    "eligible-state-organization-roster",
    "instrument-intake-and-form-check",
    "party-action-ledger",
    "reservation-declaration-register",
    "objection-acceptance-withdrawal-relations",
    "per-party-consent-and-effective-status",
    "global-entry-into-force-calculation",
    "depositary-notification-and-registration-record"
  ],
  "relationships": [
    "Party instruments, reservation relations, and threshold-derived status are independent owners; every result traces to an instrument and final clause."
  ],
  "responsive": {
    "wide": "Keep party actions, selected instrument, reservation-objection relations, and entry-into-force calculations simultaneously visible.",
    "intermediate": "Keep party actions and selected relation primary; alternate instrument text and threshold evidence while treaty version and status persist.",
    "compact": "Stage treaty status, party, instrument form check, reservation or declaration, objections or withdrawals, effects, then depositary notification.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "treaty-depositary → authentic-text-final-clauses-and-thresholds → eligible-state-organization-roster → instrument-intake-and-form-check → party-action-ledger → reservation-declaration-register → objection-acceptance-withdrawal-relations → per-party-consent-and-effective-status → global-entry-into-force-calculation → depositary-notification-and-registration-record",
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
    "treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete"
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

