# Credential rotation cutover console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | credential-rotation-cutover-console |
| Family | settings |
| Dominant task | Rotate one credential through old/new overlap, prove every consumer migrated, then disable and irreversibly retire the old credential. |
| Search aliases | credential-rotation-cutover-console; credential rotation cutover console |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Rotate one credential through old/new overlap, prove every consumer migrated, then disable and irreversibly retire the old credential.
- Each region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CRC-01 | Rotate one credential through old/new overlap, prove every consumer migrated, then disable and irreversibly retire the old credential. | required positive evidence |
| AR-CRC-02 | Every required region and critical relationship has an independent owner. | required positive evidence |
| AR-CRC-03 | The wide relationship stops working, but compact must preserve task, state, and recovery. | transformation trigger |
| AR-CRC-90 | the page is a checklist, dependency resolver, credential inventory, deployment monitor, or independent row migration tool. | reject |
| AR-CRC-91 | The difference is only a product noun, density, color, component, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-CRC-01 and AR-CRC-02 are evidenced, neither AR-CRC-90 nor AR-CRC-91 is present, and the region graph remains necessary across all three topologies. Return needs-evidence when an owner or transformation is unresolved.

## Region graph

~~~text
rotation-console
├─ credential-identity-and-risk
├─ old-and-new-credential-state
├─ dependent-consumer-migration-ledger
├─ selected-consumer-proof
├─ overlap-window-and-cutover-controls
├─ global-verification-evidence
├─ disable-grace-and-destroy-transaction
└─ completion-receipt
~~~

Critical relationship: Dual-live state, per-consumer proof, aggregate verification, grace, and irreversible destruction are separate gates.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| rotation-console | Owns the bounded page task and contains every required region; it does not invent product semantics. | Contains credential-identity-and-risk, old-and-new-credential-state, dependent-consumer-migration-ledger, selected-consumer-proof, overlap-window-and-cutover-controls, global-verification-evidence, disable-grace-and-destroy-transaction, completion-receipt while preserving their independent owners. |
| credential-identity-and-risk | Owns stable subject, scope, and orientation facts for every downstream decision. | Orients old-and-new-credential-state without replacing its owner. |
| old-and-new-credential-state | Owns this named task fact or stage and no neighboring region's decision authority. | Receives context from credential-identity-and-risk and constrains dependent-consumer-migration-ledger without merging their authorities. |
| dependent-consumer-migration-ledger | Owns membership, item identity, status, and the current selection for this bounded collection. | Receives context from old-and-new-credential-state and constrains selected-consumer-proof without merging their authorities. |
| selected-consumer-proof | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from dependent-consumer-migration-ledger and constrains overlap-window-and-cutover-controls without merging their authorities. |
| overlap-window-and-cutover-controls | Owns the currently selected input or choice and preserves its pending and recovery state. | Receives context from selected-consumer-proof and constrains global-verification-evidence without merging their authorities. |
| global-verification-evidence | Owns traceable supporting evidence and its freshness, availability, and permission state. | Receives context from overlap-window-and-cutover-controls and constrains disable-grace-and-destroy-transaction without merging their authorities. |
| disable-grace-and-destroy-transaction | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Receives context from global-verification-evidence and constrains completion-receipt without merging their authorities. |
| completion-receipt | Owns the bounded completion, verification, or recovery transaction and prevents duplicate execution. | Consumes verified state from disable-grace-and-destroy-transaction and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Keep old/new states, consumer ledger, and global verification simultaneously comparable.
- Failure trigger: simultaneous regions narrow content, obscure state, or break owner relationships.
- Navigation replacement is unnecessary while regions remain simultaneous; sticky is allowed only for context that fits.
- The page owns vertical overflow; only an intrinsically two-dimensional region may own bounded overflow.

### Intermediate

- Persist the dual-state summary, keep the ledger primary, and move selected proof into the temporary pane.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- A named trigger opens the temporary pane; Escape closes it and focus returns to the trigger.
- Sticky behavior yields at short height; the page remains the overflow owner.

### Compact

- Stage rotation summary, each consumer proof, cutover, global verification, grace, destroy or recovery, then receipt.
- Failure trigger: multiple panes are no longer simultaneously operable with 16px text and 44px targets.
- Previous, Next, and a stage selector replace pane adjacency; Back preserves selection and draft.
- No page-level horizontal scrolling is allowed; sticky or fixed surfaces never obscure content or focus.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder it. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. Region state survives movement into and out of the temporary pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale/conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A dialog contains focus, supports Escape or cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: preparing; old-only; new staged; dual-active; consumer pending/migrated/failed/unknown; overlap expiring; verification running/partial/pass/fail; cutover conflict; disabled/grace; pre-destruction cutback; destroy locked/pending/failed/irreversible; forward rotation; completion receipt.

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
| domain states | Alpha migrated to the new credential with textual proof. Beta migrated; every known consumer now has proof. Aggregate verification passed across all consumers; disable is unlocked. Old credential disabled in grace; cutback remains available before destruction. Old credential destroyed irreversibly; recovery now requires forward rotation. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, its critical relationship creates a distinct topology, and all responsive states preserve task and recovery parity.

### Reject

Reject when the page is a checklist, dependency resolver, credential inventory, deployment monitor, or independent row migration tool, or when the candidate only changes nouns, cards, or density from another archetype.

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
| [Google Cloud — Secret Manager rotation recommendations](https://docs.cloud.google.com/secret-manager/docs/rotation-recommendations) | Supports rotation schedule and operational separation. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [NIST SP 800-57 Part 1 Rev. 5](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf) | Supports key lifecycle and destruction risk. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Tables tutorial](https://www.w3.org/WAI/tutorials/tables/) | Supports semantic association for tabular consumer evidence. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "credential-rotation-cutover-console",
  "matchedSituationCodes": [
    "AR-CRC-01",
    "AR-CRC-02"
  ],
  "aliases": [
    "credential-rotation-cutover-console",
    "credential rotation cutover console"
  ],
  "dominantTask": "Rotate one credential through old/new overlap, prove every consumer migrated, then disable and irreversibly retire the old credential.",
  "regions": [
    "rotation-console",
    "credential-identity-and-risk",
    "old-and-new-credential-state",
    "dependent-consumer-migration-ledger",
    "selected-consumer-proof",
    "overlap-window-and-cutover-controls",
    "global-verification-evidence",
    "disable-grace-and-destroy-transaction",
    "completion-receipt"
  ],
  "relationships": [
    "Dual-live state, per-consumer proof, aggregate verification, grace, and irreversible destruction are separate gates."
  ],
  "responsive": {
    "wide": "Keep old/new states, consumer ledger, and global verification simultaneously comparable.",
    "intermediate": "Persist the dual-state summary, keep the ledger primary, and move selected proof into the temporary pane.",
    "compact": "Stage rotation summary, each consumer proof, cutover, global verification, grace, destroy or recovery, then receipt.",
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
