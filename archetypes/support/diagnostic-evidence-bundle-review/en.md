# Diagnostic evidence bundle review

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | diagnostic-evidence-bundle-review |
| Family | support |
| Dominant task | Assemble diagnostic artifacts from multiple sources, verify completeness and privacy, and export one traceable manifest. |
| Search aliases | diagnostic-evidence-bundle-review; diagnostic evidence bundle review |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Assemble diagnostic artifacts from multiple sources, verify completeness and privacy, and export one traceable manifest.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-DEB-01 | Assemble diagnostic artifacts from multiple sources, verify completeness and privacy, and export one traceable manifest. | required positive evidence |
| AR-DEB-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-DEB-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-DEB-90 | the task is support redaction handoff, upload management, audit detail, streaming logs, or request composition. | reject |
| AR-DEB-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-DEB-01 and AR-DEB-02 are evidenced, neither AR-DEB-90 nor AR-DEB-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
evidence-bundle
├─ diagnostic-question-and-scope
├─ source-capture-status
├─ artifact-register
├─ relationship-and-time-summary
├─ privacy-and-completeness-checks
├─ bundle-manifest-preview
└─ export-or-attach
~~~

Critical relationship: The manifest derives from the artifact register and completed privacy and completeness checks.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| evidence-bundle | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains diagnostic-question-and-scope, source-capture-status, artifact-register, relationship-and-time-summary, privacy-and-completeness-checks, bundle-manifest-preview, export-or-attach while preserving their independent owners. |
| diagnostic-question-and-scope | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients source-capture-status without replacing its owner. |
| source-capture-status | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from diagnostic-question-and-scope and constrains artifact-register without merging their authorities. |
| artifact-register | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from source-capture-status and constrains relationship-and-time-summary without merging their authorities. |
| relationship-and-time-summary | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from artifact-register and constrains privacy-and-completeness-checks without merging their authorities. |
| privacy-and-completeness-checks | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from relationship-and-time-summary and constrains bundle-manifest-preview without merging their authorities. |
| bundle-manifest-preview | Owns the derived interpretation or consequence preview; it never becomes a second input source. | Receives context from privacy-and-completeness-checks and constrains export-or-attach without merging their authorities. |
| export-or-attach | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from bundle-manifest-preview and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep source status, artifact register, and manifest/check summary together; selected detail is temporary.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Collapse source status while artifact register and manifest remain primary.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage capture, artifacts, selected detail, checks, manifest, then export; Back preserves selection and results.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: source unavailable/capturing/complete; artifact unsupported/duplicate/stale; timestamp mismatch; sensitive item; missing required evidence; stale manifest; export pending/failure/ready; permission.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Preserve known anatomy and name the waiting region. | Do not move focus automatically. | Keep the same stage identity. |
| ready | Show internally consistent, product-neutral demo data. | Focus remains at the activating control. | Preserve selection. |
| empty/not-applicable | Explain why content is empty and any valid next step. | Move to recovery only when continuation needs it. | Do not erase other required regions. |
| error/retry | Associate the error with its owner and provide bounded retry. | Multi-error moves to the summary; retry returns to the owner. | Error is not color-only. |
| permission/unavailable | Preserve orientation and explain the limitation. | Do not focus a locked control. | Use the same reason in every topology. |
| pending | Prevent duplicates and preserve the action meaning. | Do not steal focus for progress. | State stays with its action owner. |
| success | Confirm the outcome and a valid continuation. | Move focus only when it helps continuation. | Do not create a second source of truth. |
| stale/conflict | Name the changed version and preserve safe input. | Focus a contextual recovery choice. | Selection survives transformation. |
| domain states | Three mock sources captured; one source remains unavailable with a reason. Duplicate artifact removed while the original timestamp stays traceable. Sensitive value redacted and required evidence is complete. Local manifest exported without upload; artifact hashes and check results are included. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the task is support redaction handoff, upload management, audit detail, streaming logs, or request composition, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [USWDS — File input](https://designsystem.digital.gov/components/file-input/) | Supports file capture state and accessible labeling. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports scan and action relationships in dense records. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports announced dynamic status without unnecessary focus movement. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "diagnostic-evidence-bundle-review",
  "matchedSituationCodes": [
    "AR-DEB-01",
    "AR-DEB-02"
  ],
  "aliases": [
    "diagnostic-evidence-bundle-review",
    "diagnostic evidence bundle review"
  ],
  "dominantTask": "Assemble diagnostic artifacts from multiple sources, verify completeness and privacy, and export one traceable manifest.",
  "regions": [
    "evidence-bundle",
    "diagnostic-question-and-scope",
    "source-capture-status",
    "artifact-register",
    "relationship-and-time-summary",
    "privacy-and-completeness-checks",
    "bundle-manifest-preview",
    "export-or-attach"
  ],
  "relationships": [
    "The manifest derives from the artifact register and completed privacy and completeness checks."
  ],
  "responsive": {
    "wide": "Keep source status, artifact register, and manifest/check summary together; selected detail is temporary.",
    "intermediate": "Collapse source status while artifact register and manifest remain primary.",
    "compact": "Stage capture, artifacts, selected detail, checks, manifest, then export; Back preserves selection and results.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
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
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
