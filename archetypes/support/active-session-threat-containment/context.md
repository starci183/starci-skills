# Active session threat containment

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | active-session-threat-containment |
| Family | support |
| Dominant task | Identify suspicious sessions or devices, preserve the current trusted access path, contain threats, and complete credential-recovery follow-up. |
| Search aliases | active-session-threat-containment; session containment; suspicious device revoke; self-lockout prevention |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Identify suspicious sessions or devices, preserve the current trusted access path, contain threats, and complete credential-recovery follow-up.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-AST-01 | Identify suspicious sessions or devices, preserve the current trusted access path, contain threats, and complete credential-recovery follow-up. | required positive evidence |
| AR-AST-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-AST-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-AST-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-AST-90 | Reject operational collections, generic account-security lists, incident command, and credential rotation alone. | reject |
| AR-AST-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-AST-01, AR-AST-02, and AR-AST-03 are evidenced, neither AR-AST-90 nor AR-AST-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
session-containment
├─ current-trusted-session
├─ device-session-groups
├─ sign-in-risk-evidence
├─ suspicious-selection
├─ containment-actions
├─ credential-recovery-followup
└─ security-receipt
~~~

Critical relationship: The current trusted session is a protected invariant; every destructive containment action checks self-lockout risk before execution.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| session-containment | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains current-trusted-session, device-session-groups, sign-in-risk-evidence, suspicious-selection, containment-actions, credential-recovery-followup, security-receipt while preserving each region's independent owner. |
| current-trusted-session | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from session-containment and gates device-session-groups without merging authority. |
| device-session-groups | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from current-trusted-session and gates sign-in-risk-evidence without merging authority. |
| sign-in-risk-evidence | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from device-session-groups and gates suspicious-selection without merging authority. |
| suspicious-selection | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from sign-in-risk-evidence and gates containment-actions without merging authority. |
| containment-actions | Owns editable decision state, validation, and the pending guard for the named stage. | Receives context from suspicious-selection and gates credential-recovery-followup without merging authority. |
| credential-recovery-followup | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from containment-actions and gates security-receipt without merging authority. |
| security-receipt | Owns the bounded outcome, receipt, or recovery route after every upstream gate passes. | Consumes verified state from credential-recovery-followup and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep session groups, risk evidence, current trusted status, suspicious selection, and containment actions simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Make suspicious sessions and risk evidence primary while the current-safe-session status persists.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage current safe session, suspicious session, risk evidence, containment, credential recovery, then security receipt.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt.

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
| domain states | Preserve the complete domain catalog: session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject operational collections, generic account-security lists, incident command, and credential rotation alone. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [NIST — Session management](https://pages.nist.gov/800-63-4/sp800-63b/session/) | Supports session integrity, termination, and reauthentication. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [Google Account Help — Devices with account access](https://support.google.com/accounts/answer/3067630?hl=en) | Supports reviewing device sessions and signing out unfamiliar access. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports keeping destructive-action focus visible around persistent safety status. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "active-session-threat-containment",
  "matchedSituationCodes": [
    "AR-AST-01",
    "AR-AST-02",
    "AR-AST-03"
  ],
  "aliases": [
    "active-session-threat-containment",
    "session containment",
    "suspicious device revoke",
    "self-lockout prevention"
  ],
  "dominantTask": "Identify suspicious sessions or devices, preserve the current trusted access path, contain threats, and complete credential-recovery follow-up.",
  "regions": [
    "session-containment",
    "current-trusted-session",
    "device-session-groups",
    "sign-in-risk-evidence",
    "suspicious-selection",
    "containment-actions",
    "credential-recovery-followup",
    "security-receipt"
  ],
  "relationships": [
    "The current trusted session is a protected invariant; every destructive containment action checks self-lockout risk before execution."
  ],
  "responsive": {
    "wide": "Keep session groups, risk evidence, current trusted status, suspicious selection, and containment actions simultaneously visible.",
    "intermediate": "Make suspicious sessions and risk evidence primary while the current-safe-session status persists.",
    "compact": "Stage current safe session, suspicious session, risk evidence, containment, credential recovery, then security receipt.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "session-containment → current-trusted-session → device-session-groups → sign-in-risk-evidence → suspicious-selection → containment-actions → credential-recovery-followup → security-receipt",
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
    "session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt"
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

