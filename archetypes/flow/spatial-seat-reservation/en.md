# Spatial seat reservation

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spatial-seat-reservation` |
| Family | `flow` |
| Dominant task | Select and hold seats by adjacency, spatial location, accessibility, category, and price before checkout. |
| Search aliases | `seat map reservation`, `accessible seat selection`, `spatial ticket hold` |
| Authority | Product-neutral macro topology and behavior contract. |

### Invariants

- The archetype owns only the dominant task, required regions, region relationships, responsive transformations, interaction parity, and state families.
- Grammar owns product nouns, semantic owners, domain rules, and state transitions.
- Principles own exact geometry, measure, gap, alignment, overflow values, and responsive thresholds.
- Direction owns visual character; the template is only one neutral conforming realization.
- Reading order, DOM order, and focus order retain one semantic sequence across every topology.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `SSR-01` | Select and hold seats by adjacency, spatial location, accessibility, category, and price before checkout. | required positive |
| `SSR-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `SSR-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `SSR-90` | Reject time-slot booking, map result browsing, or plan selection. | reject |
| `SSR-91` | Reject static venue maps or decorative seat charts. | reject |

### Selection rule

- Return `accept` only when `SSR-01` and `SSR-02` are evidenced and no 90–99 code is present.
- Return `reject` when `SSR-90` or `SSR-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
seat-reservation
├─ event-and-party-context
├─ seat-map-and-legend ↔ accessible-seat-list
├─ selected-seat-summary
├─ hold-timer-and-price
└─ continue
```

- **Shared relationship:** The map and accessible list are bidirectional views of the same seat identities and selection; the hold timer and price qualify that shared selection before Continue.
- `seat-reservation -> event-and-party-context`: `event-and-party-context` consumes the named context or revision from `seat-reservation` and exposes an explicit return or reconciliation path.
- `event-and-party-context -> seat-map-and-legend`: `seat-map-and-legend` consumes the named context or revision from `event-and-party-context` and exposes an explicit return or reconciliation path.
- `seat-map-and-legend -> accessible-seat-list`: `accessible-seat-list` consumes the named context or revision from `seat-map-and-legend` and exposes an explicit return or reconciliation path.
- `accessible-seat-list -> selected-seat-summary`: `selected-seat-summary` consumes the named context or revision from `accessible-seat-list` and exposes an explicit return or reconciliation path.
- `selected-seat-summary -> hold-timer-and-price`: `hold-timer-and-price` consumes the named context or revision from `selected-seat-summary` and exposes an explicit return or reconciliation path.
- `hold-timer-and-price -> continue`: `continue` consumes the named context or revision from `hold-timer-and-price` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `seat-reservation` | Owns the complete seat reservation transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `event-and-party-context` | Owns the event and party context orientation and immutable basis that qualifies every downstream decision. |
| `seat-map-and-legend` | Owns the seat map and legend input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `accessible-seat-list` | Owns the accessible seat list input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `selected-seat-summary` | Owns the derived selected seat summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `hold-timer-and-price` | Owns the derived hold timer and price state; it names its source revision and cannot contradict the input or evidence owners. |
| `continue` | Owns the continue commitment boundary and prevents duplicate or stale commitment; it consumes the reviewed shared revision. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** A bounded seat map and selected-price summary remain simultaneous; the map and accessible list share seat identity.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** The summary becomes temporary while the map keeps an operable scale and the accessible list remains reachable.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** The accessible seat list is default and the map is an optional full-screen view; the timer remains in flow.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `seat-reservation` → `event-and-party-context` → `seat-map-and-legend` → `accessible-seat-list` → `selected-seat-summary` → `hold-timer-and-price` → `continue`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `layout loading` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `available seat` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `selected seat` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `held seat` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `unavailable seat` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `accessible seat` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `adjacency warning` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `price change` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `hold countdown` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `hold expiry` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `concurrent conflict` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `map unavailable` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `list parity` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `checkout pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when spatial adjacency and list parity govern a held seat selection.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject time-slot booking, map result browsing, or plan selection.
- Reject static venue maps or decorative seat charts.
- Reject when the difference is only a product noun, card count, density, color, component, or state variation.

### Boundary verdict

- Default `needs-evidence`; `accept` is valid only under the executable selection rule above.

## Handoff

- **Grammar:** Supplies product actors, nouns, semantic owners, domain rules, eligibility, transitions, and consequences.
- **Principles:** Resolve exact grid, measure, gap, size, alignment, overflow, sticky offsets, and content-driven thresholds.
- **Direction:** Resolve visual character without changing topology or ownership.

## Non-binding research evidence

### Evidence boundary

The sources below are advisory comparison evidence. They are not product truth, do not select a Grammar owner, do not authorize copied geometry or component trees, and do not override Source authority.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [W3C WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Interactive spatial grids require explicit keyboard navigation and focus management. | It does not require a grid when a semantic list is clearer. |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Primary content keeps readable and operable relationships as space changes. | It does not prescribe this web template geometry. |
| [Material Design 3 — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) | Primary and supporting regions can transform across available space. | It does not define product owners or breakpoints. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Required content reflows without page-level two-dimensional scrolling. | It does not prescribe a breakpoint or region geometry. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "spatial-seat-reservation",
  "situationCodes": [
    "SSR-01",
    "SSR-02",
    "SSR-03"
  ],
  "searchAliases": [
    "seat map reservation",
    "accessible seat selection",
    "spatial ticket hold"
  ],
  "dominantTask": "Select and hold seats by adjacency, spatial location, accessibility, category, and price before checkout.",
  "regions": [
    "seat-reservation",
    "event-and-party-context",
    "seat-map-and-legend",
    "accessible-seat-list",
    "selected-seat-summary",
    "hold-timer-and-price",
    "continue"
  ],
  "regionRelationships": [
    "seat-reservation -> event-and-party-context",
    "event-and-party-context -> seat-map-and-legend",
    "seat-map-and-legend -> accessible-seat-list",
    "accessible-seat-list -> selected-seat-summary",
    "selected-seat-summary -> hold-timer-and-price",
    "hold-timer-and-price -> continue"
  ],
  "responsive": {
    "wide": "A bounded seat map and selected-price summary remain simultaneous; the map and accessible list share seat identity.",
    "intermediate": "The summary becomes temporary while the map keeps an operable scale and the accessible list remains reachable.",
    "compact": "The accessible seat list is default and the map is an optional full-screen view; the timer remains in flow.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "seat-reservation -> event-and-party-context -> seat-map-and-legend -> accessible-seat-list -> selected-seat-summary -> hold-timer-and-price -> continue",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "layout loading",
    "available seat",
    "selected seat",
    "held seat",
    "unavailable seat",
    "accessible seat",
    "adjacency warning",
    "price change",
    "hold countdown",
    "hold expiry",
    "concurrent conflict",
    "map unavailable",
    "list parity",
    "checkout pending"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product actors and nouns",
    "semantic owners",
    "domain rules and transitions"
  ],
  "principlesHandoff": [
    "exact geometry and thresholds",
    "measure and spacing",
    "sticky offsets and overflow values"
  ],
  "confidence": "high",
  "evidence": [
    "dominant-task",
    "region-relationship",
    "responsive-failure",
    "state-family",
    "official-research"
  ]
}
```

Do not return a class, token, component, source path, fixed breakpoint, or invented product fact.
