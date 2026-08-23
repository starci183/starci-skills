# Multi Creditor Hardship Plan Negotiator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-creditor-hardship-plan-negotiator` |
| Family | Flow |
| Dominant task | Negotiate a sustainable hardship plan across multiple creditors by proving an affordability envelope, comparing offers and counters, and guarding the combined commitment schedule. |
| Search aliases | `multi-creditor negotiation`, `affordability envelope`, `hardship counteroffer`, `combined commitment schedule` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Negotiate a sustainable hardship plan across multiple creditors by proving an affordability envelope, comparing offers and counters, and guarding the combined commitment schedule.
- The required region graph remains `hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters ×n → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-HN-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-HN-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-HN-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-HN-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-HN-05` | Template must model at least three creditors, counter one offer, reject a combined overcommitment, produce a sustainable schedule and retain evidence plus agreement provenance. | Required evidence. |
| `AR-HN-90` | budgeting | Reject. |
| `AR-HN-91` | debt list | Reject. |
| `AR-HN-92` | single settlement | Reject. |
| `AR-HN-93` | generic negotiation chat | Reject. |

### Selection rule

Select `multi-creditor-hardship-plan-negotiator` only when `AR-HN-01` through `AR-HN-05` are evidenced and no `AR-HN-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
hardship-negotiator
   `-- verified-income-essential-cost-and-affordability
      `-- creditor-obligation-register
         `-- creditor-offers-and-counters
            `-- global-commitment-envelope
               `-- scenario-and-priority-tradeoffs
                  `-- selected-multi-creditor-plan
                     `-- agreements-schedule-and-review
```

Declared relationship expression: `hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters ×n → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `hardship-negotiator` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `verified-income-essential-cost-and-affordability` | Owns verified income essential cost and affordability evidence, action, state, and recovery. | Follows `hardship-negotiator` in semantic order and consumes its exact selected context. |
| `creditor-obligation-register` | Owns creditor obligation register evidence, action, state, and recovery. | Follows `verified-income-essential-cost-and-affordability` in semantic order and consumes its exact selected context. |
| `creditor-offers-and-counters` | Owns creditor offers and counters evidence, action, state, and recovery. | Repeats per autonomous party while retaining separate authority and receipt. |
| `global-commitment-envelope` | Owns global commitment envelope evidence, action, state, and recovery. | Follows `creditor-offers-and-counters` in semantic order and consumes its exact selected context. |
| `scenario-and-priority-tradeoffs` | Owns scenario and priority tradeoffs evidence, action, state, and recovery. | Follows `global-commitment-envelope` in semantic order and consumes its exact selected context. |
| `selected-multi-creditor-plan` | Owns selected multi creditor plan evidence, action, state, and recovery. | Follows `scenario-and-priority-tradeoffs` in semantic order and consumes its exact selected context. |
| `agreements-schedule-and-review` | Owns agreements schedule and review evidence, action, state, and recovery. | Follows `selected-multi-creditor-plan` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Affordability evidence, creditor register, offer/counter workspace and global commitment ledger remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `none` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Creditor offers and global envelope remain primary; detailed evidence and scenarios become drawers.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `none` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Affordability summary → creditor → offer/counter → global impact → next creditor → combined schedule/review; each acceptance revalidates the envelope.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `none` is optional and bounded.

### Reflow

- Semantic and DOM order is `hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review`.
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
| Initial / loading | `verified-income-essential-cost-and-affordability` | Identify pending scope and preserve semantic position. |
| Ready | `creditor-obligation-register` | Expose the complete dominant task and current version. |
| Empty / not applicable | `creditor-offers-and-counters` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `global-commitment-envelope` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-multi-creditor-plan` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `agreements-schedule-and-review` | Prevent duplicate action and announce progress without moving focus. |
| Success | `agreements-schedule-and-review` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `verified-income-essential-cost-and-affordability` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `agreements-schedule-and-review` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `hardship-negotiator` | Preserve selected entity, query, state, and recovery when topology changes. |
| evidence missing/verified | `verified-income-essential-cost-and-affordability` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| obligation disputed | `creditor-obligation-register` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| creditor contacted/no-response | `creditor-offers-and-counters` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| offer proposed/countered/accepted/expired | `global-commitment-envelope` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| envelope safe/exceeded | `scenario-and-priority-tradeoffs` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| priority conflict | `selected-multi-creditor-plan` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| agreement pending | `agreements-schedule-and-review` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| payment schedule active and review due. | `agreements-schedule-and-review` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must model at least three creditors, counter one offer, reject a combined overcommitment, produce a sustainable schedule and retain evidence plus agreement provenance.

### Reject

- Reject budgeting; this is `AR-HN-90` evidence and must route to an adjacent archetype.
- Reject debt list; this is `AR-HN-91` evidence and must route to an adjacent archetype.
- Reject single settlement; this is `AR-HN-92` evidence and must route to an adjacent archetype.
- Reject generic negotiation chat; this is `AR-HN-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-HN-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [CFPB — Debt Collection](https://www.consumerfinance.gov/consumer-tools/debt-collection/) | Supports debt verification, response, and dispute context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [MoneyHelper — Dealing with Debt](https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt) | Supports affordability and multi-debt planning. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports stable negotiation and error-summary focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "multi-creditor-hardship-plan-negotiator",
  "situationCodes": [
    "<matched AR-HN-* codes>"
  ],
  "searchAliases": [
    "multi-creditor negotiation",
    "affordability envelope",
    "hardship counteroffer",
    "combined commitment schedule"
  ],
  "dominantTask": "Negotiate a sustainable hardship plan across multiple creditors by proving an affordability envelope, comparing offers and counters, and guarding the combined commitment schedule.",
  "regions": [
    "hardship-negotiator",
    "verified-income-essential-cost-and-affordability",
    "creditor-obligation-register",
    "creditor-offers-and-counters",
    "global-commitment-envelope",
    "scenario-and-priority-tradeoffs",
    "selected-multi-creditor-plan",
    "agreements-schedule-and-review"
  ],
  "regionRelationships": [
    "hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters ×n → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "evidence missing/verified",
    "obligation disputed",
    "creditor contacted/no-response",
    "offer proposed/countered/accepted/expired",
    "envelope safe/exceeded",
    "priority conflict",
    "agreement pending",
    "payment schedule active and review due."
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

