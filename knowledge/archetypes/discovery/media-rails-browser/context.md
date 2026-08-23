# Media rails browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-rails-browser` |
| Family | Discovery |
| Dominant task | Discover a media library through a featured choice and editorially ranked semantic groups. |
| Search aliases | `media rails, featured media, editorial shelves, streaming browse` |
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
| `AR-MRB-01` | Discover a media library through a featured choice and editorially ranked semantic groups. | Candidate when evidenced. |
| `AR-MRB-02` | Every region in `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview` is required and has a distinct owner. | Required for selection. |
| `AR-MRB-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-MRB-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-MRB-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-MRB-90` | A homogeneous searchable collection requires a catalog. | Reject. |
| `AR-MRB-91` | Ranked query snippets require faceted results. | Reject. |
| `AR-MRB-92` | Chronological editorial reading requires a feed. | Reject. |

### Selection rule

Select `media-rails-browser` only when AR-MRB-01, AR-MRB-02, AR-MRB-03 are evidenced and none of AR-MRB-90, AR-MRB-91, AR-MRB-92 applies. Apply the responsive contract when AR-MRB-04 occurs. Return `needs-evidence` when AR-MRB-05 cannot be proven.

## Region graph

```text
media-browser
├─ featured-stage
├─ category-rail
├─ bounded-rail-navigation
└─ item-preview
```

Canonical relationship: `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `media-browser` | Owns featured media discovery across editorially distinct groups; establishes featured item, rail identity, rail position, preview item, and resume progress for every child without absorbing child responsibilities. |
| `featured-stage` | owns the featured choice and establishes library priority; consumes featured item, rail identity, rail position, preview item, and resume progress from `media-browser` and publishes the same identity to `category-rail`. |
| `category-rail` | owns one semantic editorial group and its ordered media items; consumes featured item, rail identity, rail position, preview item, and resume progress from `featured-stage` and publishes the same identity to `bounded-rail-navigation`. |
| `bounded-rail-navigation` | owns explicit previous/next movement within the active rail; consumes featured item, rail identity, rail position, preview item, and resume progress from `category-rail` and publishes the same identity to `item-preview`. |
| `item-preview` | owns lightweight preview and resume context without becoming playback theater; consumes featured item, rail identity, rail position, preview item, and resume progress from `bounded-rail-navigation` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep a featured stage and multiple named rails; each rail owns only its bounded horizontal overflow.
- **Navigation replacement:** No replacement; featured stage and named category rails remain in editorial order.
- **Sticky boundary:** No rail is page-sticky; preview is modal only while open.
- **Overflow owner:** Each category rail owns its bounded horizontal axis; page flow owns vertical group order.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Reduce featured dominance and visible rail items while preserving group headings and continuation routes.
- **Navigation replacement:** Reduce featured dominance and visible rail items while preserving headings and continue paths.
- **Sticky boundary:** Preview returns focus to the exact rail item.
- **Overflow owner:** Each rail retains bounded horizontal overflow with explicit controls.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Turn featured media into a vertical lead and use bounded rail controls or short vertical groups with View all.
- **Navigation replacement:** Use bounded rail controls or short vertical groups with View all; keep the featured item as a vertical lead.
- **Sticky boundary:** No rail or featured surface is sticky at short height.
- **Overflow owner:** Only individual rails own horizontal overflow; the page itself never does.

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
| Initial/loading | `featured-stage` | Load featured stage and each rail loading independently without replacing the last committed featured item, rail identity, rail position, preview item, and resume progress. | Retain the last safe context in every band. |
| Ready | `bounded-rail-navigation` | Expose featured item, rail positions, and preview selection as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `category-rail` | Represent one empty rail without collapsing other editorial groups; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `bounded-rail-navigation` | When one rail failure with retry isolated to that group, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `bounded-rail-navigation` | Represent unavailable media with its group and continue path retained; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `item-preview` | While rail retry or preview open, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `item-preview` | After preview or resume action completes without resetting rail position, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `bounded-rail-navigation` | When new recommendations arrive without replacing focused items, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `featured-stage` | preview close returns to the invoking item; rail controls remain keyboard reachable. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `media-browser` | Resize preserves featured item, rail identity, rail position, preview item, and resume progress, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Discover a media library through a featured choice and editorially ranked semantic groups.
- Every required region and the relationship `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- A homogeneous searchable collection requires a catalog.
- Ranked query snippets require faceted results.
- Chronological editorial reading requires a feed.
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
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | editorial grouping and prioritized discovery | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA APG — Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) | explicit sequential controls and announced position | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: media-rails-browser
situationCodes: AR-MRB-01, AR-MRB-02, AR-MRB-03, AR-MRB-04, AR-MRB-05
searchAliases: media rails, featured media, editorial shelves, streaming browse
dominantTask: Discover a media library through a featured choice and editorially ranked semantic groups.
regions: media-browser, featured-stage, category-rail, bounded-rail-navigation, item-preview
regionRelationships: media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview
responsive:
  wide: Keep a featured stage and multiple named rails; each rail owns only its bounded horizontal overflow.
  intermediate: Reduce featured dominance and visible rail items while preserving group headings and continuation routes.
  compact: Turn featured media into a vertical lead and use bounded rail controls or short vertical groups with View all.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: media-browser → featured-stage → category-rail → bounded-rail-navigation → item-preview
  navigationReplacement: Use bounded rail controls or short vertical groups with View all; keep the featured item as a vertical lead.
  stickyBehavior: No rail or featured surface is sticky at short height.
  overflowOwner: Only individual rails own horizontal overflow; the page itself never does.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
