# Histopathology slide signout workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `histopathology-slide-signout-workbench` |
| Family | Work |
| Dominant task | Review a pathology case across specimen parts, blocks and whole-slide images, register diagnostic regions and features, complete synoptic elements, obtain consultation when required, and issue a versioned diagnostic signout |
| Search aliases | histopathology-slide-signout-workbench, histopathology-signout, signed-report-version |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `histopathology-signout` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-HSS-01` | The user must review a pathology case across specimen parts, blocks and whole-slide images, register diagnostic regions and features, complete synoptic elements, obtain consultation when required, and issue a versioned diagnostic signout | Require the dominant task. |
| `AR-HSS-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-HSS-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-HSS-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-HSS-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-HSS-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-HSS-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `histopathology-slide-signout-workbench` if and only if `AR-HSS-01` through `AR-HSS-04` are evidenced, every named region and relationship is required, and none of `AR-HSS-90` through `AR-HSS-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ histopathology-signout
├─ case-and-specimen-identity
├─ specimen-part-to-block-to-slide-provenance
├─ tiled-whole-slide-stage
├─ diagnostic-region-and-feature-register
├─ feature-to-synoptic-element-and-report-claim-links
├─ diagnosis-and-comment-composer
├─ peer-review-or-consult
└─ signed-report-version
```

