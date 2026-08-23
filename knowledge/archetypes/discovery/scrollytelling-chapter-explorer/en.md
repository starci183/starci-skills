# Scrollytelling chapter explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scrollytelling-chapter-explorer` |
| Family | Discovery |
| Dominant task | Move through authored chapters while coordinated visual evidence explains the claim currently being read. |
| Search aliases | `scrollytelling, chapter narrative, evidence story, guided explainer` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- This archetype decides only the dominant task, required regions, region relationships, responsive transformation, and interaction parity.
- Grammar owns semantic and product owners; Principles own exact geometry and breakpoints; Direction owns visual character.
- Current source and research are evidence, not permission to copy layout or invent product fact.
- Region IDs, situation codes, and shared state remain stable across wide, intermediate, and compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-SCX-01` | Move through authored chapters while coordinated visual evidence explains the claim currently being read. | Candidate when evidenced. |
| `AR-SCX-02` | Every region in `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress` is required and has a distinct owner. | Required for selection. |
| `AR-SCX-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-SCX-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-SCX-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-SCX-90` | An analytical dashboard owns cross-filtered evidence. | Reject. |
| `AR-SCX-91` | A manuscript reader owns static notes around continuous reading. | Reject. |
| `AR-SCX-92` | A paged presentation owns discrete frames. | Reject. |

### Selection rule

Select `scrollytelling-chapter-explorer` only when AR-SCX-01, AR-SCX-02, AR-SCX-03 are evidenced and none of AR-SCX-90, AR-SCX-91, AR-SCX-92 applies. Apply the responsive contract when AR-SCX-04 occurs. Return `needs-evidence` when AR-SCX-05 cannot be proven.

## Region graph

```text
scrollytelling
├─ chapter-navigation
├─ ordered-narrative-chapters
├─ coordinated-visual-stage
├─ active-claim-annotation
└─ evidence-sources-and-progress
```

Canonical relationship: `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `scrollytelling` | Owns the authored chapter journey and its claim-to-evidence coordination; establishes active chapter, claim anchor, evidence identity, and reading progress for every child without absorbing child responsibilities. |
| `chapter-navigation` | offers direct chapter and deep-link navigation without owning reading progress; consumes active chapter, claim anchor, evidence identity, and reading progress from `scrollytelling` and publishes the same identity to `ordered-narrative-chapters`. |
| `ordered-narrative-chapters` | owns continuous chapter reading and determines which claim is in context; consumes active chapter, claim anchor, evidence identity, and reading progress from `chapter-navigation` and publishes the same identity to `coordinated-visual-stage`. |
| `coordinated-visual-stage` | renders evidence for the active claim without owning page scroll or focus; consumes active chapter, claim anchor, evidence identity, and reading progress from `ordered-narrative-chapters` and publishes the same identity to `active-claim-annotation`. |
| `active-claim-annotation` | binds the visible claim to its evidence identity and annotation; consumes active chapter, claim anchor, evidence identity, and reading progress from `coordinated-visual-stage` and publishes the same identity to `evidence-sources-and-progress`. |
| `evidence-sources-and-progress` | owns citations, availability, reduced-motion alternative, and progress feedback; consumes active chapter, claim anchor, evidence identity, and reading progress from `active-claim-annotation` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep chapter navigation, readable narrative, and a non-obscuring sticky visual stage simultaneous while each remains usable.
- **Navigation replacement:** No replacement; chapter links remain direct.
- **Sticky boundary:** Only the coordinated visual stage may persist, and it yields before obscuring a heading or focus.
- **Overflow owner:** Page flow owns vertical reading; the visual stage owns no independent scroll.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Replace the chapter rail with disclosure navigation and reduce visual persistence before narrative measure becomes unusable.
- **Navigation replacement:** Replace the chapter rail with a named chapter disclosure while keeping the active chapter visible.
- **Sticky boundary:** The visual stage loses persistence before narrative measure fails.
- **Overflow owner:** Page flow remains the only vertical scroll owner.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Place each visual inline with its supporting claim and expose chapter navigation in a TOC sheet with static reduced-motion parity.
- **Navigation replacement:** Use a TOC sheet that returns focus to its trigger and preserves the chapter anchor.
- **Sticky boundary:** No evidence surface is sticky; evidence is inline at its claim.
- **Overflow owner:** Page flow owns reading; no nested scroll is introduced.

