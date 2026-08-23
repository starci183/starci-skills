# Pivot drilldown analytics

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `pivot-drilldown-analytics` |
| Family | Work |
| Dominant task | Ask questions over aggregate measures, change dimensions and filters, coordinate selections across views, and drill from a signal to supporting records. |
| Search aliases | pivot analysis, cross-filter chart, segment drill, analytical records |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `analytics-workbench` owns the complete dominant task and its recovery boundary.
- Ask questions over aggregate measures, change dimensions and filters, coordinate selections across views, and drill from a signal to supporting records.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PDA-01` | Ask questions over aggregate measures, change dimensions and filters, coordinate selections across views, and drill from a signal to supporting records. | Required positive evidence. |
| `AR-PDA-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-PDA-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-PDA-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-PDA-90` | The actual task is owned by overview dashboards or batch tables. | Reject. |
| `AR-PDA-91` | Reject passive KPI dashboards, fixed reports, raw table operations, and chart collections without coordinated selection and a drill path. | Reject. |
| `AR-PDA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `pivot-drilldown-analytics` if and only if `AR-PDA-01` through `AR-PDA-04` are evidenced, every required region and relationship is present, and none of `AR-PDA-90` through `AR-PDA-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
analytics-workbench
├─ metric-and-scope-context
├─ shared-filter-and-pivot-controls
├─ primary-visual-analysis
├─ coordinated-secondary-views
├─ selected-segment-detail
└─ drilldown-records
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `analytics-workbench` | Owns one analytical question and the query state shared by every view. |
| `metric-and-scope-context` | Names measure, population, period, freshness, and redaction scope. |
| `shared-filter-and-pivot-controls` | Change dimensions and filters once for all coordinated views. |
| `primary-visual-analysis` | Owns the dominant aggregate signal and selection entry point. |
| `coordinated-secondary-views` | Explain the same selected segment through another measure or partition. |
| `selected-segment-detail` | Names selected mark, value, filter effect, and drill path outside color. |
| `drilldown-records` | Owns record evidence for the current aggregate without resetting query state. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Give the primary analysis visual precedence; show only secondary views and records that explain the same selection, never a peer grid of unrelated metric cards.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Analytical plots reflow; only `drilldown-records` may own bounded horizontal overflow for relational evidence.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Keep the primary view and one support view; place other views in named tabs or disclosures while filter, pivot, selection, and drill path remain persistent.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Analytical plots reflow; only `drilldown-records` may own bounded horizontal overflow for relational evidence.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Show one analytical view per stage; keep pivot/filter summary and selected segment visible; open drill records as a subsequent stage or sheet rather than shrinking the chart.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Analytical plots reflow; only `drilldown-records` may own bounded horizontal overflow for relational evidence.

### Reflow

- DOM order, reading order, and meaningful focus order are `analytics-workbench → metric-and-scope-context → shared-filter-and-pivot-controls → primary-visual-analysis → coordinated-secondary-views → selected-segment-detail → drilldown-records`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes initial/loading, no data, partial series failure, pivot editing, filter applied, selected mark, drill loading, stale snapshot, permission-redacted records, export pending, and announced result changes.

## State obligations

Task-specific states: initial/loading, no data, partial series failure, pivot editing, filter applied, selected mark, drill loading, stale snapshot, permission-redacted records, export pending, and announced result changes.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, selection or cursor, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, filter no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context needed for understanding. |
| Pending | Prevent duplicates, retain context, expose Cancel when safe, and announce progress without stealing focus. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains required simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage while retaining actions, state, and recovery. |

## Boundaries

### Accept

- Aggregate views share one query and selected segment, and drilldown records provide evidence for that aggregate.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject passive KPI dashboards, fixed reports, raw table operations, and chart collections without coordinated selection and a drill path.
- Reject when overview dashboards or batch tables owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PDA-90`, `AR-PDA-91`, or `AR-PDA-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Tableau drill-down and hierarchies](https://help.tableau.com/current/pro/desktop/en-us/qs_hierarchies.htm) | Hierarchies support moving between aggregate levels while preserving analytical context. | It does not make Tableau labels, visuals, or hierarchy fields product truth. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information and function survive narrow width without page-level two-axis scrolling. | It does not decide which intrinsic work region owns bounded overflow. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `pivot-drilldown-analytics`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "pivot-drilldown-analytics",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
