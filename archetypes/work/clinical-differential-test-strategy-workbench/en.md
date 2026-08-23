# Clinical differential test strategy workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `clinical-differential-test-strategy-workbench` |
| Family | Work |
| Dominant task | Construct and revise a diagnostic test strategy by comparing competing diagnoses, choosing discriminating tests with explicit harms and stopping rules, updating likelihoods from results, and closing with a no-miss disposition rationale |
| Search aliases | clinical-differential-test-strategy-workbench, diagnostic-strategy, disposition-rationale |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `diagnostic-strategy` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CDT-01` | The user must construct and revise a diagnostic test strategy by comparing competing diagnoses, choosing discriminating tests with explicit harms and stopping rules, updating likelihoods from results, and closing with a no-miss disposition rationale | Require the dominant task. |
| `AR-CDT-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-CDT-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-CDT-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-CDT-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-CDT-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-CDT-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `clinical-differential-test-strategy-workbench` if and only if `AR-CDT-01` through `AR-CDT-04` are evidenced, every named region and relationship is required, and none of `AR-CDT-90` through `AR-CDT-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ diagnostic-strategy
├─ problem-representation-and-urgency
├─ competing-diagnosis-prior-set
├─ discriminating-finding-ledger
├─ next-test-expected-discrimination-and-harm
├─ ordered-test-sequence-and-stopping-rules
├─ result-driven-prior-to-posterior-update-ledger
├─ posterior-rank-and-no-miss-gate
└─ disposition-rationale
```

