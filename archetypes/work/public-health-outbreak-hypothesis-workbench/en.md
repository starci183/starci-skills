# Public health outbreak hypothesis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `public-health-outbreak-hypothesis-workbench` |
| Family | Work |
| Dominant task | Investigate an outbreak by maintaining a versioned case definition and line list, comparing time/place/exposure-network projections, testing source or transmission hypotheses, and tracking control measures plus reporting lag as evidence changes |
| Search aliases | public-health-outbreak-hypothesis-workbench, outbreak-investigation, hypothesis-status-and-investigation-log |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `outbreak-investigation` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PHO-01` | The user must investigate an outbreak by maintaining a versioned case definition and line list, comparing time/place/exposure-network projections, testing source or transmission hypotheses, and tracking control measures plus reporting lag as evidence changes | Require the dominant task. |
| `AR-PHO-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-PHO-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-PHO-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-PHO-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-PHO-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-PHO-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `public-health-outbreak-hypothesis-workbench` if and only if `AR-PHO-01` through `AR-PHO-04` are evidenced, every named region and relationship is required, and none of `AR-PHO-90` through `AR-PHO-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ outbreak-investigation
├─ case-definition-version
├─ case-membership-recomputation-ledger
├─ recomputed-line-list
├─ synchronized-epidemic-curve
├─ place-map
├─ exposure-and-contact-network
├─ hypothesis-register
├─ analytic-comparison-results
├─ control-measures-and-reporting-lag
└─ hypothesis-status-and-investigation-log
```

