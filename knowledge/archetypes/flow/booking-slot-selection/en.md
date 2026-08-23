# Booking slot selection

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `booking-slot-selection` |
| Family | `flow` |
| Dominant task | Choose an available time slot by service, date, timezone, and constraints, then hold the selection long enough to continue. |
| Search aliases | `appointment slot booking`, `date and time selection`, `availability agenda` |
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
| `BSS-01` | Choose an available time slot by service, date, timezone, and constraints, then hold the selection long enough to continue. | required positive |
| `BSS-02` | All required regions and their named ownership relationships are necessary for the task. | required positive |
| `BSS-03` | Wide adjacency fails while intermediate and compact transformations preserve task, state, and recovery. | conditional positive |
| `BSS-90` | Reject browsing existing events, spatial seats, or free-form date entry. | reject |
| `BSS-91` | Reject staff schedulers or one-action centered tasks. | reject |

### Selection rule

- Return `accept` only when `BSS-01` and `BSS-02` are evidenced and no 90–99 code is present.
- Return `reject` when `BSS-90` or `BSS-91` is evidenced, or an adjacent archetype owns the dominant task.
- Return `needs-evidence` when the task, required region, relationship, or responsive failure trigger remains unresolved.

## Region graph

```text
slot-booking
├─ service-and-attendee-context
├─ date-navigation
├─ availability-by-date
├─ slot-selection
├─ selected-slot-summary
└─ continue-or-waitlist
```

- **Shared relationship:** Date and slot share one selection model; availability qualifies each slot; the held selection summary and Continue action consume the same availability revision.
- `slot-booking -> service-and-attendee-context`: `service-and-attendee-context` consumes the named context or revision from `slot-booking` and exposes an explicit return or reconciliation path.
- `service-and-attendee-context -> date-navigation`: `date-navigation` consumes the named context or revision from `service-and-attendee-context` and exposes an explicit return or reconciliation path.
- `date-navigation -> availability-by-date`: `availability-by-date` consumes the named context or revision from `date-navigation` and exposes an explicit return or reconciliation path.
- `availability-by-date -> slot-selection`: `slot-selection` consumes the named context or revision from `availability-by-date` and exposes an explicit return or reconciliation path.
- `slot-selection -> selected-slot-summary`: `selected-slot-summary` consumes the named context or revision from `slot-selection` and exposes an explicit return or reconciliation path.
- `selected-slot-summary -> continue-or-waitlist`: `continue-or-waitlist` consumes the named context or revision from `selected-slot-summary` and exposes an explicit return or reconciliation path.

### Region obligations

| Region | Obligation |
|---|---|
| `slot-booking` | Owns the complete slot booking transaction boundary, shared revision, and recovery context; child regions cannot commit outside it. |
| `service-and-attendee-context` | Owns the service and attendee context orientation and immutable basis that qualifies every downstream decision. |
| `date-navigation` | Owns the date navigation input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `availability-by-date` | Owns the availability by date input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `slot-selection` | Owns the slot selection input or decision and updates the shared transaction revision while preserving its label, status, and contextual actions. |
| `selected-slot-summary` | Owns the derived selected slot summary state; it names its source revision and cannot contradict the input or evidence owners. |
| `continue-or-waitlist` | Owns the continue or waitlist recovery route and preserves the exact state, trigger, and return position. |

## Responsive contract

### Wide

- **Failure trigger:** A required region can no longer remain simultaneous without squeezing, truncating, or separating context from action.
- **Topology response:** Date navigation and available slots remain simultaneous while the availability list owns scan order.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer persist while retaining readable measure and action order.
- **Topology response:** Selected date precedes the slot list and the summary moves adjacent to Continue.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Compact

- **Failure trigger:** Adjacency or multiple primary panes no longer work under zoom, localization, text growth, or short height.
- **Topology response:** A one-day agenda is primary; the calendar becomes an alternate dialog and the selected slot follows its option.
- **Navigation replacement:** Every region that loses adjacency receives a named route to the same content and state.
- **Sticky boundary:** Persistence yields before it can obscure content, focus, validation, or actions in short-height conditions.
- **Overflow owner:** The page owns vertical overflow; only an explicitly named two-dimensional task region may own bounded overflow.

### Reflow

- Semantic and DOM order is `slot-booking` → `service-and-attendee-context` → `date-navigation` → `availability-by-date` → `slot-selection` → `selected-slot-summary` → `continue-or-waitlist`.
- CSS does not reorder regions or the focus sequence at a topology transition.
- Compact navigation replaces adjacency with a named primary pane and restores the exact trigger, state, and scroll context.

