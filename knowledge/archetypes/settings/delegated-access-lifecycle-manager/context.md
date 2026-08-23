# Delegated access lifecycle manager

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | delegated-access-lifecycle-manager |
| Family | settings |
| Dominant task | Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal, and revocation. |
| Search aliases | delegated-access-lifecycle-manager; delegate access; access lifecycle; authority invitation expiry |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity, and state families. |

### Invariants

- Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal, and revocation.
- Each required region has one semantic owner; supporting context never takes over the dominant task.
- DOM order, reading order, and focus order preserve meaning across wide, intermediate, and compact.
- Grammar supplies product facts; Principles resolve exact geometry; the archetype does not own visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-DAL-01 | Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal, and revocation. | required positive evidence |
| AR-DAL-02 | The critical region relationship and owner separation are evidenced. | required relationship evidence |
| AR-DAL-03 | The wide relationship fails, but compact preserves task, state, and recovery. | responsive transformation trigger |
| AR-DAL-04 | Error, permission, pending, success, and stale or conflict states have bounded recovery. | required state evidence |
| AR-DAL-90 | Reject permission matrices, one-time third-party grants, account switchers, and preference centers. | reject |
| AR-DAL-91 | The difference is only a product noun, density, color, component, state skin, or card count. | duplicate-or-variation |

### Selection rule

Return accept only when AR-DAL-01, AR-DAL-02, and AR-DAL-03 are evidenced, neither AR-DAL-90 nor AR-DAL-91 is present, and every required region remains necessary across all three topologies. Return needs-evidence when an owner, relation, or transformation is unresolved.

## Region graph

~~~text
delegation-manager
├─ account-subject
├─ delegate-roster
├─ authority-evidence
├─ scoped-access-bundles
├─ invitation-verification-expiry
├─ effective-access-activity
└─ renew-revoke-recovery
~~~

Critical relationship: Authority proof and lifecycle state distinguish a delegate from a permission cell; effective access derives from verified, unexpired grants.

### Region obligations

| Region ID | Owner | Required relationship |
|---|---|---|
| delegation-manager | Owns the dominant-task boundary and contains every required region without inventing product semantics. | Contains account-subject, delegate-roster, authority-evidence, scoped-access-bundles, invitation-verification-expiry, effective-access-activity, renew-revoke-recovery while preserving each region's independent owner. |
| account-subject | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from delegation-manager and gates delegate-roster without merging authority. |
| delegate-roster | Owns membership, identity, status, and current selection for this bounded collection. | Receives context from account-subject and gates authority-evidence without merging authority. |
| authority-evidence | Owns source evidence, provenance, freshness, and availability; it never decides the outcome. | Receives context from delegate-roster and gates scoped-access-bundles without merging authority. |
| scoped-access-bundles | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from authority-evidence and gates invitation-verification-expiry without merging authority. |
| invitation-verification-expiry | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Receives context from scoped-access-bundles and gates effective-access-activity without merging authority. |
| effective-access-activity | Owns a derived interpretation or consequence preview; it never becomes a second input authority. | Receives context from invitation-verification-expiry and gates renew-revoke-recovery without merging authority. |
| renew-revoke-recovery | Owns the state and obligation of the named stage; it does not take authority from adjacent regions. | Consumes verified state from effective-access-activity and emits the bounded outcome or recovery path. |

## Responsive contract

### Wide

- Topology response: Keep delegate roster, selected authority and grant, invitation lifecycle, and effective-access activity simultaneously visible.
- Failure trigger: simultaneous regions narrow readable measure, obscure state, or break the named relationship.
- Navigation replacement: none while regions remain simultaneous; sticky is limited to orientation context that fits.
- Sticky boundary: yield at short height and never obscure a focused control.
- Overflow owner: the page owns vertical overflow; only an intrinsic matrix owns bounded horizontal overflow.

### Intermediate

