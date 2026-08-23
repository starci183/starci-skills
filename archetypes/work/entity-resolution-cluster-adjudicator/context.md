# Entity resolution cluster adjudicator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `entity-resolution-cluster-adjudicator` |
| Family | Work |
| Dominant task | Decide whether multiple noisy records represent one entity, then merge or split clusters and define a reviewable canonical outcome. |
| Search aliases | `record linkage adjudicator`, `entity cluster review`, `deduplication cluster` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Decide whether multiple noisy records represent one entity, then merge or split clusters and define a reviewable canonical outcome.
- N-record transitivity and canonicalization are independent owners bound to the same candidate cluster.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ERA-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-ERA-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-ERA-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-ERA-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-ERA-90` | The dominant task is actually two-source diff. | Reject. |
| `AR-ERA-91` | The dominant task is actually operational queue. | Reject. |
| `AR-ERA-92` | The dominant task is actually one-case dossier. | Reject. |
| `AR-ERA-93` | The dominant task is actually duplicate warning. | Reject. |

### Selection rule

Select `entity-resolution-cluster-adjudicator` if and only if `AR-ERA-01` through `AR-ERA-04` are evidenced and none of `AR-ERA-90` through `AR-ERA-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `cluster-adjudicator` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `source-dataset-context` | Owns Source Dataset Context evidence or action and preserves its declared relationship to the current selection. |
| `candidate-cluster-graph` | Owns Candidate Cluster Graph evidence or action and preserves its declared relationship to the current selection. |
| `pairwise-comparison-evidence` | Owns Pairwise Comparison Evidence evidence or action and preserves its declared relationship to the current selection. |
| `cluster-consistency-and-anomaly-summary` | Owns Cluster Consistency And Anomaly Summary evidence or action and preserves its declared relationship to the current selection. |
| `merge-split-and-canonical-actions` | Owns Merge Split And Canonical Actions evidence or action and preserves its declared relationship to the current selection. |
| `outcome-preview` | Owns Outcome Preview evidence or action and preserves its declared relationship to the current selection. |
| `audit-sample-and-commit` | Owns Audit Sample And Commit evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Cluster graph, pairwise evidence, and canonical preview remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `candidate-cluster-graph` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The cluster queue and pair evidence stay primary while the graph becomes optional.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `candidate-cluster-graph` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Cluster queue → suspicious pair → evidence → merge or split → canonical preview → commit.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `candidate-cluster-graph` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit`.
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

Task-specific states: cluster loading, pair match, pair nonmatch, pair uncertain, transitivity anomaly, split draft, merge draft, canonical field conflict, preview stale, audit sample pass, audit sample fail, commit, rollback.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `source-dataset-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `candidate-cluster-graph` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `candidate-cluster-graph` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `outcome-preview` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `audit-sample-and-commit` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `audit-sample-and-commit` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `audit-sample-and-commit` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `source-dataset-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `audit-sample-and-commit` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `cluster-adjudicator` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Decide whether multiple noisy records represent one entity, then merge or split clusters and define a reviewable canonical outcome.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject two-source diff; this is `AR-ERA-90` evidence and must route to an adjacent archetype.
- Reject operational queue; this is `AR-ERA-91` evidence and must route to an adjacent archetype.
- Reject one-case dossier; this is `AR-ERA-92` evidence and must route to an adjacent archetype.
- Reject duplicate warning; this is `AR-ERA-93` evidence and must route to an adjacent archetype.

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
| [UK Ministry of Justice — Splink clustering](https://moj-analytical-services.github.io/splink/api_docs/linker_clustering.html) | Connected-record clustering and graph metrics. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [US Census — Statistical Quality Standard C4](https://www.census.gov/about/policies/quality/standards/standardc4.html) | Quality evidence for linking data records. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "entity-resolution-cluster-adjudicator",
  "situationCodes": ["<matched AR-ERA-* codes>"],
  "searchAliases": ["record linkage adjudicator","entity cluster review","deduplication cluster"],
  "dominantTask": "Decide whether multiple noisy records represent one entity, then merge or split clusters and define a reviewable canonical outcome.",
  "regions": ["cluster-adjudicator","source-dataset-context","candidate-cluster-graph","pairwise-comparison-evidence","cluster-consistency-and-anomaly-summary","merge-split-and-canonical-actions","outcome-preview","audit-sample-and-commit"],
  "regionRelationships": ["N-record transitivity and canonicalization are independent owners bound to the same candidate cluster."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-cluster-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["cluster loading","pair match","pair nonmatch","pair uncertain","transitivity anomaly","split draft","merge draft","canonical field conflict","preview stale","audit sample pass","audit sample fail","commit","rollback"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

