# Risk impact likelihood overview

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `risk-impact-likelihood-overview` |
| Family | Overview |
| Dominant task | Prioritize risks by likelihood, impact, exposure, and mitigation state, then inspect evidence for one risk. |
| Search aliases | `risk matrix`, `impact likelihood register`, `risk prioritization`, `risk exposure overview` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Every plotted risk has a text identity, explicit likelihood and impact, rank, and mitigation state.
- The region graph remains `risk-overview` → `scope-horizon-category-filters` → `impact-by-likelihood-matrix` → `prioritized-risk-register` → `mitigation-summary` → `selected-risk-evidence`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RI-01` | The dominant task is: Prioritize risks by likelihood, impact, exposure, and mitigation state, then inspect evidence for one risk. | Candidate evidence. |
| `AR-RI-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-RI-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-RI-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-RI-90` | a portfolio health matrix | Reject. |
| `AR-RI-91` | a generic issue queue | Reject. |
| `AR-RI-92` | a scenario forecast | Reject. |
| `AR-RI-93` | a color-only heatmap without risk identities | Reject. |

### Selection rule

Select `risk-impact-likelihood-overview` only when `AR-RI-01`, `AR-RI-02`, and `AR-RI-03` are evidenced and none of `AR-RI-90`, `AR-RI-91`, `AR-RI-92`, or `AR-RI-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
risk-overview
└─ scope-horizon-category-filters
   └─ impact-by-likelihood-matrix
      └─ prioritized-risk-register
         └─ mitigation-summary
            └─ selected-risk-evidence
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `risk-overview` | Owns the page-level risk overview task and all descendant state. | Root of the graph. |
| `scope-horizon-category-filters` | Owns scope horizon category filters evidence or action without borrowing product semantics. | Follows `risk-overview` in semantic order and retains the same selection context. |
| `impact-by-likelihood-matrix` | Owns impact by likelihood matrix evidence or action without borrowing product semantics. | Follows `scope-horizon-category-filters` in semantic order and retains the same selection context. |
| `prioritized-risk-register` | Owns prioritized risk register evidence or action without borrowing product semantics. | Follows `impact-by-likelihood-matrix` in semantic order and retains the same selection context. |
| `mitigation-summary` | Owns mitigation summary evidence or action without borrowing product semantics. | Follows `prioritized-risk-register` in semantic order and retains the same selection context. |
| `selected-risk-evidence` | Owns selected risk evidence evidence or action without borrowing product semantics. | Follows `mitigation-summary` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep the risk matrix synchronized with the prioritized register and selected mitigation evidence.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** `impact-by-likelihood-matrix` alone may own bounded horizontal overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Promote either matrix or register according to the active task and move detail to a drawer.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** `impact-by-likelihood-matrix` keeps the only bounded overflow axis and exposes keyboard instructions.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Default to the prioritized register; make the matrix an alternate full-screen view and restore rank and filters on Back.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `impact-by-likelihood-matrix` is optional; its text or list equivalent is primary.

### Reflow

- Semantic and DOM order is `risk-overview` → `scope-horizon-category-filters` → `impact-by-likelihood-matrix` → `prioritized-risk-register` → `mitigation-summary` → `selected-risk-evidence`.
- Text, zoom, long translation, and enlarged controls trigger the same named topology changes.
- No CSS ordering changes the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap; hidden detail has an explicit accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, action, explanation, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected entity, filters, data state, and pending or completed result.
- Dynamic updates announce one contextual status message without stealing focus.
- Any modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, and geometry always have a textual or structural equivalent.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `scope-horizon-category-filters` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `impact-by-likelihood-matrix` | Expose the complete dominant task with every plotted risk has a text identity, explicit likelihood and impact, rank, and mitigation state. |
| Empty / not applicable | `prioritized-risk-register` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `mitigation-summary` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-risk-evidence` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `selected-risk-evidence` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `selected-risk-evidence` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `scope-horizon-category-filters` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `selected-risk-evidence` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `risk-overview` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: unassessed, accepted, mitigating, escalated, closed, unknown likelihood, unknown impact, overdue mitigation, selected risk, stale assessment, missing owner, permission-redacted evidence.

## Boundaries

### Accept

- Accept when likelihood and impact jointly determine exposure.
- Accept when the matrix and register share exact selection.
- Accept when mitigation state changes risk priority.

### Reject

- Reject a portfolio health matrix; this is `AR-RI-90` evidence and must route to an adjacent archetype.
- Reject a generic issue queue; this is `AR-RI-91` evidence and must route to an adjacent archetype.
- Reject a scenario forecast; this is `AR-RI-92` evidence and must route to an adjacent archetype.
- Reject a color-only heatmap without risk identities; this is `AR-RI-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved. Differences limited to nouns, card count, density, color, component, or state are `duplicate-or-variation`, not a new archetype.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, eligibility, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports the synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [NIST SP 800-30 Rev. 1 — Guide for Conducting Risk Assessments](https://csrc.nist.gov/pubs/sp/800/30/r1/final) | Supports likelihood, impact, risk determination, response context, and assessment uncertainty. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports explicit row-column association, selection, dense comparison, and bounded table overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Supports keyboard-complete composite interaction, state exposure, and predictable focus movement. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "risk-impact-likelihood-overview",
  "situationCodes": ["<matched AR-RI-* codes>"],
  "searchAliases": ["risk matrix","impact likelihood register","risk prioritization","risk exposure overview"],
  "dominantTask": "Prioritize risks by likelihood, impact, exposure, and mitigation state, then inspect evidence for one risk.",
  "regions": ["risk-overview","scope-horizon-category-filters","impact-by-likelihood-matrix","prioritized-risk-register","mitigation-summary","selected-risk-evidence"],
  "regionRelationships": ["risk-overview precedes scope-horizon-category-filters precedes impact-by-likelihood-matrix precedes prioritized-risk-register precedes mitigation-summary precedes selected-risk-evidence"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "risk-overview → scope-horizon-category-filters → impact-by-likelihood-matrix → prioritized-risk-register → mitigation-summary → selected-risk-evidence",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "impact-by-likelihood-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["unassessed", "accepted", "mitigating", "escalated", "closed", "unknown likelihood", "unknown impact", "overdue mitigation", "selected risk", "stale assessment", "missing owner", "permission-redacted evidence"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
