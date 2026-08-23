# Editorial feed reader

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `editorial-feed-reader` |
| Family | Discovery |
| Dominant task | Scan new or curated stories in editorial or chronological order and open a story worth reading. |
| Search aliases | `editorial feed, news stream, story feed, curated articles` |
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
| `AR-EFR-01` | Scan new or curated stories in editorial or chronological order and open a story worth reading. | Candidate when evidenced. |
| `AR-EFR-02` | Every region in `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback` is required and has a distinct owner. | Required for selection. |
| `AR-EFR-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-EFR-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-EFR-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-EFR-90` | Operational activity streams are not editorial reading. | Reject. |
| `AR-EFR-91` | Catalog facets and sort indicate peer discovery. | Reject. |
| `AR-EFR-92` | Media rails prioritize playback choice. | Reject. |

### Selection rule

Select `editorial-feed-reader` only when AR-EFR-01, AR-EFR-02, AR-EFR-03 are evidenced and none of AR-EFR-90, AR-EFR-91, AR-EFR-92 applies. Apply the responsive contract when AR-EFR-04 occurs. Return `needs-evidence` when AR-EFR-05 cannot be proven.

## Region graph

```text
editorial-feed
├─ category-context
├─ featured-story
├─ story-stream
├─ load-more-or-pagination
└─ reading-position-feedback
```

Canonical relationship: `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `editorial-feed` | Owns editorial or chronological story scanning with reading-position continuity; establishes edition, category, story order, loaded range, read state, and return position for every child without absorbing child responsibilities. |
| `category-context` | owns edition and feed orientation; consumes edition, category, story order, loaded range, read state, and return position from `editorial-feed` and publishes the same identity to `featured-story`. |
| `featured-story` | owns category or edition context without becoming a facet catalog; consumes edition, category, story order, loaded range, read state, and return position from `category-context` and publishes the same identity to `story-stream`. |
| `story-stream` | owns the highest-priority story and its direct reading route; consumes edition, category, story order, loaded range, read state, and return position from `featured-story` and publishes the same identity to `load-more-or-pagination`. |
| `load-more-or-pagination` | owns supporting stories in semantic priority order; consumes edition, category, story order, loaded range, read state, and return position from `story-stream` and publishes the same identity to `reading-position-feedback`. |
| `reading-position-feedback` | owns explicit range extension without losing the footer or current orientation; consumes edition, category, story order, loaded range, read state, and return position from `load-more-or-pagination` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Let the featured story lead while supporting stories follow semantic priority in a grid or list, never masonry order.
- **Navigation replacement:** No replacement; featured story and supporting stream retain explicit editorial hierarchy.
- **Sticky boundary:** No feed region is sticky by default; category context may persist only with reserved space.
- **Overflow owner:** Page flow owns the full story stream.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Reflow the featured story and reduce supporting tracks according to title measure.
- **Navigation replacement:** Reflow the featured story and reduce supporting columns when title measure fails.
- **Sticky boundary:** Reading-position feedback never overlays story links.
- **Overflow owner:** Page flow remains the only scroll owner.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Present one story per row in semantic priority; user-requested loading preserves orientation and focuses the first new story only when requested.
- **Navigation replacement:** Use one story per row in semantic priority order; load-more keeps the footer and orientation stable.
- **Sticky boundary:** No story card or feedback surface is sticky at short height.
- **Overflow owner:** Page flow owns reading and range extension.

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
| Initial/loading | `category-context` | Load edition and story stream loading without replacing the last committed edition, category, story order, loaded range, read state, and return position. | Retain the last safe context in every band. |
| Ready | `load-more-or-pagination` | Expose featured story, supporting order, and read state as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `featured-story` | Represent empty edition with category and return route retained; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `load-more-or-pagination` | When partial image or load-more failure without losing loaded stories, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `load-more-or-pagination` | Represent unavailable story named without collapsing editorial order; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `reading-position-feedback` | While load more, save, or return-position restoration, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `reading-position-feedback` | After new stories append and are announced without auto-scroll, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `load-more-or-pagination` | When updated or new-item notice while current reading position stays stable, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `category-context` | user-requested load-more may focus the first new story; passive updates never steal focus. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `editorial-feed` | Resize preserves edition, category, story order, loaded range, read state, and return position, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Scan new or curated stories in editorial or chronological order and open a story worth reading.
- Every required region and the relationship `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Operational activity streams are not editorial reading.
- Catalog facets and sort indicate peer discovery.
- Media rails prioritize playback choice.
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
| [Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | editorial grouping and prioritized discovery | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA APG — Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | article-stream loading and reading continuity | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: editorial-feed-reader
situationCodes: AR-EFR-01, AR-EFR-02, AR-EFR-03, AR-EFR-04, AR-EFR-05
searchAliases: editorial feed, news stream, story feed, curated articles
dominantTask: Scan new or curated stories in editorial or chronological order and open a story worth reading.
regions: editorial-feed, category-context, featured-story, story-stream, load-more-or-pagination, reading-position-feedback
regionRelationships: editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback
responsive:
  wide: Let the featured story lead while supporting stories follow semantic priority in a grid or list, never masonry order.
  intermediate: Reflow the featured story and reduce supporting tracks according to title measure.
  compact: Present one story per row in semantic priority; user-requested loading preserves orientation and focuses the first new story only when requested.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback
  navigationReplacement: Use one story per row in semantic priority order; load-more keeps the footer and orientation stable.
  stickyBehavior: No story card or feedback surface is sticky at short height.
  overflowOwner: Page flow owns reading and range extension.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
