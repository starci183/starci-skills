# Braille translation contraction proof workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `braille-translation-contraction-proof-workbench` |
| Family | Work |
| Dominant task | Translate print source into a declared braille code, prove every contraction and indicator decision, back-translate the cells and certify a tactile master whose semantics and pagination are intact. |
| Search aliases | braille contraction proof, UEB transducer, back translation |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `braille-proof` owns the complete dominant task, work state, and recovery boundary.
- Translate print source into a declared braille code, prove every contraction and indicator decision, back-translate the cells and certify a tactile master whose semantics and pagination are intact.
- Every required region retains its named owner, relationship, and stable identity; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft, pending work, error, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `BRA-01` | Translate print source into a declared braille code, prove every contraction and indicator decision, back-translate the cells and certify a tactile master whose semantics and pagination are intact. | Required positive evidence. |
| `BRA-02` | Every required region and relationship in the graph is necessary to complete the task. | Require the complete graph. |
| `BRA-03` | Template must show one token's inherited transducer state, apply a contraction transition with exact rule and source-span↔dot-numbered-cell-span trace, carry or close an indicator at a line boundary, show the resulting state, reveal one discrepancy through an independent back-translation, accept tactile proof and certify an embosser-ready master with visible code-version provenance. | Require the domain-specific proof path. |
| `BRA-04` | Work state must survive all three named topology responses. | Require responsive parity. |
| `BRA-05` | Task-specific states: source current/changed, code edition selected/outdated, token contracted/uncontracted/ambiguous, indicator open/closed/missing, cell sequence valid/invalid, line overflow, page break approved/risky, back-translation equal/diverged, proofreader issue open/resolved and master certified/revoked. | Require state and recovery coverage. |
| `BRA-90` | Reject cho `localization-workbench`, `print-proof-preflight-review`, `reconciliation-diff-workbench` or `typeface-glyph-metrics-workbench`; a braille finite-state transducer, explicit pre/post indicator state, source-span↔cell-span ownership, line/page state carry-or-close and independent back-translation are mandatory. | Reject. |
| `BRA-91` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |
| `BRA-92` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |

### Selection rule

