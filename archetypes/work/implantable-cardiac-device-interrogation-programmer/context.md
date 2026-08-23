# Implantable cardiac device interrogation programmer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `implantable-cardiac-device-interrogation-programmer` |
| Family | Work |
| Dominant task | Interrogate an implanted cardiac device, correlate battery/lead measurements and detected episodes with electrograms, edit interdependent pacing or therapy-zone settings, run safety and observation checks, and commit a traceable current-versus-proposed program |
| Search aliases | implantable-cardiac-device-interrogation-programmer, cied-programmer, commit-and-exported-interrogation |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `cied-programmer` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-ICD-01` | The user must interrogate an implanted cardiac device, correlate battery/lead measurements and detected episodes with electrograms, edit interdependent pacing or therapy-zone settings, run safety and observation checks, and commit a traceable current-versus-proposed program | Require the dominant task. |
| `AR-ICD-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-ICD-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-ICD-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-ICD-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-ICD-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-ICD-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `implantable-cardiac-device-interrogation-programmer` if and only if `AR-ICD-01` through `AR-ICD-04` are evidenced, every named region and relationship is required, and none of `AR-ICD-90` through `AR-ICD-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ cied-programmer
├─ patient-device-lead-and-session-identity
├─ immutable-interrogation-snapshot
├─ battery-lead-sensing-pacing-and-episode-register
├─ selected-episode-event-markers-and-electrogram
├─ interdependent-mode-zone-and-therapy-program
├─ zone-mode-dependency-and-safety-checks
├─ proposed-versus-current-program
├─ mandatory-program-test-and-observation
└─ commit-and-exported-interrogation
```

