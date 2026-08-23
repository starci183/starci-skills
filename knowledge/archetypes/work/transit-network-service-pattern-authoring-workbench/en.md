# Transit network service pattern authoring workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `transit-network-service-pattern-authoring-workbench` |
| Family | Work |
| Dominant task | Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations. |
| Search aliases | `transit network service pattern authoring`, `transit network service pattern workspace`, `network service pattern authoring control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations.
- one service specification generates both operational trips and public representations.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-TNSPAW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-TNSPAW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-TNSPAW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-TNSPAW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-TNSPAW-90` | The dominant task is actually `spatial-route-itinerary-explorer`. | Reject. |
| `AR-TNSPAW-91` | The dominant task is actually `calendar-resource-scheduler`. | Reject. |
| `AR-TNSPAW-92` | The dominant task is actually `document-outline-editor`. | Reject. |
| `AR-TNSPAW-93` | The dominant task is actually `workflow-automation-builder`. | Reject. |

### Selection rule

Select `transit-network-service-pattern-authoring-workbench` if and only if `AR-TNSPAW-01` through `AR-TNSPAW-04` are evidenced and none of `AR-TNSPAW-90` through `AR-TNSPAW-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
service-pattern-authoring → service-objective-area-and-policy-version → network-and-stop-geometry ↔ ordered-stop-pattern-and-direction-variants → trip-frequency-and-calendar-generator → block-and-interlining-dependencies → coverage-headway-load-and-equity-validation → rider-facing-map-timetable-and-exception-preview → feed-schema-and-cross-file-validation → versioned-publication
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `service-pattern-authoring` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `service-objective-area-and-policy-version` | Owns Service Objective Area And Policy Version evidence or action and preserves its declared relationship to the current selection. |
| `network-and-stop-geometry` | Owns Network And Stop Geometry evidence or action and preserves its declared relationship to the current selection. |
| `ordered-stop-pattern-and-direction-variants` | Owns Ordered Stop Pattern And Direction Variants evidence or action and preserves its declared relationship to the current selection. |
| `trip-frequency-and-calendar-generator` | Owns Trip Frequency And Calendar Generator evidence or action and preserves its declared relationship to the current selection. |
| `block-and-interlining-dependencies` | Owns Block And Interlining Dependencies evidence or action and preserves its declared relationship to the current selection. |
| `coverage-headway-load-and-equity-validation` | Owns Coverage Headway Load And Equity Validation evidence or action and preserves its declared relationship to the current selection. |
| `rider-facing-map-timetable-and-exception-preview` | Owns Rider Facing Map Timetable And Exception Preview evidence or action and preserves its declared relationship to the current selection. |
| `feed-schema-and-cross-file-validation` | Owns Feed Schema And Cross File Validation evidence or action and preserves its declared relationship to the current selection. |
| `versioned-publication` | Owns Versioned Publication evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Network geometry, stop-pattern hierarchy, trip/calendar generation, validation ledger and rider/feed previews remain visible; the network stage alone owns bounded pan/zoom.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `rider-facing-map-timetable-and-exception-preview` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Selected route variant remains primary; geometry and timetable/calendar editors alternate while validation and publication state persist.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Service objective → direction/variant → ordered stops → frequency/calendar → operational dependencies → policy/schema issues → rider preview → publish; an ordered stop sequence replaces the editable map and offers non-drag move controls.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `service-pattern-authoring → service-objective-area-and-policy-version → network-and-stop-geometry ↔ ordered-stop-pattern-and-direction-variants → trip-frequency-and-calendar-generator → block-and-interlining-dependencies → coverage-headway-load-and-equity-validation → rider-facing-map-timetable-and-exception-preview → feed-schema-and-cross-file-validation → versioned-publication`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: Network loading/stale, stop active/temporarily closed, pattern incomplete/valid, trip/calendar generated/conflicting, frequency under/meeting standard, load/coverage/equity pass/fail, interline broken/valid, preview current/stale, feed invalid/valid, publication draft/scheduled/live/superseded and rollback available.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `service-objective-area-and-policy-version` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `network-and-stop-geometry` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `network-and-stop-geometry` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `feed-schema-and-cross-file-validation` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `versioned-publication` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `versioned-publication` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `versioned-publication` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `service-objective-area-and-policy-version` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `versioned-publication` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `service-pattern-authoring` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `spatial-route-itinerary-explorer`; this is `AR-TNSPAW-90` evidence and must route to an adjacent archetype.
- Reject `calendar-resource-scheduler`; this is `AR-TNSPAW-91` evidence and must route to an adjacent archetype.
- Reject `document-outline-editor`; this is `AR-TNSPAW-92` evidence and must route to an adjacent archetype.
- Reject `workflow-automation-builder`; this is `AR-TNSPAW-93` evidence and must route to an adjacent archetype.

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
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [current GTFS Schedule Reference](https://gtfs.org/documentation/schedule/reference/) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FTA fixed-route transit service requirements](https://www.transit.dot.gov/regulations-and-guidance/civil-rights-ada/title-vi-fixed-route-transit-requirements-video-transcript) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "transit-network-service-pattern-authoring-workbench",
  "situationCodes": [
    "<matched AR-TNSPAW-* codes>"
  ],
  "searchAliases": [
    "transit network service pattern authoring",
    "transit network service pattern workspace",
    "network service pattern authoring control"
  ],
  "dominantTask": "Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations.",
  "regions": [
    "service-pattern-authoring",
    "service-objective-area-and-policy-version",
    "network-and-stop-geometry",
    "ordered-stop-pattern-and-direction-variants",
    "trip-frequency-and-calendar-generator",
    "block-and-interlining-dependencies",
    "coverage-headway-load-and-equity-validation",
    "rider-facing-map-timetable-and-exception-preview",
    "feed-schema-and-cross-file-validation",
    "versioned-publication"
  ],
  "regionRelationships": [
    "one service specification generates both operational trips and public representations."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "service-pattern-authoring -> service-objective-area-and-policy-version -> network-and-stop-geometry -> ordered-stop-pattern-and-direction-variants -> trip-frequency-and-calendar-generator -> block-and-interlining-dependencies -> coverage-headway-load-and-equity-validation -> rider-facing-map-timetable-and-exception-preview -> feed-schema-and-cross-file-validation -> versioned-publication",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "rider-facing-map-timetable-and-exception-preview",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Network loading/stale",
    "stop active/temporarily closed",
    "pattern incomplete/valid",
    "trip/calendar generated/conflicting",
    "frequency under/meeting standard",
    "load/coverage/equity pass/fail",
    "interline broken/valid",
    "preview current/stale",
    "feed invalid/valid",
    "publication draft/scheduled/live/superseded",
    "rollback available"
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

