# Insolvency Priority Distribution Waterfall

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `insolvency-priority-distribution-waterfall` |
| Family | Flow |
| Dominant task | Allocate one insolvency estate across encumbered asset pools and admitted claims in court-approved priority order, including within-class pro rata distributions, reserves, deficiencies, and objections. |
| Search aliases | `insolvency estate distribution`, `claim priority waterfall`, `encumbered pool allocation`, `pari passu claims` |
| Authority | This record defines shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Allocate one insolvency estate across encumbered asset pools and admitted claims in court-approved priority order, including within-class pro rata distributions, reserves, deficiencies, and objections.
- The required region graph remains: `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.
- The bipartite claim-to-pool graph permits governed claims and liens to touch multiple pools without collapsing the estate into one waterfall.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-IW-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-IW-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-IW-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-IW-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-IW-05` | The interactive template proves the prompt acceptance focus. | Required evidence. |
| `AR-IW-90` | bridge-contribution-waterfall-overview | Reject. |
| `AR-IW-91` | multi-creditor-hardship-plan-negotiator | Reject. |
| `AR-IW-92` | waitlist-offer-allocation-board | Reject. |
| `AR-IW-93` | constrained-quota-allocation-editor | Reject. |
| `AR-IW-94` | single-pool tier list | Reject. |

### Selection rule

Select `insolvency-priority-distribution-waterfall` only when codes 01–05 are evidenced and no 9* code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` for any rejection code. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
insolvency-distribution
   `-- proceeding-estate-date-and-court-order-version
      `-- asset-pool-and-encumbrance-register
         `-- admitted-disputed-contingent-and-subordinated-claim-register
            `-- bipartite-claim-to-encumbered-pool-edges
               `-- available-estate-by-pool
                  `-- pool-specific-priority-and-within-class-pro-rata
                     `-- cross-pool-deficiency-surplus-and-reserve-ledger
                        `-- objection-order-and-recalculation
                           `-- approved-payment-schedule-and-closure-receipt
```

Declared relationship expression: `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `insolvency-distribution` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; a generic container cannot replace it. |
| `proceeding-estate-date-and-court-order-version` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `asset-pool-and-encumbrance-register` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `admitted-disputed-contingent-and-subordinated-claim-register` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `bipartite-claim-to-encumbered-pool-edges` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `available-estate-by-pool` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `pool-specific-priority-and-within-class-pro-rata` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `cross-pool-deficiency-surplus-and-reserve-ledger` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `objection-order-and-recalculation` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `approved-payment-schedule-and-closure-receipt` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Asset pools, claims, lien and class mappings, pool waterfalls, distributions, and objections remain simultaneously visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant relationship.
- **Topology response:** The selected pool and active priority class remain primary; full claims, order evidence, and payment history move to synchronized disclosures.
- **Navigation replacement:** A named synchronized disclosure or drawer replaces each displaced region and exposes current state in its trigger.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot retain readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Estate and order version → pool → encumbrance → priority class → claim and pro rata share → reserve or deficiency → objection effect → approved payment becomes a numeric sequence.
- **Navigation replacement:** One primary-pane sequence with explicit Previous and Next preserves selection, query, state, and scroll context.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Reflow

