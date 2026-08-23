# Authored analytical briefing

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `authored-analytical-briefing` |
| Family | Detail |
| Dominant task | Read a curated analytical argument from executive conclusion through ordered findings, annotated evidence, caveats, and methods. |
| Search aliases | `analytical briefing`, `evidence brief`, `ordered findings report`, `analysis narrative` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Authored order is authority; evidence and caveat remain attached to the exact finding they qualify.
- The region graph remains `analytical-briefing` → `thesis-and-scope` → `ordered-finding-navigation` → `finding-narrative` → `annotated-evidence-figure` → `implication-and-caveat` → `methods-and-source-appendix`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-AB-01` | The dominant task is: Read a curated analytical argument from executive conclusion through ordered findings, annotated evidence, caveats, and methods. | Candidate evidence. |
| `AR-AB-02` | The complete required region graph must remain semantically present. | Required evidence. |
| `AR-AB-03` | Compact must retain wide selection, action, state, and recovery. | Required evidence. |
| `AR-AB-04` | Each region has an independent owner and retains the current selection association. | Preserve as an invariant. |
| `AR-AB-90` | a cross-filter analytics dashboard | Reject. |
| `AR-AB-91` | coordinated scrollytelling | Reject. |
| `AR-AB-92` | a general manuscript reader | Reject. |
| `AR-AB-93` | a persuasive product detail | Reject. |

### Selection rule

Select `authored-analytical-briefing` only when `AR-AB-01`, `AR-AB-02`, and `AR-AB-03` are evidenced and none of `AR-AB-90`, `AR-AB-91`, `AR-AB-92`, or `AR-AB-93` describes the dominant task. If one required relationship is unknown, return `needs-evidence`; if a rejection code holds, return `reject` instead of adapting this topology by visual resemblance.

## Region graph

```text
analytical-briefing
└─ thesis-and-scope
   └─ ordered-finding-navigation
      └─ finding-narrative
         └─ annotated-evidence-figure
            └─ implication-and-caveat
               └─ methods-and-source-appendix
