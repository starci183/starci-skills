# Corporate action election entitlement workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `corporate-action-election-entitlement-workbench` |
| Family | Work |
| Dominant task | Determine holder-specific entitlements for one announced corporate action, capture valid elections before the applicable deadline, and reconcile confirmed allocations or proceeds back to each eligible position. |
| Search aliases | `corporate action election`, `holder entitlement`, `voluntary event instruction`, `allocation reconciliation` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Determine holder-specific entitlements for one announced corporate action, capture valid elections before the applicable deadline, and reconcile confirmed allocations or proceeds back to each eligible position.
- The complete region graph retains every stable English region ID declared below.
- Required relationship: The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved exact geometry; Direction owns visual character.
- Every state family preserves task, selection, action, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CA-01` | The dominant task matches Identity exactly. | Candidate evidence. |
| `AR-CA-02` | The complete required region graph is present. | Required evidence. |
| `AR-CA-03` | Compact retains wide action, state, recovery, and associations. | Required evidence. |
| `AR-CA-04` | The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close. | Preserve as an invariant. |
| `AR-CA-90` | The dominant task is  waitlist-offer-allocation-board. | Reject. |
| `AR-CA-91` | The dominant task is  constrained-quota-allocation-editor. | Reject. |
| `AR-CA-92` | The dominant task is  multi-program-eligibility-screening. | Reject. |
| `AR-CA-93` | The dominant task is  dual-list-transfer. | Reject. |

### Selection rule

Select `corporate-action-election-entitlement-workbench` only when `AR-CA-01`, `AR-CA-02`, and `AR-CA-03` are evidenced and no rejection code holds. Return `needs-evidence` when a required owner or relationship is unknown; return `reject` for rejection evidence; a difference limited to noun, count, density, color, component, or state is `duplicate-or-variation`.

## Region graph

```text
corporate-action-election
└─ event-announcement-and-version
   └─ terms-options-and-key-dates
      └─ frozen-record-date-position-snapshot
         └─ holder-account-entitlement-derivation
            ├─ holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle
            └─ deadline-channel-and-agent-status
               └─ default-option
                  └─ confirmed-allocation-cash-or-security-movement
                     └─ exception-tax-and-final-entitlement-receipt
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `corporate-action-election` | Owns the evidence, action, and state of `corporate-action-election` without borrowing product semantics. | Root of the graph. |
| `event-announcement-and-version` | Owns the evidence, action, and state of `event-announcement-and-version` without borrowing product semantics. | Follows the graph semantic order and retains its association with `corporate-action-election`. |
| `terms-options-and-key-dates` | Owns the evidence, action, and state of `terms-options-and-key-dates` without borrowing product semantics. | Follows the graph semantic order and retains its association with `event-announcement-and-version`. |
| `frozen-record-date-position-snapshot` | Owns the evidence, action, and state of `frozen-record-date-position-snapshot` without borrowing product semantics. | Follows the graph semantic order and retains its association with `terms-options-and-key-dates`. |
| `holder-account-entitlement-derivation` | Owns the evidence, action, and state of `holder-account-entitlement-derivation` without borrowing product semantics. | Follows the graph semantic order and retains its association with `frozen-record-date-position-snapshot`. |
| `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` | Owns the evidence, action, and state of `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` without borrowing product semantics. | Follows the graph semantic order and retains its association with `holder-account-entitlement-derivation`. |
| `deadline-channel-and-agent-status` | Owns deadline, transmission channel, and agent acknowledgement state. | Operates as a synchronized peer of the holder-instruction lifecycle and gates each lifecycle transition. |
| `default-option` | Owns the evidence, action, and state of `default-option` without borrowing product semantics. | Follows the graph semantic order and retains its association with `deadline-channel-and-agent-status`. |
| `confirmed-allocation-cash-or-security-movement` | Owns the evidence, action, and state of `confirmed-allocation-cash-or-security-movement` without borrowing product semantics. | Follows the graph semantic order and retains its association with `default-option`. |
| `exception-tax-and-final-entitlement-receipt` | Owns the evidence, action, and state of `exception-tax-and-final-entitlement-receipt` without borrowing product semantics. | Follows the graph semantic order and retains its association with `confirmed-allocation-cash-or-security-movement`. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep event terms, position-derived entitlements, election book, deadline status, and projected versus confirmed allocations simultaneously inspectable.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields at short height.
- **Overflow owner:** `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` is the sole bounded horizontal overflow owner when needed.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Keep the selected holder entitlement and instruction primary; move announcement lineage, the full account roster, and movement history to synchronized disclosures.
- **Navigation replacement:** A named disclosure opens the displaced region and retains the exact selection.
- **Sticky boundary:** An action persists only while its exact target and status remain visible; it returns to normal flow at short height.
- **Overflow owner:** The wide bounded owner retains the only axis and exposes a keyboard alternative.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot retain readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Sequence event option and deadline, holder, eligible position, entitlement, elect/amend/cancel, agent status, default, and final movement receipt; replace aggregate matrices with an account route.
- **Navigation replacement:** A primary-pane sequence with Back and Next restores selection, state, and scroll context.
- **Sticky boundary:** The bottom action reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** A numeric or list equivalent replaces the bounded grid; no page-level horizontal scroll appears.