- Semantic and DOM order is `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register → admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.
- Text zoom, long translation, and enlarged controls trigger the same named topology changes.
- CSS never reorders visual content away from keyboard or assistive-technology order.
- Long labels wrap and hidden detail has an explicit accessible reveal.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve selected entity, version, pending state, validation result, and recovery point.
- Dynamic updates use a contextual status message without moving focus.
- Color, position, geometry, and motion have textual or structural equivalents.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `proceeding-estate-date-and-court-order-version` | Identify pending scope and preserve semantic position. |
| Ready | `asset-pool-and-encumbrance-register` | Expose the complete dominant task and current version. |
| Empty / not applicable | `admitted-disputed-contingent-and-subordinated-claim-register` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `bipartite-claim-to-encumbered-pool-edges` | Keep valid context and offer local retry without resetting selection. |
| Permission / unavailable | `available-estate-by-pool` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `pool-specific-priority-and-within-class-pro-rata` | Prevent duplicate action and announce progress without moving focus. |
| Success | `cross-pool-deficiency-surplus-and-reserve-ledger` | Expose outcome, provenance, and the next valid action. |
| Stale / conflict | `objection-order-and-recalculation` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `approved-payment-schedule-and-closure-receipt` | Move focus only to a required error summary, then return it to the exact trigger. |
| Responsive presentation | `approved-payment-schedule-and-closure-receipt` | Preserve entity, query, state, and recovery when topology changes. |
| estate estimated/realized | `proceeding-estate-date-and-court-order-version` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| asset unencumbered/encumbered/disputed | `asset-pool-and-encumbrance-register` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| claim filed/admitted/disputed/contingent/subordinated/rejected | `admitted-disputed-contingent-and-subordinated-claim-register` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| class open/partially paid/satisfied/deficient | `bipartite-claim-to-encumbered-pool-edges` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| distribution provisional/approved/paid | `available-estate-by-pool` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| reserve held/released | `pool-specific-priority-and-within-class-pro-rata` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| objection open/sustained/overruled | `cross-pool-deficiency-surplus-and-reserve-ledger` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| order current/amended/appealed | `objection-order-and-recalculation` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| proceeding open/closed/reopened | `approved-payment-schedule-and-closure-receipt` | Expose cause, consequence, and valid recovery without overwriting provenance. |

## Boundaries

### Accept

- Accept only when the dominant task transforms required evidence into the declared outcome.
- Accept only when each required region has an independent owner and named relationships remain explicit.
- A bipartite claim-to-encumbered-pool graph, admitted-claim status, pool-specific priority, within-class pari passu allocation, cross-pool deficiency and reserve effects, court-order versions, and approved distributions are present.

### Reject

- Reject `bridge-contribution-waterfall-overview`; this is `AR-IW-90` evidence and must route to an adjacent archetype.
- Reject `multi-creditor-hardship-plan-negotiator`; this is `AR-IW-91` evidence and must route to an adjacent archetype.
- Reject `waitlist-offer-allocation-board`; this is `AR-IW-92` evidence and must route to an adjacent archetype.
- Reject `constrained-quota-allocation-editor`; this is `AR-IW-93` evidence and must route to an adjacent archetype.
- Reject `single-pool tier list`; this is `AR-IW-94` evidence and must route to an adjacent archetype.
- Reject any candidate that satisfies the task only by changing product nouns or visual treatment.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, transformation contract, state and recovery parity, and acceptance focus all hold. Return `reject` for any rejection code. Return `needs-evidence` for an unresolved owner or relationship.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, truthful state meaning, and permitted actions to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, replace the dominant task, or weaken keyboard, focus, responsive, or recovery parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, responsive transformation, interaction, and accessibility. It does not name StarCi owners, select exact geometry, create product facts, or authorize copying a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [UNCITRAL — Legislative Guide on Insolvency Law](https://uncitral.un.org/en/texts/insolvency/legislativeguides/insolvency_law) | Proceeding, claim treatment, priority, and distribution concerns. | A jurisdiction-specific order or interface geometry. |
| [World Bank — Insolvency and creditor/debtor principles](https://www.worldbank.org/en/topic/financialsector/brief/the-world-bank-principles-for-effective-insolvency-and-creditor-rights) | International benchmark context for insolvency and secured-creditor regimes. | A court-approved fact or payment amount. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Reviewable dense claim and pool records. | Legal priority or a copied component tree. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Unobscured focus around persistent distribution receipts. | Legal truth or exact geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "insolvency-priority-distribution-waterfall",
  "situationCodes": ["<matched AR-IW-* codes>"],
  "searchAliases": ["insolvency estate distribution","claim priority waterfall","encumbered pool allocation","pari passu claims"],
  "dominantTask": "Allocate one insolvency estate across encumbered asset pools and admitted claims in court-approved priority order, including within-class pro rata distributions, reserves, deficiencies, and objections.",
  "regions": ["insolvency-distribution","proceeding-estate-date-and-court-order-version","asset-pool-and-encumbrance-register","admitted-disputed-contingent-and-subordinated-claim-register","bipartite-claim-to-encumbered-pool-edges","available-estate-by-pool","pool-specific-priority-and-within-class-pro-rata","cross-pool-deficiency-surplus-and-reserve-ledger","objection-order-and-recalculation","approved-payment-schedule-and-closure-receipt"],
  "regionRelationships": ["insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register → admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "admitted-disputed-contingent-and-subordinated-claim-register",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["estate estimated/realized","asset unencumbered/encumbered/disputed","claim filed/admitted/disputed/contingent/subordinated/rejected","class open/partially paid/satisfied/deficient","distribution provisional/approved/paid","reserve held/released","objection open/sustained/overruled","order current/amended/appealed","proceeding open/closed/reopened"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
