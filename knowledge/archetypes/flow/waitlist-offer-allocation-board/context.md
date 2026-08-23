# Waitlist Offer Allocation Board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `waitlist-offer-allocation-board` |
| Family | Flow |
| Dominant task | Allocate scarce openings from a waitlist by applying eligibility and priority rules, issuing time-bounded offers, recording responses, and recycling declined or expired capacity with a complete fairness trail. |
| Search aliases | `scarce-opening allocation`, `ranked waitlist offer`, `capacity recycling`, `fairness audit` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Allocate scarce openings from a waitlist by applying eligibility and priority rules, issuing time-bounded offers, recording responses, and recycling declined or expired capacity with a complete fairness trail.
- The required region graph remains `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-WO-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-WO-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-WO-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-WO-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-WO-05` | Template must explain why one candidate is next, issue an expiring offer, recover failed delivery, recycle a declined slot and keep policy version plus allocation audit visible. | Required evidence. |
| `AR-WO-90` | generic queue | Reject. |
| `AR-WO-91` | appointment booking | Reject. |
| `AR-WO-92` | inventory allocation | Reject. |
| `AR-WO-93` | notification center | Reject. |

### Selection rule

Select `waitlist-offer-allocation-board` only when `AR-WO-01` through `AR-WO-05` are evidenced and no `AR-WO-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
allocation-board
   `-- capacity-pool-and-policy-version
      `-- eligible-ranked-waitlist
         `-- selected-candidate-rule-evidence
            `-- offer-slot-allocation
               `-- response-window-and-contact-delivery
                  `-- accept-decline-expire
                     `-- recycled-capacity-and-next-candidate
                        `-- fairness-audit
```

Declared relationship expression: `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `allocation-board` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `capacity-pool-and-policy-version` | Owns capacity pool and policy version evidence, action, state, and recovery. | Follows `allocation-board` in semantic order and consumes its exact selected context. |
| `eligible-ranked-waitlist` | Owns eligible ranked waitlist evidence, action, state, and recovery. | Follows `capacity-pool-and-policy-version` in semantic order and consumes its exact selected context. |
| `selected-candidate-rule-evidence` | Owns selected candidate rule evidence evidence, action, state, and recovery. | Follows `eligible-ranked-waitlist` in semantic order and consumes its exact selected context. |
| `offer-slot-allocation` | Owns offer slot allocation evidence, action, state, and recovery. | Follows `selected-candidate-rule-evidence` in semantic order and consumes its exact selected context. |
| `response-window-and-contact-delivery` | Owns response window and contact delivery evidence, action, state, and recovery. | Follows `offer-slot-allocation` in semantic order and consumes its exact selected context. |
| `accept-decline-expire` | Owns accept decline expire evidence, action, state, and recovery. | Follows `response-window-and-contact-delivery` in semantic order and consumes its exact selected context. |
| `recycled-capacity-and-next-candidate` | Owns recycled capacity and next candidate evidence, action, state, and recovery. | Follows `accept-decline-expire` in semantic order and consumes its exact selected context. |
| `fairness-audit` | Owns fairness audit evidence, action, state, and recovery. | Follows `recycled-capacity-and-next-candidate` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Capacity pool, ranked waitlist, selected rule evidence and live offer/recycling rail remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `allocation-board` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Ranked candidates and active offers remain primary; policy evidence and audit move to synchronized drawers.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `allocation-board` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Capacity summary → next eligible candidate → rule explanation → issue offer → response/expiry → recycle or confirm; full waitlist is a filtered route.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `allocation-board` is optional and bounded.

### Reflow

- Semantic and DOM order is `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.
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
| Initial / loading | `capacity-pool-and-policy-version` | Identify pending scope and preserve semantic position. |
| Ready | `eligible-ranked-waitlist` | Expose the complete dominant task and current version. |
| Empty / not applicable | `selected-candidate-rule-evidence` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `offer-slot-allocation` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `recycled-capacity-and-next-candidate` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `fairness-audit` | Prevent duplicate action and announce progress without moving focus. |
| Success | `fairness-audit` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `capacity-pool-and-policy-version` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `fairness-audit` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `allocation-board` | Preserve selected entity, query, state, and recovery when topology changes. |
| capacity unknown/available/held/full | `capacity-pool-and-policy-version` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| candidate eligible/ineligible/pending evidence | `eligible-ranked-waitlist` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| rank recalculating/stale | `selected-candidate-rule-evidence` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| offer draft/sent/delivered/failed | `offer-slot-allocation` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| accepted/declined/expired | `response-window-and-contact-delivery` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| duplicate hold | `accept-decline-expire` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| appeal and allocation audited. | `recycled-capacity-and-next-candidate` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must explain why one candidate is next, issue an expiring offer, recover failed delivery, recycle a declined slot and keep policy version plus allocation audit visible.

### Reject

- Reject generic queue; this is `AR-WO-90` evidence and must route to an adjacent archetype.
- Reject appointment booking; this is `AR-WO-91` evidence and must route to an adjacent archetype.
- Reject inventory allocation; this is `AR-WO-92` evidence and must route to an adjacent archetype.
- Reject notification center; this is `AR-WO-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-WO-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [NHS England — Referral to treatment](https://www.england.nhs.uk/rtt/) | Supports waiting-time rules, priority, and recording. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [HUD — Housing Choice Voucher Tenants](https://www.hud.gov/helping-americans/housing-choice-vouchers-tenants) | Supports eligibility, preferences, finite offers, and expiry. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "waitlist-offer-allocation-board",
  "situationCodes": [
    "<matched AR-WO-* codes>"
  ],
  "searchAliases": [
    "scarce-opening allocation",
    "ranked waitlist offer",
    "capacity recycling",
    "fairness audit"
  ],
  "dominantTask": "Allocate scarce openings from a waitlist by applying eligibility and priority rules, issuing time-bounded offers, recording responses, and recycling declined or expired capacity with a complete fairness trail.",
  "regions": [
    "allocation-board",
    "capacity-pool-and-policy-version",
    "eligible-ranked-waitlist",
    "selected-candidate-rule-evidence",
    "offer-slot-allocation",
    "response-window-and-contact-delivery",
    "accept-decline-expire",
    "recycled-capacity-and-next-candidate",
    "fairness-audit"
  ],
  "regionRelationships": [
    "allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "capacity unknown/available/held/full",
    "candidate eligible/ineligible/pending evidence",
    "rank recalculating/stale",
    "offer draft/sent/delivered/failed",
    "accepted/declined/expired",
    "duplicate hold",
    "appeal and allocation audited."
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

