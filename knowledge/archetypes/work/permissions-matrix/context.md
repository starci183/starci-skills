# Permissions matrix

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `permissions-matrix` |
| Family | Work |
| Dominant task | Review and edit policy at actor, resource, and capability intersections while distinguishing inheritance, exceptions, and effective access. |
| Search aliases | access matrix, inherited permission, capability override, effective policy |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `permission-workbench` owns the complete dominant task and its recovery boundary.
- Review and edit policy at actor, resource, and capability intersections while distinguishing inheritance, exceptions, and effective access.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PMX-01` | Review and edit policy at actor, resource, and capability intersections while distinguishing inheritance, exceptions, and effective access. | Required positive evidence. |
| `AR-PMX-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-PMX-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-PMX-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-PMX-90` | The actual task is owned by spreadsheet editing or rule building. | Reject. |
| `AR-PMX-91` | Reject generic spreadsheets, flat role forms, condition-outcome rule sets, and record tables without effective-access semantics. | Reject. |
| `AR-PMX-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `permissions-matrix` if and only if `AR-PMX-01` through `AR-PMX-04` are evidenced, every required region and relationship is present, and none of `AR-PMX-90` through `AR-PMX-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
permission-workbench
├─ scope-and-actor-selector
├─ policy-matrix
│  └─ stated-and-effective-intersections
├─ inheritance-legend
├─ exception-summary
├─ effective-access-preview
└─ review-and-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `permission-workbench` | Bounds one policy scope and preserves draft exceptions until explicit review. |
| `scope-and-actor-selector` | Selects actor/group and resource scope that all intersections inherit. |
| `policy-matrix` | Owns actor-resource-capability intersections and axis identity. |
| `stated-and-effective-intersections` | Expose direct value, inherited source, exception, and effective outcome at each editable intersection. |
| `inheritance-legend` | Explains non-color distinctions shared by all matrix cells. |
| `exception-summary` | Aggregates deviations from inheritance and links back to exact intersections. |
| `effective-access-preview` | Answers what the selected actor can actually do after inheritance and exceptions. |
| `review-and-commit` | Names affected scope, validates draft, commits once, and owns conflict recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep frozen axis identities and the matrix simultaneous with legend, exception summary, and effective preview; review names the exact affected scope.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** `policy-matrix` owns bounded horizontal overflow only while axis comparison remains usable; compact capability lists remove page overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Focus one resource or capability group while actor context and unsaved/effective summary remain visible; move supporting inheritance evidence to a named disclosure.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** `policy-matrix` owns bounded horizontal overflow only while axis comparison remains usable; compact capability lists remove page overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Choose actor or resource first, edit a capability list that states inherited source and override, then review every exception in a summary stage before commit.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** `policy-matrix` owns bounded horizontal overflow only while axis comparison remains usable; compact capability lists remove page overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `permission-workbench → scope-and-actor-selector → policy-matrix → stated-and-effective-intersections → inheritance-legend → exception-summary → effective-access-preview → review-and-commit`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes policy loading, inherited/direct/denied/mixed outcomes, no edit permission, unsaved override, validation, bulk change, commit pending/success/partial failure, and external policy conflict.

## State obligations

Task-specific states: policy loading, inherited/direct/denied/mixed outcomes, no edit permission, unsaved override, validation, bulk change, commit pending/success/partial failure, and external policy conflict.

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

- The user must reason about stated and effective access at actor-resource-capability intersections with inheritance or exceptions.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject generic spreadsheets, flat role forms, condition-outcome rule sets, and record tables without effective-access semantics.
- Reject when spreadsheet editing or rule building owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-PMX-90`, `AR-PMX-91`, or `AR-PMX-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [GitHub repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization) | Roles map people and teams to resource capabilities, with scope and consequence. | It does not prove this matrix geometry or a product permission model. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Composite two-axis widgets require managed directional keyboard navigation and explicit edit mode. | It does not require ARIA grid when native table semantics are sufficient. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `permissions-matrix`. |
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
  "archetypeId": "permissions-matrix",
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