### Reflow

- DOM order and reading order follow the region graph; CSS does not reorder semantics.
- Resize does not reset query, selection, anchor, progress, path, or recovery state.
- Text zoom, long translation, missing media, and user content do not remove labels, relationships, or recovery routes.
- The page creates no horizontal scroll; any bounded exception belongs to the declared overflow owner.

### Interaction parity

- Every wide action, state, recovery route, and keyboard path exists at intermediate and compact.
- Temporary surfaces support Escape or cancel, contain modal focus, and return focus to the exact trigger.
- Dynamic status is announced without stealing focus; visual state never relies on color alone.
- Pointer, hover, gesture, and motion always have keyboard or static alternatives.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `chapter-navigation` | Load chapter deep-link and coordinated visual loading without replacing the last committed active chapter, claim anchor, evidence identity, and reading progress. | Retain the last safe context in every band. |
| Ready | `active-claim-annotation` | Expose active claim, active visual, and reading progress as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `ordered-narrative-chapters` | Represent unsupported visual or unavailable source with a text alternative; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `active-claim-annotation` | When visual or source failure with chapter text retained, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `active-claim-annotation` | Represent restricted evidence source without implying hidden content; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `evidence-sources-and-progress` | While visual or source retry, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `evidence-sources-and-progress` | After recovered evidence at the same claim anchor, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `active-claim-annotation` | When revised evidence or resize that could desynchronize claim and visual, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `chapter-navigation` | TOC close returns to its trigger; evidence changes never move focus. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `scrollytelling` | Resize preserves active chapter, claim anchor, evidence identity, and reading progress, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Move through authored chapters while coordinated visual evidence explains the claim currently being read.
- Every required region and the relationship `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- An analytical dashboard owns cross-filtered evidence.
- A manuscript reader owns static notes around continuous reading.
- A paged presentation owns discrete frames.
- Decorative parallax has no claim-to-evidence relationship.
- Reject when the difference from an existing archetype is only a product noun, card count, density, color, component, or state.

### Boundary verdict

Return `accept` when the selection rule and parity pass. Return `reject` for rejection evidence, `duplicate-or-variation` for a noun or presentation variation, and `needs-evidence` when one separating fact is unknown.

## Handoff

Grammar assigns semantic and product owners to each region. Principles resolve exact grid, measure, gap, size, alignment, overflow exceptions, and breakpoints after topology selection. Direction resolves visual character.

## Non-binding research evidence

### Evidence boundary

These official sources are advisory evidence for topology, interaction, and accessibility. They are not product truth, do not establish this synthesized archetype name as an official term, and do not license copied geometry, component trees, breakpoints, or visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | adaptive layout and content priority | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [MDN — IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) | coordination with viewport entry without synchronous scroll polling | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: scrollytelling-chapter-explorer
situationCodes: AR-SCX-01, AR-SCX-02, AR-SCX-03, AR-SCX-04, AR-SCX-05
searchAliases: scrollytelling, chapter narrative, evidence story, guided explainer
dominantTask: Move through authored chapters while coordinated visual evidence explains the claim currently being read.
regions: scrollytelling, chapter-navigation, ordered-narrative-chapters, coordinated-visual-stage, active-claim-annotation, evidence-sources-and-progress
regionRelationships: scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress
responsive:
  wide: Keep chapter navigation, readable narrative, and a non-obscuring sticky visual stage simultaneous while each remains usable.
  intermediate: Replace the chapter rail with disclosure navigation and reduce visual persistence before narrative measure becomes unusable.
  compact: Place each visual inline with its supporting claim and expose chapter navigation in a TOC sheet with static reduced-motion parity.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: scrollytelling → chapter-navigation → ordered-narrative-chapters → coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress
  navigationReplacement: Use a TOC sheet that returns focus to its trigger and preserves the chapter anchor.
  stickyBehavior: No evidence surface is sticky; evidence is inline at its claim.
  overflowOwner: Page flow owns reading; no nested scroll is introduced.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
