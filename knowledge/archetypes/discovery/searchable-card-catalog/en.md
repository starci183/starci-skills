# Searchable card catalog

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype id | `searchable-card-catalog` |
| Family | Discovery |
| Dominant task | Discover, narrow, scan, and compare a homogeneous set of peer items before opening or acting on one. |
| Search aliases | `catalog`, `catalogue`, `card catalog`, `searchable catalog`, `browse`, `discovery`, `library`, `course catalog`, `marketplace grid`, `filtered collection`, `resource gallery`, `searchable card grid`, `danh mục`, `thư viện`, `danh sách thẻ`, `tìm kiếm và lọc` |
| Authority level | Shared, product-neutral macro topology. |

### Authority statement

This archetype decides the relationship between discovery context, controls, one peer-item result set,
and continuation through that set. It also decides how those responsibilities remain coherent when a
wide toolbar or filter rail cannot remain visible beside results.

It does not decide what an item means, which fields appear on an item, available filter values, source
owners, visual treatment, exact geometry, implementation components, tokens, classes, or numeric
breakpoints. A repeated-card appearance alone is not evidence; peer semantics and a browse-to-narrow
task are required.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-SC-01` | The surface exposes a homogeneous set of peer items with one comparable semantic anatomy. | Candidate. |
| `AR-SC-02` | The user may arrive without knowing the exact item and needs to browse, search, narrow, sort, or compare before choosing. | Required for selection. |
| `AR-SC-03` | Search, filters, sort, view choice, active criteria, result count, and continuation describe one committed result set. | Keep every control and summary coupled to that same dataset state. |
| `AR-SC-04` | Each peer exposes enough comparable evidence to judge whether opening or acting on it is worthwhile. | Preserve comparable scanning in every presentation. |
| `AR-SC-05` | Available space no longer permits all discovery controls and results to remain simultaneous. | Replace presentation without losing active criteria, location, or access. |
| `AR-SC-06` | Repeated regions are heterogeneous signals with unequal jobs and priority. | Reject; resolve an overview archetype. |
| `AR-SC-07` | Parent-child hierarchy or path navigation is the primary way items are found. | Reject; resolve a hierarchical browser. |
| `AR-SC-08` | Dense field-by-field comparison, bulk selection, queue processing, or inline editing is the dominant task. | Reject; resolve a table, worklist, or operational collection. |

### Resolver

Select `searchable-card-catalog` only when `AR-SC-01` and `AR-SC-02` are evidenced and none of
`AR-SC-06`, `AR-SC-07`, or `AR-SC-08` better describes the dominant task. Apply `AR-SC-03`,
`AR-SC-04`, and `AR-SC-05` whenever their facts occur.

Resolve from item peerhood and discovery behaviour, not from the presence of search, filters, or card-like
boundaries alone. Search over heterogeneous destinations is a search-results problem; filters over an
operational table do not turn it into this archetype. If comparable item anatomy or one result-set
identity cannot be proven, return `needs-evidence` instead of inventing either.

## Region graph

### Canonical regions

```text
catalog-header
├─ location-and-title
└─ discovery-toolbar
   ├─ search
   ├─ filters
   ├─ sort
   ├─ view-switch
   └─ result-count

