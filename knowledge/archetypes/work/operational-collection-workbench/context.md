# Operational collection workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `operational-collection-workbench` |
| Family | Work |
| Dominant task | Repeatedly find, inspect and act on comparable operational records without losing collection context. |
| Search aliases | worklist, queue, admin table, moderation, operations, master detail, record processing |
| Authority | Cross-product page topology and responsive behavior; never product semantics, components, tokens or fixed breakpoints. |

This archetype owns a bounded operational loop. It keeps collection controls and results coherent while one selected record receives deeper inspection and state-changing actions.

### Invariants

- `collection-region` is the primary continuity owner; selection never destroys filters, sort, page or scroll context.
- `record-detail` is subordinate to the collection but owns the selected record's complete facts, actions, warnings and action feedback.
- Destructive or consequential actions expose their target and consequence before commitment.
- Wide, intermediate and compact presentations preserve the same searchable records, state meaning, actions, recovery and focus destinations.
- A table is optional. Comparable records may use rows or another dense collection owner, but this is never a card-discovery catalogue.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-OCW-01` | The user repeatedly processes comparable records rather than completing one terminal task. | Required positive signal. |
| `AR-OCW-02` | Search, filters, sort or pagination materially narrow a bounded operational collection. | Require `collection-controls` and persistent query context. |
| `AR-OCW-03` | A selected record needs facts or actions too rich for one collection row. | Require coordinated `record-detail`. |
| `AR-OCW-04` | Actions transition status, permission, publication, lock, backup or another consequential state. | Require action eligibility, confirmation where consequential, pending, success, failure and conflict states. |
| `AR-OCW-05` | Several records may update while the operator works. | Preserve stale/conflict recovery without silently replacing local context. |
| `AR-OCW-90` | The items are discovered and compared primarily as cards or catalogue choices. | Reject; use a discovery archetype. |
| `AR-OCW-91` | The page is a heterogeneous status overview before action. | Reject; use `overview-dashboard`. |
| `AR-OCW-92` | The user completes one short bounded operation or reads one narrative subject. | Reject; use task or detail authority. |

### Selection rule

Select only when `AR-OCW-01` is evidenced, no rejection code applies, and at least one of `AR-OCW-02` through `AR-OCW-05` is present. When selected-record depth or action consequence is unknown, return `needs-evidence` instead of inventing a permanent detail pane.

## Region graph

```text
operational-workspace
├─ workspace-header
│  ├─ workspace-identity
│  ├─ bounded-summary
│  └─ primary-entry-action [when evidenced]
├─ collection-controls [AR-OCW-02]
│  ├─ search
│  ├─ filters
│  ├─ sort-or-view-policy
│  └─ active-query-summary
├─ workbench
│  ├─ collection-region
│  │  ├─ result-feedback
│  │  ├─ operational-collection
│  │  └─ pagination
│  └─ record-detail [AR-OCW-03]
│     ├─ selected-record-context
│     ├─ record-facts
│     ├─ action-region [AR-OCW-04]
│     └─ action-feedback
└─ temporary-confirmation [consequential AR-OCW-04 action only]
```

### Region obligations

| Region | Obligation |
|---|---|
| `workspace-header` | Name the operational subject and bounded summary without competing with the collection. |
| `collection-controls` | Own query state, active filters, reset behavior and result count; labels remain visible or programmatically determinable. |
| `collection-region` | Own selection, result states, row semantics, pagination and the primary page scroll. |
| `record-detail` | Own selected-record data, eligibility, warnings, actions and action-local states; it never proxies these through the page owner. |
| `temporary-confirmation` | Name the exact target and consequence, keep focus contained, and return focus deterministically after cancel or completion. |

## Responsive contract

### Wide

- Use coordinated master-detail only when `AR-OCW-03` is evidenced: collection is primary and detail is supporting.
- Controls align with the collection and may wrap by meaning; they do not become an unanchored toolbar.
- The collection owns horizontal overflow only when essential columns cannot be responsibly reduced. Page-level horizontal scrolling is forbidden.
- A supporting detail region may remain visible only when it does not create competing ambiguous scroll owners or hide focused content.

### Intermediate

- Transition when collection comprehension or action targets no longer fit, not at a device label.
- Replace the persistent detail pane with an overlay or staged panel while preserving selected record and query context.
- Reduce columns by priority with accessible labels; do not compress every desktop column into unreadable fragments.
- Filters may use a named temporary surface, but active filters and reset remain visible from the collection.

### Compact

- Present collection and detail as two explicit steps. Selecting a record opens its detail; a visible back-to-results action restores filters, page, selection anchor and scroll context.
- Rows become priority-led summaries or stacked row anatomy, not unrelated cards. Status and available actions remain programmatically associated with their record.
- Detail actions stay with record detail. Consequential actions open a named confirmation surface and never rely on swipe or hover.
- Temporary surfaces move focus inside, contain it while modal, and return focus to the invoking record or control.

### Reflow

- Semantic order is header, controls, result feedback, collection, selected detail when invoked, then confirmation.
- Text, localized labels and zoom reflow without covering actions or causing page-level horizontal scroll.
- The page owns vertical scroll; one temporary detail/confirmation surface may own scroll while open. Nested row scroll is forbidden.
- Sticky controls or action bars are optional and must yield when height is insufficient or focus would be obscured.

### Interaction parity

- Search, filters, sort, pagination, selection, detail, allowed actions, confirmation, retry and conflict recovery exist at every size.
- Presentation changes never reset query state, selection, draft edits or a pending action.
- Loading, empty, error, unavailable, permission, stale/conflict and success states name their scope and preserve safe recovery.
- Keyboard and assistive-technology users can reach the same records and actions; status is never color-only.

## State obligations

| State family | Required states and behavior |
|---|---|
| Collection | `loading`, `ready`, `empty`, `filtered-empty`, `error`, `refreshing`; refreshing retains readable prior results when safe. |
| Query | resting, editing, applying, active and reset; active filters are perceivable and serialized consistently. |
| Selection | none, selected, selection-loading, selected-missing and selected-stale; lost records explain recovery. |
| Detail | loading, ready, partial-error, unavailable and permission-refused with scope-specific retry or return. |
| Action | eligible, disabled-with-reason, confirming, submitting, succeeded, failed and conflict; duplicate commitment is prevented. |
| Pagination | first, middle, last, out-of-range recovery and page-size policy when product truth permits it. |
| Focus | collection entry, selection-to-detail, detail-to-results, confirmation entry/return, action error and success destination. |
| Responsive | persistent detail, temporary detail and two-step detail preserve identical record/action meaning. |

## Boundaries

### Accept

- Moderation, membership, submission, account, content, audit or backup worklists with repeated record processing.
- Dense administrative collections whose selected record owns richer facts or state transitions.
- Read-only operational audit collections when filtering and record inspection remain the dominant task.

### Reject

- Heterogeneous KPI/status dashboards, catalogue or gallery discovery, one short terminal form, one narrative detail, finite assessment, tree navigation or spreadsheet-like bulk editing as the dominant task.
- A collection whose only purpose is choosing a product/card for comparison rather than operating records.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-OCW-90` through `AR-OCW-92`. Return `needs-evidence` when record comparability, selection depth, action consequence or responsive recovery materially changes the topology.

## Handoff

1. Business supplies record kinds, roles, filters, state transitions, action consequences and retention.
2. This archetype fixes collection continuity, optional master-detail relationship and responsive replacement.
3. Grammar assigns product semantic owners to controls, rows, detail, feedback and confirmation without replacing topology.
4. Principles resolve exact density, measures, gaps, column priority, overlay geometry and motion.
5. Direction supplies visual character inside these regions without turning the worklist into a catalogue or generic dashboard.

## Output

Return the standard archetype fields from the shelf router with `archetypeId: operational-collection-workbench`, matched `AR-OCW-*` codes, the exact responsive contract, state obligations, handoffs, confidence and routed evidence. The output names no product component, source path, class, token or fixed breakpoint.
