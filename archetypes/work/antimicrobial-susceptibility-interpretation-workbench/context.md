# Antimicrobial susceptibility interpretation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `antimicrobial-susceptibility-interpretation-workbench` |
| Family | Work |
| Dominant task | Interpret antimicrobial susceptibility measurements for one isolate by validating method QC, applying the correct organism-specific breakpoint edition and expert rules, resolving exceptions, and releasing a selective report with amendment lineage |
| Search aliases | antimicrobial-susceptibility-interpretation-workbench, ast-interpretation, release-and-amendment |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `ast-interpretation` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-AST-01` | The user must interpret antimicrobial susceptibility measurements for one isolate by validating method QC, applying the correct organism-specific breakpoint edition and expert rules, resolving exceptions, and releasing a selective report with amendment lineage | Require the dominant task. |
| `AR-AST-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-AST-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-AST-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-AST-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-AST-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-AST-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `antimicrobial-susceptibility-interpretation-workbench` if and only if `AR-AST-01` through `AR-AST-04` are evidenced, every named region and relationship is required, and none of `AR-AST-90` through `AR-AST-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ ast-interpretation
├─ isolate-organism-and-method-context
├─ test-qc-and-validity
├─ organism-by-antimicrobial-measurement-matrix
├─ breakpoint-standard-and-edition-applicability
├─ measurement-to-category-derivation-cells
├─ expert-rule-and-phenotype-overrides
├─ uncertainty-and-exception-queue
├─ selective-report-preview
└─ release-and-amendment
```

