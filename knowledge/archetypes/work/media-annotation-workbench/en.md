# Media annotation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-annotation-workbench` |
| Family | Work |
| Dominant task | Review media and create or edit annotations bound to timestamps, ranges, or spatial regions while preserving playback position. |
| Search aliases | time annotation, media labels, playback marker editor, range review |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `annotation-workbench` owns the complete dominant task and its recovery boundary.
- Review media and create or edit annotations bound to timestamps, ranges, or spatial regions while preserving playback position.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MAW-01` | Review media and create or edit annotations bound to timestamps, ranges, or spatial regions while preserving playback position. | Required positive evidence. |
| `AR-MAW-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-MAW-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-MAW-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-MAW-90` | The actual task is owned by media playback or multi-track composition. | Reject. |
| `AR-MAW-91` | Reject passive media queues, asset metadata galleries, document comments, audit timelines, and multi-track composition that changes rendered output. | Reject. |
| `AR-MAW-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `media-annotation-workbench` if and only if `AR-MAW-01` through `AR-MAW-04` are evidenced, every required region and relationship is present, and none of `AR-MAW-90` through `AR-MAW-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
annotation-workbench
├─ media-stage
├─ transport-and-timecode
├─ annotation-track-or-list
├─ active-annotation-editor
├─ labels-or-schema
└─ review-and-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `annotation-workbench` | Owns one media cursor, annotation set, schema, and review/export boundary. |
| `media-stage` | Presents current frame/region and reflects selected annotation without owning metadata forms. |
| `transport-and-timecode` | Owns play, pause, seek, exact time, and non-drag marker navigation. |
| `annotation-track-or-list` | Owns temporal/spatial marker identity, selection, bounded timeline overflow, and overlap cues. |
| `active-annotation-editor` | Edits selected annotation bounds, label, note, and validation while retaining cursor. |
| `labels-or-schema` | Constrains allowed labels and explains unavailable or changed schema. |
| `review-and-export` | Owns completeness review, autosave conflict, export pending/error, and recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep media stage, annotation track/list, and editor simultaneous; highlight the exact selected media range or region.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `annotation-track-or-list` alone owns bounded horizontal timeline overflow; media and page do not.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make the annotation editor collapsible; keep stage and track primary; move labels/schema to a temporary surface with issue summary outside.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `annotation-track-or-list` alone owns bounded horizontal timeline overflow; media and page do not.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Keep media stage plus current annotation sequence; open list/editor as sheets or stages and provide previous/next marker controls instead of precision-only dragging.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `annotation-track-or-list` alone owns bounded horizontal timeline overflow; media and page do not.

### Reflow

- DOM order, reading order, and meaningful focus order are `annotation-workbench → media-stage → transport-and-timecode → annotation-track-or-list → active-annotation-editor → labels-or-schema → review-and-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes media loading/error, play/pause/seek, annotation none/selected/draft/invalid, overlapping ranges, label unavailable, autosave pending/conflict, export pending/error, and permission/read-only.

## State obligations

Task-specific states: media loading/error, play/pause/seek, annotation none/selected/draft/invalid, overlapping ranges, label unavailable, autosave pending/conflict, export pending/error, and permission/read-only.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, selection or cursor, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, filter no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context needed for understanding. |
| Pending | Prevent duplicates, retain context, expose Cancel when safe, and announce progress without stealing focus. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains required simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage while retaining actions, state, and recovery. |

## Boundaries

### Accept

- Annotation identity binds to media time, range, or region and one cursor coordinates playback, list selection, and editing.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject passive media queues, asset metadata galleries, document comments, audit timelines, and multi-track composition that changes rendered output.
- Reject when media playback or multi-track composition owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-MAW-90`, `AR-MAW-91`, or `AR-MAW-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Audacity label tracks](https://manual.audacityteam.org/man/label_tracks.html) | Labels can bind text to points or ranges on a media timeline and support keyboard creation/editing. | It does not prescribe product media types, labels, or layout. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `media-annotation-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "media-annotation-workbench",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