### Reflow

- Semantic and DOM order is `corporate-action-election` → `event-announcement-and-version` → `terms-options-and-key-dates` → `frozen-record-date-position-snapshot` → `holder-account-entitlement-derivation` → `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` → `deadline-channel-and-agent-status` → `default-option` → `confirmed-allocation-cash-or-security-movement` → `exception-tax-and-final-entitlement-receipt`.
- Zoom, long translation, enlarged controls, and text pressure trigger the same topology transformations.
- CSS does not reorder the visual sequence away from keyboard or assistive-technology order.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact entity, filters, data state, and pending or completed result.
- Dynamic updates announce contextual status without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `event-announcement-and-version` | Name the scope and pending owner; preserve semantic position. |
| Ready | `terms-options-and-key-dates` | Expose the complete dominant task and required associations. |
| Empty / not applicable | `frozen-record-date-position-snapshot` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `holder-account-entitlement-derivation` | Keep valid context, name the failed owner, and offer local retry. |
| Permission / unavailable | `confirmed-allocation-cash-or-security-movement` | Do not imply hidden evidence is absent; provide a safe exit. |
| Pending | `confirmed-allocation-cash-or-security-movement` | Prevent duplicate action, retain the exact target, and announce progress. |
| Success | `exception-tax-and-final-entitlement-receipt` | Expose the outcome, preserve context, and provide the next valid action. |
| Stale / conflict | `event-announcement-and-version` | Keep the last safe value and require explicit recovery. |
| Focus transition | `exception-tax-and-final-entitlement-receipt` | Move focus only to a modal or error summary, then return to the exact trigger. |
| Responsive presentation | `corporate-action-election` | Preserve task, state, selection, and recovery when topology changes. |

Applicable state family: announcement preliminary/confirmed/amended/cancelled; position pending/frozen/disputed; holder eligible/ineligible; entitlement projected/revised/final; instruction draft/sent/acknowledged/rejected/cancelled/late; deadline open/near/closed; default applied; proration pending/final; proceeds pending/paid; tax exception unresolved/resolved.

## Boundaries

### Accept

- Accept when A versioned security event and frozen record-date snapshot derive the entitlement.
- Accept when The holder instruction retains draft-to-agent lifecycle and deadline behavior.
- Accept when Confirmed cash or securities reconcile to the instruction and eligible position.

### Reject

- Reject `waitlist-offer-allocation-board`; this is `AR-CA-90` evidence and must route to an adjacent archetype.
- Reject `constrained-quota-allocation-editor`; this is `AR-CA-91` evidence and must route to an adjacent archetype.
- Reject `multi-program-eligibility-screening`; this is `AR-CA-92` evidence and must route to an adjacent archetype.
- Reject `dual-list-transfer`; this is `AR-CA-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved. Apply `duplicate-or-variation` when the difference is limited to noun, count, density, color, component, or state.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, eligibility, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, size, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, responsive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy an interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [DTCC — Corporate Actions Processing](https://www.dtcc.com/asset-services/corporate-actions-processing) | Announcement, entitlement, instruction, allocation, and payment lifecycle. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [ISO 20022 — MT565 scope](https://www.iso20022.org/15022/uhb/finmt565.htm) | Election, amendment, cancellation, and custodian-instruction semantics. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Visible focus around deadline and compact action surfaces. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcements for acknowledgement, default, proration, and movement status. | Does not select the archetype, define product truth, or authorize copied geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Account-row association and bounded election-book scanning. | Does not select the archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard semantics when an interactive entitlement grid is used. | Does not select the archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "corporate-action-election-entitlement-workbench",
  "situationCodes": [
    "<matched AR-CA-* codes>"
  ],
  "searchAliases": [
    "corporate action election",
    "holder entitlement",
    "voluntary event instruction",
    "allocation reconciliation"
  ],
  "dominantTask": "Determine holder-specific entitlements for one announced corporate action, capture valid elections before the applicable deadline, and reconcile confirmed allocations or proceeds back to each eligible position.",
  "regions": [
    "corporate-action-election",
    "event-announcement-and-version",
    "terms-options-and-key-dates",
    "frozen-record-date-position-snapshot",
    "holder-account-entitlement-derivation",
    "holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle",
    "deadline-channel-and-agent-status",
    "default-option",
    "confirmed-allocation-cash-or-security-movement",
    "exception-tax-and-final-entitlement-receipt"
  ],
  "regionRelationships": [
    "The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "corporate-action-election → event-announcement-and-version → terms-options-and-key-dates → frozen-record-date-position-snapshot → holder-account-entitlement-derivation → holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle → deadline-channel-and-agent-status → default-option → confirmed-allocation-cash-or-security-movement → exception-tax-and-final-entitlement-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "announcement preliminary/confirmed/amended/cancelled",
    "position pending/frozen/disputed",
    "holder eligible/ineligible",
    "entitlement projected/revised/final",
    "instruction draft/sent/acknowledged/rejected/cancelled/late",
    "deadline open/near/closed",
    "default applied",
    "proration pending/final",
    "proceeds pending/paid",
    "tax exception unresolved/resolved"
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
    "<official task research>",
    "<accessibility research>"
  ]
}
```