Required relationship: `ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells ↔ expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `ast-interpretation` | Owns the state and decision of `ast-interpretation`; preserves its relationship with downstream `isolate-organism-and-method-context` without absorbing another region's owner. |
| `isolate-organism-and-method-context` | Owns the state and decision of `isolate-organism-and-method-context`; preserves its relationship with upstream `ast-interpretation` and downstream `test-qc-and-validity` without absorbing another region's owner. |
| `test-qc-and-validity` | Owns the state and decision of `test-qc-and-validity`; preserves its relationship with upstream `isolate-organism-and-method-context` and downstream `organism-by-antimicrobial-measurement-matrix` without absorbing another region's owner. |
| `organism-by-antimicrobial-measurement-matrix` | Owns the state and decision of `organism-by-antimicrobial-measurement-matrix`; preserves its relationship with upstream `test-qc-and-validity` and downstream `breakpoint-standard-and-edition-applicability` without absorbing another region's owner. |
| `breakpoint-standard-and-edition-applicability` | Owns the state and decision of `breakpoint-standard-and-edition-applicability`; preserves its relationship with upstream `organism-by-antimicrobial-measurement-matrix` and downstream `measurement-to-category-derivation-cells` without absorbing another region's owner. |
| `measurement-to-category-derivation-cells` | Owns the state and decision of `measurement-to-category-derivation-cells`; preserves its relationship with upstream `breakpoint-standard-and-edition-applicability` and downstream `expert-rule-and-phenotype-overrides` without absorbing another region's owner. |
| `expert-rule-and-phenotype-overrides` | Owns the state and decision of `expert-rule-and-phenotype-overrides`; preserves its relationship with upstream `measurement-to-category-derivation-cells` and downstream `uncertainty-and-exception-queue` without absorbing another region's owner. |
| `uncertainty-and-exception-queue` | Owns the state and decision of `uncertainty-and-exception-queue`; preserves its relationship with upstream `expert-rule-and-phenotype-overrides` and downstream `selective-report-preview` without absorbing another region's owner. |
| `selective-report-preview` | Owns the state and decision of `selective-report-preview`; preserves its relationship with upstream `uncertainty-and-exception-queue` and downstream `release-and-amendment` without absorbing another region's owner. |
| `release-and-amendment` | Owns the state and decision of `release-and-amendment`; preserves its relationship with upstream `selective-report-preview` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Isolate/method context, bounded antimicrobial matrix, breakpoint/rule evidence, exception queue and report preview remain visible; each derived category can be traced to measurement plus applicable rule
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `organism-by-antimicrobial-measurement-matrix` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** The matrix and selected drug interpretation remain primary; breakpoint edition and rule provenance become synchronized detail, while exceptions and preview alternate in a secondary pane
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `organism-by-antimicrobial-measurement-matrix` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Validate isolate/organism/method/QC → select one organism×drug matrix cell → review MIC/zone measurement → confirm exact breakpoint standard and edition → inspect derived category plus expert-rule override → resolve exception → decide include/suppress → release/amend; the complete matrix remains one bounded table route and the selected cell keeps measurement→edition→category lineage
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `organism-by-antimicrobial-measurement-matrix` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells → expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes organism identified/uncertain/changed, method supported/unsupported, QC pending/pass/fail, MIC or zone missing/off-scale/valid, breakpoint applicable/not applicable/version stale, category susceptible/increased-exposure/resistant/indeterminate, expert rule applied/conflicting, report included/suppressed, release pending/signed/amended and permission-limited rule detail.

## State obligations

Task-specific states: organism identified/uncertain/changed, method supported/unsupported, QC pending/pass/fail, MIC or zone missing/off-scale/valid, breakpoint applicable/not applicable/version stale, category susceptible/increased-exposure/resistant/indeterminate, expert rule applied/conflicting, report included/suppressed, release pending/signed/amended and permission-limited rule detail.

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

- Template must enter fictional MIC/zone values into an organism×drug matrix, derive each selected category from a named breakpoint edition, make a method-QC failure invalidate the matrix, demonstrate an explained expert-rule override, let keyboard users trace measurement→edition→category for one cell, and preserve the prior selective report when an amendment is issued
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the result is `diagnostic-evidence-bundle-review`, `microplate-dose-response-analysis-workbench`, `evidence-led-case-resolution-dossier`, a generic measurement-to-category report or a data table; a standards-versioned organism×drug matrix, method QC, cell-level MIC/zone→S/I/R derivation, expert-rule overrides and selective release are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-AST-90`, `AR-AST-91`, or `AR-AST-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [EUCAST current clinical breakpoint tables](https://www.eucast.org/bacteria/clinical-breakpoints-and-interpretation/clinical-breakpoint-tables/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [FDA antibacterial susceptibility test interpretive criteria](https://www.fda.gov/drugs/development-resources/antibacterial-susceptibility-test-interpretive-criteria) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [CLSI M100](https://clsi.org/shop/standards/m100/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard grid semantics. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "antimicrobial-susceptibility-interpretation-workbench",
  "matchedSituationCodes": [
    "AR-AST-01",
    "AR-AST-02",
    "AR-AST-03",
    "AR-AST-04"
  ],
  "aliases": [
    "antimicrobial-susceptibility-interpretation-workbench",
    "ast-interpretation",
    "release-and-amendment"
  ],
  "dominantTask": "Interpret antimicrobial susceptibility measurements for one isolate by validating method QC, applying the correct organism-specific breakpoint edition and expert rules, resolving exceptions, and releasing a selective report with amendment lineage",
  "regions": [
    "ast-interpretation",
    "isolate-organism-and-method-context",
    "test-qc-and-validity",
    "organism-by-antimicrobial-measurement-matrix",
    "breakpoint-standard-and-edition-applicability",
    "measurement-to-category-derivation-cells",
    "expert-rule-and-phenotype-overrides",
    "uncertainty-and-exception-queue",
    "selective-report-preview",
    "release-and-amendment"
  ],
  "relationships": [
    "ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells ↔ expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment"
  ],
  "responsive": {
    "wide": "Isolate/method context, bounded antimicrobial matrix, breakpoint/rule evidence, exception queue and report preview remain visible; each derived category can be traced to measurement plus applicable rule",
    "intermediate": "The matrix and selected drug interpretation remain primary; breakpoint edition and rule provenance become synchronized detail, while exceptions and preview alternate in a secondary pane",
    "compact": "Validate isolate/organism/method/QC → select one organism×drug matrix cell → review MIC/zone measurement → confirm exact breakpoint standard and edition → inspect derived category plus expert-rule override → resolve exception → decide include/suppress → release/amend; the complete matrix remains one bounded table route and the selected cell keeps measurement→edition→category lineage",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells → expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "organism-by-antimicrobial-measurement-matrix",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "organism identified/uncertain/changed",
    "method supported/unsupported",
    "QC pending/pass/fail",
    "MIC or zone missing/off-scale/valid",
    "breakpoint applicable/not applicable/version stale",
    "category susceptible/increased-exposure/resistant/indeterminate",
    "expert rule applied/conflicting",
    "report included/suppressed",
    "release pending/signed/amended and permission-limited rule detail"
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