- Topology response: Keep delegate selection and lifecycle detail primary; move supporting authority evidence to a drawer.
- Failure trigger: supporting persistence competes with primary-task measure or focus.
- Navigation replacement: a named trigger opens the supporting dialog; Escape or Cancel closes it and focus returns to the exact trigger.
- Sticky boundary: persistent context yields at short height; the dialog body owns bounded vertical overflow.
- Overflow owner: the page retains vertical overflow; the supporting dialog owns only its internal overflow.

### Compact

- Topology response: Stage delegate identity and authority, grant, invitation and verification, effective access, then renewal or revocation.
- Failure trigger: the multi-pane relationship is no longer operable with 16px body text and 44px targets.
- Navigation replacement: Previous, Next, and a stage selector replace pane adjacency; Back preserves selection, draft, and recovery state.
- Sticky boundary: no fixed action bar; focused content remains visible.
- Overflow owner: no page-level horizontal scrolling; an intrinsic matrix becomes grouped records.

### Reflow

The region graph order is the DOM and reading order at every width. CSS does not reorder semantics. Text, localization, zoom, and spacing growth increase region height or trigger a topology change; content is not clipped. State survives movement into and out of the supporting pane.

### Interaction parity

Wide, intermediate, and compact expose the same action, selection, pending guard, success, error, retry, stale or conflict recovery, and outcome. Dynamic status is announced through a polite live region without stealing focus. A modal contains focus, supports Escape or Cancel, and returns focus to its exact trigger.

## State obligations

Domain state catalog: delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery.

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
| domain states | Preserve the complete domain catalog: delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery. | Every modal returns focus to its trigger. | Preserve action and recovery parity. |

## Boundaries

### Accept

Accept when the dominant task needs this exact region graph, the critical relationship creates a distinct topology, and every responsive state preserves task and recovery parity.

### Reject

Reject permission matrices, one-time third-party grants, account switchers, and preference centers. Also reject duplicate-or-variation when the candidate only changes nouns, density, components, or visual state.

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
| [Microsoft Entra — Create an access package](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-access-package-create) | Supports scoped entitlement packages and reviewable policy. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [NIST — Federation and assertions](https://pages.nist.gov/800-63-4/sp800-63c.html) | Supports verified federated identity and assertion boundaries. | Does not prove product facts, geometry, breakpoints, or visual direction. |
| [W3C WAI — Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum) | Supports authentication without unnecessary cognitive barriers. | Does not prove product facts, geometry, breakpoints, or visual direction. |

## Output

~~~json
{
  "archetypeId": "delegated-access-lifecycle-manager",
  "matchedSituationCodes": [
    "AR-DAL-01",
    "AR-DAL-02",
    "AR-DAL-03"
  ],
  "aliases": [
    "delegated-access-lifecycle-manager",
    "delegate access",
    "access lifecycle",
    "authority invitation expiry"
  ],
  "dominantTask": "Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal, and revocation.",
  "regions": [
    "delegation-manager",
    "account-subject",
    "delegate-roster",
    "authority-evidence",
    "scoped-access-bundles",
    "invitation-verification-expiry",
    "effective-access-activity",
    "renew-revoke-recovery"
  ],
  "relationships": [
    "Authority proof and lifecycle state distinguish a delegate from a permission cell; effective access derives from verified, unexpired grants."
  ],
  "responsive": {
    "wide": "Keep delegate roster, selected authority and grant, invitation lifecycle, and effective-access activity simultaneously visible.",
    "intermediate": "Keep delegate selection and lifecycle detail primary; move supporting authority evidence to a drawer.",
    "compact": "Stage delegate identity and authority, grant, invitation and verification, effective access, then renewal or revocation.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "delegation-manager → account-subject → delegate-roster → authority-evidence → scoped-access-bundles → invitation-verification-expiry → effective-access-activity → renew-revoke-recovery",
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
    "delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery"
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