Required relationship: `outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve ↔ place-map ↔ exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `outbreak-investigation` | Owns the state and decision of `outbreak-investigation`; preserves its relationship with downstream `case-definition-version` without absorbing another region's owner. |
| `case-definition-version` | Owns the state and decision of `case-definition-version`; preserves its relationship with upstream `outbreak-investigation` and downstream `case-membership-recomputation-ledger` without absorbing another region's owner. |
| `case-membership-recomputation-ledger` | Owns the state and decision of `case-membership-recomputation-ledger`; preserves its relationship with upstream `case-definition-version` and downstream `recomputed-line-list` without absorbing another region's owner. |
| `recomputed-line-list` | Owns the state and decision of `recomputed-line-list`; preserves its relationship with upstream `case-membership-recomputation-ledger` and downstream `synchronized-epidemic-curve` without absorbing another region's owner. |
| `synchronized-epidemic-curve` | Owns the state and decision of `synchronized-epidemic-curve`; preserves its relationship with upstream `recomputed-line-list` and downstream `place-map` without absorbing another region's owner. |
| `place-map` | Owns the state and decision of `place-map`; preserves its relationship with upstream `synchronized-epidemic-curve` and downstream `exposure-and-contact-network` without absorbing another region's owner. |
| `exposure-and-contact-network` | Owns the state and decision of `exposure-and-contact-network`; preserves its relationship with upstream `place-map` and downstream `hypothesis-register` without absorbing another region's owner. |
| `hypothesis-register` | Owns the state and decision of `hypothesis-register`; preserves its relationship with upstream `exposure-and-contact-network` and downstream `analytic-comparison-results` without absorbing another region's owner. |
| `analytic-comparison-results` | Owns the state and decision of `analytic-comparison-results`; preserves its relationship with upstream `hypothesis-register` and downstream `control-measures-and-reporting-lag` without absorbing another region's owner. |
| `control-measures-and-reporting-lag` | Owns the state and decision of `control-measures-and-reporting-lag`; preserves its relationship with upstream `analytic-comparison-results` and downstream `hypothesis-status-and-investigation-log` without absorbing another region's owner. |
| `hypothesis-status-and-investigation-log` | Owns the state and decision of `hypothesis-status-and-investigation-log`; preserves its relationship with upstream `control-measures-and-reporting-lag` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Case-definition version, line-list summary, epidemic curve, place map, exposure network, hypothesis register and control/lag context remain linked; selecting a case or interval propagates across every projection
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `case-membership-recomputation-ledger` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** One selected time/place/network projection remains primary with the hypothesis register; the other projections become explicit switches, while case-definition and reporting-lag banners remain persistent
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `case-membership-recomputation-ledger` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Confirm or revise the case-definition version → review membership changes and exclusions → wait for recomputed line-list counts → step through accessible time, place and network projections from the same recomputation receipt → open one hypothesis → compare supporting/opposing results → account for control timing/reporting lag → update status/log; maps and networks yield to table/path alternatives, and hypothesis actions stay blocked while any projection is stale
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `case-membership-recomputation-ledger` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve → place-map → exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes case definition draft/active/superseded, case suspected/probable/confirmed/excluded/reclassified, line list loading/incomplete/stale, location redacted/unavailable, exposure link known/uncertain, hypothesis proposed/under test/supported/weakened/refuted, analysis pending/failed/ready, control planned/active/lifted, reporting lag estimated/changed and investigation log appended/conflicted.

## State obligations

Task-specific states: case definition draft/active/superseded, case suspected/probable/confirmed/excluded/reclassified, line list loading/incomplete/stale, location redacted/unavailable, exposure link known/uncertain, hypothesis proposed/under test/supported/weakened/refuted, analysis pending/failed/ready, control planned/active/lifted, reporting lag estimated/changed and investigation log appended/conflicted.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with a valid next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow cancellation when safe, and announce progress. |
| Success | Confirm the exact changed scope, update dependent summaries, and preserve the next valid step. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus. |
| Responsive presentation | Wide retains simultaneity; intermediate makes low-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must change a fictional case-definition version, show added/excluded membership, block hypothesis updates while the line list or any time/place/network projection is stale, complete one recomputation receipt, synchronize a selected cluster across every projection and accessible alternative, compare two hypotheses, weaken a premature trend claim from reporting lag, record a control and append the investigation log
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology could be `causal-root-analysis-dossier`, `map-led-situation-monitor`, `process-variant-mining-overview` or `knowledge-graph-explorer`; a static case dossier, map or causal hypothesis list is insufficient. A versioned case definition must own line-list membership and recompute synchronized person–place–time/network projections before competing outbreak hypotheses, controls or reporting-lag conclusions may update
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PHO-90`, `AR-PHO-91`, or `AR-PHO-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit thresholds.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [CDC Field Epidemiology Manual: Conducting a Field Investigation](https://www.cdc.gov/field-epi-manual/php/chapters/field-investigation.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [CDC foodborne outbreak investigation steps](https://www.cdc.gov/foodborne-outbreaks/outbreak-basics/investigation-steps.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WHO Outbreak Toolkit](https://www.who.int/emergencies/outbreak-toolkit) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [Esri — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports map and alternative-view layout considerations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "public-health-outbreak-hypothesis-workbench",
  "matchedSituationCodes": [
    "AR-PHO-01",
    "AR-PHO-02",
    "AR-PHO-03",
    "AR-PHO-04"
  ],
  "aliases": [
    "public-health-outbreak-hypothesis-workbench",
    "outbreak-investigation",
    "hypothesis-status-and-investigation-log"
  ],
  "dominantTask": "Investigate an outbreak by maintaining a versioned case definition and line list, comparing time/place/exposure-network projections, testing source or transmission hypotheses, and tracking control measures plus reporting lag as evidence changes",
  "regions": [
    "outbreak-investigation",
    "case-definition-version",
    "case-membership-recomputation-ledger",
    "recomputed-line-list",
    "synchronized-epidemic-curve",
    "place-map",
    "exposure-and-contact-network",
    "hypothesis-register",
    "analytic-comparison-results",
    "control-measures-and-reporting-lag",
    "hypothesis-status-and-investigation-log"
  ],
  "relationships": [
    "outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve ↔ place-map ↔ exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log"
  ],
  "responsive": {
    "wide": "Case-definition version, line-list summary, epidemic curve, place map, exposure network, hypothesis register and control/lag context remain linked; selecting a case or interval propagates across every projection",
    "intermediate": "One selected time/place/network projection remains primary with the hypothesis register; the other projections become explicit switches, while case-definition and reporting-lag banners remain persistent",
    "compact": "Confirm or revise the case-definition version → review membership changes and exclusions → wait for recomputed line-list counts → step through accessible time, place and network projections from the same recomputation receipt → open one hypothesis → compare supporting/opposing results → account for control timing/reporting lag → update status/log; maps and networks yield to table/path alternatives, and hypothesis actions stay blocked while any projection is stale",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve → place-map → exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "case-membership-recomputation-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "case definition draft/active/superseded",
    "case suspected/probable/confirmed/excluded/reclassified",
    "line list loading/incomplete/stale",
    "location redacted/unavailable",
    "exposure link known/uncertain",
    "hypothesis proposed/under test/supported/weakened/refuted",
    "analysis pending/failed/ready",
    "control planned/active/lifted",
    "reporting lag estimated/changed and investigation log appended/conflicted"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