Select `braille-translation-contraction-proof-workbench` if and only if `BRA-01`–`05` are evidenced and none of `BRA-90`–`92` is present. Return `needs-evidence` when the dominant task, owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
braille-proof
├─ source-language-purpose-and-code-edition (downstream)
├─ print-block-and-stable-token-sequence (downstream)
├─ braille-finite-state-transducer (downstream)
├─ pre-token-grade-capital-number-and-emphasis-state (downstream)
├─ rule-and-contraction-transition (downstream)
├─ source-span-to-cell-span-mapping (downstream)
├─ post-token-grade-capital-number-and-emphasis-state (downstream)
├─ line-page-formatting-and-state-carry-or-close (downstream)
├─ independent-back-translation (downstream)
├─ semantic-punctuation-capitalization-and-number-discrepancy-ledger (downstream)
├─ tactile-proofreader-corrections (downstream)
└─ certified-master-and-embosser-export (downstream)
```

The binding relationship expression is `braille-proof → source-language-purpose-and-code-edition → print-block-and-stable-token-sequence → braille-finite-state-transducer → pre-token-grade-capital-number-and-emphasis-state → rule-and-contraction-transition → source-span-to-cell-span-mapping → post-token-grade-capital-number-and-emphasis-state → line-page-formatting-and-state-carry-or-close → independent-back-translation → semantic-punctuation-capitalization-and-number-discrepancy-ledger → tactile-proofreader-corrections → certified-master-and-embosser-export`; operators retain the directed, peer, or joint-axis meaning declared by the prompt.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `braille-proof` | braille-proof owns its evidence and state and the dominant-task boundary and passes stable identity to `source-language-purpose-and-code-edition`. It does not absorb another region's owner. |
| `source-language-purpose-and-code-edition` | source-language-purpose-and-code-edition owns its evidence and state; it preserves the → relationship from upstream `braille-proof` and passes stable identity to `print-block-and-stable-token-sequence`. It does not absorb another region's owner. |
| `print-block-and-stable-token-sequence` | print-block-and-stable-token-sequence owns its evidence and state; it preserves the → relationship from upstream `source-language-purpose-and-code-edition` and passes stable identity to `braille-finite-state-transducer`. It does not absorb another region's owner. |
| `braille-finite-state-transducer` | braille-finite-state-transducer owns its evidence and state; it preserves the → relationship from upstream `print-block-and-stable-token-sequence` and passes stable identity to `pre-token-grade-capital-number-and-emphasis-state`. It does not absorb another region's owner. |
| `pre-token-grade-capital-number-and-emphasis-state` | pre-token-grade-capital-number-and-emphasis-state owns its evidence and state; it preserves the → relationship from upstream `braille-finite-state-transducer` and passes stable identity to `rule-and-contraction-transition`. It does not absorb another region's owner. |
| `rule-and-contraction-transition` | rule-and-contraction-transition owns its evidence and state; it preserves the → relationship from upstream `pre-token-grade-capital-number-and-emphasis-state` and passes stable identity to `source-span-to-cell-span-mapping`. It does not absorb another region's owner. |
| `source-span-to-cell-span-mapping` | source-span-to-cell-span-mapping owns its evidence and state; it preserves the → relationship from upstream `rule-and-contraction-transition` and passes stable identity to `post-token-grade-capital-number-and-emphasis-state`. It does not absorb another region's owner. |
| `post-token-grade-capital-number-and-emphasis-state` | post-token-grade-capital-number-and-emphasis-state owns its evidence and state; it preserves the → relationship from upstream `source-span-to-cell-span-mapping` and passes stable identity to `line-page-formatting-and-state-carry-or-close`. It does not absorb another region's owner. |
| `line-page-formatting-and-state-carry-or-close` | line-page-formatting-and-state-carry-or-close owns its evidence and state; it preserves the → relationship from upstream `post-token-grade-capital-number-and-emphasis-state` and passes stable identity to `independent-back-translation`. It does not absorb another region's owner. |
| `independent-back-translation` | independent-back-translation owns its evidence and state; it preserves the → relationship from upstream `line-page-formatting-and-state-carry-or-close` and passes stable identity to `semantic-punctuation-capitalization-and-number-discrepancy-ledger`. It does not absorb another region's owner. |
| `semantic-punctuation-capitalization-and-number-discrepancy-ledger` | semantic-punctuation-capitalization-and-number-discrepancy-ledger owns its evidence and state; it preserves the → relationship from upstream `independent-back-translation` and passes stable identity to `tactile-proofreader-corrections`. It does not absorb another region's owner. |
| `tactile-proofreader-corrections` | tactile-proofreader-corrections owns its evidence and state; it preserves the → relationship from upstream `semantic-punctuation-capitalization-and-number-discrepancy-ledger` and passes stable identity to `certified-master-and-embosser-export`. It does not absorb another region's owner. |
| `certified-master-and-embosser-export` | certified-master-and-embosser-export owns its evidence and state; it preserves the → relationship from upstream `tactile-proofreader-corrections` and emits completion evidence. It does not absorb another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** A named simultaneous evidence relationship no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Print source, braille cells with line/page context, applied-rule trace, back-translation and discrepancy ledger remain visible together.
- **Navigation replacement:** None; direct region access still fits and related evidence remains simultaneous.
- **Sticky boundary:** Only current scope or the primary action may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** Only the intrinsically tabular, matrix, graph, timeline, notation, or media region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The complete support scope can no longer remain persistent beside the active proof without reducing readable measure or hiding focus.
- **Topology response:** The active token-to-cell decision and back-translation remain primary; full page layout, rulebook context and proofreader history move to synchronized drawers.
- **Navigation replacement:** A labeled stage or drawer opens the exact supporting region and preserves query, selection, draft, scroll, and return-focus target.
- **Sticky boundary:** The active proof may stay sticky only while reserved space keeps every focused control visible; short height yields.
- **Overflow owner:** The same bounded intrinsic region remains the only overflow owner; temporary support does not create nested page scroll.

### Compact

- **Failure trigger:** The active decision and its minimum proof no longer fit side by side at readable measure.
- **Topology response:** Source token → inherited grade/capital/number/emphasis state → rule or contraction transition → cell span → resulting indicator state → carry or close at line/page boundary → independent back-translation → discrepancy → correct or certify; visual dot diagrams include textual dot-number labels and semantic cell strings.
- **Navigation replacement:** A labeled one-pane stage route replaces simultaneous columns and preserves the exact active object and recovery target.
- **Sticky boundary:** Only the current-stage action may persist with safe-area spacing; landscape or short height returns it to flow.
- **Overflow owner:** No page-level horizontal scroll; intrinsic two-dimensional evidence uses one labeled bounded region or a semantic list replacement.

### Reflow

- DOM order, reading order, and meaningful focus order are `braille-proof → source-language-purpose-and-code-edition → print-block-and-stable-token-sequence → braille-finite-state-transducer → pre-token-grade-capital-number-and-emphasis-state → rule-and-contraction-transition → source-span-to-cell-span-mapping → post-token-grade-capital-number-and-emphasis-state → line-page-formatting-and-state-carry-or-close → independent-back-translation → semantic-punctuation-capitalization-and-number-discrepancy-ledger → tactile-proofreader-corrections → certified-master-and-embosser-export`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific states: source current/changed, code edition selected/outdated, token contracted/uncontracted/ambiguous, indicator open/closed/missing, cell sequence valid/invalid, line overflow, page break approved/risky, back-translation equal/diverged, proofreader issue open/resolved and master certified/revoked.

## State obligations

Task-specific states: source current/changed, code edition selected/outdated, token contracted/uncontracted/ambiguous, indicator open/closed/missing, cell sequence valid/invalid, line overflow, page break approved/risky, back-translation equal/diverged, proofreader issue open/resolved and master certified/revoked.

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

- Template must show one token's inherited transducer state, apply a contraction transition with exact rule and source-span↔dot-numbered-cell-span trace, carry or close an indicator at a line boundary, show the resulting state, reveal one discrepancy through an independent back-translation, accept tactile proof and certify an embosser-ready master with visible code-version provenance.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject cho `localization-workbench`, `print-proof-preflight-review`, `reconciliation-diff-workbench` or `typeface-glyph-metrics-workbench`; a braille finite-state transducer, explicit pre/post indicator state, source-span↔cell-span ownership, line/page state carry-or-close and independent back-translation are mandatory.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `BRA-90`–`92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports reflow, focus order, status communication, and keyboard-operable responsive behavior. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [International Council on English Braille UEB rulebook](https://iceb.org/publications/ueb/) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |
| [Braille Authority of North America UEB implementation statement](https://brailleauthority.org/unified-english-braille-ueb) | Supports domain terminology and constraints used to distinguish the dominant task. | Does not prove product truth, geometry, breakpoints, components, or visual direction. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `braille-translation-contraction-proof-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, joint-axis, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"braille-translation-contraction-proof-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
