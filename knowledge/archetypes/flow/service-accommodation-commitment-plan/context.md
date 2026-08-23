# Service Accommodation Commitment Plan

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `service-accommodation-commitment-plan` |
| Family | Flow |
| Dominant task | Create an actionable service accommodation plan by mapping a person's access needs to journey-specific barriers, selecting accommodations, and recording reciprocal provider and user commitments. |
| Search aliases | `access accommodation plan`, `journey barrier mapping`, `provider user commitments`, `accessible service exception` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Create an actionable service accommodation plan by mapping a person's access needs to journey-specific barriers, selecting accommodations, and recording reciprocal provider and user commitments.
- The required region graph remains `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-AC-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-AC-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-AC-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-AC-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-AC-05` | Template must map multiple needs to journey barriers, compare feasible accommodations, assign provider ownership, record user preference/consent and escalate one unavailable commitment. | Required evidence. |
| `AR-AC-90` | profile settings | Reject. |
| `AR-AC-91` | accessibility checklist | Reject. |
| `AR-AC-92` | care plan | Reject. |
| `AR-AC-93` | generic task list | Reject. |

### Selection rule

Select `service-accommodation-commitment-plan` only when `AR-AC-01` through `AR-AC-05` are evidenced and no `AR-AC-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
accommodation-plan
   `-- person-preferences-and-consent
      `-- service-journey-step-map
         `-- access-need-by-barrier-matrix
            `-- accommodation-options-and-feasibility
               `-- provider-commitments
                  `-- user-commitments
                     `-- exception-escalation
                        `-- confirmed-plan-and-review
```

Declared relationship expression: `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `accommodation-plan` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `person-preferences-and-consent` | Owns person preferences and consent evidence, action, state, and recovery. | Follows `accommodation-plan` in semantic order and consumes its exact selected context. |
| `service-journey-step-map` | Owns service journey step map evidence, action, state, and recovery. | Follows `person-preferences-and-consent` in semantic order and consumes its exact selected context. |
| `access-need-by-barrier-matrix` | Owns access need by barrier matrix evidence, action, state, and recovery. | Follows `service-journey-step-map` in semantic order and consumes its exact selected context. |
| `accommodation-options-and-feasibility` | Owns accommodation options and feasibility evidence, action, state, and recovery. | Follows `access-need-by-barrier-matrix` in semantic order and consumes its exact selected context. |
| `provider-commitments` | Owns provider commitments evidence, action, state, and recovery. | Synchronizes bidirectionally with `accommodation-options-and-feasibility` under one selected context. |
| `user-commitments` | Owns user commitments evidence, action, state, and recovery. | Synchronizes bidirectionally with `provider-commitments` under one selected context. |
| `exception-escalation` | Owns exception escalation evidence, action, state, and recovery. | Follows `user-commitments` in semantic order and consumes its exact selected context. |
| `confirmed-plan-and-review` | Owns confirmed plan and review evidence, action, state, and recovery. | Follows `exception-escalation` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Journey steps, need/barrier matrix, selected accommodation and commitment rail remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `service-journey-step-map` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Journey/barrier map remains primary; preferences and commitment details move to drawers.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `service-journey-step-map` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Journey step → barrier → preferred accommodation → provider/user commitment → exception → plan review; matrix becomes grouped accessible lists.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `service-journey-step-map` is optional and bounded.

### Reflow

- Semantic and DOM order is `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments → user-commitments → exception-escalation → confirmed-plan-and-review`.
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
| Initial / loading | `person-preferences-and-consent` | Identify pending scope and preserve semantic position. |
| Ready | `service-journey-step-map` | Expose the complete dominant task and current version. |
| Empty / not applicable | `access-need-by-barrier-matrix` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `accommodation-options-and-feasibility` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `exception-escalation` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `confirmed-plan-and-review` | Prevent duplicate action and announce progress without moving focus. |
| Success | `confirmed-plan-and-review` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `person-preferences-and-consent` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `confirmed-plan-and-review` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `accommodation-plan` | Preserve selected entity, query, state, and recovery when topology changes. |
| preference unknown/restricted | `person-preferences-and-consent` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| barrier identified/unverified | `service-journey-step-map` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| accommodation available/unavailable | `access-need-by-barrier-matrix` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| feasibility pending | `accommodation-options-and-feasibility` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| provider owner missing | `provider-commitments` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| user commitment declined | `user-commitments` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| exception escalated | `exception-escalation` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| plan confirmed/stale and review due. | `confirmed-plan-and-review` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must map multiple needs to journey barriers, compare feasible accommodations, assign provider ownership, record user preference/consent and escalate one unavailable commitment.

### Reject

- Reject profile settings; this is `AR-AC-90` evidence and must route to an adjacent archetype.
- Reject accessibility checklist; this is `AR-AC-91` evidence and must route to an adjacent archetype.
- Reject care plan; this is `AR-AC-92` evidence and must route to an adjacent archetype.
- Reject generic task list; this is `AR-AC-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-AC-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [NHS England — Accessible Information Standard](https://www.england.nhs.uk/accessible-information-standard/) | Supports identifying, recording, sharing, and meeting communication needs. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ADA.gov — Effective Communication](https://www.ada.gov/resources/effective-communication/) | Supports effective auxiliary aids and service obligations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports accessible matrix-to-grouped-list transformation. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "service-accommodation-commitment-plan",
  "situationCodes": [
    "<matched AR-AC-* codes>"
  ],
  "searchAliases": [
    "access accommodation plan",
    "journey barrier mapping",
    "provider user commitments",
    "accessible service exception"
  ],
  "dominantTask": "Create an actionable service accommodation plan by mapping a person's access needs to journey-specific barriers, selecting accommodations, and recording reciprocal provider and user commitments.",
  "regions": [
    "accommodation-plan",
    "person-preferences-and-consent",
    "service-journey-step-map",
    "access-need-by-barrier-matrix",
    "accommodation-options-and-feasibility",
    "provider-commitments",
    "user-commitments",
    "exception-escalation",
    "confirmed-plan-and-review"
  ],
  "regionRelationships": [
    "accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments → user-commitments → exception-escalation → confirmed-plan-and-review",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "service-journey-step-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "preference unknown/restricted",
    "barrier identified/unverified",
    "accommodation available/unavailable",
    "feasibility pending",
    "provider owner missing",
    "user commitment declined",
    "exception escalated",
    "plan confirmed/stale and review due."
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

