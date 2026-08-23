# Interrupted Service Continuity Router

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `interrupted-service-continuity-router` |
| Family | Support |
| Dominant task | Preserve an unfinished user task when its primary service channel becomes unavailable, select an alternate channel that supports the remaining operations and access needs, and transfer reusable state with a continuity handoff. |
| Search aliases | `interrupted task continuity`, `warm channel transfer`, `state compatibility routing`, `restoration reconciliation` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Preserve an unfinished user task when its primary service channel becomes unavailable, select an alternate channel that supports the remaining operations and access needs, and transfer reusable state with a continuity handoff.
- The required region graph remains `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-IC-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-IC-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-IC-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-IC-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-IC-05` | Template must preserve a saved task position, filter alternate channels by operation and access needs, disclose non-transferable evidence, issue an accessible handoff and reconcile later completion/restoration. | Required evidence. |
| `AR-IC-90` | communication-delivery-recovery-center | Reject. |
| `AR-IC-91` | stable service hub | Reject. |
| `AR-IC-92` | outage dashboard | Reject. |
| `AR-IC-93` | completed handoff | Reject. |

### Selection rule

Select `interrupted-service-continuity-router` only when `AR-IC-01` through `AR-IC-05` are evidenced and no `AR-IC-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
continuity-router
   `-- disruption-scope-and-authority
      `-- interrupted-task-state
         `-- remaining-operation-and-access-constraints
            `-- alternative-channel-capability-register
               `-- state-transfer-compatibility
                  `-- selected-continuity-route
                     `-- handoff-token-and-commitments
                        `-- restoration-reconciliation
```

Declared relationship expression: `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `continuity-router` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `disruption-scope-and-authority` | Owns disruption scope and authority evidence, action, state, and recovery. | Follows `continuity-router` in semantic order and consumes its exact selected context. |
| `interrupted-task-state` | Owns interrupted task state evidence, action, state, and recovery. | Follows `disruption-scope-and-authority` in semantic order and consumes its exact selected context. |
| `remaining-operation-and-access-constraints` | Owns remaining operation and access constraints evidence, action, state, and recovery. | Follows `interrupted-task-state` in semantic order and consumes its exact selected context. |
| `alternative-channel-capability-register` | Owns alternative channel capability register evidence, action, state, and recovery. | Follows `remaining-operation-and-access-constraints` in semantic order and consumes its exact selected context. |
| `state-transfer-compatibility` | Owns state transfer compatibility evidence, action, state, and recovery. | Follows `alternative-channel-capability-register` in semantic order and consumes its exact selected context. |
| `selected-continuity-route` | Owns selected continuity route evidence, action, state, and recovery. | Follows `state-transfer-compatibility` in semantic order and consumes its exact selected context. |
| `handoff-token-and-commitments` | Owns handoff token and commitments evidence, action, state, and recovery. | Follows `selected-continuity-route` in semantic order and consumes its exact selected context. |
| `restoration-reconciliation` | Owns restoration reconciliation evidence, action, state, and recovery. | Follows `handoff-token-and-commitments` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Interrupted-task state, alternate-channel capability comparison and transfer/handoff detail remain visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `none` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Current task and viable channels own the workspace; disruption scope becomes a drawer while transfer limitations stay adjacent.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `none` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Saved task position → viable alternate routes → what transfers versus repeats → handoff token/instructions → completion or restoration reconciliation.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `none` is optional and bounded.

### Reflow

- Semantic and DOM order is `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.
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
| Initial / loading | `disruption-scope-and-authority` | Identify pending scope and preserve semantic position. |
| Ready | `interrupted-task-state` | Expose the complete dominant task and current version. |
| Empty / not applicable | `remaining-operation-and-access-constraints` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `alternative-channel-capability-register` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `handoff-token-and-commitments` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `restoration-reconciliation` | Prevent duplicate action and announce progress without moving focus. |
| Success | `restoration-reconciliation` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `disruption-scope-and-authority` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `restoration-reconciliation` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `continuity-router` | Preserve selected entity, query, state, and recovery when topology changes. |
| channel healthy/degraded/unavailable | `disruption-scope-and-authority` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| task state saved/partial/lost | `interrupted-task-state` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| alternate available/inaccessible/full | `remaining-operation-and-access-constraints` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| transfer compatible/partial/impossible | `alternative-channel-capability-register` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| handoff pending/accepted/expired | `state-transfer-compatibility` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| restoration detected and reconciliation conflict/complete. | `selected-continuity-route` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must preserve a saved task position, filter alternate channels by operation and access needs, disclose non-transferable evidence, issue an accessible handoff and reconcile later completion/restoration.

### Reject

- Reject communication-delivery-recovery-center; this is `AR-IC-90` evidence and must route to an adjacent archetype.
- Reject stable service hub; this is `AR-IC-91` evidence and must route to an adjacent archetype.
- Reject outage dashboard; this is `AR-IC-92` evidence and must route to an adjacent archetype.
- Reject completed handoff; this is `AR-IC-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-IC-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [GOV.UK — Joined-up Channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels) | Supports continuity across online, phone, paper, and face-to-face channels. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FEMA — Continuity Guidance Circular](https://www.fema.gov/sites/default/files/documents/fema_continuity-guidance-circular_082024.pdf) | Supports continuity capabilities, essential functions, and restoration. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports handoff and restoration announcements. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "interrupted-service-continuity-router",
  "situationCodes": [
    "<matched AR-IC-* codes>"
  ],
  "searchAliases": [
    "interrupted task continuity",
    "warm channel transfer",
    "state compatibility routing",
    "restoration reconciliation"
  ],
  "dominantTask": "Preserve an unfinished user task when its primary service channel becomes unavailable, select an alternate channel that supports the remaining operations and access needs, and transfer reusable state with a continuity handoff.",
  "regions": [
    "continuity-router",
    "disruption-scope-and-authority",
    "interrupted-task-state",
    "remaining-operation-and-access-constraints",
    "alternative-channel-capability-register",
    "state-transfer-compatibility",
    "selected-continuity-route",
    "handoff-token-and-commitments",
    "restoration-reconciliation"
  ],
  "regionRelationships": [
    "continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "channel healthy/degraded/unavailable",
    "task state saved/partial/lost",
    "alternate available/inaccessible/full",
    "transfer compatible/partial/impossible",
    "handoff pending/accepted/expired",
    "restoration detected and reconciliation conflict/complete."
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

