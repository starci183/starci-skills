# Media theater with queue

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-theater-queue` |
| Family | Discovery |
| Dominant task | Maintain continuous playback while navigating a queue, chapters, or synchronized transcript. |
| Search aliases | `media theater, player queue, transcript player, chapter playback` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- This archetype decides only the dominant task, required regions, region relationships, responsive transformation, and interaction parity.
- Grammar owns semantic and product owners; Principles own exact geometry and breakpoints; Direction owns visual character.
- Current source and research are evidence, not permission to copy layout or invent product fact.
- Region IDs, situation codes, and shared state remain stable across wide, intermediate, and compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-MTQ-01` | Maintain continuous playback while navigating a queue, chapters, or synchronized transcript. | Candidate when evidenced. |
| `AR-MTQ-02` | Every region in `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata` is required and has a distinct owner. | Required for selection. |
| `AR-MTQ-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-MTQ-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-MTQ-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-MTQ-90` | Gallery inspection does not own playback continuity. | Reject. |
| `AR-MTQ-91` | Illustrative video on a narrative detail is supporting content. | Reject. |
| `AR-MTQ-92` | Discrete frames require a presentation stage. | Reject. |

### Selection rule

Select `media-theater-queue` only when AR-MTQ-01, AR-MTQ-02, AR-MTQ-03 are evidenced and none of AR-MTQ-90, AR-MTQ-91, AR-MTQ-92 applies. Apply the responsive contract when AR-MTQ-04 occurs. Return `needs-evidence` when AR-MTQ-05 cannot be proven.

## Region graph

```text
media-theater
├─ playback-stage
├─ transport-controls
├─ queue-or-chapters
├─ synchronized-transcript
└─ current-metadata
```

Canonical relationship: `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `media-theater` | Owns continuous local playback while queue, chapters, or transcript navigation changes; establishes current item, play state, time, cue, captions, speed, and resume position for every child without absorbing child responsibilities. |
| `playback-stage` | owns playback continuity and rendered media state; consumes current item, play state, time, cue, captions, speed, and resume position from `media-theater` and publishes the same identity to `transport-controls`. |
| `transport-controls` | owns play, pause, seek, captions, and speed actions; consumes current item, play state, time, cue, captions, speed, and resume position from `playback-stage` and publishes the same identity to `queue-or-chapters`. |
| `queue-or-chapters` | owns ordered media or chapter navigation without resetting playback implicitly; consumes current item, play state, time, cue, captions, speed, and resume position from `transport-controls` and publishes the same identity to `synchronized-transcript`. |
| `synchronized-transcript` | owns transcript text and the cue synchronized to playback time; consumes current item, play state, time, cue, captions, speed, and resume position from `queue-or-chapters` and publishes the same identity to `current-metadata`. |
| `current-metadata` | owns title, duration, availability, and current-item context; consumes current item, play state, time, cue, captions, speed, and resume position from `synchronized-transcript` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep a large stage and one secondary pane while transport remains reachable and playback owns continuity.
- **Navigation replacement:** No replacement; large playback stage and one secondary pane coexist with state preserved across tabs.
- **Sticky boundary:** Playback may persist only in reserved space and never obscure transcript focus.
- **Overflow owner:** Playback owns continuity, not scroll; secondary content owns one declared reading axis.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Place the stage above secondary content or move secondary content to a drawer without restarting playback.
- **Navigation replacement:** Place secondary content below the stage or in a drawer while transport remains reachable.
- **Sticky boundary:** Drawer operations do not pause or recreate playback and return focus to the trigger.
- **Overflow owner:** Page flow owns secondary reading; playback stage owns no nested scroll.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use a full-width player or reserved mini-player, then sequence queue, chapters, and transcript; sticky playback yields at short height.
- **Navigation replacement:** Use a full-width or mini-player followed by queue, chapters, and transcript in a named sequence.
- **Sticky boundary:** Sticky player reserves space, never obscures focus, and yields at short height.
- **Overflow owner:** Page flow owns secondary content; any transcript region has one bounded reading axis only when necessary.

### Reflow

- DOM order and reading order follow the region graph; CSS does not reorder semantics.
- Resize does not reset query, selection, anchor, progress, path, or recovery state.
- Text zoom, long translation, missing media, and user content do not remove labels, relationships, or recovery routes.
- The page creates no horizontal scroll; any bounded exception belongs to the declared overflow owner.

### Interaction parity

- Every wide action, state, recovery route, and keyboard path exists at intermediate and compact.
- Temporary surfaces support Escape or cancel, contain modal focus, and return focus to the exact trigger.
- Dynamic status is announced without stealing focus; visual state never relies on color alone.
- Pointer, hover, gesture, and motion always have keyboard or static alternatives.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `playback-stage` | Load media loading or buffering with transport context retained without replacing the last committed current item, play state, time, cue, captions, speed, and resume position. | Retain the last safe context in every band. |
| Ready | `synchronized-transcript` | Expose play or pause state, current item, cue, captions, speed, and resume position as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `transport-controls` | Represent transcript unavailable with playback controls retained; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `synchronized-transcript` | When playback error or media removed with queue recovery, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `synchronized-transcript` | Represent captions or transcript unavailable without hiding playback state; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `current-metadata` | While buffering, seek, queue change, or speed update, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `current-metadata` | After resume or retry completes at the same media position, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `synchronized-transcript` | When queue revision or removed media invalidates current item, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `playback-stage` | queue/transcript focus never interrupts playback; sheets return to their triggers. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `media-theater` | Resize preserves current item, play state, time, cue, captions, speed, and resume position, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Maintain continuous playback while navigating a queue, chapters, or synchronized transcript.
- Every required region and the relationship `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Gallery inspection does not own playback continuity.
- Illustrative video on a narrative detail is supporting content.
- Discrete frames require a presentation stage.
- Reject when the difference from an existing archetype is only a product noun, card count, density, color, component, or state.

