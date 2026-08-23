# Customs Origin Valuation Duty Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `customs-origin-valuation-duty-workbench` |
| Family | Work |
| Dominant task | Determine customs treatment of shipment items by jointly classifying goods, establishing customs value, testing origin, and deriving duties, taxes, and declaration evidence. |
| Search aliases | `customs classification valuation`, `origin qualification`, `duty derivation`, `entry amendment lineage` |
| Authority | This record defines shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Determine customs treatment of shipment items by jointly classifying goods, establishing customs value, testing origin, and deriving duties, taxes, and declaration evidence.
- The required region graph remains: `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.
- Classification, valuation, and origin remain peer determinations with separate evidence and uncertainty; they converge only at rate and duty derivation.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CV-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-CV-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-CV-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-CV-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-CV-05` | The interactive template proves the prompt acceptance focus. | Required evidence. |
| `AR-CV-90` | multi-program-eligibility-screening | Reject. |
| `AR-CV-91` | rule-builder-workbench | Reject. |
| `AR-CV-92` | calculation-estimate-flow | Reject. |
| `AR-CV-93` | evidence-led-case-resolution-dossier | Reject. |

### Selection rule

Select `customs-origin-valuation-duty-workbench` only when codes 01–05 are evidenced and no 9* code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` for any rejection code. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
customs-duty
   `-- shipment-entry-date-trade-agreement-and-law-version
      `-- item-evidence-register
         `-- classification-determination
            `-- goods-description
               `-- tariff-heading
                  `-- measure
                     `-- valuation-determination
                        `-- method
                           `-- transaction-value-adjustments
                              `-- customs-value
                                 `-- origin-determination
                                    `-- bill-of-materials-and-production
                                       `-- origin-criterion
                                          `-- preference-status
                                             `-- duty-tax-relief-and-additional-measure-calculation
                                                `-- declaration-document-evidence-and-exception
                                                   `-- accepted-examined-amended-or-refunded-entry-lineage
```

Declared relationship expression: `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `customs-duty` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; a generic container cannot replace it. |
| `shipment-entry-date-trade-agreement-and-law-version` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `item-evidence-register` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `classification-determination` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `goods-description` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `tariff-heading` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `measure` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `valuation-determination` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `method` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `transaction-value-adjustments` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `customs-value` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `origin-determination` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `bill-of-materials-and-production` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `origin-criterion` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `preference-status` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `duty-tax-relief-and-additional-measure-calculation` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `declaration-document-evidence-and-exception` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `accepted-examined-amended-or-refunded-entry-lineage` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Shipment items, tariff reasoning, value adjustments, material and process origin test, duty calculation, and declaration evidence remain simultaneously visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `item-evidence-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant relationship.
- **Topology response:** The selected item and unresolved classification or origin issue remain primary; the full bill of materials, valuation history, and prior entries move to synchronized disclosures.
- **Navigation replacement:** A named synchronized disclosure or drawer replaces each displaced region and exposes current state in its trigger.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `item-evidence-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot retain readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Entry and item → classify and measure → build customs value → test origin criterion → apply preference or general rate → calculate duty and tax → attach evidence → submit or amend becomes an item route.
- **Navigation replacement:** One primary-pane sequence with explicit Previous and Next preserves selection, query, state, and scroll context.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `item-evidence-register` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Reflow

