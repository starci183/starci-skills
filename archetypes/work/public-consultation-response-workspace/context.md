# Public consultation response workspace

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | public-consultation-response-workspace |
| Family | work |
| Dominant task | Read a proposal or docket, compose responses across multiple issues, bind citations, and preview exactly what will be public. |
| Search aliases | public-consultation-response-workspace; consultation response; docket issue response; public disclosure preview |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Read a proposal or docket, compose responses across multiple issues, bind citations, and preview exactly what will be public.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-PCR-01 | Read a proposal or docket, compose responses across multiple issues, bind citations, and preview exactly what will be public. | required positive evidence |
| AR-PCR-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-PCR-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-PCR-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-PCR-90 | Reject split-reference forms, generic document editors, regulatory-comment synthesis, and generic multi-step applications. | reject |
| AR-PCR-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-PCR-01, AR-PCR-02, and AR-PCR-03 are evidenced, neither AR-PCR-90 nor AR-PCR-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
consultation-workspace
├─ docket-and-deadline
├─ issue-navigator
├─ source-proposal
├─ response-register
├─ cited-evidence-and-attachments
├─ public-disclosure-preview
└─ declaration-submit-receipt
~~~

Critical relationship: Issue responses and the public-disclosure preview are independent owners; submission requires both issue coverage and disclosure safety.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| consultation-workspace | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains docket-and-deadline, issue-navigator, source-proposal, response-register, cited-evidence-and-attachments, public-disclosure-preview, declaration-submit-receipt while preserving each region's independent owner. |
| docket-and-deadline | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from consultation-workspace and gates issue-navigator without merging authority. |
| issue-navigator | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from docket-and-deadline and gates source-proposal without merging authority. |
| source-proposal | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from issue-navigator and gates response-register without merging authority. |
| response-register | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from source-proposal and gates cited-evidence-and-attachments without merging authority. |
| cited-evidence-and-attachments | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from response-register and gates public-disclosure-preview without merging authority. |
| public-disclosure-preview | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from cited-evidence-and-attachments and gates declaration-submit-receipt without merging authority. |
| declaration-submit-receipt | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from public-disclosure-preview and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep the source proposal, active issue response, evidence, and public-disclosure preview simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Keep response and disclosure primary; move the source proposal to an anchored drawer that returns to the exact response.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage one issue with its adjacent clause excerpt, citations and attachments, full public preview, declaration, then submission.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt.

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
| domain states | Preserve the complete domain catalog: docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject split-reference forms, generic document editors, regulatory-comment synthesis, and generic multi-step applications. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [European Commission — Better regulation](https://commission.europa.eu/law/law-making-process/better-regulation_en) | Supports transparent public consultation and evidence contribution. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [US EPA — Commenting on EPA dockets](https://www.epa.gov/dockets/commenting-epa-dockets) | Supports docket identity and public disclosure awareness. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announcing preview, validation, and submission state without moving focus. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "public-consultation-response-workspace",
  "matchedSituationCodes": [
    "AR-PCR-01",
    "AR-PCR-02",
    "AR-PCR-03"
  ],
  "aliases": [
    "public-consultation-response-workspace",
    "consultation response",
    "docket issue response",
    "public disclosure preview"
  ],
  "dominantTask": "Read a proposal or docket, compose responses across multiple issues, bind citations, and preview exactly what will be public.",
  "regions": [
    "consultation-workspace",
    "docket-and-deadline",
    "issue-navigator",
    "source-proposal",
    "response-register",
    "cited-evidence-and-attachments",
    "public-disclosure-preview",
    "declaration-submit-receipt"
  ],
  "relationships": [
    "Issue responses and the public-disclosure preview are independent owners; submission requires both issue coverage and disclosure safety."
  ],
  "responsive": {
    "wide": "Keep the source proposal, active issue response, evidence, and public-disclosure preview simultaneously visible.",
    "intermediate": "Keep response and disclosure primary; move the source proposal to an anchored drawer that returns to the exact response.",
    "compact": "Stage one issue with its adjacent clause excerpt, citations and attachments, full public preview, declaration, then submission.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "consultation-workspace → docket-and-deadline → issue-navigator → source-proposal → response-register → cited-evidence-and-attachments → public-disclosure-preview → declaration-submit-receipt",
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
    "docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt"
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

