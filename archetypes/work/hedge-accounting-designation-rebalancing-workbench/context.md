# Hedge accounting designation rebalancing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `hedge-accounting-designation-rebalancing-workbench` |
| Family | Work |
| Dominant task | Designate one hedge-accounting relationship from a specific hedged item and hedging instrument, test whether their economic relationship and hedge ratio remain qualifying, and account for rebalancing or discontinuation without rewriting prior periods. |
| Search aliases | hedge designation, effectiveness test, hedge ratio rebalancing |
| Authority | Product-neutral page-topology authority; it does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `hedge-accounting` owns the complete dominant task and recovery boundary.
- The hedged-item profile and hedging-instrument profile are peer evidence owners; the documented ratio joins them, effectiveness and diagnostics are synchronized peers, and accounting attribution follows the resulting designation state.
- Every required region retains its named owner.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft input, pending work, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-HDR-01` | Designate one hedge-accounting relationship from a specific hedged item and hedging instrument, test whether their economic relationship and hedge ratio remain qualifying, and account for rebalancing or discontinuation without rewriting prior periods. | Required positive evidence. |
| `AR-HDR-02` | Every required region and relationship is necessary for completion. | Require the complete graph. |
| `AR-HDR-03` | The named wide, intermediate, and compact transformations preserve the same work state. | Require responsive parity. |
| `AR-HDR-04` | Failure, pending, conflict, permission, or recovery can occur after state exists. | Retain state and focus meaning. |
| `AR-HDR-90` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |
| `AR-HDR-91` | Reject scenario-sensitivity-modeler, reconciliation-diff-workbench, portfolio-health-matrix, or generic derivative valuation when the documented objective, designation ratio, qualifying tests, accounting attribution, and rebalance-versus-discontinue lineage are absent. | Reject. |
| `AR-HDR-92` | The candidate differs only by noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `hedge-accounting-designation-rebalancing-workbench` if and only if `AR-HDR-01` through `04` are evidenced, all required regions and relationships are present, and none of `AR-HDR-90` through `92` is present. Return `needs-evidence` when dominant task, owner relationship, overflow owner, or completion consequence is unproved. Return `reject` when a rejection code is present.

## Region graph

```text
hedge-accounting
  ├─ reporting-entity-period-standard-and-policy-version
  ├─ hedged-item-risk-component-profile
  ├─ hedging-instrument-terms-and-exposure-profile
  ├─ documented-risk-management-objective
  ├─ designation-ratio-and-qualifying-criteria
  ├─ prospective-and-period-effectiveness-tests
  ├─ source-of-ineffectiveness-diagnostics
  ├─ oci-pnl-and-basis-adjustment-attribution
  ├─ rebalance-or-discontinue-decision
  └─ posted-accounting-and-designation-lineage