### Boundary verdict

Return `accept` when the selection rule and parity pass. Return `reject` for rejection evidence, `duplicate-or-variation` for a noun or presentation variation, and `needs-evidence` when one separating fact is unknown.

## Handoff

Grammar assigns semantic and product owners to each region. Principles resolve exact grid, measure, gap, size, alignment, overflow exceptions, and breakpoints after topology selection. Direction resolves visual character.

## Non-binding research evidence

### Evidence boundary

These official sources are advisory evidence for topology, interaction, and accessibility. They are not product truth, do not establish this synthesized archetype name as an official term, and do not license copied geometry, component trees, breakpoints, or visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | adaptive layout and content priority | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | keyboard and widget interaction models | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WAI — Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/) | captions, transcripts, and media alternatives | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: media-theater-queue
situationCodes: AR-MTQ-01, AR-MTQ-02, AR-MTQ-03, AR-MTQ-04, AR-MTQ-05
searchAliases: media theater, player queue, transcript player, chapter playback
dominantTask: Maintain continuous playback while navigating a queue, chapters, or synchronized transcript.
regions: media-theater, playback-stage, transport-controls, queue-or-chapters, synchronized-transcript, current-metadata
regionRelationships: media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata
responsive:
  wide: Keep a large stage and one secondary pane while transport remains reachable and playback owns continuity.
  intermediate: Place the stage above secondary content or move secondary content to a drawer without restarting playback.
  compact: Use a full-width player or reserved mini-player, then sequence queue, chapters, and transcript; sticky playback yields at short height.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata
  navigationReplacement: Use a full-width or mini-player followed by queue, chapters, and transcript in a named sequence.
  stickyBehavior: Sticky player reserves space, never obscures focus, and yields at short height.
  overflowOwner: Page flow owns secondary content; any transcript region has one bounded reading axis only when necessary.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
