# Roll Call Quorum Threshold Determination Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `roll-call-quorum-threshold-determination-workbench` |
| Family | Work |
| Dominant task | Determine whether one motion is adopted from a versioned procedural rule, the eligible membership and quorum denominator at decision time, and an auditable member-level roll-call ledger. |
| Search aliases | `roll call determination`, `quorum denominator`, `motion threshold audit`, `certified vote journal` |
| Authority | This record defines shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Determine whether one motion is adopted from a versioned procedural rule, the eligible membership and quorum denominator at decision time, and an auditable member-level roll-call ledger.
- The required region graph remains: `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.
- The versioned eligible set derives denominators while immutable member responses derive numerators; they meet only at the motion threshold.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product semantics; Principles own unresolved geometry; Direction owns visual character.
- Wide, intermediate, and compact preserve action, state, keyboard access, overflow ownership, and recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RQ-01` | The stated dominant task is the page's primary user outcome. | Candidate evidence. |
| `AR-RQ-02` | Every required region and named relationship is present. | Required evidence. |
| `AR-RQ-03` | Wide, intermediate, and compact use the declared topology transformations. | Required evidence. |
| `AR-RQ-04` | Compact preserves every action, state, keyboard path, focus return, and recovery. | Required evidence. |
| `AR-RQ-05` | The interactive template proves the prompt acceptance focus. | Required evidence. |
| `AR-RQ-90` | survey-response-analysis-overview | Reject. |
| `AR-RQ-91` | calculation-estimate-flow | Reject. |
| `AR-RQ-92` | review-submit-ledger | Reject. |
| `AR-RQ-93` | generic vote counter | Reject. |

### Selection rule

Select `roll-call-quorum-threshold-determination-workbench` only when codes 01–05 are evidenced and no 9* code holds. Return `needs-evidence` when a required owner or relationship is unknown. Return `reject` for any rejection code. A difference limited to nouns, density, color, card count, component, or state is `duplicate-or-variation`.

## Region graph

```text
roll-call-determination
   `-- body-session-motion-rule-and-time-version
      `-- eligible-membership-set
         `-- vacancy-disqualification-recusal-and-pair-adjustments
            `-- dynamic-quorum-and-decision-denominators
               `-- member-by-member-roll-call-ledger
                  `-- present-voting-abstaining-absent-and-challenged-tallies
                     `-- majority-supermajority-tie-and-casting-vote-rule
                        `-- provisional-result
                           `-- challenge-correction-or-recount
                              `-- certified-result-and-journal-receipt
```

Declared relationship expression: `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `roll-call-determination` | Owns the complete dominant task, version context, and descendant recovery. | Root of the required graph; a generic container cannot replace it. |
| `body-session-motion-rule-and-time-version` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `eligible-membership-set` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `vacancy-disqualification-recusal-and-pair-adjustments` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `dynamic-quorum-and-decision-denominators` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `member-by-member-roll-call-ledger` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `present-voting-abstaining-absent-and-challenged-tallies` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `majority-supermajority-tie-and-casting-vote-rule` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `provisional-result` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `challenge-correction-or-recount` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |
| `certified-result-and-journal-receipt` | Owns this region's evidence, action, state, and recovery. | Follows semantic order and consumes the exact selected context; peer edges synchronize without merging owners. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions cannot preserve readable labels, exact associations, visible actions, and unobscured focus.
- **Topology response:** Motion and rule, membership adjustments, denominator derivation, roll-call ledger, tallies, and threshold result remain simultaneously visible.
- **Navigation replacement:** None while every required owner remains simultaneously usable.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `member-by-member-roll-call-ledger` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region breaks the dominant relationship.
- **Topology response:** The threshold, unresolved member statuses, and challenged responses remain primary; membership evidence, rule text, and prior counts move to synchronized disclosures.
- **Navigation replacement:** A named synchronized disclosure or drawer replaces each displaced region and exposes current state in its trigger.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `member-by-member-roll-call-ledger` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task owners cannot retain readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Motion and rule → eligible set → denominator adjustments → one member response → persistent tallies → threshold or tie rule → challenge or recount → certification becomes a member queue.
- **Navigation replacement:** One primary-pane sequence with explicit Previous and Next preserves selection, query, state, and scroll context.
- **Sticky boundary:** Only the current outcome or action may persist; it reserves space and yields to normal flow at short height.
- **Overflow owner:** `member-by-member-roll-call-ledger` Only the declared bounded region owns overflow; ordinary content never creates page-level horizontal scroll.

### Reflow

- Semantic and DOM order is `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators → member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.
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
| Initial / loading | `body-session-motion-rule-and-time-version` | Identify pending scope and preserve semantic position. |
| Ready | `eligible-membership-set` | Expose the complete dominant task and current version. |
| Empty / not applicable | `vacancy-disqualification-recusal-and-pair-adjustments` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `dynamic-quorum-and-decision-denominators` | Keep valid context and offer local retry without resetting selection. |
| Permission / unavailable | `member-by-member-roll-call-ledger` | Do not imply restricted evidence is absent; provide a safe alternate route. |
| Pending | `present-voting-abstaining-absent-and-challenged-tallies` | Prevent duplicate action and announce progress without moving focus. |
| Success | `majority-supermajority-tie-and-casting-vote-rule` | Expose outcome, provenance, and the next valid action. |
| Stale / conflict | `provisional-result` | Keep the last safe value and require explicit reconciliation. |
| Focus transition | `challenge-correction-or-recount` | Move focus only to a required error summary, then return it to the exact trigger. |
| Responsive presentation | `certified-result-and-journal-receipt` | Preserve entity, query, state, and recovery when topology changes. |
| rule current/superseded | `body-session-motion-rule-and-time-version` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| member eligible/ineligible/recused/vacant | `eligible-membership-set` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| attendance unknown/present/absent | `vacancy-disqualification-recusal-and-pair-adjustments` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| response pending/aye/no/abstain/paired/challenged | `dynamic-quorum-and-decision-denominators` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| quorum unmet/met/lost | `member-by-member-roll-call-ledger` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| threshold unresolved/met/not-met | `present-voting-abstaining-absent-and-challenged-tallies` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| tie absent/present/resolved | `majority-supermajority-tie-and-casting-vote-rule` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| count open/closed/recounting | `provisional-result` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| result provisional/challenged/corrected/certified | `challenge-correction-or-recount` | Expose cause, consequence, and valid recovery without overwriting provenance. |
| journal pending/published | `certified-result-and-journal-receipt` | Expose cause, consequence, and valid recovery without overwriting provenance. |

