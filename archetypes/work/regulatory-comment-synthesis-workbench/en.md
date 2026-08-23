# Regulatory comment synthesis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | regulatory-comment-synthesis-workbench |
| Family | work |
| Dominant task | Organize a public-comment corpus by issue, stance, and evidence, trace every synthesis to source comments, and prove response coverage. |
| Search aliases | regulatory-comment-synthesis-workbench; comment corpus synthesis; issue response coverage; regulatory comments |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Organize a public-comment corpus by issue, stance, and evidence, trace every synthesis to source comments, and prove response coverage.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-RCS-01 | Organize a public-comment corpus by issue, stance, and evidence, trace every synthesis to source comments, and prove response coverage. | required positive evidence |
| AR-RCS-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-RCS-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-RCS-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-RCS-90 | Reject consultation-response submission, one-case dossiers, literature synthesis, and generic document editors. | reject |
| AR-RCS-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-RCS-01, AR-RCS-02, and AR-RCS-03 are evidenced, neither AR-RCS-90 nor AR-RCS-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
comment-synthesis
├─ docket-comment-corpus
├─ issue-taxonomy
├─ comment-clusters
├─ selected-comment-attachment-evidence
├─ response-to-issue-composer
├─ coverage-unresolved-register
└─ published-response-package
~~~

Critical relationship: Corpus-wide issue coverage owns completion; every synthesis and response traces to source comments rather than one selected case.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| comment-synthesis | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains docket-comment-corpus, issue-taxonomy, comment-clusters, selected-comment-attachment-evidence, response-to-issue-composer, coverage-unresolved-register, published-response-package while preserving each region's independent owner. |
| docket-comment-corpus | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from comment-synthesis and gates issue-taxonomy without merging authority. |
| issue-taxonomy | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from docket-comment-corpus and gates comment-clusters without merging authority. |
| comment-clusters | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from issue-taxonomy and gates selected-comment-attachment-evidence without merging authority. |
| selected-comment-attachment-evidence | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from comment-clusters and gates response-to-issue-composer without merging authority. |
| response-to-issue-composer | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from selected-comment-attachment-evidence and gates coverage-unresolved-register without merging authority. |
| coverage-unresolved-register | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from response-to-issue-composer and gates published-response-package without merging authority. |
| published-response-package | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from coverage-unresolved-register and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep issue taxonomy, comment clusters, source evidence, response composer, and coverage simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Move source detail to a drawer while issue response and coverage persist.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage issue, cluster, source evidence, response, coverage review, then published package.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: corpus loading/duplicate; issue unclassified; cluster provisional; source redacted; response draft/reviewed; material comment unresolved; coverage incomplete/complete; package publish.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show consistent fictional data and the current selection. | Focus remains at the activating control. | Preserve selection through transformation. |
| empty/not-applicable | Explain why content is empty and the valid next step. | Move to recovery only when continuation requires it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error focuses the summary; retry returns to the exact action. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Preserve the complete domain catalog: corpus loading/duplicate; issue unclassified; cluster provisional; source redacted; response draft/reviewed; material comment unresolved; coverage incomplete/complete; package publish. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject consultation-response submission, one-case dossiers, literature synthesis, and generic document editors. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

### Boundary verdict

The valid result is accept, reject, duplicate-or-variation, or needs-evidence under the Situation-code rule; visual preference is not evidence.

## Handoff

- Grammar receives real facts, semantic owners, permissions, states, and action consequences.
- Principles receives exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets, and focus accommodation.
- Direction receives visual character; the template is only one conforming realization.

## Non-binding research evidence

### Evidence boundary

The official sources below are advisory evidence. They are not product truth, do not imply that a source organization names this synthesized archetype, and do not authorize copying geometry, component trees, nouns, or breakpoints.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [US EPA — Commenting on EPA dockets](https://www.epa.gov/dockets/commenting-epa-dockets) | Supports public-comment evidence, disclosure, and docket identity. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [GSA — Regulations.gov API](https://open.gsa.gov/api/regulationsgov/) | Supports comment corpus, docket, attachment, and field semantics. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports preserving issue, source, and response context through pane changes. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "regulatory-comment-synthesis-workbench",
  "matchedSituationCodes": [
    "AR-RCS-01",
    "AR-RCS-02",
    "AR-RCS-03"
  ],
  "aliases": [
    "regulatory-comment-synthesis-workbench",
    "comment corpus synthesis",
    "issue response coverage",
    "regulatory comments"
  ],
  "dominantTask": "Organize a public-comment corpus by issue, stance, and evidence, trace every synthesis to source comments, and prove response coverage.",
  "regions": [
    "comment-synthesis",
    "docket-comment-corpus",
    "issue-taxonomy",
    "comment-clusters",
    "selected-comment-attachment-evidence",
    "response-to-issue-composer",
    "coverage-unresolved-register",
    "published-response-package"
  ],
  "relationships": [
    "Corpus-wide issue coverage owns completion; every synthesis and response traces to source comments rather than one selected case."
  ],
  "responsive": {
    "wide": "Keep issue taxonomy, comment clusters, source evidence, response composer, and coverage simultaneously visible.",
    "intermediate": "Move source detail to a drawer while issue response and coverage persist.",
    "compact": "Stage issue, cluster, source evidence, response, coverage review, then published package.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "comment-synthesis → docket-comment-corpus → issue-taxonomy → comment-clusters → selected-comment-attachment-evidence → response-to-issue-composer → coverage-unresolved-register → published-response-package",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition",
    "corpus loading/duplicate; issue unclassified; cluster provisional; source redacted; response draft/reviewed; material comment unresolved; coverage incomplete/complete; package publish"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.

