# Passenger disruption reaccommodation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `passenger-disruption-reaccommodation-workbench` |
| Family | Work |
| Dominant task | Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted. |
| Search aliases | `passenger disruption reaccommodation`, `passenger disruption reaccommodation workspace`, `passenger disruption reaccommodation control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted.
- a candidate is not a package until every passenger and every replacement segment is feasible, and partial ticket reissue is never a successful commit.
- Every required region retains a separate owner and the same selected context.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PDRW-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-PDRW-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-PDRW-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-PDRW-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-PDRW-90` | The dominant task is actually `spatial-route-itinerary-explorer`. | Reject. |
| `AR-PDRW-91` | The dominant task is actually `booking-slot-selection`. | Reject. |
| `AR-PDRW-92` | The dominant task is actually `waitlist-offer-allocation-board`. | Reject. |
| `AR-PDRW-93` | The dominant task is actually `multi-item-return-resolution`. | Reject. |
| `AR-PDRW-94` | The dominant task is actually `nonlinear-task-list-application`. | Reject. |

### Selection rule

Select `passenger-disruption-reaccommodation-workbench` if and only if `AR-PDRW-01` through `AR-PDRW-04` are evidenced and none of `AR-PDRW-90` through `AR-PDRW-94` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
reaccommodation-workbench → disruption-and-original-journey-contract → passenger-party-membership-access-document-and-assistance-constraints → original-segments-ticket-coupons-and-baggage-state → complete-origin-to-contracted-destination-replacement-package-graph → every-segment-seat-connection-and-baggage-feasibility-per-passenger → keep-party-together-or-record-explicit-member-level-split-consent → care-refund-compensation-and-assistance-ledger → selected-complete-party-recovery-package → atomic-all-passenger-rebook-reissue-or-full-rollback → notifications-and-per-passenger-party-receipts
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `reaccommodation-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `disruption-and-original-journey-contract` | Owns Disruption And Original Journey Contract evidence or action and preserves its declared relationship to the current selection. |
| `passenger-party-membership-access-document-and-assistance-constraints` | Owns Passenger Party Membership Access Document And Assistance Constraints evidence or action and preserves its declared relationship to the current selection. |
| `original-segments-ticket-coupons-and-baggage-state` | Owns Original Segments Ticket Coupons And Baggage State evidence or action and preserves its declared relationship to the current selection. |
| `complete-origin-to-contracted-destination-replacement-package-graph` | Owns Complete Origin To Contracted Destination Replacement Package Graph evidence or action and preserves its declared relationship to the current selection. |
| `every-segment-seat-connection-and-baggage-feasibility-per-passenger` | Owns Every Segment Seat Connection And Baggage Feasibility Per Passenger evidence or action and preserves its declared relationship to the current selection. |
| `keep-party-together-or-record-explicit-member-level-split-consent` | Owns Keep Party Together Or Record Explicit Member Level Split Consent evidence or action and preserves its declared relationship to the current selection. |
| `care-refund-compensation-and-assistance-ledger` | Owns Care Refund Compensation And Assistance Ledger evidence or action and preserves its declared relationship to the current selection. |
| `selected-complete-party-recovery-package` | Owns Selected Complete Party Recovery Package evidence or action and preserves its declared relationship to the current selection. |
| `atomic-all-passenger-rebook-reissue-or-full-rollback` | Owns Atomic All Passenger Rebook Reissue Or Full Rollback evidence or action and preserves its declared relationship to the current selection. |
| `notifications-and-per-passenger-party-receipts` | Owns Notifications And Per Passenger Party Receipts evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Original journey, passenger constraints, replacement graph, party/seat feasibility, assistance ledger and issue receipts remain comparable; only the bounded journey graph may pan horizontally.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `complete-origin-to-contracted-destination-replacement-package-graph` owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected party and candidate package stay pinned; journey alternatives and passenger/assistance feasibility alternate while the commit summary remains adjacent.
- **Navigation replacement:** Named evidence views replace displaced regions and preserve exact selection and trigger.
- **Sticky boundary:** The current verdict persists only while its target remains visible and returns to flow at short height.
- **Overflow owner:** The wide bounded owner remains local; alternate evidence views create no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Disruption → exact party members and original contract → non-negotiable per-passenger constraints → ranked complete all-segment journey packages → every passenger's seat/access/document/baggage proof → keep together or explicit split consent → assistance consequence → atomic rebook/reissue or rollback → individual and party receipts; a complete package sequence replaces the route graph.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The bounded visual has a textual ordered equivalent as the primary compact representation.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `reaccommodation-workbench → disruption-and-original-journey-contract → passenger-party-membership-access-document-and-assistance-constraints → original-segments-ticket-coupons-and-baggage-state → complete-origin-to-contracted-destination-replacement-package-graph → every-segment-seat-connection-and-baggage-feasibility-per-passenger → keep-party-together-or-record-explicit-member-level-split-consent → care-refund-compensation-and-assistance-ledger → selected-complete-party-recovery-package → atomic-all-passenger-rebook-reissue-or-full-rollback → notifications-and-per-passenger-party-receipts`.
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

Task-specific states: Disruption loading/confirmed/changed, segment operating/cancelled/misconnected, passenger verified/document-blocked, accessibility request unmet/matched, baggage retained/transferred/unknown, seat tentative/held/expired/confirmed, connection feasible/risky/impossible, party together/split-proposed/split-consented, care due/offered/accepted, package draft/committing/partially-failed/issued and notification acknowledged.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `disruption-and-original-journey-contract` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `passenger-party-membership-access-document-and-assistance-constraints` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `passenger-party-membership-access-document-and-assistance-constraints` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `atomic-all-passenger-rebook-reissue-or-full-rollback` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `notifications-and-per-passenger-party-receipts` | Explain the restriction without implying hidden evidence is absent and provide a safe exit. |
| Pending | `notifications-and-per-passenger-party-receipts` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `notifications-and-per-passenger-party-receipts` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `disruption-and-original-journey-contract` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `notifications-and-per-passenger-party-receipts` | Move focus only to a modal or required error summary, then return it to the exact trigger. |
| Responsive presentation | `reaccommodation-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject `spatial-route-itinerary-explorer`; this is `AR-PDRW-90` evidence and must route to an adjacent archetype.
- Reject `booking-slot-selection`; this is `AR-PDRW-91` evidence and must route to an adjacent archetype.
- Reject `waitlist-offer-allocation-board`; this is `AR-PDRW-92` evidence and must route to an adjacent archetype.
- Reject `multi-item-return-resolution`; this is `AR-PDRW-93` evidence and must route to an adjacent archetype.
- Reject `nonlinear-task-list-application`; this is `AR-PDRW-94` evidence and must route to an adjacent archetype.

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
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Accessibility obligations for reflow, focus, status, and interaction parity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [European Commission air passenger rights](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [U.S. Department of Transportation airline refunds](https://www.transportation.gov/individuals/aviation-consumer-protection/refunds) | Official task relationships and authority boundaries specific to the dominant task. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "passenger-disruption-reaccommodation-workbench",
  "situationCodes": [
    "<matched AR-PDRW-* codes>"
  ],
  "searchAliases": [
    "passenger disruption reaccommodation",
    "passenger disruption reaccommodation workspace",
    "passenger disruption reaccommodation control"
  ],
  "dominantTask": "Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted.",
  "regions": [
    "reaccommodation-workbench",
    "disruption-and-original-journey-contract",
    "passenger-party-membership-access-document-and-assistance-constraints",
    "original-segments-ticket-coupons-and-baggage-state",
    "complete-origin-to-contracted-destination-replacement-package-graph",
    "every-segment-seat-connection-and-baggage-feasibility-per-passenger",
    "keep-party-together-or-record-explicit-member-level-split-consent",
    "care-refund-compensation-and-assistance-ledger",
    "selected-complete-party-recovery-package",
    "atomic-all-passenger-rebook-reissue-or-full-rollback",
    "notifications-and-per-passenger-party-receipts"
  ],
  "regionRelationships": [
    "a candidate is not a package until every passenger and every replacement segment is feasible, and partial ticket reissue is never a successful commit."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "reaccommodation-workbench -> disruption-and-original-journey-contract -> passenger-party-membership-access-document-and-assistance-constraints -> original-segments-ticket-coupons-and-baggage-state -> complete-origin-to-contracted-destination-replacement-package-graph -> every-segment-seat-connection-and-baggage-feasibility-per-passenger -> keep-party-together-or-record-explicit-member-level-split-consent -> care-refund-compensation-and-assistance-ledger -> selected-complete-party-recovery-package -> atomic-all-passenger-rebook-reissue-or-full-rollback -> notifications-and-per-passenger-party-receipts",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "complete-origin-to-contracted-destination-replacement-package-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Disruption loading/confirmed/changed",
    "segment operating/cancelled/misconnected",
    "passenger verified/document-blocked",
    "accessibility request unmet/matched",
    "baggage retained/transferred/unknown",
    "seat tentative/held/expired/confirmed",
    "connection feasible/risky/impossible",
    "party together/split-proposed/split-consented",
    "care due/offered/accepted",
    "package draft/committing/partially-failed/issued",
    "notification acknowledged"
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