Required relationship: `cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram ↔ interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `cied-programmer` | Owns the state and decision of `cied-programmer`; preserves its relationship with downstream `patient-device-lead-and-session-identity` without absorbing another region's owner. |
| `patient-device-lead-and-session-identity` | Owns the state and decision of `patient-device-lead-and-session-identity`; preserves its relationship with upstream `cied-programmer` and downstream `immutable-interrogation-snapshot` without absorbing another region's owner. |
| `immutable-interrogation-snapshot` | Owns the state and decision of `immutable-interrogation-snapshot`; preserves its relationship with upstream `patient-device-lead-and-session-identity` and downstream `battery-lead-sensing-pacing-and-episode-register` without absorbing another region's owner. |
| `battery-lead-sensing-pacing-and-episode-register` | Owns the state and decision of `battery-lead-sensing-pacing-and-episode-register`; preserves its relationship with upstream `immutable-interrogation-snapshot` and downstream `selected-episode-event-markers-and-electrogram` without absorbing another region's owner. |
| `selected-episode-event-markers-and-electrogram` | Owns the state and decision of `selected-episode-event-markers-and-electrogram`; preserves its relationship with upstream `battery-lead-sensing-pacing-and-episode-register` and downstream `interdependent-mode-zone-and-therapy-program` without absorbing another region's owner. |
| `interdependent-mode-zone-and-therapy-program` | Owns the state and decision of `interdependent-mode-zone-and-therapy-program`; preserves its relationship with upstream `selected-episode-event-markers-and-electrogram` and downstream `zone-mode-dependency-and-safety-checks` without absorbing another region's owner. |
| `zone-mode-dependency-and-safety-checks` | Owns the state and decision of `zone-mode-dependency-and-safety-checks`; preserves its relationship with upstream `interdependent-mode-zone-and-therapy-program` and downstream `proposed-versus-current-program` without absorbing another region's owner. |
| `proposed-versus-current-program` | Owns the state and decision of `proposed-versus-current-program`; preserves its relationship with upstream `zone-mode-dependency-and-safety-checks` and downstream `mandatory-program-test-and-observation` without absorbing another region's owner. |
| `mandatory-program-test-and-observation` | Owns the state and decision of `mandatory-program-test-and-observation`; preserves its relationship with upstream `proposed-versus-current-program` and downstream `commit-and-exported-interrogation` without absorbing another region's owner. |
| `commit-and-exported-interrogation` | Owns the state and decision of `commit-and-exported-interrogation`; preserves its relationship with upstream `mandatory-program-test-and-observation` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Device/lead snapshot, selected episode electrogram, programmable settings, dependency warnings, current/proposed diff and test evidence remain simultaneously visible
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `immutable-interrogation-snapshot` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Selected episode or setting group and current/proposed diff remain primary; battery/lead overview becomes a persistent summary rail and detailed test history moves to a drawer
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `immutable-interrogation-snapshot` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify patient/device/leads → freeze and review the interrogation snapshot → inspect one episode through event markers plus an electrogram table alternative → edit one mode/zone/therapy dependency group → resolve safety conflicts → compare current/proposed → run the mandatory test and record observation → commit/export; the dashboard yields to a session sequence, and commit remains unreachable from editing or comparison until test evidence passes
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `immutable-interrogation-snapshot` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram → interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes device identity matched/mismatch, interrogation connecting/complete/interrupted/stale, battery normal/advisory/critical, lead measure stable/out-of-range/unavailable, episode unreviewed/classified, electrogram loading/error, setting valid/conflicting/out-of-range, safety check pending/pass/fail, proposal dirty/reverted, test running/aborted/observed, commit pending/success/failure/rollback and export available/failed.

## State obligations

Task-specific states: device identity matched/mismatch, interrogation connecting/complete/interrupted/stale, battery normal/advisory/critical, lead measure stable/out-of-range/unavailable, episode unreviewed/classified, electrogram loading/error, setting valid/conflicting/out-of-range, safety check pending/pass/fail, proposal dirty/reverted, test running/aborted/observed, commit pending/success/failure/rollback and export available/failed.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, and valid actions through text and semantics. |
| Empty / not-applicable | Distinguish true empty, no-match, and non-applicable states with a valid next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction in text; read-only differs from disabled and retains context. |
| Pending | Prevent duplicates, retain context, allow cancellation when safe, and announce progress. |
| Success | Confirm the exact changed scope, update dependent summaries, and preserve the next valid step. |
| Stale / conflict | Compare local and external state, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus. |
| Responsive presentation | Wide retains simultaneity; intermediate makes low-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Template must load and freeze a fictional interrogation snapshot, connect one lead warning and stored episode to accessible event-marker/electrogram evidence, change a therapy-zone setting that creates a mode dependency conflict, block commit from both edit and diff views until a simulated program test passes, preserve the snapshot plus current/proposed comparison through every topology change, and export a post-commit interrogation receipt
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the result is `multichannel-waveform-analysis-workbench`, `configuration-dependency-resolver`, `live-operations-command-center`, a per-channel programmer or a generic device settings page; waveform viewing and independent channel edits are insufficient. Session-bound interrogation, implanted battery/lead state, stored-episode electrograms, interdependent cardiac modes/zones/therapies, mandatory test/observation and current-versus-proposed commit are all required
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-ICD-90`, `AR-ICD-91`, or `AR-ICD-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves the dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners to regions and states without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit thresholds.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

The research below is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment; every binding claim still routes through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [IHE Patient Care Device technical framework](https://profiles.ihe.net/DEV/index.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [2019 HRS/EHRA/APHRS/LAHRS focused update on ICD programming and testing](https://www.hrsonline.org/resource/2019-hrsehraaphrslahrs-focused-update-2015-expert-consensus-statement-optimal-implantable/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [2023 HRS/EHRA/APHRS/LAHRS consensus on practical management of the remote device clinic](https://www.hrsonline.org/resource/2023-hrsehraaphrslahrs-expert-consensus-statement-practical-management-remote-device-clinic/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "implantable-cardiac-device-interrogation-programmer",
  "matchedSituationCodes": [
    "AR-ICD-01",
    "AR-ICD-02",
    "AR-ICD-03",
    "AR-ICD-04"
  ],
  "aliases": [
    "implantable-cardiac-device-interrogation-programmer",
    "cied-programmer",
    "commit-and-exported-interrogation"
  ],
  "dominantTask": "Interrogate an implanted cardiac device, correlate battery/lead measurements and detected episodes with electrograms, edit interdependent pacing or therapy-zone settings, run safety and observation checks, and commit a traceable current-versus-proposed program",
  "regions": [
    "cied-programmer",
    "patient-device-lead-and-session-identity",
    "immutable-interrogation-snapshot",
    "battery-lead-sensing-pacing-and-episode-register",
    "selected-episode-event-markers-and-electrogram",
    "interdependent-mode-zone-and-therapy-program",
    "zone-mode-dependency-and-safety-checks",
    "proposed-versus-current-program",
    "mandatory-program-test-and-observation",
    "commit-and-exported-interrogation"
  ],
  "relationships": [
    "cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram ↔ interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation"
  ],
  "responsive": {
    "wide": "Device/lead snapshot, selected episode electrogram, programmable settings, dependency warnings, current/proposed diff and test evidence remain simultaneously visible",
    "intermediate": "Selected episode or setting group and current/proposed diff remain primary; battery/lead overview becomes a persistent summary rail and detailed test history moves to a drawer",
    "compact": "Verify patient/device/leads → freeze and review the interrogation snapshot → inspect one episode through event markers plus an electrogram table alternative → edit one mode/zone/therapy dependency group → resolve safety conflicts → compare current/proposed → run the mandatory test and record observation → commit/export; the dashboard yields to a session sequence, and commit remains unreachable from editing or comparison until test evidence passes",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram → interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "immutable-interrogation-snapshot",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "device identity matched/mismatch",
    "interrogation connecting/complete/interrupted/stale",
    "battery normal/advisory/critical",
    "lead measure stable/out-of-range/unavailable",
    "episode unreviewed/classified",
    "electrogram loading/error",
    "setting valid/conflicting/out-of-range",
    "safety check pending/pass/fail",
    "proposal dirty/reverted",
    "test running/aborted/observed",
    "commit pending/success/failure/rollback and export available/failed"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Return no class, token, component, source path, fixed breakpoint, or invented product fact.
