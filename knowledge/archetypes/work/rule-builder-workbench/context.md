# Rule builder workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rule-builder-workbench` |
| Family | Work |
| Dominant task | Define ordered conditional rules and outcomes, understand precedence and coverage, test representative inputs, and publish an unambiguous rule set. |
| Search aliases | decision rules, condition outcome, precedence coverage, rule test |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `rule-workbench` owns the complete dominant task and its recovery boundary.
- Define ordered conditional rules and outcomes, understand precedence and coverage, test representative inputs, and publish an unambiguous rule set.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-RBW-01` | Define ordered conditional rules and outcomes, understand precedence and coverage, test representative inputs, and publish an unambiguous rule set. | Required positive evidence. |
| `AR-RBW-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-RBW-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-RBW-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-RBW-90` | The actual task is owned by query builders or workflow automation. | Reject. |
| `AR-RBW-91` | Reject effect-free data queries, permission inheritance matrices, executable step graphs, and local single-field validation. | Reject. |
| `AR-RBW-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `rule-builder-workbench` if and only if `AR-RBW-01` through `AR-RBW-04` are evidenced, every required region and relationship is present, and none of `AR-RBW-90` through `AR-RBW-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
rule-workbench
├─ rule-set-scope
├─ ordered-rules
│  ├─ condition-groups
│  └─ outcomes
├─ precedence-and-coverage-summary
├─ test-cases-and-result
└─ review-and-publish
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `rule-workbench` | Owns one versioned rule set from draft through tested publication. |
| `rule-set-scope` | Defines inputs, match semantics, dependencies, and publication target. |
| `ordered-rules` | Own rule identity, priority, reorder, draft/published state, and selection. |
| `condition-groups` | Own nested predicates, completeness, overlap inputs, and per-condition errors. |
| `outcomes` | Own effects produced when the active rule matches. |
| `precedence-and-coverage-summary` | Explains overlap, unreachable rules, gaps, and effective order outside color. |
| `test-cases-and-result` | Runs representative inputs and records matched rule, outcome, and trace. |
| `review-and-publish` | Blocks publication until validation and test evidence are reviewable; owns conflict recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep rule order, active editor, and test/coverage pane simultaneous; keep effective precedence visible while editing conditions and outcomes.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Ordered rules and test traces scroll vertically within their stage; no page-level horizontal overflow is required.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Collapse the rule list; keep active editor and test evidence; make coverage/precedence a named supporting pane.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Ordered rules and test traces scroll vertically within their stage; no page-level horizontal overflow is required.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Sequence select rule, edit conditions/outcome, run test, then review set; persist priority and unsaved/test state across stages.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Ordered rules and test traces scroll vertically within their stage; no page-level horizontal overflow is required.

### Reflow

- DOM order, reading order, and meaningful focus order are `rule-workbench → rule-set-scope → ordered-rules → condition-groups → outcomes → precedence-and-coverage-summary → test-cases-and-result → review-and-publish`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes rules loading/empty, add/duplicate/reorder, invalid/incomplete condition, unreachable/overlapping rule, test pending/pass/fail, draft/published, stale dependency, publish conflict, and permission.

## State obligations

Task-specific states: rules loading/empty, add/duplicate/reorder, invalid/incomplete condition, unreachable/overlapping rule, test pending/pass/fail, draft/published, stale dependency, publish conflict, and permission.

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

- Ordered conditions produce outcomes, precedence changes effective behavior, coverage can be incomplete, and tests gate publication.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject effect-free data queries, permission inheritance matrices, executable step graphs, and local single-field validation.
- Reject when query builders or workflow automation owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-RBW-90`, `AR-RBW-91`, or `AR-RBW-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Salesforce expression operators](https://help.salesforce.com/s/articleView?id=platform.customize_functions.htm&type=5) | Condition expressions combine fields and operators into evaluable logic. | It does not define product outcomes, precedence policy, or interface geometry. |
| [IBM Carbon filtering pattern](https://carbondesignsystem.com/patterns/filtering/) | Filters expose active criteria and result changes in the same dataset context. | It does not choose product filters or query semantics. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `rule-builder-workbench`. |
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
  "archetypeId": "rule-builder-workbench",
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