Required relationship: `diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set ↔ discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `diagnostic-strategy` | Owns the state and decision of `diagnostic-strategy`; preserves its relationship with downstream `problem-representation-and-urgency` without absorbing another region's owner. |
| `problem-representation-and-urgency` | Owns the state and decision of `problem-representation-and-urgency`; preserves its relationship with upstream `diagnostic-strategy` and downstream `competing-diagnosis-prior-set` without absorbing another region's owner. |
| `competing-diagnosis-prior-set` | Owns the state and decision of `competing-diagnosis-prior-set`; preserves its relationship with upstream `problem-representation-and-urgency` and downstream `discriminating-finding-ledger` without absorbing another region's owner. |
| `discriminating-finding-ledger` | Owns the state and decision of `discriminating-finding-ledger`; preserves its relationship with upstream `competing-diagnosis-prior-set` and downstream `next-test-expected-discrimination-and-harm` without absorbing another region's owner. |
| `next-test-expected-discrimination-and-harm` | Owns the state and decision of `next-test-expected-discrimination-and-harm`; preserves its relationship with upstream `discriminating-finding-ledger` and downstream `ordered-test-sequence-and-stopping-rules` without absorbing another region's owner. |
| `ordered-test-sequence-and-stopping-rules` | Owns the state and decision of `ordered-test-sequence-and-stopping-rules`; preserves its relationship with upstream `next-test-expected-discrimination-and-harm` and downstream `result-driven-prior-to-posterior-update-ledger` without absorbing another region's owner. |
| `result-driven-prior-to-posterior-update-ledger` | Owns the state and decision of `result-driven-prior-to-posterior-update-ledger`; preserves its relationship with upstream `ordered-test-sequence-and-stopping-rules` and downstream `posterior-rank-and-no-miss-gate` without absorbing another region's owner. |
| `posterior-rank-and-no-miss-gate` | Owns the state and decision of `posterior-rank-and-no-miss-gate`; preserves its relationship with upstream `result-driven-prior-to-posterior-update-ledger` and downstream `disposition-rationale` without absorbing another region's owner. |
| `disposition-rationale` | Owns the state and decision of `disposition-rationale`; preserves its relationship with upstream `posterior-rank-and-no-miss-gate` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Competing diagnoses, discriminating findings, candidate-test trade-offs and the ordered test sequence remain simultaneously visible; selecting a test or result highlights every hypothesis it changes
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `discriminating-finding-ledger` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Hypothesis ranks and the active test decision retain a split; finding provenance and completed updates move to synchronized drawers, while the no-miss status remains persistent
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `discriminating-finding-ledger` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Urgency gate → explicit competing priors → one diagnosis with for/against discriminators → next-test discrimination and harm → observed result → named prior-to-posterior delta for every affected diagnosis → stopping/no-miss gate → disposition; the full hypothesis matrix becomes a bounded accessible review route, while the active update and dangerous-alternative status remain in the primary sequence
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `discriminating-finding-ledger` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set → discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes problem representation incomplete/ready, diagnosis prior unknown/estimated, discriminator supporting/opposing/absent, test available/unavailable/contraindicated, result pending/positive/negative/indeterminate/error, posterior recalculating/stale, stop rule met/not met, dangerous alternative unresolved, disposition drafted/signed/amended and permission-limited evidence.

## State obligations

Task-specific states: problem representation incomplete/ready, diagnosis prior unknown/estimated, discriminator supporting/opposing/absent, test available/unavailable/contraindicated, result pending/positive/negative/indeterminate/error, posterior recalculating/stale, stop rule met/not met, dangerous alternative unresolved, disposition drafted/signed/amended and permission-limited evidence.

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

- Template must let a user assign priors to at least three fictional diagnoses, compare one test's expected discrimination and harm, enter an indeterminate then definitive result, observe announced per-diagnosis posterior deltas, block closure while a dangerous alternative lacks a rule-out or stopping rule, and retain the same update ledger after every topology change
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology could be `evidence-led-case-resolution-dossier`, `diagnostic-evidence-bundle-review`, `causal-root-analysis-dossier` or `guided-troubleshooting-tree`; accumulating evidence, naming one cause or following fixed branches is insufficient. Multiple explicit priors, a next-test discrimination-versus-harm decision, result-driven posterior deltas, executable stopping rules and a no-miss gate are all mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CDT-90`, `AR-CDT-91`, or `AR-CDT-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [AHRQ Probabilistic Thinking in the Diagnosis Process](https://www.ahrq.gov/diagnostic-safety/resources/issue-briefs/probabilistic-thinking3.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [NICE current guidance for reviewing evidence](https://www.nice.org.uk/process/pmg20/chapter/reviewing-evidence) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "clinical-differential-test-strategy-workbench",
  "matchedSituationCodes": [
    "AR-CDT-01",
    "AR-CDT-02",
    "AR-CDT-03",
    "AR-CDT-04"
  ],
  "aliases": [
    "clinical-differential-test-strategy-workbench",
    "diagnostic-strategy",
    "disposition-rationale"
  ],
  "dominantTask": "Construct and revise a diagnostic test strategy by comparing competing diagnoses, choosing discriminating tests with explicit harms and stopping rules, updating likelihoods from results, and closing with a no-miss disposition rationale",
  "regions": [
    "diagnostic-strategy",
    "problem-representation-and-urgency",
    "competing-diagnosis-prior-set",
    "discriminating-finding-ledger",
    "next-test-expected-discrimination-and-harm",
    "ordered-test-sequence-and-stopping-rules",
    "result-driven-prior-to-posterior-update-ledger",
    "posterior-rank-and-no-miss-gate",
    "disposition-rationale"
  ],
  "relationships": [
    "diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set ↔ discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale"
  ],
  "responsive": {
    "wide": "Competing diagnoses, discriminating findings, candidate-test trade-offs and the ordered test sequence remain simultaneously visible; selecting a test or result highlights every hypothesis it changes",
    "intermediate": "Hypothesis ranks and the active test decision retain a split; finding provenance and completed updates move to synchronized drawers, while the no-miss status remains persistent",
    "compact": "Urgency gate → explicit competing priors → one diagnosis with for/against discriminators → next-test discrimination and harm → observed result → named prior-to-posterior delta for every affected diagnosis → stopping/no-miss gate → disposition; the full hypothesis matrix becomes a bounded accessible review route, while the active update and dangerous-alternative status remain in the primary sequence",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set → discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "discriminating-finding-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "problem representation incomplete/ready",
    "diagnosis prior unknown/estimated",
    "discriminator supporting/opposing/absent",
    "test available/unavailable/contraindicated",
    "result pending/positive/negative/indeterminate/error",
    "posterior recalculating/stale",
    "stop rule met/not met",
    "dangerous alternative unresolved",
    "disposition drafted/signed/amended and permission-limited evidence"
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