## Boundaries

### Accept

- Accept only when the dominant task transforms required evidence into the declared outcome.
- Accept only when each required region has an independent owner and named relationships remain explicit.
- A versioned motion rule, dynamically derived membership and denominators, immutable member-level roll call, quorum and decision thresholds, abstention and absence semantics, tie authority, challenge or recount, and certified journal receipt are present.

### Reject

- Reject `survey-response-analysis-overview`; this is `AR-RQ-90` evidence and must route to an adjacent archetype.
- Reject `calculation-estimate-flow`; this is `AR-RQ-91` evidence and must route to an adjacent archetype.
- Reject `review-submit-ledger`; this is `AR-RQ-92` evidence and must route to an adjacent archetype.
- Reject `generic vote counter`; this is `AR-RQ-93` evidence and must route to an adjacent archetype.
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
| [U.S. House Committee on Rules — Rules and resources](https://rules.house.gov/resources) | Versioned procedural rule and precedent sources. | A fictional body's rule or interface. |
| [U.S. Senate — Roll call votes](https://www.senate.gov/legislative/votes_new.htm) | Member-level roll-call results, tallies, outcomes, and vote records. | Universal quorum semantics or product geometry. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense roster status and row-action behavior. | Procedural authority or copied layout. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Non-disruptive announcement of tally, challenge, and certification changes. | Vote truth or exact topology. |

The source set contains current official material from at least three independent organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "roll-call-quorum-threshold-determination-workbench",
  "situationCodes": ["<matched AR-RQ-* codes>"],
  "searchAliases": ["roll call determination","quorum denominator","motion threshold audit","certified vote journal"],
  "dominantTask": "Determine whether one motion is adopted from a versioned procedural rule, the eligible membership and quorum denominator at decision time, and an auditable member-level roll-call ledger.",
  "regions": ["roll-call-determination","body-session-motion-rule-and-time-version","eligible-membership-set","vacancy-disqualification-recusal-and-pair-adjustments","dynamic-quorum-and-decision-denominators","member-by-member-roll-call-ledger","present-voting-abstaining-absent-and-challenged-tallies","majority-supermajority-tie-and-casting-vote-rule","provisional-result","challenge-correction-or-recount","certified-result-and-journal-receipt"],
  "regionRelationships": ["roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators → member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "member-by-member-roll-call-ledger",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["rule current/superseded","member eligible/ineligible/recused/vacant","attendance unknown/present/absent","response pending/aye/no/abstain/paired/challenged","quorum unmet/met/lost","threshold unresolved/met/not-met","tie absent/present/resolved","count open/closed/recounting","result provisional/challenged/corrected/certified","journal pending/published"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

