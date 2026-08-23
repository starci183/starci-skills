# Learning evidence portfolio composer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `learning-evidence-portfolio-composer` |
| Family | Work |
| Dominant task | Compose a learning portfolio by mapping artifacts to multiple outcomes, adding reflection and provenance, identifying evidence gaps, and previewing the audience-specific presentation |
| Search aliases | evidence portfolio, outcome mapping, audience preview |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `portfolio-composer` owns the complete dominant task and recovery boundary.
- Compose a learning portfolio by mapping artifacts to multiple outcomes, adding reflection and provenance, identifying evidence gaps, and previewing the audience-specific presentation
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-LEP-01` | Compose a learning portfolio by mapping artifacts to multiple outcomes, adding reflection and provenance, identifying evidence gaps, and previewing the audience-specific presentation | Required positive evidence. |
| `AR-LEP-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `AR-LEP-03` | Work state must survive all three named topology responses. | Require responsive parity. |
| `AR-LEP-04` | Pending, error, permission, stale, or conflict can occur after work state exists. | Require recovery without lost input or focus meaning. |
| `AR-LEP-90` | The dominant task belongs to an adjacent archetype named in the hard rejection. | Reject. |
| `AR-LEP-91` | Reject cho dual-list transfer, generic portfolio gallery, cross-framework mapper or document builder; evidence-bearing many-to-many artifact/outcome links plus reflection and audience preview are mandatory | Reject. |
| `AR-LEP-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `learning-evidence-portfolio-composer` if and only if `AR-LEP-01`–`04` are evidenced, every required region and relationship is present, and none of `AR-LEP-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
portfolio-composer
├─ learner-goals-and-audience
├─ artifact-library
├─ outcome-framework (peer synchronization)
├─ artifact-outcome-evidence-map
├─ selected-artifact-reflection-and-provenance
├─ coverage-gap-summary
└─ audience-preview-and-publish
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `portfolio-composer` | Owns the dominant task, complete state, and recovery boundary for learning-evidence-portfolio-composer. |
| `learner-goals-and-audience` | Owns learner goals and audience; preserves the required relationship with upstream `portfolio-composer` and downstream `artifact-library`, and does not absorb another region's owner. |
| `artifact-library` | Owns artifact library; preserves the required relationship with upstream `learner-goals-and-audience` and downstream `outcome-framework`, and does not absorb another region's owner. |
| `outcome-framework` | Owns outcome framework; preserves the required relationship with upstream `artifact-library` and downstream `artifact-outcome-evidence-map`, and does not absorb another region's owner. |
| `artifact-outcome-evidence-map` | Owns artifact outcome evidence map; preserves the required relationship with upstream `outcome-framework` and downstream `selected-artifact-reflection-and-provenance`, and does not absorb another region's owner. |
| `selected-artifact-reflection-and-provenance` | Owns selected artifact reflection and provenance; preserves the required relationship with upstream `artifact-outcome-evidence-map` and downstream `coverage-gap-summary`, and does not absorb another region's owner. |
| `coverage-gap-summary` | Owns coverage gap summary; preserves the required relationship with upstream `selected-artifact-reflection-and-provenance` and downstream `audience-preview-and-publish`, and does not absorb another region's owner. |
| `audience-preview-and-publish` | Owns audience preview and publish; preserves the required relationship with upstream `coverage-gap-summary`, and does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Artifact library, outcome framework/map, selected reflection and audience preview remain visible
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Artifact/outcome map remains primary; libraries become drawers and preview becomes an alternate pane
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** A named relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Outcome or artifact entry → linked evidence → reflection/provenance → coverage gaps → audience preview → publish; matrix becomes bidirectional grouped lists
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order are `portfolio-composer → learner-goals-and-audience → artifact-library → outcome-framework → artifact-outcome-evidence-map → selected-artifact-reflection-and-provenance → coverage-gap-summary → audience-preview-and-publish`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task parity includes artifact loading/missing, outcome active/retired, link proposed/confirmed, evidence weak/strong, reflection draft, permission restricted, coverage gap, preview stale and publish pending/failure.

## State obligations

Task-specific states: artifact loading/missing, outcome active/retired, link proposed/confirmed, evidence weak/strong, reflection draft, permission restricted, coverage gap, preview stale and publish pending/failure.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with an appropriate next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow Cancel when safe, and announce progress. |
| Success | Confirm the exact changed scope, update related summaries, and preserve Undo or the next step when required. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | A user-triggered stage change focuses the new heading; status-only updates do not move focus; modals return to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes the lowest support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must map one artifact to multiple outcomes and vice versa, expose a coverage gap, preserve provenance/permissions and update an audience-specific preview
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho dual-list transfer, generic portfolio gallery, cross-framework mapper or document builder; evidence-bearing many-to-many artifact/outcome links plus reflection and audience preview are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-LEP-90`, `91` or `92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [1EdTech Open Badges 3.0](https://standards.1edtech.org/open-badges/specifications/standards/v3p0) | Provides official evidence for learner goals and audience. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [Europass digital credentials](https://europass.europa.eu/en/european-digital-credentials-learning) | Provides official evidence for artifact library. | Does not prove product truth, exact geometry, breakpoints, or components. |
| [W3C Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Provides official evidence for keyboard, focus, reflow, or status behavior. | Does not prove product truth, exact geometry, breakpoints, or components. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `learning-evidence-portfolio-composer`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{"archetypeId":"learning-evidence-portfolio-composer","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
