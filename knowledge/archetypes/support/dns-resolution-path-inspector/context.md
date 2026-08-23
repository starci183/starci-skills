# DNS resolution path inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dns-resolution-path-inspector` |
| Family | Support |
| Dominant task | Trace one DNS question through recursive hops, delegations, caches, and DNSSEC proof to locate a failure or unexpected answer. |
| Search aliases | `DNS trace`, `delegation inspector`, `DNSSEC proof path` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Trace one DNS question through recursive hops, delegations, caches, and DNSSEC proof to locate a failure or unexpected answer.
- Delegation hierarchy, RRsets, and the DNSSEC proof chain remain separate owners linked by the selected query and hop.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DRP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-DRP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-DRP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-DRP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-DRP-90` | The dominant task is actually distributed trace. | Reject. |
| `AR-DRP-91` | The dominant task is actually streaming logs. | Reject. |
| `AR-DRP-92` | The dominant task is actually certificate path. | Reject. |
| `AR-DRP-93` | The dominant task is actually generic network topology. | Reject. |

### Selection rule

Select `dns-resolution-path-inspector` if and only if `AR-DRP-01` through `AR-DRP-04` are evidenced and none of `AR-DRP-90` through `AR-DRP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dns-inspector` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `query-and-network-context` | Owns Query And Network Context evidence or action and preserves its declared relationship to the current selection. |
| `recursive-hop-sequence` | Owns Recursive Hop Sequence evidence or action and preserves its declared relationship to the current selection. |
| `delegation-and-authority-tree` | Owns Delegation And Authority Tree evidence or action and preserves its declared relationship to the current selection. |
| `rrset-evidence` | Owns Rrset Evidence evidence or action and preserves its declared relationship to the current selection. |
| `dnssec-proof-chain` | Owns Dnssec Proof Chain evidence or action and preserves its declared relationship to the current selection. |
| `timing-and-cache-status` | Owns Timing And Cache Status evidence or action and preserves its declared relationship to the current selection. |
| `failure-locus` | Owns Failure Locus evidence or action and preserves its declared relationship to the current selection. |
| `retry-or-export` | Owns Retry Or Export evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Resolution path, delegation tree, RRsets, timing, and proof evidence remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `recursive-hop-sequence` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The resolution path stays primary while RRset and proof detail move into a named drawer.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `recursive-hop-sequence` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Verdict → ordered hops → selected delegation and RRset → DNSSEC proof → timing and cache → retry.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `recursive-hop-sequence` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export`.
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

Task-specific states: query pending, timeout, cache hit, cache miss, cache stale, delegation valid, delegation lame, RRset empty, RRset conflicting, DNSSEC secure, DNSSEC insecure, DNSSEC bogus, DNSSEC indeterminate, network failure, retry.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `query-and-network-context` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `recursive-hop-sequence` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `recursive-hop-sequence` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `failure-locus` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `retry-or-export` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `retry-or-export` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `retry-or-export` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `query-and-network-context` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `retry-or-export` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `dns-inspector` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Trace one DNS question through recursive hops, delegations, caches, and DNSSEC proof to locate a failure or unexpected answer.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject distributed trace; this is `AR-DRP-90` evidence and must route to an adjacent archetype.
- Reject streaming logs; this is `AR-DRP-91` evidence and must route to an adjacent archetype.
- Reject certificate path; this is `AR-DRP-92` evidence and must route to an adjacent archetype.
- Reject generic network topology; this is `AR-DRP-93` evidence and must route to an adjacent archetype.

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
| [IETF RFC 1034](https://www.rfc-editor.org/rfc/rfc1034.html) | DNS concepts, resolvers, name servers, and delegation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ICANN — Root Server System](https://www.icann.org/root-server-system-en) | Root referrals and resolver traversal of the DNS hierarchy. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "dns-resolution-path-inspector",
  "situationCodes": ["<matched AR-DRP-* codes>"],
  "searchAliases": ["DNS trace","delegation inspector","DNSSEC proof path"],
  "dominantTask": "Trace one DNS question through recursive hops, delegations, caches, and DNSSEC proof to locate a failure or unexpected answer.",
  "regions": ["dns-inspector","query-and-network-context","recursive-hop-sequence","delegation-and-authority-tree","rrset-evidence","dnssec-proof-chain","timing-and-cache-status","failure-locus","retry-or-export"],
  "regionRelationships": ["Delegation hierarchy, RRsets, and the DNSSEC proof chain remain separate owners linked by the selected query and hop."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "recursive-hop-sequence",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["query pending","timeout","cache hit","cache miss","cache stale","delegation valid","delegation lame","RRset empty","RRset conflicting","DNSSEC secure","DNSSEC insecure","DNSSEC bogus","DNSSEC indeterminate","network failure","retry"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

