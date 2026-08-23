# Radiotherapy contour dose plan review

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `radiotherapy-contour-dose-plan-review` |
| Family | Work |
| Dominant task | Review and approve a radiotherapy plan by connecting target and organ-at-risk contours to spatial dose, beam/fraction prescription, dose-volume evidence, coverage constraints, hotspot/coldspot findings and plan-version comparison |
| Search aliases | radiotherapy-contour-dose-plan-review, radiotherapy-review, plan-comparison-and-approval |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `radiotherapy-review` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-RDP-01` | The user must review and approve a radiotherapy plan by connecting target and organ-at-risk contours to spatial dose, beam/fraction prescription, dose-volume evidence, coverage constraints, hotspot/coldspot findings and plan-version comparison | Require the dominant task. |
| `AR-RDP-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-RDP-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-RDP-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-RDP-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-RDP-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-RDP-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `radiotherapy-contour-dose-plan-review` if and only if `AR-RDP-01` through `AR-RDP-04` are evidenced, every named region and relationship is required, and none of `AR-RDP-90` through `AR-RDP-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ radiotherapy-review
├─ planning-study-frame-and-prescription
├─ target-and-organ-at-risk-contour-hierarchy
├─ synchronized-anatomy-and-dose-stage
├─ beam-fraction-and-plan-version
├─ dose-volume-histogram-set
├─ constraint-table
├─ hotspot-coldspot-and-coverage-queue
└─ plan-comparison-and-approval
```

