# Orbital Conjunction Assessment Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `orbital-conjunction-assessment-workbench` |
| Family | Work |
| Dominant task | Assess a predicted orbital encounter and choose a mitigation using relative geometry, uncertainty, risk trend and rescreened maneuver evidence. |
| Search aliases | `orbital encounter assessment`, `covariance risk trend`, `maneuver rescreen`, `conjunction disposition` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Assess a predicted orbital encounter and choose a mitigation using relative geometry, uncertainty, risk trend and rescreened maneuver evidence.
- The required region graph remains `conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-OC-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-OC-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-OC-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-OC-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-OC-05` | Template must select an event, connect tabular and visual uncertainty evidence, compare pre/post-maneuver risk, block disposition before rescreen and offer a text equivalent for every projection. | Required evidence. |
| `AR-OC-90` | map-led monitor | Reject. |
| `AR-OC-91` | scenario sensitivity modeler | Reject. |
| `AR-OC-92` | generic risk dashboard | Reject. |
| `AR-OC-93` | 3D viewer | Reject. |

### Selection rule

Select `orbital-conjunction-assessment-workbench` only when `AR-OC-01` through `AR-OC-05` are evidenced and no `AR-OC-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
conjunction-assessment
   `-- event-queue
      `-- selected-event
         `-- relative-orbit-projection
            `-- encounter-plane-covariance
               `-- probability-and-risk-trend
                  `-- maneuver-candidates
                     `-- mandatory-rescreen-comparison
                        `-- disposition-ledger
```

Declared relationship expression: `conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `conjunction-assessment` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `event-queue` | Owns event queue evidence, action, state, and recovery. | Follows `conjunction-assessment` in semantic order and consumes its exact selected context. |
| `selected-event` | Owns selected event evidence, action, state, and recovery. | Follows `event-queue` in semantic order and consumes its exact selected context. |
| `relative-orbit-projection` | Owns relative orbit projection evidence, action, state, and recovery. | Synchronizes bidirectionally with `selected-event` under one selected context. |
| `encounter-plane-covariance` | Owns encounter plane covariance evidence, action, state, and recovery. | Synchronizes bidirectionally with `relative-orbit-projection` under one selected context. |
| `probability-and-risk-trend` | Owns probability and risk trend evidence, action, state, and recovery. | Synchronizes bidirectionally with `encounter-plane-covariance` under one selected context. |
| `maneuver-candidates` | Owns maneuver candidates evidence, action, state, and recovery. | Follows `probability-and-risk-trend` in semantic order and consumes its exact selected context. |
| `mandatory-rescreen-comparison` | Owns mandatory rescreen comparison evidence, action, state, and recovery. | Follows `maneuver-candidates` in semantic order and consumes its exact selected context. |
| `disposition-ledger` | Owns disposition ledger evidence, action, state, and recovery. | Follows `mandatory-rescreen-comparison` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Event queue, orbit projection, encounter plane, risk trend and maneuver comparison remain linked.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `relative-orbit-projection` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Encounter plane and risk trend remain primary; orbit becomes on-demand and candidates move to a drawer.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `relative-orbit-projection` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Event dossier → risk facts/trend → tabular geometry/covariance → maneuver cards → rescreen comparison → disposition; no miniature 3D view is required.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `relative-orbit-projection` is optional and bounded.

### Reflow

- Semantic and DOM order is `conjunction-assessment → event-queue → selected-event → relative-orbit-projection → encounter-plane-covariance → probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.
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
| Initial / loading | `event-queue` | Identify pending scope and preserve semantic position. |
| Ready | `selected-event` | Expose the complete dominant task and current version. |
| Empty / not applicable | `relative-orbit-projection` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `encounter-plane-covariance` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `mandatory-rescreen-comparison` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `disposition-ledger` | Prevent duplicate action and announce progress without moving focus. |
| Success | `disposition-ledger` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `event-queue` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `disposition-ledger` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `conjunction-assessment` | Preserve selected entity, query, state, and recovery when topology changes. |
| event loading/stale | `event-queue` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| covariance missing/low-confidence | `selected-event` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| risk below/above threshold | `relative-orbit-projection` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| trajectory update | `encounter-plane-covariance` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| candidate infeasible | `probability-and-risk-trend` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| rescreen pending/failure | `maneuver-candidates` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| collision risk reduced/increased and decision approved/escalated. | `mandatory-rescreen-comparison` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must select an event, connect tabular and visual uncertainty evidence, compare pre/post-maneuver risk, block disposition before rescreen and offer a text equivalent for every projection.

### Reject

- Reject map-led monitor; this is `AR-OC-90` evidence and must route to an adjacent archetype.
- Reject scenario sensitivity modeler; this is `AR-OC-91` evidence and must route to an adjacent archetype.
- Reject generic risk dashboard; this is `AR-OC-92` evidence and must route to an adjacent archetype.
- Reject 3D viewer; this is `AR-OC-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-OC-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [NASA CARA — Training Materials](https://www.nasa.gov/cara/training-materials-and-documentation/) | Supports conjunction assessment, risk, and mitigation evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ESA — Collision Avoidance](https://www.esa.int/Space_Safety/Space_Debris/Reentry_and_collision_avoidance) | Supports collision avoidance workflow and maneuver assessment. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [CCSDS — Conjunction Data Message](https://ccsds.org/Pubs/508x0b1e2c2.pdf) | Supports encounter data and covariance exchange. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports bounded complex projections and text reflow. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "orbital-conjunction-assessment-workbench",
  "situationCodes": [
    "<matched AR-OC-* codes>"
  ],
  "searchAliases": [
    "orbital encounter assessment",
    "covariance risk trend",
    "maneuver rescreen",
    "conjunction disposition"
  ],
  "dominantTask": "Assess a predicted orbital encounter and choose a mitigation using relative geometry, uncertainty, risk trend and rescreened maneuver evidence.",
  "regions": [
    "conjunction-assessment",
    "event-queue",
    "selected-event",
    "relative-orbit-projection",
    "encounter-plane-covariance",
    "probability-and-risk-trend",
    "maneuver-candidates",
    "mandatory-rescreen-comparison",
    "disposition-ledger"
  ],
  "regionRelationships": [
    "conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "conjunction-assessment → event-queue → selected-event → relative-orbit-projection → encounter-plane-covariance → probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "relative-orbit-projection",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "event loading/stale",
    "covariance missing/low-confidence",
    "risk below/above threshold",
    "trajectory update",
    "candidate infeasible",
    "rescreen pending/failure",
    "collision risk reduced/increased and decision approved/escalated."
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

