# Multi Service Life Event Orchestrator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-service-life-event-orchestrator` |
| Family | Flow |
| Dominant task | Orchestrate a life event across multiple autonomous services by collecting one canonical fact set, deriving service-specific submissions, tracking independent decisions and reconciling the overall outcome. |
| Search aliases | `joined-up life event`, `canonical fact fan-out`, `multi-service receipts`, `autonomous service submission` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Orchestrate a life event across multiple autonomous services by collecting one canonical fact set, deriving service-specific submissions, tracking independent decisions and reconciling the overall outcome.
- The required region graph remains `life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents ×n → independent-status-and-receipts → unresolved-obligation-summary → event-closure`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-LE-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-LE-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-LE-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-LE-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-LE-05` | Template must reuse canonical facts across at least three services, expose a service-specific delta, track independent receipts, handle one rejection and close only after remaining obligations are explicit. | Required evidence. |
| `AR-LE-90` | multi-program-eligibility-screening | Reject. |
| `AR-LE-91` | service hub | Reject. |
| `AR-LE-92` | multi-step form | Reject. |
| `AR-LE-93` | case management | Reject. |

### Selection rule

Select `multi-service-life-event-orchestrator` only when `AR-LE-01` through `AR-LE-05` are evidenced and no `AR-LE-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
life-event-orchestrator
   `-- event-person-and-authority
      `-- canonical-fact-register
         `-- affected-service-map
            `-- service-specific-requirement-deltas
               `-- submissions-and-consents
                  `-- independent-status-and-receipts
                     `-- unresolved-obligation-summary
                        `-- event-closure
```

Declared relationship expression: `life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents ×n → independent-status-and-receipts → unresolved-obligation-summary → event-closure`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `life-event-orchestrator` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `event-person-and-authority` | Owns event person and authority evidence, action, state, and recovery. | Follows `life-event-orchestrator` in semantic order and consumes its exact selected context. |
| `canonical-fact-register` | Owns canonical fact register evidence, action, state, and recovery. | Follows `event-person-and-authority` in semantic order and consumes its exact selected context. |
| `affected-service-map` | Owns affected service map evidence, action, state, and recovery. | Follows `canonical-fact-register` in semantic order and consumes its exact selected context. |
| `service-specific-requirement-deltas` | Owns service specific requirement deltas evidence, action, state, and recovery. | Follows `affected-service-map` in semantic order and consumes its exact selected context. |
| `submissions-and-consents` | Owns submissions and consents evidence, action, state, and recovery. | Repeats per autonomous party while retaining separate authority and receipt. |
| `independent-status-and-receipts` | Owns independent status and receipts evidence, action, state, and recovery. | Follows `submissions-and-consents` in semantic order and consumes its exact selected context. |
| `unresolved-obligation-summary` | Owns unresolved obligation summary evidence, action, state, and recovery. | Follows `independent-status-and-receipts` in semantic order and consumes its exact selected context. |
| `event-closure` | Owns event closure evidence, action, state, and recovery. | Follows `unresolved-obligation-summary` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Canonical facts, affected services, selected requirement delta and multi-service status/receipt rail remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `affected-service-map` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Service map and unresolved deltas remain primary; canonical facts and receipts become synchronized drawers.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `affected-service-map` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Event summary → affected service list → selected service delta/submission → receipt/status → next unresolved service → overall closure; facts are entered once and reviewed where transformed.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `affected-service-map` is optional and bounded.

### Reflow

- Semantic and DOM order is `life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents → independent-status-and-receipts → unresolved-obligation-summary → event-closure`.
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
| Initial / loading | `event-person-and-authority` | Identify pending scope and preserve semantic position. |
| Ready | `canonical-fact-register` | Expose the complete dominant task and current version. |
| Empty / not applicable | `affected-service-map` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `service-specific-requirement-deltas` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `unresolved-obligation-summary` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `event-closure` | Prevent duplicate action and announce progress without moving focus. |
| Success | `event-closure` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `event-person-and-authority` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `event-closure` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `life-event-orchestrator` | Preserve selected entity, query, state, and recovery when topology changes. |
| event draft/verified | `event-person-and-authority` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| fact missing/conflicting/stale | `canonical-fact-register` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| service applicable/not-applicable | `affected-service-map` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| requirement satisfied/gap | `service-specific-requirement-deltas` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| consent needed/withdrawn | `submissions-and-consents` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| submission pending/rejected/accepted | `independent-status-and-receipts` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| receipt missing and overall closure partial/complete. | `unresolved-obligation-summary` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must reuse canonical facts across at least three services, expose a service-specific delta, track independent receipts, handle one rejection and close only after remaining obligations are explicit.

### Reject

- Reject multi-program-eligibility-screening; this is `AR-LE-90` evidence and must route to an adjacent archetype.
- Reject service hub; this is `AR-LE-91` evidence and must route to an adjacent archetype.
- Reject multi-step form; this is `AR-LE-92` evidence and must route to an adjacent archetype.
- Reject case management; this is `AR-LE-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-LE-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [GOV.UK — Joined-up Channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels) | Supports whole-service continuity across autonomous channels. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [U.S. Web Design System — Patterns](https://designsystem.digital.gov/patterns/) | Supports public-service collection, review, and completion patterns. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent receipt and status announcements. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "multi-service-life-event-orchestrator",
  "situationCodes": [
    "<matched AR-LE-* codes>"
  ],
  "searchAliases": [
    "joined-up life event",
    "canonical fact fan-out",
    "multi-service receipts",
    "autonomous service submission"
  ],
  "dominantTask": "Orchestrate a life event across multiple autonomous services by collecting one canonical fact set, deriving service-specific submissions, tracking independent decisions and reconciling the overall outcome.",
  "regions": [
    "life-event-orchestrator",
    "event-person-and-authority",
    "canonical-fact-register",
    "affected-service-map",
    "service-specific-requirement-deltas",
    "submissions-and-consents",
    "independent-status-and-receipts",
    "unresolved-obligation-summary",
    "event-closure"
  ],
  "regionRelationships": [
    "life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents ×n → independent-status-and-receipts → unresolved-obligation-summary → event-closure"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents → independent-status-and-receipts → unresolved-obligation-summary → event-closure",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "affected-service-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "event draft/verified",
    "fact missing/conflicting/stale",
    "service applicable/not-applicable",
    "requirement satisfied/gap",
    "consent needed/withdrawn",
    "submission pending/rejected/accepted",
    "receipt missing and overall closure partial/complete."
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