result-region
├─ active-filter-summary
├─ peer-item-grid-or-list
├─ empty-or-no-result-guidance
└─ pagination-or-continuation
```

- `location-and-title` names the collection and enough scope to interpret every result.
- `search` narrows or locates peers within the declared collection scope.
- `filters` constrain the set through known item attributes.
- `sort` changes result order without changing item identity.
- `view-switch` changes presentation of the same result set; it exists only when both views serve a real
  task.
- `result-count` describes the same committed query represented by the visible results.
- `active-filter-summary` makes current constraints inspectable and reversible even when filter controls
  are not open.
- `peer-item-grid-or-list` contains homogeneous peers, not unrelated summaries.
- `empty-or-no-result-guidance` owns both distinct absence explanations.
- `pagination-or-continuation` advances within the same result-set identity.

Search is expected when text attributes are meaningful and the collection scale or task earns it. A
catalog may omit an inapplicable control, but it may not display inert controls or fabricate filter
categories merely to resemble a catalog reference.

### Relationship invariants

1. Catalog context and discovery controls precede results in logical reading order.
2. Search, filters, sort, active criteria, result count, visible items, and continuation are projections
   of one committed dataset state.
3. Applied criteria remain inspectable and reversible when their full control surface is closed.
4. All result items are peers. A promoted item may receive emphasis but does not become a different
   information family inside the peer result region.
5. A view switch changes presentation, not query, selection, item semantics, or available actions.
6. Pagination or continuation preserves the active query and follows the result region; it does not
   become global page navigation.
7. Opening an item may leave the catalog, but returning preserves the user's discovery context according
   to product policy resolved by grammar.

## Responsive contract

### Wide

- Let the discovery toolbar govern the full result set. Search receives a stable, prominent place;
  result count remains visibly associated with the committed results.
- When filter categories are numerous and persistent comparison benefits from simultaneity, filters may
  occupy a supporting rail. Otherwise they remain in the leading discovery area.
- Results may use a multi-track peer grid or a joined list according to item comparison needs. Track
  count follows useful item measure, not a fixed inventory.
- A discovery control region may remain available while a long collection scrolls only when its scope
  and state stay clear and it does not create competing scroll owners.

### Intermediate

- Give search its own usable line before compressing or relocating secondary controls.
- Move extensive filters behind an explicit reveal control when simultaneous presentation no longer
  leaves useful result measure. Keep active criteria, their count, and a clear-all route visible outside.
- Keep result count, sort, and any valid view choice associated with the same result set even if they
  wrap into more than one line.
- Reduce result tracks before truncating item evidence. A grid becomes a list when peer comparison and
  item content remain clearer that way; it is not required to pass through every possible track count.
- Preserve query, filters, sort, selected item, and continuation position across the transformation.

### Compact

- Use one principal vertical order: location and title, search, filter or sort access, active criteria,
  result count, peer results, then continuation.
- Present extensive filters or sorting choices in a temporary or alternate local surface. The opener
  states when criteria are active, and closing returns focus to the opener.
- Keep the current query and applied criteria visible or immediately inspectable while results are read.
- Use a single useful result flow unless more than one track remains readable under real content stress.
  Item identity, decisive comparison evidence, status, and primary route remain available.
- Avoid nested vertical scroll for ordinary results. Page flow owns scrolling; only intrinsic media or
  another genuine two-dimensional region may own bounded overflow.
- If continuation is automatic, it must still announce new content, preserve location, expose failure and
  completion, and provide an alternative when endless continuation would obstruct orientation.

### Reflow

- Reflow must withstand enlarged text, zoom, long translations, long item names, large filter labels,
  changed writing direction, absent media, and user-generated content.
- Preserve semantic source order: catalog context, discovery controls, active criteria, result summary,
  peers, and continuation. Visual movement does not create a conflicting keyboard or assistive reading
  sequence.
- Search and filter access never disappear. Controls may relocate or disclose progressively, but their
  functionality, labels, active state, and clearing route remain available.
- Ordinary text and items reflow without page-level two-dimensional scrolling. Intrinsic preview media
  owns its bounded exception without widening the result region.
- Item evidence wraps or gains an accessible reveal route. Truncation, hover, colour, or image alone is
  never the only carrier of identity, status, or decisive comparison information.

### Interaction parity

- Search, every applicable filter category, sort choices, valid view choices, result count, item actions,
  and continuation remain operable in wide, intermediate, and compact presentations.
- Relocated controls preserve draft-versus-applied semantics. Closing, applying, cancelling, or clearing
  has the same dataset effect in every presentation.
- Focus remains on the initiating control or moves to an explicitly announced result summary after a
  committed update; refreshed results do not return focus to page start.
- Applied query and criteria survive reflow, item-detail return, and recoverable request failure according
  to grammar policy.
- No hover-only route, pointer-only reordering, or colour-only state is introduced by a denser presentation.
- Result count, empty state, pagination, and visible results never describe different query versions.

## State obligations

### Required state matrix

| State | Owning region | Obligation |
|---|---|---|
| Initial collection load | Result region | Preserve catalog context and controls; identify that the initial peer set is pending. |
| Search or filter draft | Discovery toolbar | Distinguish uncommitted criteria from the result set currently shown. |
| Query update pending | Result region and result summary | Preserve the committed query context, signal update, and prevent duplicate commitment. |
| Incremental continuation | Pagination or continuation | Keep existing peers usable, identify where new content will join, and preserve location. |
| Empty collection | Result region | Explain that the collection itself has no items and offer the next valid route when one exists. |
| No matching results | Empty or no-result guidance | Retain query and criteria, show a zero count, and offer reversible recovery without pretending the collection is empty. |
| Query failure | Result region | Preserve query, applied criteria, and prior safe results when possible; provide scoped retry. |
| Partial item data | Affected peer | Keep identity and safe actions clear, identify unavailable evidence, and avoid fabricating comparison values. |
| Continuation failure | Continuation region | Keep loaded peers and discovery context intact; retry does not duplicate items. |
| End of results | Continuation region | Announce completion and leave the final item and return path reachable. |
| Permission-limited results | Catalog context or affected peer | State the scope limitation without implying that inaccessible peers do not exist. |

### State invariants

1. Empty collection and no matching results are different states with different recovery.
2. Query failure does not clear the user's query or filters.
3. The result count describes the same committed state as visible peers; during transition it is marked
   pending or retains its last-safe meaning.
4. Loading more does not replace, reorder, or duplicate already loaded peers unless a declared sort or
   data change requires it and the change is communicated.
5. Missing item media or optional metadata never erases item identity or its valid route.
6. Clearing criteria is reversible until commitment semantics say otherwise and never leaves a hidden
   active constraint.

## Boundaries

### Use when

- Items are semantic peers and expose comparable evidence before selection.
- People benefit from exploration because they may not know the exact item in advance.
- Search, filters, sort, or view choice narrow or reorder one coherent set.
- Opening one item is usually a transition from discovery to detail or work.

### Refuse and route

| Evidence | Refusal | Route |
|---|---|---|
| `AR-SC-06`: regions represent unlike signals, priorities, and actions. | Repetition is visual, not semantic peerhood. | `overview-dashboard` or another overview archetype. |
| `AR-SC-07`: finding depends on traversing parents, children, folders, or a path. | A flat peer result set would erase structure. | A hierarchical browser. |
| `AR-SC-08`: column-level comparison, bulk operations, queue state, or inline edit is dominant. | Peer summaries do not carry the work safely. | A data table, worklist, or operational collection. |
| Results combine unrelated entity families from a global query. | One comparable item anatomy and one collection scope do not exist. | A federated search-results archetype. |
| One item's narrative and decision dominate. | Discovery has ended. | A detail archetype. |
| A recommendation sequence decides the next item for the user. | Free browsing is not the task. | A guided or recommendation flow. |

### Variants, not new archetypes

- Course, product, service, people, template, media, and resource catalogs remain this archetype when
  peerhood and discovery relationships match.
- Grid versus list, filter rail versus disclosed filters, submitted versus active search, and paged versus
  incremental continuation are variants governed by task evidence and grammar.
- Item density, image ratio, number of fields, card treatment, and decorative style do not create new
  archetypes.
- A featured peer remains a variant only while it participates in the same query, states, and actions.

## Handoff

### Archetype → Grammar

Pass the selected situation codes, collection scope, peer-item definition, dominant discovery task,
canonical regions, control-to-result relationships, applicable controls, persistence expectations,
responsive replacements, and state obligations. Grammar resolves product-specific item meaning,
available attributes and criteria, action semantics, item owner, detail route, query commitment policy,
and return-state policy.

Grammar may omit a control that the product facts do not earn. It may not detach a displayed count from
visible results, hide an applied constraint, mix unrelated entity families as peers, or remove compact
access to a valid wide capability.

### Grammar → Principles

After grammar resolves semantic owners, principles decide exact flow, grid or list realization, useful
item measure, spacing, alignment, control wrapping, disclosure geometry, sticky realization, overflow
containment, and content-driven transition points. Principles may change presentation but not result-set
identity, peerhood, reading order, state distinctions, or interaction parity.

This archetype emits no implementation component, class, token, exact dimension, or numeric breakpoint.

## Non-binding research evidence

### External official evidence

- [Carbon Design System — Search](https://carbondesignsystem.com/patterns/search-pattern/) identifies
  catalog discovery as a use for active search, requires result counts, loading feedback, keyboard access,
  and recovery from no-results dead ends.
- [Carbon Design System — Filtering](https://carbondesignsystem.com/patterns/filtering/) distinguishes
  filter commitment models, keeps applied-filter state visible when controls are closed, and provides
  clear/reset obligations.
- [Material Design — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
  describes a feed as a configurable peer-content arrangement and treats compact, intermediate, and
  expanded space as adaptive configurations.
- [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) requires content
  and functionality to remain available through reflow and warns against controls disappearing after
  transformation.

These sources challenge and support the topology; none decides product filters, item anatomy, source
ownership, or visual treatment.

### StarCi evidence

The current StarCi course-discovery surface supplies observed product facts and implementation capability
for collection identity, search, result count, peer presentation, view choice, empty handling, continuation
and narrow reflow. It does not prove that the current composition is correct. Only relationships that
independently pass this record corroborate the archetype; conflicts are `layout-drift`. The source never
authorizes copying its fields, controls, geometry, styling or business meaning.

### Evidence boundary

Research and current source are advisory provenance. Binding authority here is the recognition rule,
region graph, responsive contract, state obligations, boundaries, and handoff. A source change or
external guideline update does not silently rewrite that authority.

## Output

### Runtime record

Emit exactly this closed JSON field set; do not add, remove, or rename fields:

```json
{
  "archetypeId": "searchable-card-catalog",
  "situationCodes": ["<matched AR-SC-* codes>"],
  "searchAliases": [
    "catalog",
    "catalogue",
    "card catalog",
    "searchable catalog",
    "browse",
    "discovery",
    "library",
    "course catalog",
    "marketplace grid",
    "filtered collection",
    "resource gallery",
    "searchable card grid",
    "danh mục",
    "thư viện",
    "danh sách thẻ",
    "tìm kiếm và lọc"
  ],
  "dominantTask": "<one evidence-backed discovery sentence>",
  "regions": ["<ordered canonical region ids remaining after evidenced omissions>"],
  "regionRelationships": ["<ordered scope, dataset, priority, and state-ownership relations>"],
  "responsive": {
    "wide": "<simultaneous controls and results>",
    "intermediate": "<first content-driven control or result transformation>",
    "compact": "<single-flow presentation and relocated controls>",
    "reflow": "<zoom, long-content, writing-direction, and overflow obligations>",
    "readingOrder": "<one logical visual, keyboard, and assistive reading order>",
    "navigationReplacement": "<replacement for displaced filter or collection navigation, or none>",
    "stickyBehavior": "<earned persistent discovery behaviour and release condition, or none>",
    "overflowOwner": "<page or named intrinsically two-dimensional region>",
    "interactionParity": "<how every wide control, action, and state remains reachable>"
  },
  "stateObligations": ["<applicable state and recovery obligations>"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<unresolved product meaning, query, and semantic-owner decisions>"],
  "principlesHandoff": ["<unresolved geometry and realization decisions>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business facts>", "<verified source capability>", "<non-binding research>"]
}
```
