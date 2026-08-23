# Localization workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `localization-workbench` |
| Family | Work |
| Dominant task | Translate and review many source segments into a target locale while preserving context, placeholders, workflow status, and quality evidence. |
| Search aliases | translation segments, locale QA, placeholder validation, terminology review |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `localization-workbench` owns the complete dominant task and its recovery boundary.
- Translate and review many source segments into a target locale while preserving context, placeholders, workflow status, and quality evidence.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-LWB-01` | Translate and review many source segments into a target locale while preserving context, placeholders, workflow status, and quality evidence. | Required positive evidence. |
| `AR-LWB-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-LWB-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-LWB-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-LWB-90` | The actual task is owned by spreadsheet editing or reconciliation diff. | Reject. |
| `AR-LWB-91` | Reject generic spreadsheet rows, two-version merge diff, document authoring, and single-language forms without segment or placeholder semantics. | Reject. |
| `AR-LWB-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `localization-workbench` if and only if `AR-LWB-01` through `AR-LWB-04` are evidenced, every required region and relationship is present, and none of `AR-LWB-90` through `AR-LWB-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
localization-workbench
├─ project-locale-and-progress
├─ segment-queue
├─ source-context
├─ target-editor
├─ terminology-and-placeholder-support
├─ quality-issues
└─ save-and-submit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `localization-workbench` | Owns one source-target locale pair, segment draft set, QA state, and submission boundary. |
| `project-locale-and-progress` | Names source/target locale, progress denominator, role, and freshness. |
| `segment-queue` | Owns segment order, status, filtering, selection, and next/previous navigation. |
| `source-context` | Provides immutable source segment and surrounding usage context. |
| `target-editor` | Owns target draft, autosave, review state, conflict, and current focus. |
| `terminology-and-placeholder-support` | Compares required placeholders and offers non-binding terminology evidence. |
| `quality-issues` | Owns missing placeholder, length, stale-source, and review issues linked to exact target spans. |
| `save-and-submit` | Owns pending protection, locked state, submission completeness, success, and retry. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep segment queue, paired source/target editing, and terminology/QA support simultaneous; source and target remain one segment context.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Segment and issue lists scroll vertically within their active stage; placeholders wrap and the page never scrolls horizontally.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Collapse the queue; keep source and target visible; make terminology/QA a drawer while an issue summary stays outside.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Segment and issue lists scroll vertically within their active stage; placeholders wrap and the page never scrolls horizontally.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Use a segment-by-segment stage with source immediately before target; open queue/progress and terminology/issues as sheets; previous/next preserves draft and review state.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Segment and issue lists scroll vertically within their active stage; placeholders wrap and the page never scrolls horizontally.

### Reflow

- DOM order, reading order, and meaningful focus order are `localization-workbench → project-locale-and-progress → segment-queue → source-context → target-editor → terminology-and-placeholder-support → quality-issues → save-and-submit`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes project/segment loading, untranslated/draft/reviewed/approved, autosave pending/error, placeholder or length issue, terminology suggestion, source changed/stale target, conflict, locked segment, and submit success.

## State obligations

Task-specific states: project/segment loading, untranslated/draft/reviewed/approved, autosave pending/error, placeholder or length issue, terminology suggestion, source changed/stale target, conflict, locked segment, and submit success.

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

- Many source-target segments share locale, status, placeholder, terminology, and QA semantics.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject generic spreadsheet rows, two-version merge diff, document authoring, and single-language forms without segment or placeholder semantics.
- Reject when spreadsheet editing or reconciliation diff owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-LWB-90`, `AR-LWB-91`, or `AR-LWB-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [Unicode ICU message formatting](https://unicode-org.github.io/icu/userguide/format_parse/messages/) | Translatable messages preserve variable placeholders and grammatical context as one unit. | It does not define product segments, target locales, or workbench geometry. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor controls expose labeled states, validation, and contextual actions. | It does not make a Spectrum component tree binding here. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information and function survive narrow width without page-level two-axis scrolling. | It does not decide which intrinsic work region owns bounded overflow. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `localization-workbench`. |
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
  "archetypeId": "localization-workbench",
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