Required relationship: `histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage ↔ diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `histopathology-signout` | Owns the state and decision of `histopathology-signout`; preserves its relationship with downstream `case-and-specimen-identity` without absorbing another region's owner. |
| `case-and-specimen-identity` | Owns the state and decision of `case-and-specimen-identity`; preserves its relationship with upstream `histopathology-signout` and downstream `specimen-part-to-block-to-slide-provenance` without absorbing another region's owner. |
| `specimen-part-to-block-to-slide-provenance` | Owns the state and decision of `specimen-part-to-block-to-slide-provenance`; preserves its relationship with upstream `case-and-specimen-identity` and downstream `tiled-whole-slide-stage` without absorbing another region's owner. |
| `tiled-whole-slide-stage` | Owns the state and decision of `tiled-whole-slide-stage`; preserves its relationship with upstream `specimen-part-to-block-to-slide-provenance` and downstream `diagnostic-region-and-feature-register` without absorbing another region's owner. |
| `diagnostic-region-and-feature-register` | Owns the state and decision of `diagnostic-region-and-feature-register`; preserves its relationship with upstream `tiled-whole-slide-stage` and downstream `feature-to-synoptic-element-and-report-claim-links` without absorbing another region's owner. |
| `feature-to-synoptic-element-and-report-claim-links` | Owns the state and decision of `feature-to-synoptic-element-and-report-claim-links`; preserves its relationship with upstream `diagnostic-region-and-feature-register` and downstream `diagnosis-and-comment-composer` without absorbing another region's owner. |
| `diagnosis-and-comment-composer` | Owns the state and decision of `diagnosis-and-comment-composer`; preserves its relationship with upstream `feature-to-synoptic-element-and-report-claim-links` and downstream `peer-review-or-consult` without absorbing another region's owner. |
| `peer-review-or-consult` | Owns the state and decision of `peer-review-or-consult`; preserves its relationship with upstream `diagnosis-and-comment-composer` and downstream `signed-report-version` without absorbing another region's owner. |
| `signed-report-version` | Owns the state and decision of `signed-report-version`; preserves its relationship with upstream `peer-review-or-consult` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Part/block/slide hierarchy, selected slide stage, diagnostic feature register and report/synoptic progress remain visible; selection is synchronized without making visual marks the only way to navigate
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `tiled-whole-slide-stage` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** The slide stage and selected diagnostic feature stay primary; hierarchy becomes a specimen breadcrumb plus slide rail, while synoptic/report work moves to a resumable side sheet
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `tiled-whole-slide-stage` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Case identity → specimen part → block → slide → selected tile/region or textual coordinate → diagnostic feature → linked synoptic element and report claim → consultation if required → signout; the provenance path and unlinked required claim remain persistent, while the slide mosaic yields to one image stage plus a coordinate/feature ledger
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `tiled-whole-slide-stage` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage → diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes case loading, specimen mismatch, block/slide missing or unavailable, image tile loading/error, region selected/unselected/unreviewed, feature draft/confirmed/conflicting, synoptic complete/incomplete/not-applicable, consult requested/returned/overdue, report unsigned/signed/amended, stale slide revision, permission-limited image and focus restored after region detail closes.

## State obligations

Task-specific states: case loading, specimen mismatch, block/slide missing or unavailable, image tile loading/error, region selected/unselected/unreviewed, feature draft/confirmed/conflicting, synoptic complete/incomplete/not-applicable, consult requested/returned/overdue, report unsigned/signed/amended, stale slide revision, permission-limited image and focus restored after region detail closes.

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

- Template must traverse a fictional specimen part→block→slide path, locate a diagnostic region by image and numeric/list controls, link the recorded feature to one synoptic element and report claim, expose an unlinked required claim, route a consult, block signout until the gap resolves, and show an accessible amended-version trail
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the result is `multichannel-microscopy-analysis-workbench`, `media-annotation-workbench`, `orthogonal-volume-slice-inspector`, `sample-lineage-custody-explorer` or a generic case dossier; channel analysis, annotation or traceability alone is insufficient. Post-slide diagnostic interpretation must preserve specimen→block→slide provenance, link each relied-on feature to a synoptic/report claim, and end in a versioned pathology signout
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-HSS-90`, `AR-HSS-91`, or `AR-HSS-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [DICOM current Whole Slide Microscopy Image IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.32.8.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [CAP current cancer protocols](https://www.cap.org/protocols-and-guidelines/cancer-protocols/current-cancer-protocols/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [CAP whole-slide imaging validation guideline](https://www.cap.org/protocols-and-guidelines/cap-guidelines/current-cap-guidelines/validating-whole-slide-imaging-for-diagnostic-purposes-in-pathology) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "histopathology-slide-signout-workbench",
  "matchedSituationCodes": [
    "AR-HSS-01",
    "AR-HSS-02",
    "AR-HSS-03",
    "AR-HSS-04"
  ],
  "aliases": [
    "histopathology-slide-signout-workbench",
    "histopathology-signout",
    "signed-report-version"
  ],
  "dominantTask": "Review a pathology case across specimen parts, blocks and whole-slide images, register diagnostic regions and features, complete synoptic elements, obtain consultation when required, and issue a versioned diagnostic signout",
  "regions": [
    "histopathology-signout",
    "case-and-specimen-identity",
    "specimen-part-to-block-to-slide-provenance",
    "tiled-whole-slide-stage",
    "diagnostic-region-and-feature-register",
    "feature-to-synoptic-element-and-report-claim-links",
    "diagnosis-and-comment-composer",
    "peer-review-or-consult",
    "signed-report-version"
  ],
  "relationships": [
    "histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage ↔ diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version"
  ],
  "responsive": {
    "wide": "Part/block/slide hierarchy, selected slide stage, diagnostic feature register and report/synoptic progress remain visible; selection is synchronized without making visual marks the only way to navigate",
    "intermediate": "The slide stage and selected diagnostic feature stay primary; hierarchy becomes a specimen breadcrumb plus slide rail, while synoptic/report work moves to a resumable side sheet",
    "compact": "Case identity → specimen part → block → slide → selected tile/region or textual coordinate → diagnostic feature → linked synoptic element and report claim → consultation if required → signout; the provenance path and unlinked required claim remain persistent, while the slide mosaic yields to one image stage plus a coordinate/feature ledger",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage → diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "tiled-whole-slide-stage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "case loading",
    "specimen mismatch",
    "block/slide missing or unavailable",
    "image tile loading/error",
    "region selected/unselected/unreviewed",
    "feature draft/confirmed/conflicting",
    "synoptic complete/incomplete/not-applicable",
    "consult requested/returned/overdue",
    "report unsigned/signed/amended",
    "stale slide revision",
    "permission-limited image and focus restored after region detail closes"
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