Required relationship: `radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy ↔ synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set ↔ constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `radiotherapy-review` | Owns the state and decision of `radiotherapy-review`; preserves its relationship with downstream `planning-study-frame-and-prescription` without absorbing another region's owner. |
| `planning-study-frame-and-prescription` | Owns the state and decision of `planning-study-frame-and-prescription`; preserves its relationship with upstream `radiotherapy-review` and downstream `target-and-organ-at-risk-contour-hierarchy` without absorbing another region's owner. |
| `target-and-organ-at-risk-contour-hierarchy` | Owns the state and decision of `target-and-organ-at-risk-contour-hierarchy`; preserves its relationship with upstream `planning-study-frame-and-prescription` and downstream `synchronized-anatomy-and-dose-stage` without absorbing another region's owner. |
| `synchronized-anatomy-and-dose-stage` | Owns the state and decision of `synchronized-anatomy-and-dose-stage`; preserves its relationship with upstream `target-and-organ-at-risk-contour-hierarchy` and downstream `beam-fraction-and-plan-version` without absorbing another region's owner. |
| `beam-fraction-and-plan-version` | Owns the state and decision of `beam-fraction-and-plan-version`; preserves its relationship with upstream `synchronized-anatomy-and-dose-stage` and downstream `dose-volume-histogram-set` without absorbing another region's owner. |
| `dose-volume-histogram-set` | Owns the state and decision of `dose-volume-histogram-set`; preserves its relationship with upstream `beam-fraction-and-plan-version` and downstream `constraint-table` without absorbing another region's owner. |
| `constraint-table` | Owns the state and decision of `constraint-table`; preserves its relationship with upstream `dose-volume-histogram-set` and downstream `hotspot-coldspot-and-coverage-queue` without absorbing another region's owner. |
| `hotspot-coldspot-and-coverage-queue` | Owns the state and decision of `hotspot-coldspot-and-coverage-queue`; preserves its relationship with upstream `constraint-table` and downstream `plan-comparison-and-approval` without absorbing another region's owner. |
| `plan-comparison-and-approval` | Owns the state and decision of `plan-comparison-and-approval`; preserves its relationship with upstream `hotspot-coldspot-and-coverage-queue` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Contour hierarchy, synchronized anatomy/dose stage, DVH set, constraint table, issue queue and plan-version comparison remain linked around a fixed prescription
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `synchronized-anatomy-and-dose-stage` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Anatomy/dose plus the selected structure's DVH/constraints remain primary; hierarchy becomes a searchable structure rail and plan comparison/issues alternate in a secondary pane
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `synchronized-anatomy-and-dose-stage` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify frame/prescription → choose one target or organ → inspect contour with textual slice/coordinate alternative → review that structure's DVH and constraint → resolve hotspot/coldspot → compare plan version → approval gate; no miniaturized multi-panel planning desktop
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `synchronized-anatomy-and-dose-stage` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy → synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set → constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes study loading/mismatch, prescription incomplete/amended, contour present/missing/changed/unapproved, dose loading/stale, beam/fraction mismatch, constraint pass/fail/not-applicable, hotspot or coldspot open/accepted/resolved, DVH unavailable/recomputed, plan current/superseded/comparison pending, approval blocked/approved/rejected and focus restored after spatial issue detail.

## State obligations

Task-specific states: study loading/mismatch, prescription incomplete/amended, contour present/missing/changed/unapproved, dose loading/stale, beam/fraction mismatch, constraint pass/fail/not-applicable, hotspot or coldspot open/accepted/resolved, DVH unavailable/recomputed, plan current/superseded/comparison pending, approval blocked/approved/rejected and focus restored after spatial issue detail.

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

- Template must bind a fictional contour to its dose overlay, DVH and named constraint, provide keyboard/list alternatives to spatial selection, show a failing organ-at-risk constraint and a target coldspot, compare a revised plan, announce recomputation, and block approval until every mandatory issue has a disposition
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology can be `orthogonal-volume-slice-inspector`, `scenario-sensitivity-modeler`, `spatial-change-detection-workbench` or `diagnostic-evidence-bundle-review`; linked target/OAR contours, spatial dose, DVH constraints, coverage issues and versioned clinical plan approval are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-RDP-90`, `AR-RDP-91`, or `AR-RDP-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [DICOM current RT Dose IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.18.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [IAEA transition to 3-D conformal and intensity-modulated radiotherapy](https://www.iaea.org/publications/8523/transition-from-2-d-radiotherapy-to-3-d-conformal-and-intensity-modulated-radiotherapy) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "radiotherapy-contour-dose-plan-review",
  "matchedSituationCodes": [
    "AR-RDP-01",
    "AR-RDP-02",
    "AR-RDP-03",
    "AR-RDP-04"
  ],
  "aliases": [
    "radiotherapy-contour-dose-plan-review",
    "radiotherapy-review",
    "plan-comparison-and-approval"
  ],
  "dominantTask": "Review and approve a radiotherapy plan by connecting target and organ-at-risk contours to spatial dose, beam/fraction prescription, dose-volume evidence, coverage constraints, hotspot/coldspot findings and plan-version comparison",
  "regions": [
    "radiotherapy-review",
    "planning-study-frame-and-prescription",
    "target-and-organ-at-risk-contour-hierarchy",
    "synchronized-anatomy-and-dose-stage",
    "beam-fraction-and-plan-version",
    "dose-volume-histogram-set",
    "constraint-table",
    "hotspot-coldspot-and-coverage-queue",
    "plan-comparison-and-approval"
  ],
  "relationships": [
    "radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy ↔ synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set ↔ constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval"
  ],
  "responsive": {
    "wide": "Contour hierarchy, synchronized anatomy/dose stage, DVH set, constraint table, issue queue and plan-version comparison remain linked around a fixed prescription",
    "intermediate": "Anatomy/dose plus the selected structure's DVH/constraints remain primary; hierarchy becomes a searchable structure rail and plan comparison/issues alternate in a secondary pane",
    "compact": "Verify frame/prescription → choose one target or organ → inspect contour with textual slice/coordinate alternative → review that structure's DVH and constraint → resolve hotspot/coldspot → compare plan version → approval gate; no miniaturized multi-panel planning desktop",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy → synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set → constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "synchronized-anatomy-and-dose-stage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "study loading/mismatch",
    "prescription incomplete/amended",
    "contour present/missing/changed/unapproved",
    "dose loading/stale",
    "beam/fraction mismatch",
    "constraint pass/fail/not-applicable",
    "hotspot or coldspot open/accepted/resolved",
    "DVH unavailable/recomputed",
    "plan current/superseded/comparison pending",
    "approval blocked/approved/rejected and focus restored after spatial issue detail"
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
