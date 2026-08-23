# Multi Payer Responsibility Coordinator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-payer-responsibility-coordinator` |
| Family | Flow |
| Dominant task | Coordinate responsibility for a charge across multiple payers by establishing coverage order, submitting evidence, applying each adjudication and reconciling the remaining balance. |
| Search aliases | `coordination of benefits`, `ordered payer adjudication`, `charge conservation`, `payer remainder appeal` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Coordinate responsibility for a charge across multiple payers by establishing coverage order, submitting evidence, applying each adjudication and reconciling the remaining balance.
- The required region graph remains `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MP-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-MP-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-MP-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-MP-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-MP-05` | Template must apply at least two payer responses in order, explain a denial/adjustment, prevent amount imbalance, route remainder correctly and preserve appeal evidence. | Required evidence. |
| `AR-MP-90` | invoice detail | Reject. |
| `AR-MP-91` | claim form | Reject. |
| `AR-MP-92` | payment split | Reject. |
| `AR-MP-93` | line-item dispute | Reject. |

### Selection rule

Select `multi-payer-responsibility-coordinator` only when `AR-MP-01` through `AR-MP-05` are evidenced and no `AR-MP-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
payer-coordinator
   `-- charge-and-service-ledger
      `-- coverage-and-coordination-order
         `-- payer-submission-chain
            `-- selected-payer-evidence-and-response
               `-- allowed-paid-denied-adjustment-ledger
                  `-- remainder-and-next-payer
                     `-- final-responsibility-and-appeal
```

Declared relationship expression: `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `payer-coordinator` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `charge-and-service-ledger` | Owns charge and service ledger evidence, action, state, and recovery. | Follows `payer-coordinator` in semantic order and consumes its exact selected context. |
| `coverage-and-coordination-order` | Owns coverage and coordination order evidence, action, state, and recovery. | Follows `charge-and-service-ledger` in semantic order and consumes its exact selected context. |
| `payer-submission-chain` | Owns payer submission chain evidence, action, state, and recovery. | Follows `coverage-and-coordination-order` in semantic order and consumes its exact selected context. |
| `selected-payer-evidence-and-response` | Owns selected payer evidence and response evidence, action, state, and recovery. | Follows `payer-submission-chain` in semantic order and consumes its exact selected context. |
| `allowed-paid-denied-adjustment-ledger` | Owns allowed paid denied adjustment ledger evidence, action, state, and recovery. | Follows `selected-payer-evidence-and-response` in semantic order and consumes its exact selected context. |
| `remainder-and-next-payer` | Owns remainder and next payer evidence, action, state, and recovery. | Follows `allowed-paid-denied-adjustment-ledger` in semantic order and consumes its exact selected context. |
| `final-responsibility-and-appeal` | Owns final responsibility and appeal evidence, action, state, and recovery. | Follows `remainder-and-next-payer` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Charge ledger, payer order, selected response and conserved responsibility summary remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `charge-and-service-ledger` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Payer chain and remainder summary remain primary; detailed evidence/response becomes a drawer.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `charge-and-service-ledger` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Charge → coverage order → payer submission/response → adjusted remainder → next payer → final responsibility/appeal; amounts remain explicit at every step.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `charge-and-service-ledger` is optional and bounded.

### Reflow

- Semantic and DOM order is `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.
- Text zoom, long translation, and enlarged controls trigger the same named topology changes.
- CSS never reorders visual content away from keyboard or assistive-technology order.
- Long labels and identifiers wrap; hidden detail has an explicit accessible reveal.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve selected entity, version, filter, pending state, validation result, and recovery point.
- Dynamic updates use one contextual status message without moving focus.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Drag, drawing, fader, spatial, or point movement has button, numeric, or list parity.
- Color, position, geometry, and motion always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `charge-and-service-ledger` | Identify pending scope and preserve semantic position. |
| Ready | `coverage-and-coordination-order` | Expose the complete dominant task and current version. |
| Empty / not applicable | `payer-submission-chain` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `selected-payer-evidence-and-response` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `remainder-and-next-payer` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `final-responsibility-and-appeal` | Prevent duplicate action and announce progress without moving focus. |
| Success | `final-responsibility-and-appeal` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `charge-and-service-ledger` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `final-responsibility-and-appeal` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `payer-coordinator` | Preserve selected entity, query, state, and recovery when topology changes. |
| charge pending/final | `charge-and-service-ledger` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| coverage active/unknown/conflicting | `coverage-and-coordination-order` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| order unresolved | `payer-submission-chain` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| submission draft/sent/rejected | `selected-payer-evidence-and-response` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| response partial/denied/paid | `allowed-paid-denied-adjustment-ledger` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| duplicate payment | `remainder-and-next-payer` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| adjustment invalid | `final-responsibility-and-appeal` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| remainder mismatch and appeal pending. | `final-responsibility-and-appeal` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must apply at least two payer responses in order, explain a denial/adjustment, prevent amount imbalance, route remainder correctly and preserve appeal evidence.

### Reject

- Reject invoice detail; this is `AR-MP-90` evidence and must route to an adjacent archetype.
- Reject claim form; this is `AR-MP-91` evidence and must route to an adjacent archetype.
- Reject payment split; this is `AR-MP-92` evidence and must route to an adjacent archetype.
- Reject line-item dispute; this is `AR-MP-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-MP-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, truthful state meaning, and permitted actions to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, replace the dominant task, or weaken keyboard, focus, responsive, or recovery parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, responsive transformation, interaction, and accessibility obligations. It does not name StarCi owners, select exact geometry, create product facts, or authorize copying a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [CMS — Coordination of Benefits](https://www.cms.gov/medicare/coordination-benefits-recovery/overview) | Supports payer order and responsibility coordination. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [HL7 — ExplanationOfBenefit](https://hl7.org/fhir/explanationofbenefit.html) | Supports adjudication amounts, denials, and benefit responses. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announcing balance and appeal changes. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "multi-payer-responsibility-coordinator",
  "situationCodes": [
    "<matched AR-MP-* codes>"
  ],
  "searchAliases": [
    "coordination of benefits",
    "ordered payer adjudication",
    "charge conservation",
    "payer remainder appeal"
  ],
  "dominantTask": "Coordinate responsibility for a charge across multiple payers by establishing coverage order, submitting evidence, applying each adjudication and reconciling the remaining balance.",
  "regions": [
    "payer-coordinator",
    "charge-and-service-ledger",
    "coverage-and-coordination-order",
    "payer-submission-chain",
    "selected-payer-evidence-and-response",
    "allowed-paid-denied-adjustment-ledger",
    "remainder-and-next-payer",
    "final-responsibility-and-appeal"
  ],
  "regionRelationships": [
    "payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "charge pending/final",
    "coverage active/unknown/conflicting",
    "order unresolved",
    "submission draft/sent/rejected",
    "response partial/denied/paid",
    "duplicate payment",
    "adjustment invalid",
    "remainder mismatch and appeal pending."
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

