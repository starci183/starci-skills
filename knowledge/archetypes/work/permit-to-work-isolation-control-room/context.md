# Permit to work isolation control room

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `permit-to-work-isolation-control-room` |
| Family | Work |
| Dominant task | Authorize hazardous work only while isolations, tests, competence, and rescue controls remain valid, and suspend or close it when evidence changes. |
| Search aliases | `permit to work control`, `isolation register`, `hazardous work authorization` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Authorize hazardous work only while isolations, tests, competence, and rescue controls remain valid, and suspend or close it when evidence changes.
- Independent isolation, test, competence, rescue, and condition controls can invalidate authorization at any time.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PTW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-PTW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-PTW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-PTW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-PTW-90` | The dominant task is actually generic stage-gated process. | Reject. |
| `AR-PTW-91` | The dominant task is actually checklist. | Reject. |
| `AR-PTW-92` | The dominant task is actually command center. | Reject. |
| `AR-PTW-93` | The dominant task is actually job run. | Reject. |

### Selection rule

Select `permit-to-work-isolation-control-room` if and only if `AR-PTW-01` through `AR-PTW-04` are evidenced and none of `AR-PTW-90` through `AR-PTW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `permit-control` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `work-site-scope` | Owns Work Site Scope evidence or action and preserves its declared relationship to the current selection. |
| `hazards` | Owns Hazards evidence or action and preserves its declared relationship to the current selection. |
| `isolation-register` | Owns Isolation Register evidence or action and preserves its declared relationship to the current selection. |
| `test-monitor-readings` | Owns Test Monitor Readings evidence or action and preserves its declared relationship to the current selection. |
| `role-competency-rescue-roster` | Owns Role Competency Rescue Roster evidence or action and preserves its declared relationship to the current selection. |
| `permit-conditions` | Owns Permit Conditions evidence or action and preserves its declared relationship to the current selection. |
| `authorize-suspend-close` | Owns Authorize Suspend Close evidence or action and preserves its declared relationship to the current selection. |
| `immutable-event-record` | Owns Immutable Event Record evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Hazard, isolation, test evidence, and the authorization rail remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `isolation-register` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The isolation register is primary; evidence detail becomes a drawer while permit state persists.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `isolation-register` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Scope → hazards → isolations → current tests → roster → authorization; permit status remains visible without obscuring focus.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `isolation-register` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: permit draft, permit authorized, permit suspended, permit closed, isolation applied, isolation verified, isolation expired, reading safe, reading unsafe, reading stale, role missing, rescue unready, condition breached, authorization pending, authorization failure, immutable event.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `work-site-scope` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `hazards` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `hazards` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `authorize-suspend-close` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `immutable-event-record` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `immutable-event-record` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `immutable-event-record` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `work-site-scope` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `immutable-event-record` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `permit-control` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Authorize hazardous work only while isolations, tests, competence, and rescue controls remain valid, and suspend or close it when evidence changes.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject generic stage-gated process; this is `AR-PTW-90` evidence and must route to an adjacent archetype.
- Reject checklist; this is `AR-PTW-91` evidence and must route to an adjacent archetype.
- Reject command center; this is `AR-PTW-92` evidence and must route to an adjacent archetype.
- Reject job run; this is `AR-PTW-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [OSHA 1926.1204](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1204) | Permit-space hazards, controls, rescue, verification, and authorization obligations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Persistent permit actions must not fully obscure focused content. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "permit-to-work-isolation-control-room",
  "situationCodes": ["<matched AR-PTW-* codes>"],
  "searchAliases": ["permit to work control","isolation register","hazardous work authorization"],
  "dominantTask": "Authorize hazardous work only while isolations, tests, competence, and rescue controls remain valid, and suspend or close it when evidence changes.",
  "regions": ["permit-control","work-site-scope","hazards","isolation-register","test-monitor-readings","role-competency-rescue-roster","permit-conditions","authorize-suspend-close","immutable-event-record"],
  "regionRelationships": ["Independent isolation, test, competence, rescue, and condition controls can invalidate authorization at any time."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "isolation-register",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["permit draft","permit authorized","permit suspended","permit closed","isolation applied","isolation verified","isolation expired","reading safe","reading unsafe","reading stale","role missing","rescue unready","condition breached","authorization pending","authorization failure","immutable event"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

