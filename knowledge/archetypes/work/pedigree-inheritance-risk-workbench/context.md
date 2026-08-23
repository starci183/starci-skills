# Pedigree inheritance risk workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `pedigree-inheritance-risk-workbench` |
| Family | Work |
| Dominant task | Build and evaluate a family pedigree by recording uncertain relationships, phenotype onset and genotype evidence, testing candidate inheritance models through segregation, and producing recurrence-risk scenarios plus a family testing/counseling plan |
| Search aliases | pedigree-inheritance-risk-workbench, inheritance-risk, family-testing-and-counseling-plan |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `inheritance-risk` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PIR-01` | The user must build and evaluate a family pedigree by recording uncertain relationships, phenotype onset and genotype evidence, testing candidate inheritance models through segregation, and producing recurrence-risk scenarios plus a family testing/counseling plan | Require the dominant task. |
| `AR-PIR-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-PIR-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-PIR-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-PIR-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-PIR-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-PIR-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `pedigree-inheritance-risk-workbench` if and only if `AR-PIR-01` through `AR-PIR-04` are evidenced, every named region and relationship is required, and none of `AR-PIR-90` through `AR-PIR-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ inheritance-risk
├─ proband-indication-and-consent
├─ pedigree-kinship-graph
├─ phenotype-onset-and-genotype-overlay
├─ relationship-certainty-and-consanguinity
├─ candidate-inheritance-models
├─ segregation-consistency
├─ recurrence-risk-scenarios
└─ family-testing-and-counseling-plan
```