```

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `analytical-briefing` | Owns the page-level analytical briefing task and all descendant state. | Root of the graph. |
| `thesis-and-scope` | Owns thesis and scope evidence or action without borrowing product semantics. | Follows `analytical-briefing` in semantic order and retains the same selection context. |
| `ordered-finding-navigation` | Owns ordered finding navigation evidence or action without borrowing product semantics. | Follows `thesis-and-scope` in semantic order and retains the same selection context. |
| `finding-narrative` | Owns finding narrative evidence or action without borrowing product semantics. | Follows `ordered-finding-navigation` in semantic order and retains the same selection context. |
| `annotated-evidence-figure` | Owns annotated evidence figure evidence or action without borrowing product semantics. | Follows `finding-narrative` in semantic order and retains the same selection context. |
| `implication-and-caveat` | Owns implication and caveat evidence or action without borrowing product semantics. | Follows `annotated-evidence-figure` in semantic order and retains the same selection context. |
| `methods-and-source-appendix` | Owns methods and source appendix evidence or action without borrowing product semantics. | Follows `implication-and-caveat` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when the simultaneous regions cannot retain readable labels, exact associations, and complete actions.
- **Topology response:** Keep finding navigation beside readable narrative while each evidence figure stays attached to its claim.
- **Navigation replacement:** None while all required regions remain simultaneously usable.
- **Sticky boundary:** Only an active cross-region action may persist; it reserves space and yields when height cannot keep focused content visible.
- **Overflow owner:** No region owns horizontal overflow; the page reflows vertically.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** Replace persistent navigation with an outline disclosure and keep evidence immediately after its supported claim.
- **Navigation replacement:** Replace the displaced supporting region with a named button or disclosure that exposes current selection and state.
- **Sticky boundary:** A persistent action remains only while its exact target and status stay visible; it becomes in-flow at short height.
- **Overflow owner:** No region gains horizontal overflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions no longer preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use one authored narrative in conclusion-to-finding-to-evidence-to-caveat order with appendix disclosures.
- **Navigation replacement:** Use an explicit primary-pane sequence with Back that restores selection, filter, state, and scroll context.
- **Sticky boundary:** A bottom action reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** The compact sequence uses page scrolling only.

### Reflow

- Semantic and DOM order is `analytical-briefing` → `thesis-and-scope` → `ordered-finding-navigation` → `finding-narrative` → `annotated-evidence-figure` → `implication-and-caveat` → `methods-and-source-appendix`.
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
| Initial / loading | `thesis-and-scope` | Identify the scope and the region that is pending; preserve the semantic position. |
| Ready | `ordered-finding-navigation` | Expose the complete dominant task with authored order is authority; evidence and caveat remain attached to the exact finding they qualify. |
| Empty / not applicable | `finding-narrative` | Distinguish meaningful absence from unavailable evidence and state why the region does not apply. |
| Error / retry | `annotated-evidence-figure` | Keep valid context, name the failed owner, and offer a local retry without resetting selection. |
| Permission / unavailable | `methods-and-source-appendix` | Do not imply hidden evidence is absent; provide a safe exit or alternate route. |
| Pending | `methods-and-source-appendix` | Prevent duplicate action, retain the exact target and announce progress without moving focus. |
| Success | `methods-and-source-appendix` | Expose the outcome, preserve the selected context, and provide the next valid action. |
| Stale / conflict | `thesis-and-scope` | Keep the last safe value, identify version or time conflict, and require explicit recovery. |
| Focus transition | `methods-and-source-appendix` | Move focus only for an opened modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `analytical-briefing` | Preserve state, selection, query, and recovery when topology changes. |

Applicable state family: briefing loading, partial figure error, active finding, source unavailable, revised edition, expanded caveat, print pending, export pending, deep link, reduced-motion static figure.

## Boundaries

### Accept

- Accept when a curated argument has an intentional reading order.
- Accept when findings cite local evidence and caveats.
- Accept when methods and sources remain reachable without becoming primary.

### Reject

- Reject a cross-filter analytics dashboard; this is `AR-AB-90` evidence and must route to an adjacent archetype.
- Reject coordinated scrollytelling; this is `AR-AB-91` evidence and must route to an adjacent archetype.
- Reject a general manuscript reader; this is `AR-AB-92` evidence and must route to an adjacent archetype.
- Reject a persuasive product detail; this is `AR-AB-93` evidence and must route to an adjacent archetype.

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
| [UK Government Analysis Function — Writing about data](https://analysisfunction.civilservice.gov.uk/policy-store/writing-about-data/) | Supports important-points-first structure, context, logical order, uncertainty, limitations, and accessible analytical writing. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Supports adaptive screen regions, fluid structures, and content-driven layout integrity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Supports adaptive panes, readable content regions, and layout relationships across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow without page-level two-dimensional scrolling and bounded exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

| [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Supports hierarchy, readable regions, adaptation, and preserving important content across available space. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports meaningful focus sequence through reflow, disclosures, and staged compact navigation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Supports announcing live, pending, success, failure, and reconnect changes without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "authored-analytical-briefing",
  "situationCodes": ["<matched AR-AB-* codes>"],
  "searchAliases": ["analytical briefing","evidence brief","ordered findings report","analysis narrative"],
  "dominantTask": "Read a curated analytical argument from executive conclusion through ordered findings, annotated evidence, caveats, and methods.",
  "regions": ["analytical-briefing","thesis-and-scope","ordered-finding-navigation","finding-narrative","annotated-evidence-figure","implication-and-caveat","methods-and-source-appendix"],
  "regionRelationships": ["analytical-briefing precedes thesis-and-scope precedes ordered-finding-navigation precedes finding-narrative precedes annotated-evidence-figure precedes implication-and-caveat precedes methods-and-source-appendix"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "analytical-briefing → thesis-and-scope → ordered-finding-navigation → finding-narrative → annotated-evidence-figure → implication-and-caveat → methods-and-source-appendix",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["briefing loading", "partial figure error", "active finding", "source unavailable", "revised edition", "expanded caveat", "print pending", "export pending", "deep link", "reduced-motion static figure"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
