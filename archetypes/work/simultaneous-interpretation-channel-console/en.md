# Simultaneous Interpretation Channel Console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `simultaneous-interpretation-channel-console` |
| Family | Work |
| Dominant task | Maintain live language-channel coverage by assigning primary and backup interpreters, managing direction and relay paths, and handing channels over without losing the floor feed. |
| Search aliases | `interpretation channel coverage`, `interpreter relay routing`, `live language handoff`, `booth health` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Maintain live language-channel coverage by assigning primary and backup interpreters, managing direction and relay paths, and handing channels over without losing the floor feed.
- The required region graph remains `interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.
- Every state and action binds to one selected context and its provenance.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SI-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-SI-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-SI-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-SI-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-SI-05` | Template must assign primary/backup interpreters, configure a relay, surface uncovered language, complete a handoff and announce health changes without moving focus. | Required evidence. |
| `AR-SI-90` | facilitated meeting | Reject. |
| `AR-SI-91` | localization workbench | Reject. |
| `AR-SI-92` | audio mix console | Reject. |
| `AR-SI-93` | generic roster | Reject. |

### Selection rule

Select `simultaneous-interpretation-channel-console` only when `AR-SI-01` through `AR-SI-05` are evidenced and no `AR-SI-9*` code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` when any rejection code holds. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
interpretation-console
   `-- floor-speaker-feed
      `-- language-channel-matrix
         `-- interpreter-booth-roster
            `-- primary-backup-relay-routes
               `-- active-channel-health
                  `-- handoff-and-incident-controls
                     `-- listener-coverage-and-session-log
```

Declared relationship expression: `interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `interpretation-console` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; it cannot be replaced by a generic container. |
| `floor-speaker-feed` | Owns floor speaker feed evidence, action, state, and recovery. | Follows `interpretation-console` in semantic order and consumes its exact selected context. |
| `language-channel-matrix` | Owns language channel matrix evidence, action, state, and recovery. | Synchronizes bidirectionally with `floor-speaker-feed` under one selected context. |
| `interpreter-booth-roster` | Owns interpreter booth roster evidence, action, state, and recovery. | Synchronizes bidirectionally with `language-channel-matrix` under one selected context. |
| `primary-backup-relay-routes` | Owns primary backup relay routes evidence, action, state, and recovery. | Follows `interpreter-booth-roster` in semantic order and consumes its exact selected context. |
| `active-channel-health` | Owns active channel health evidence, action, state, and recovery. | Follows `primary-backup-relay-routes` in semantic order and consumes its exact selected context. |
| `handoff-and-incident-controls` | Owns handoff and incident controls evidence, action, state, and recovery. | Follows `active-channel-health` in semantic order and consumes its exact selected context. |
| `listener-coverage-and-session-log` | Owns listener coverage and session log evidence, action, state, and recovery. | Follows `handoff-and-incident-controls` in semantic order and consumes its exact selected context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when all simultaneous regions named by the contract cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Floor feed, channel matrix, interpreter roster, relay paths and health/incident rail coexist.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `language-channel-matrix` alone may own bounded horizontal overflow; ordinary content never owns page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant cross-region relationship.
- **Topology response:** Active channel becomes primary; full matrix and roster move to synchronized drawers while floor language persists.
- **Navigation replacement:** A named synchronized drawer, disclosure, or pane replaces each displaced persistent region and exposes current state in its trigger.
- **Sticky boundary:** A persistent action remains only while its exact target is visible and becomes in-flow at short height.
- **Overflow owner:** `language-channel-matrix` retains the only bounded overflow axis and a text or list equivalent.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot keep readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Channel list → channel direction/feed → interpreter and relay assignment → health → handoff/incident; operator and interpreter views preserve role-specific controls.
- **Navigation replacement:** Use one primary-pane sequence with explicit Previous and Next controls that restore selection, query, state, and scroll context.
- **Sticky boundary:** The current action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The text or relation ledger is primary; `language-channel-matrix` is optional and bounded.

### Reflow

- Semantic and DOM order is `interpretation-console → floor-speaker-feed → language-channel-matrix → interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.
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
| Initial / loading | `floor-speaker-feed` | Identify pending scope and preserve semantic position. |
| Ready | `language-channel-matrix` | Expose the complete dominant task and current version. |
| Empty / not applicable | `interpreter-booth-roster` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `primary-backup-relay-routes` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `handoff-and-incident-controls` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `listener-coverage-and-session-log` | Prevent duplicate action and announce progress without moving focus. |
| Success | `listener-coverage-and-session-log` | Expose the outcome, provenance, and next valid action. |
| Stale / conflict | `floor-speaker-feed` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `listener-coverage-and-session-log` | Move focus only to a required error summary or opened modal, then return it to the exact trigger. |
| Responsive presentation | `interpretation-console` | Preserve selected entity, query, state, and recovery when topology changes. |
| session offline/live/ended | `floor-speaker-feed` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| floor language known/unknown | `language-channel-matrix` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| channel covered/degraded/uncovered | `interpreter-booth-roster` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| interpreter active/break/unavailable | `primary-backup-relay-routes` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| relay valid/broken | `active-channel-health` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| handoff pending/accepted | `handoff-and-incident-controls` | Expose this task-specific state with its cause, consequence, and valid recovery. |
| listener issue and session log failure. | `listener-coverage-and-session-log` | Expose this task-specific state with its cause, consequence, and valid recovery. |

## Boundaries

### Accept

- Accept only when the dominant task transforms the required evidence into the declared outcome.
- Accept only when each required region has an independent owner and the named relationships remain explicit.
- Accept only when template must assign primary/backup interpreters, configure a relay, surface uncovered language, complete a handoff and announce health changes without moving focus.

### Reject

- Reject facilitated meeting; this is `AR-SI-90` evidence and must route to an adjacent archetype.
- Reject localization workbench; this is `AR-SI-91` evidence and must route to an adjacent archetype.
- Reject audio mix console; this is `AR-SI-92` evidence and must route to an adjacent archetype.
- Reject generic roster; this is `AR-SI-93` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete required graph, transformation contract, state and recovery parity, and `AR-SI-05` all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship. Report `duplicate-or-variation` for differences limited to nouns, density, color, card count, component, or state.

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
| [Microsoft Teams — Language Interpretation](https://support.microsoft.com/en-us/teams/meetings/use-language-interpretation-in-microsoft-teams-meetings) | Supports language-channel assignment and interpreter roles. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Zoom — Language Interpretation](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064768) | Supports live language channels and handoff context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports health announcements without focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "simultaneous-interpretation-channel-console",
  "situationCodes": [
    "<matched AR-SI-* codes>"
  ],
  "searchAliases": [
    "interpretation channel coverage",
    "interpreter relay routing",
    "live language handoff",
    "booth health"
  ],
  "dominantTask": "Maintain live language-channel coverage by assigning primary and backup interpreters, managing direction and relay paths, and handing channels over without losing the floor feed.",
  "regions": [
    "interpretation-console",
    "floor-speaker-feed",
    "language-channel-matrix",
    "interpreter-booth-roster",
    "primary-backup-relay-routes",
    "active-channel-health",
    "handoff-and-incident-controls",
    "listener-coverage-and-session-log"
  ],
  "regionRelationships": [
    "interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "interpretation-console → floor-speaker-feed → language-channel-matrix → interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "language-channel-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "session offline/live/ended",
    "floor language known/unknown",
    "channel covered/degraded/uncovered",
    "interpreter active/break/unavailable",
    "relay valid/broken",
    "handoff pending/accepted",
    "listener issue and session log failure."
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

