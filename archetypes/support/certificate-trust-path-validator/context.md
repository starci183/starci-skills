# Certificate trust path validator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `certificate-trust-path-validator` |
| Family | Support |
| Dominant task | Explain exactly why a certificate succeeds or fails for one endpoint, policy, and trust store. |
| Search aliases | `certificate chain validator`, `TLS trust path`, `PKIX failure inspector` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Explain exactly why a certificate succeeds or fails for one endpoint, policy, and trust store.
- The selected trust path and parallel hostname, key-usage, time, revocation, transparency, and policy checks jointly own the verdict.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CTV-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-CTV-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-CTV-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-CTV-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-CTV-90` | The dominant task is actually effective-setting provenance. | Reject. |
| `AR-CTV-91` | The dominant task is actually generic dependency graph. | Reject. |
| `AR-CTV-92` | The dominant task is actually credential rotation. | Reject. |
| `AR-CTV-93` | The dominant task is actually record detail without certification-path checks. | Reject. |

### Selection rule

Select `certificate-trust-path-validator` if and only if `AR-CTV-01` through `AR-CTV-04` are evidenced and none of `AR-CTV-90` through `AR-CTV-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `trust-validator` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `endpoint-and-verification-context` | Owns Endpoint And Verification Context evidence or action and preserves its declared relationship to the current selection. |
| `candidate-certificate-chains` | Owns Candidate Certificate Chains evidence or action and preserves its declared relationship to the current selection. |
| `selected-trust-path` | Owns Selected Trust Path evidence or action and preserves its declared relationship to the current selection. |
| `per-certificate-fields-and-validity` | Owns Per Certificate Fields And Validity evidence or action and preserves its declared relationship to the current selection. |
| `hostname-keyusage-policy-checks` | Owns Hostname Keyusage Policy Checks evidence or action and preserves its declared relationship to the current selection. |
| `revocation-and-transparency-evidence` | Owns Revocation And Transparency Evidence evidence or action and preserves its declared relationship to the current selection. |
| `failure-locus` | Owns Failure Locus evidence or action and preserves its declared relationship to the current selection. |
| `remediation` | Owns Remediation evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Candidate chains, selected-certificate detail, and validation checks remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `candidate-certificate-chains` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The chain summary persists while certificate fields and checks alternate in a named evidence pane.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `candidate-certificate-chains` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Verdict → first failed check → trust path → certificate detail → remediation; Back restores the exact failed check.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `candidate-certificate-chains` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation`.
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

Task-specific states: endpoint loading, chain absent, multiple chains, valid, expired, not yet valid, hostname mismatch, usage invalid, revocation unknown, revoked, trust anchor missing, policy pass, policy fail, retry.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `endpoint-and-verification-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `candidate-certificate-chains` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `candidate-certificate-chains` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `failure-locus` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `remediation` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `remediation` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `remediation` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `endpoint-and-verification-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `remediation` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `trust-validator` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Explain exactly why a certificate succeeds or fails for one endpoint, policy, and trust store.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject effective-setting provenance; this is `AR-CTV-90` evidence and must route to an adjacent archetype.
- Reject generic dependency graph; this is `AR-CTV-91` evidence and must route to an adjacent archetype.
- Reject credential rotation; this is `AR-CTV-92` evidence and must route to an adjacent archetype.
- Reject record detail without certification-path checks; this is `AR-CTV-93` evidence and must route to an adjacent archetype.

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
| [IETF RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html) | Certification-path validation, validity, constraints, and revocation processing. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST SP 800-52 Rev. 2](https://csrc.nist.gov/pubs/sp/800/52/r2/final) | TLS certificate and protocol policy guidance. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "certificate-trust-path-validator",
  "situationCodes": ["<matched AR-CTV-* codes>"],
  "searchAliases": ["certificate chain validator","TLS trust path","PKIX failure inspector"],
  "dominantTask": "Explain exactly why a certificate succeeds or fails for one endpoint, policy, and trust store.",
  "regions": ["trust-validator","endpoint-and-verification-context","candidate-certificate-chains","selected-trust-path","per-certificate-fields-and-validity","hostname-keyusage-policy-checks","revocation-and-transparency-evidence","failure-locus","remediation"],
  "regionRelationships": ["The selected trust path and parallel hostname, key-usage, time, revocation, transparency, and policy checks jointly own the verdict."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-certificate-chains",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["endpoint loading","chain absent","multiple chains","valid","expired","not yet valid","hostname mismatch","usage invalid","revocation unknown","revoked","trust anchor missing","policy pass","policy fail","retry"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

