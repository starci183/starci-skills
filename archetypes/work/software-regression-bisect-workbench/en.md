# Software regression bisect workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `software-regression-bisect-workbench` |
| Family | Work |
| Dominant task | Repeatedly test selected revisions to shrink a known-good and known-bad interval until the introducing commit is proven. |
| Search aliases | `git bisect workbench`, `regression interval`, `culprit commit finder` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Repeatedly test selected revisions to shrink a known-good and known-bad interval until the introducing commit is proven.
- The ordered revision interval and executable result evidence determine every next candidate and terminal culprit.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SRB-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-SRB-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-SRB-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-SRB-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-SRB-90` | The dominant task is actually guided troubleshooting tree. | Reject. |
| `AR-SRB-91` | The dominant task is actually job-run timeline. | Reject. |
| `AR-SRB-92` | The dominant task is actually audit timeline. | Reject. |
| `AR-SRB-93` | The dominant task is actually generic commit explorer. | Reject. |

### Selection rule

Select `software-regression-bisect-workbench` if and only if `AR-SRB-01` through `AR-SRB-04` are evidenced and none of `AR-SRB-90` through `AR-SRB-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `bisect-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `symptom-and-reproduction-command` | Owns Symptom And Reproduction Command evidence or action and preserves its declared relationship to the current selection. |
| `known-good-and-bad-endpoints` | Owns Known Good And Bad Endpoints evidence or action and preserves its declared relationship to the current selection. |
| `candidate-interval-and-commit-graph` | Owns Candidate Interval And Commit Graph evidence or action and preserves its declared relationship to the current selection. |
| `current-candidate-build-and-test` | Owns Current Candidate Build And Test evidence or action and preserves its declared relationship to the current selection. |
| `result-evidence` | Owns Result Evidence evidence or action and preserves its declared relationship to the current selection. |
| `shrinking-interval` | Owns Shrinking Interval evidence or action and preserves its declared relationship to the current selection. |
| `skipped-or-ambiguous-candidates` | Owns Skipped Or Ambiguous Candidates evidence or action and preserves its declared relationship to the current selection. |
| `culprit-confirmation-and-reset` | Owns Culprit Confirmation And Reset evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Commit interval, active test evidence, and remaining candidates remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The active candidate and run are primary while the interval summary persists.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Next candidate → build and test → mark good, bad, or skip → remaining interval → culprit confirmation or reset.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: endpoints invalid, candidate checkout, building, testing, good, bad, skip, ambiguous, command failed, interval shrinking, culprit provisional, culprit confirmed, abort, reset, evidence export.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `symptom-and-reproduction-command` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `known-good-and-bad-endpoints` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `known-good-and-bad-endpoints` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `skipped-or-ambiguous-candidates` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `culprit-confirmation-and-reset` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `culprit-confirmation-and-reset` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `culprit-confirmation-and-reset` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `symptom-and-reproduction-command` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `culprit-confirmation-and-reset` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `bisect-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Repeatedly test selected revisions to shrink a known-good and known-bad interval until the introducing commit is proven.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject guided troubleshooting tree; this is `AR-SRB-90` evidence and must route to an adjacent archetype.
- Reject job-run timeline; this is `AR-SRB-91` evidence and must route to an adjacent archetype.
- Reject audit timeline; this is `AR-SRB-92` evidence and must route to an adjacent archetype.
- Reject generic commit explorer; this is `AR-SRB-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Git — git bisect](https://git-scm.com/docs/git-bisect) | Algorithmic good and bad interval reduction, skip, reset, and run. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Chromium — bisect-builds.py](https://www.chromium.org/developers/bisect-builds-py/) | Executable revision testing across available builds. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "software-regression-bisect-workbench",
  "situationCodes": ["<matched AR-SRB-* codes>"],
  "searchAliases": ["git bisect workbench","regression interval","culprit commit finder"],
  "dominantTask": "Repeatedly test selected revisions to shrink a known-good and known-bad interval until the introducing commit is proven.",
  "regions": ["bisect-workbench","symptom-and-reproduction-command","known-good-and-bad-endpoints","candidate-interval-and-commit-graph","current-candidate-build-and-test","result-evidence","shrinking-interval","skipped-or-ambiguous-candidates","culprit-confirmation-and-reset"],
  "regionRelationships": ["The ordered revision interval and executable result evidence determine every next candidate and terminal culprit."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-interval-and-commit-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["endpoints invalid","candidate checkout","building","testing","good","bad","skip","ambiguous","command failed","interval shrinking","culprit provisional","culprit confirmed","abort","reset","evidence export"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