- Semantic and DOM order is `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination → goods-description → tariff-heading → measure → valuation-determination → method → transaction-value-adjustments → customs-value → origin-determination → bill-of-materials-and-production → origin-criterion → preference-status → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.
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
| Initial / loading | `shipment-entry-date-trade-agreement-and-law-version` | Identify pending scope and preserve semantic position. |
| Ready | `item-evidence-register` | Expose the complete dominant task and current version. |
| Empty / not applicable | `classification-determination` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `goods-description` | Keep valid context and offer local retry without resetting selection. |
| Permission / unavailable | `tariff-heading` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `measure` | Prevent duplicate action and announce progress without moving focus. |
| Success | `valuation-determination` | Expose outcome, provenance, and the next valid action. |
| Stale / conflict | `method` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `transaction-value-adjustments` | Move focus only to a required error summary, then return it to the exact trigger. |
| Responsive presentation | `customs-value` | Preserve entity, query, state, and recovery when topology changes. |
| entry draft/submitted/selected-for-exam | `shipment-entry-date-trade-agreement-and-law-version` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| item classified/ambiguous | `item-evidence-register` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| value method accepted/challenged | `classification-determination` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| adjustment included/excluded | `goods-description` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| material origin verified/missing | `tariff-heading` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| rule test pass/fail/indeterminate | `measure` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| preference claimed/denied | `valuation-determination` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| duty provisional/final/underpaid/refundable | `method` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| document valid/expired/missing | `transaction-value-adjustments` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| entry accepted/amended/refunded | `customs-value` | Expose cause, consequence, and valid recovery without overwriting provenance. |

## Boundaries

### Accept

- Accept only when the dominant task transforms required evidence into the declared outcome.
- Accept only when each required region has an independent owner and named relationships remain explicit.
- Three independent peer determinations for tariff classification, customs valuation, and origin retain distinct evidence and uncertainty and converge only at rate derivation, declaration evidence, and customs-entry lineage.

### Reject

- Reject `multi-program-eligibility-screening`; this is `AR-CV-90` evidence and must route to an adjacent archetype.
- Reject `rule-builder-workbench`; this is `AR-CV-91` evidence and must route to an adjacent archetype.
- Reject `calculation-estimate-flow`; this is `AR-CV-92` evidence and must route to an adjacent archetype.
- Reject `evidence-led-case-resolution-dossier`; this is `AR-CV-93` evidence and must route to an adjacent archetype.
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
| [World Customs Organization — Rules of Origin Compendium](https://www.wcoomd.org/en/topics/origin/overview/origin-compendium.aspx?p=1) | Preferential and non-preferential origin reasoning and evidence concerns. | A shipment's origin result or interface geometry. |
| [World Trade Organization — Customs valuation](https://www.wto.org/english/tratop_e/cusval_e/cusval_e.htm) | Fair, uniform, neutral valuation and the valuation agreement context. | A tariff classification, origin result, or declared value. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense item evidence and comparison behavior. | Customs law or copied component structure. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard traversal across peer determinations. | Customs truth or exact responsive geometry. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "customs-origin-valuation-duty-workbench",
  "situationCodes": ["<matched AR-CV-* codes>"],
  "searchAliases": ["customs classification valuation","origin qualification","duty derivation","entry amendment lineage"],
  "dominantTask": "Determine customs treatment of shipment items by jointly classifying goods, establishing customs value, testing origin, and deriving duties, taxes, and declaration evidence.",
  "regions": ["customs-duty","shipment-entry-date-trade-agreement-and-law-version","item-evidence-register","classification-determination","goods-description","tariff-heading","measure","valuation-determination","method","transaction-value-adjustments","customs-value","origin-determination","bill-of-materials-and-production","origin-criterion","preference-status","duty-tax-relief-and-additional-measure-calculation","declaration-document-evidence-and-exception","accepted-examined-amended-or-refunded-entry-lineage"],
  "regionRelationships": ["customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination → goods-description → tariff-heading → measure → valuation-determination → method → transaction-value-adjustments → customs-value → origin-determination → bill-of-materials-and-production → origin-criterion → preference-status → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "item-evidence-register",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["entry draft/submitted/selected-for-exam","item classified/ambiguous","value method accepted/challenged","adjustment included/excluded","material origin verified/missing","rule test pass/fail/indeterminate","preference claimed/denied","duty provisional/final/underpaid/refundable","document valid/expired/missing","entry accepted/amended/refunded"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

