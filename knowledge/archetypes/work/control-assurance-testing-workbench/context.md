# Control assurance testing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | control-assurance-testing-workbench |
| Family | work |
| Dominant task | Execute repeatable assurance procedures across samples, bind evidence, record exceptions, and prove assertion coverage before reviewer sign-off. |
| Search aliases | control-assurance-testing-workbench; control testing; assurance procedure; sample evidence coverage |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Execute repeatable assurance procedures across samples, bind evidence, record exceptions, and prove assertion coverage before reviewer sign-off.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CAT-01 | Execute repeatable assurance procedures across samples, bind evidence, record exceptions, and prove assertion coverage before reviewer sign-off. | required positive evidence |
| AR-CAT-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-CAT-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-CAT-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-CAT-90 | Reject one-case dossiers, diagnostic bundles, assessments, regulated sample selection, and generic checklists. | reject |
| AR-CAT-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CAT-01, AR-CAT-02, and AR-CAT-03 are evidenced, neither AR-CAT-90 nor AR-CAT-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
assurance-workbench
├─ control-test-plan
├─ sample-population
├─ procedure-steps
├─ evidence-viewer
├─ result-exception-ledger
├─ assertion-coverage
└─ reviewer-signoff
~~~

Critical relationship: Repeated sample results roll up to one assertion owner; missing evidence or open exceptions prevent sufficient coverage and sign-off.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| assurance-workbench | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains control-test-plan, sample-population, procedure-steps, evidence-viewer, result-exception-ledger, assertion-coverage, reviewer-signoff while preserving each region's independent owner. |
| control-test-plan | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from assurance-workbench and gates sample-population without merging authority. |
| sample-population | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from control-test-plan and gates procedure-steps without merging authority. |
| procedure-steps | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from sample-population and gates evidence-viewer without merging authority. |
| evidence-viewer | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from procedure-steps and gates result-exception-ledger without merging authority. |
| result-exception-ledger | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from evidence-viewer and gates assertion-coverage without merging authority. |
| assertion-coverage | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from result-exception-ledger and gates reviewer-signoff without merging authority. |
| reviewer-signoff | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from assertion-coverage and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep sample and procedure context, evidence, results, exceptions, and assertion coverage simultaneously inspectable.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Move the sample queue to a drawer; keep the active procedure and evidence primary while coverage persists.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage one sample, one procedure step, evidence, result or exception, next sample, then coverage and sign-off.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off.

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
| domain states | Preserve the complete domain catalog: plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject one-case dossiers, diagnostic bundles, assessments, regulated sample selection, and generic checklists. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [NIST — SP 800-53A Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/a/r5/final) | Supports repeatable assessment procedures and assessment plans. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Supports dense record collections with explicit selection and state. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive procedure, exception, and coverage announcements. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "control-assurance-testing-workbench",
  "matchedSituationCodes": [
    "AR-CAT-01",
    "AR-CAT-02",
    "AR-CAT-03"
  ],
  "aliases": [
    "control-assurance-testing-workbench",
    "control testing",
    "assurance procedure",
    "sample evidence coverage"
  ],
  "dominantTask": "Execute repeatable assurance procedures across samples, bind evidence, record exceptions, and prove assertion coverage before reviewer sign-off.",
  "regions": [
    "assurance-workbench",
    "control-test-plan",
    "sample-population",
    "procedure-steps",
    "evidence-viewer",
    "result-exception-ledger",
    "assertion-coverage",
    "reviewer-signoff"
  ],
  "relationships": [
    "Repeated sample results roll up to one assertion owner; missing evidence or open exceptions prevent sufficient coverage and sign-off."
  ],
  "responsive": {
    "wide": "Keep sample and procedure context, evidence, results, exceptions, and assertion coverage simultaneously inspectable.",
    "intermediate": "Move the sample queue to a drawer; keep the active procedure and evidence primary while coverage persists.",
    "compact": "Stage one sample, one procedure step, evidence, result or exception, next sample, then coverage and sign-off.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "assurance-workbench → control-test-plan → sample-population → procedure-steps → evidence-viewer → result-exception-ledger → assertion-coverage → reviewer-signoff",
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
    "plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off"
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