### Interaction parity

- Wide, intermediate, and compact retain the same actions, state meanings, recovery paths, and consequence.
- Dynamic status is announced without moving focus automatically.
- Error recovery moves focus to a summary or repairable field and then returns to the meaningful continuation.

## State obligations

| State | Required behavior | Responsive presentation |
|---|---|---|
| `range loading` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `no slots` | Distinguish a valid absence from missing required input and expose the next available start path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `timezone` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `locale` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `selected slot` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `held slot` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `expired slot` | Explain the unavailable boundary, retain readable context, and expose an eligible alternate or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `concurrent slot taken` | Identify the conflicting revision, block stale commitment, and reconcile without discarding unaffected state. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `accessibility requirement` | Expose the state with its owner, consequence, and a deterministic continuation or recovery path. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `waitlist available` | Expose the confirming evidence and the next or handoff action without erasing review context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `continue pending` | Announce progress without moving focus, preserve the current revision, and prevent only the duplicate operation. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `continue error` | Name the cause at its owner, expose a focusable repair path, and preserve safe input for retry. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |
| `focus after refresh` | Move focus only after an explicit action or failed submit, then restore the exact trigger and semantic context. | Wide keeps the state beside its owner; intermediate removes low-priority persistence; compact places the state and recovery in the current primary pane and restores its anchor. |

## Boundaries

### Accept

- Use when date and slot share one availability and hold model.
- Required regions must share one transaction state model and one provable recovery path.

### Reject

- Reject browsing existing events, spatial seats, or free-form date entry.
- Reject staff schedulers or one-action centered tasks.
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
| [W3C WAI-ARIA APG — Date picker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) | A calendar dialog manages keyboard focus and returns focus to its trigger. | It is illustrative code and does not establish booking rules. |
| [NHS service manual — Date input](https://service-manual.nhs.uk/design-system/components/date-input) | Date entry exposes an explicit format and field labels. | It does not prove a calendar or slot model. |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Primary content keeps readable and operable relationships as space changes. | It does not prescribe this web template geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic results can be announced without moving focus. | It does not define transaction states or timing. |

## Output

Return one resolved record with exactly these runtime fields:

```json
{
  "archetypeId": "booking-slot-selection",
  "situationCodes": [
    "BSS-01",
    "BSS-02",
    "BSS-03"
  ],
  "searchAliases": [
    "appointment slot booking",
    "date and time selection",
    "availability agenda"
  ],
  "dominantTask": "Choose an available time slot by service, date, timezone, and constraints, then hold the selection long enough to continue.",
  "regions": [
    "slot-booking",
    "service-and-attendee-context",
    "date-navigation",
    "availability-by-date",
    "slot-selection",
    "selected-slot-summary",
    "continue-or-waitlist"
  ],
  "regionRelationships": [
    "slot-booking -> service-and-attendee-context",
    "service-and-attendee-context -> date-navigation",
    "date-navigation -> availability-by-date",
    "availability-by-date -> slot-selection",
    "slot-selection -> selected-slot-summary",
    "selected-slot-summary -> continue-or-waitlist"
  ],
  "responsive": {
    "wide": "Date navigation and available slots remain simultaneous while the availability list owns scan order.",
    "intermediate": "Selected date precedes the slot list and the summary moves adjacent to Continue.",
    "compact": "A one-day agenda is primary; the calendar becomes an alternate dialog and the selected slot follows its option.",
    "reflow": "Preserve one semantic DOM order and transform topology when a named relationship fails.",
    "readingOrder": "slot-booking -> service-and-attendee-context -> date-navigation -> availability-by-date -> slot-selection -> selected-slot-summary -> continue-or-waitlist",
    "navigationReplacement": "Replace lost adjacency with named in-flow or pane navigation to the same regions.",
    "stickyBehavior": "Persistence yields before it can obscure content, focus, validation, or short-height operation.",
    "overflowOwner": "The page owns vertical overflow unless the archetype names one bounded two-dimensional task region.",
    "interactionParity": "Preserve every action, state, recovery path, and focus return across topology changes."
  },
  "stateObligations": [
    "range loading",
    "no slots",
    "timezone",
    "locale",
    "selected slot",
    "held slot",
    "expired slot",
    "concurrent slot taken",
    "accessibility requirement",
    "waitlist available",
    "continue pending",
    "continue error",
    "focus after refresh"
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