```

The hedged-item profile and hedging-instrument profile are peer evidence owners; the documented ratio joins them, effectiveness and diagnostics are synchronized peers, and accounting attribution follows the resulting designation state.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `hedge-accounting` | Owns the complete designation, effectiveness, accounting, and lineage task. |
| `reporting-entity-period-standard-and-policy-version` | Binds every decision to one reporting scope and policy version. |
| `hedged-item-risk-component-profile` | Owns item eligibility, risk component evidence, and designated exposure independently from the instrument. |
| `hedging-instrument-terms-and-exposure-profile` | Owns instrument terms, lifecycle, and exposure independently from the item. |
| `documented-risk-management-objective` | Connects the two profiles through one documented objective without merging their evidence. |
| `designation-ratio-and-qualifying-criteria` | Owns the documented ratio and all qualification gates. |
| `prospective-and-period-effectiveness-tests` | Owns repeatable effectiveness evidence for the designated ratio. |
| `source-of-ineffectiveness-diagnostics` | Explains failed or drifting effectiveness beside the test that produced it. |
| `oci-pnl-and-basis-adjustment-attribution` | Receives accounting attribution only from the qualifying designation state. |
| `rebalance-or-discontinue-decision` | Chooses continuation, prospective rebalancing, or discontinuation without retrospective mutation. |
| `posted-accounting-and-designation-lineage` | Preserves posted results and prior versions as immutable lineage. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison no longer leaves enough measure for profiles, evidence, controls, and unobscured focus.
- **Topology response:** Hedged-item and instrument profiles, ratio, effectiveness evidence, diagnostics, attribution, and decision remain visible together.
- **Navigation replacement:** None while direct region access remains operable.
- **Sticky boundary:** Only current scope or the primary receipt may persist after reserving space.
- **Overflow owner:** One intrinsically tabular or graph region may own bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without compressing the dominant relationship.
- **Topology response:** The ratio, failed criterion, and effectiveness result remain primary; profile detail, policy evidence, and prior versions move to an anchored contextual drawer.
- **Navigation replacement:** A labeled contextual drawer opens the exact supporting region and preserves selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary receipt may persist; short height returns it to normal flow.
- **Overflow owner:** The same bounded evidence region remains the sole overflow owner.

### Compact

- **Failure trigger:** Peer regions can no longer remain simultaneously readable and operable.
- **Topology response:** Policy → item and risk component → instrument → ratio → criteria → effectiveness → attribution → continue, rebalance, or discontinue; peer profiles become an alternating comparison route with a persistent relationship receipt.
- **Navigation replacement:** A labeled stage navigator exposes one primary pane at a time and returns focus to the entered stage heading.
- **Sticky boundary:** The relationship receipt may persist only with reserved space and yields at short height.
- **Overflow owner:** A numeric table becomes a labeled route or remains one bounded navigator; the page never scrolls horizontally.

### Reflow

- DOM order, reading order, and meaningful focus order follow `hedge-accounting → reporting-entity-period-standard-and-policy-version → hedged-item-risk-component-profile → hedging-instrument-terms-and-exposure-profile → documented-risk-management-objective → designation-ratio-and-qualifying-criteria → prospective-and-period-effectiveness-tests → source-of-ineffectiveness-diagnostics → oci-pnl-and-basis-adjustment-attribution → rebalance-or-discontinue-decision → posted-accounting-and-designation-lineage`.
- CSS never reorders semantic content.
- Long labels, translation, enlarged text, and zoom wrap without losing actions or state.
- A modal drawer focuses its heading, contains modal focus, supports Escape and Cancel, and returns to the exact trigger.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag or gesture has an add, remove, or ordered-list alternative.
- A topology change retains selection, completed steps, pending guards, errors, and recovery.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Multi-error validation retains input and moves focus to a summary.
- Task parity includes item eligible/ineligible/partially designated; instrument active/matured/novated; risk component identifiable/not-qualifying; designation draft/documented/rejected; ratio aligned/imbalanced/rebalanced; test pending/pass/fail; ineffectiveness unmeasured/measured/posted; accounting OCI/P&L/basis-adjusted; relationship continuing/discontinued; prior period locked/corrected-by-new-version.

## State obligations

Task-specific states: item eligible/ineligible/partially designated; instrument active/matured/novated; risk component identifiable/not-qualifying; designation draft/documented/rejected; ratio aligned/imbalanced/rebalanced; test pending/pass/fail; ineffectiveness unmeasured/measured/posted; accounting OCI/P&L/basis-adjusted; relationship continuing/discontinued; prior period locked/corrected-by-new-version.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, evidence state, and valid actions in text. |
| Empty / not-applicable | Distinguish true empty, no-match, excluded, and non-applicable states with a next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction; read-only differs from disabled and retains context. |
| Pending | Prevent duplicate action, retain context, allow safe cancellation, and announce progress. |
| Success | Confirm the exact changed scope and update dependent receipts. |
| Stale / conflict | Compare versions, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus; modal close returns to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes lower-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Pair separately evidenced item and instrument profiles, fail and correct a qualifying criterion, test effectiveness, attribute ineffectiveness, rebalance prospectively, and preserve discontinuation lineage.
- Accept a variation only when dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject scenario-sensitivity-modeler, reconciliation-diff-workbench, portfolio-health-matrix, or generic derivative valuation when the documented objective, designation ratio, qualifying tests, accounting attribution, and rebalance-versus-discontinue lineage are absent.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-HDR-90`, `91`, or `92`. Return `needs-evidence` when business truth does not prove dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

Research is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment. Binding product claims still route through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [IFRS 9 Financial Instruments](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/) | Hedge-accounting policy, instrument recognition, and version context. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [FASB ASU 2025-09 Hedge Accounting Improvements](https://storage.fasb.org/ASU%202025-09.pdf) | Current U.S. hedge-accounting improvement context and ongoing risk assessment. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard order across paired profiles and stage changes. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [Microsoft Fluent layout](https://fluent2.microsoft.design/layout) | Advisory evidence for adaptive dense-work topology. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `hedge-accounting-designation-rebalancing-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry and fit thresholds left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"hedge-accounting-designation-rebalancing-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