Required relationship: `inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph ↔ phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `inheritance-risk` | Owns the state and decision of `inheritance-risk`; preserves its relationship with downstream `proband-indication-and-consent` without absorbing another region's owner. |
| `proband-indication-and-consent` | Owns the state and decision of `proband-indication-and-consent`; preserves its relationship with upstream `inheritance-risk` and downstream `pedigree-kinship-graph` without absorbing another region's owner. |
| `pedigree-kinship-graph` | Owns the state and decision of `pedigree-kinship-graph`; preserves its relationship with upstream `proband-indication-and-consent` and downstream `phenotype-onset-and-genotype-overlay` without absorbing another region's owner. |
| `phenotype-onset-and-genotype-overlay` | Owns the state and decision of `phenotype-onset-and-genotype-overlay`; preserves its relationship with upstream `pedigree-kinship-graph` and downstream `relationship-certainty-and-consanguinity` without absorbing another region's owner. |
| `relationship-certainty-and-consanguinity` | Owns the state and decision of `relationship-certainty-and-consanguinity`; preserves its relationship with upstream `phenotype-onset-and-genotype-overlay` and downstream `candidate-inheritance-models` without absorbing another region's owner. |
| `candidate-inheritance-models` | Owns the state and decision of `candidate-inheritance-models`; preserves its relationship with upstream `relationship-certainty-and-consanguinity` and downstream `segregation-consistency` without absorbing another region's owner. |
| `segregation-consistency` | Owns the state and decision of `segregation-consistency`; preserves its relationship with upstream `candidate-inheritance-models` and downstream `recurrence-risk-scenarios` without absorbing another region's owner. |
| `recurrence-risk-scenarios` | Owns the state and decision of `recurrence-risk-scenarios`; preserves its relationship with upstream `segregation-consistency` and downstream `family-testing-and-counseling-plan` without absorbing another region's owner. |
| `family-testing-and-counseling-plan` | Owns the state and decision of `family-testing-and-counseling-plan`; preserves its relationship with upstream `recurrence-risk-scenarios` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Pedigree graph, selected-relative evidence, inheritance-model comparison, segregation exceptions and recurrence scenarios remain linked; privacy and consent scope stay visible
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `inheritance-risk` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Pedigree and active inheritance model remain primary; relative detail becomes a synchronized drawer and risk scenarios move to a resumable review pane
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `inheritance-risk` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Proband/consent → generation and relationship list → selected-relative phenotype/genotype editor → choose inheritance model → inspect segregation-consistent and inconsistent relatives → review recurrence scenario → plan testing/counseling; a relationship path/list replaces a miniature graph
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `inheritance-risk` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph → phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes consent in/out/limited, relationship confirmed/uncertain/conflicting, relative alive/deceased/unknown, phenotype absent/present/onset unknown, genotype positive/negative/not tested/unavailable, model candidate/rejected/indeterminate, segregation consistent/exception, risk computable/range/unknown, privacy-redacted branch, plan draft/shared and stale after family evidence changes.

## State obligations

Task-specific states: consent in/out/limited, relationship confirmed/uncertain/conflicting, relative alive/deceased/unknown, phenotype absent/present/onset unknown, genotype positive/negative/not tested/unavailable, model candidate/rejected/indeterminate, segregation consistent/exception, risk computable/range/unknown, privacy-redacted branch, plan draft/shared and stale after family evidence changes.

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

- Template must add a fictional relative through keyboard-capable relational controls, mark one relationship uncertain, overlay phenotype and genotype, reject one inheritance model from a visible segregation conflict, produce a bounded recurrence-risk scenario, and redact a non-consented branch without breaking relationship comprehension
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology is `knowledge-graph-explorer`, `phylogeny-alignment-comparison-explorer`, `entity-resolution-cluster-adjudicator` or a generic family record; generational kinship, inheritance-model hypotheses, segregation checks, consent/privacy boundaries and recurrence-risk scenarios are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PIR-90`, `AR-PIR-91`, or `AR-PIR-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [CDC genetic counseling and testing](https://www.cdc.gov/genomics-and-health/counseling-testing/genetic-counseling.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [HL7 FHIR FamilyMemberHistory](https://hl7.org/fhir/familymemberhistory.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "pedigree-inheritance-risk-workbench",
  "matchedSituationCodes": [
    "AR-PIR-01",
    "AR-PIR-02",
    "AR-PIR-03",
    "AR-PIR-04"
  ],
  "aliases": [
    "pedigree-inheritance-risk-workbench",
    "inheritance-risk",
    "family-testing-and-counseling-plan"
  ],
  "dominantTask": "Build and evaluate a family pedigree by recording uncertain relationships, phenotype onset and genotype evidence, testing candidate inheritance models through segregation, and producing recurrence-risk scenarios plus a family testing/counseling plan",
  "regions": [
    "inheritance-risk",
    "proband-indication-and-consent",
    "pedigree-kinship-graph",
    "phenotype-onset-and-genotype-overlay",
    "relationship-certainty-and-consanguinity",
    "candidate-inheritance-models",
    "segregation-consistency",
    "recurrence-risk-scenarios",
    "family-testing-and-counseling-plan"
  ],
  "relationships": [
    "inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph ↔ phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan"
  ],
  "responsive": {
    "wide": "Pedigree graph, selected-relative evidence, inheritance-model comparison, segregation exceptions and recurrence scenarios remain linked; privacy and consent scope stay visible",
    "intermediate": "Pedigree and active inheritance model remain primary; relative detail becomes a synchronized drawer and risk scenarios move to a resumable review pane",
    "compact": "Proband/consent → generation and relationship list → selected-relative phenotype/genotype editor → choose inheritance model → inspect segregation-consistent and inconsistent relatives → review recurrence scenario → plan testing/counseling; a relationship path/list replaces a miniature graph",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph → phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "inheritance-risk",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "consent in/out/limited",
    "relationship confirmed/uncertain/conflicting",
    "relative alive/deceased/unknown",
    "phenotype absent/present/onset unknown",
    "genotype positive/negative/not tested/unavailable",
    "model candidate/rejected/indeterminate",
    "segregation consistent/exception",
    "risk computable/range/unknown",
    "privacy-redacted branch",
    "plan draft/shared and stale after family evidence changes"
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
