# Multi-party consensus workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multi-party-consensus-workbench` |
| Family | Work |
| Dominant task | Synthesize shared evidence, participant positions, and unresolved objections into a proposal with quorum and a durable decision record. |
| Search aliases | consensus, objections register, participant positions, quorum proposal |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `consensus-workbench` owns the complete dominant task and its recovery boundary.
- Synthesize shared evidence, participant positions, and unresolved objections into a proposal with quorum and a durable decision record.
- Every required region retains its named owner and relationship; Grammar only binds product-semantic owners.
- Wide, intermediate, and compact topology changes occur when a named relationship fails, never by device label.
- Responsive transformation preserves selection, draft, cursor, pending work, errors, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MPC-01` | Synthesize shared evidence, participant positions, and unresolved objections into a proposal with quorum and a durable decision record. | Required positive evidence. |
| `AR-MPC-02` | Every required batch region and relationship is necessary to complete the task. | Require the complete region graph. |
| `AR-MPC-03` | A named simultaneous relationship fails at intermediate or compact while work state must survive transformation. | Require the three topology responses. |
| `AR-MPC-04` | Pending, error, conflict, or stale state can occur after the user creates work state. | Require recovery without lost input or focus meaning. |
| `AR-MPC-90` | The actual task is owned by approval requests or criteria-led case review. | Reject. |
| `AR-MPC-91` | Reject simple approvals, comment threads, incident command, voting-only ballots, diff resolution, and criteria-led cases without participant positions plus quorum. | Reject. |
| `AR-MPC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `multi-party-consensus-workbench` if and only if `AR-MPC-01` through `AR-MPC-04` are evidenced, every required region and relationship is present, and none of `AR-MPC-90` through `AR-MPC-92` is present. Return `needs-evidence` when the dominant task, an owner, overflow owner, or completion consequence is unproved; return `reject` when a rejection code is present.

## Region graph

```text
consensus-workbench
├─ decision-question-and-rules
├─ shared-evidence-set
├─ participant-position-map
├─ unresolved-issue-register
├─ proposal-composer
└─ quorum-and-decision-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `consensus-workbench` | Owns one decision question from evidence intake through recorded outcome. |
| `decision-question-and-rules` | States scope, quorum rule, expiry, and who may participate. |
| `shared-evidence-set` | Owns stable evidence identities cited by positions and objections. |
| `participant-position-map` | Owns each participant response, abstention, and position change. |
| `unresolved-issue-register` | Owns objections, evidence links, resolution, reopen, and remaining blockers. |
| `proposal-composer` | Integrates evidence and issue resolutions into one versioned proposal. |
| `quorum-and-decision-record` | Computes quorum from participant state and records the exact accepted proposal and objections. |

## Responsive contract

### Wide

- **Failure trigger:** Required simultaneous regions retain enough measure for reading, operation, and relationship comprehension.
- **Topology response:** Keep evidence, positions/issues, and proposal/quorum in two or three simultaneous regions; link every active objection to exact evidence and proposed resolution.
- **Navigation replacement:** None; direct region access still fits.
- **Sticky boundary:** Only actions or status bound to the current work object may be sticky; they reserve space and never obscure focus.
- **Overflow owner:** Each evidence/issue list may scroll vertically in its own stage; no region owns horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support starts to squeeze primary work, labels, or actions.
- **Topology response:** Make evidence or the participant map temporary; keep unresolved issues and proposal primary while participant state remains visible in a summary.
- **Navigation replacement:** A labeled trigger opens the exact temporary pane or disclosure and preserves query, selection, draft, cursor, and return-focus target.
- **Sticky boundary:** Current scope and pending/error summary may persist but yield when height is insufficient.
- **Overflow owner:** Each evidence/issue list may scroll vertically in its own stage; no region owns horizontal overflow.

### Compact

- **Failure trigger:** Two work regions cannot remain simultaneous with sufficient measure, 44px targets, and unobscured focus.
- **Topology response:** Sequence decision context, evidence summary, positions, unresolved issues, proposal, then quorum; preserve selected evidence/issue and a deterministic Back path.
- **Navigation replacement:** Named stages, tabs, or sheets replace direct simultaneity; Back restores exact filter, scroll, selection, draft, cursor, and trigger focus.
- **Sticky boundary:** The primary action is sticky only with reserved space, unobscured focus, and a short-height fallback to normal flow.
- **Overflow owner:** Each evidence/issue list may scroll vertically in its own stage; no region owns horizontal overflow.

### Reflow

- DOM order, reading order, and meaningful focus order are `consensus-workbench → decision-question-and-rules → shared-evidence-set → participant-position-map → unresolved-issue-register → proposal-composer → quorum-and-decision-record`; CSS never reorders semantics.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A dialog, drawer, or sheet focuses its heading, contains focus while modal, supports Escape or Cancel, and returns to the exact trigger with work context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action; drag or gesture always has a button or keyboard equivalent.
- A topology change never resets work state, duplicates a pending action, or changes an owner.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies specific recovery.
- Task-specific parity includes evidence loading/stale, participant invited/responded/abstained, position changed, objection open/resolved/reopened, proposal draft/conflict, quorum unmet/met/expired, decision pending/recorded, and evidence-to-issue focus.

## State obligations

Task-specific states: evidence loading/stale, participant invited/responded/abstained, position changed, objection open/resolved/reopened, proposal draft/conflict, quorum unmet/met/expired, decision pending/recorded, and evidence-to-issue focus.

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

- Participant positions and objections remain independent owners, quorum gates one proposal, and the record binds evidence to the decision.
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject simple approvals, comment threads, incident command, voting-only ballots, diff resolution, and criteria-led cases without participant positions plus quorum.
- Reject when approval requests or criteria-led case review owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-MPC-90`, `AR-MPC-91`, or `AR-MPC-92`. Return `needs-evidence` when business truth does not prove the dominant task, owner relationship, overflow owner, or completion consequence.

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
| [IETF RFC 7282 on consensus](https://www.rfc-editor.org/rfc/rfc7282) | Consensus requires objections to be heard and evaluated rather than reduced to vote totals. | It does not define product quorum, participant authority, or interface geometry. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Relational scanning, selection, sorting, expansion, and actions remain table-owned. | It does not define product fields, density, or breakpoint values. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary and supporting regions adapt when simultaneous content no longer fits. | It does not supply fixed breakpoints or product components. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading, and focus order preserve task meaning through topology changes. | It does not define product keyboard shortcuts. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error, and live changes are announced without moving focus. | It does not define business state policy or copy. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `multi-party-consensus-workbench`. |
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
  "archetypeId": "multi-party-consensus-workbench",
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
