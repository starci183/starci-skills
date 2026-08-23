# Cardiac electrophysiology ablation map workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cardiac-electrophysiology-ablation-map-workbench` |
| Family | Work |
| Dominant task | Map and ablate a cardiac arrhythmia by registering catheter locations, linking spatial map points to intracardiac electrograms and activation/voltage evidence, selecting targets, recording lesion delivery and safety events, then remapping to prove the procedural endpoint |
| Search aliases | cardiac-electrophysiology-ablation-map-workbench, ep-ablation, procedure-record |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `ep-ablation` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CEA-01` | The user must map and ablate a cardiac arrhythmia by registering catheter locations, linking spatial map points to intracardiac electrograms and activation/voltage evidence, selecting targets, recording lesion delivery and safety events, then remapping to prove the procedural endpoint | Require the dominant task. |
| `AR-CEA-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-CEA-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-CEA-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-CEA-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-CEA-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-CEA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `cardiac-electrophysiology-ablation-map-workbench` if and only if `AR-CEA-01` through `AR-CEA-04` are evidenced, every named region and relationship is required, and none of `AR-CEA-90` through `AR-CEA-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ ep-ablation
├─ procedure-rhythm-and-chamber-context
├─ catheter-and-reference-registration
├─ three-dimensional-chamber-map
├─ intracardiac-electrogram-lanes
├─ activation-voltage-and-pace-mapping-layers
├─ candidate-target-and-lesion-set
├─ energy-delivery-and-safety-events
├─ remap-and-endpoint-proof
└─ procedure-record
```

Required relationship: `ep-ablation → procedure-rhythm-and-chamber-context → catheter-and-reference-registration → three-dimensional-chamber-map ↔ intracardiac-electrogram-lanes → activation-voltage-and-pace-mapping-layers → candidate-target-and-lesion-set → energy-delivery-and-safety-events → remap-and-endpoint-proof → procedure-record`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `ep-ablation` | Owns the state and decision of `ep-ablation`; preserves its relationship with downstream `procedure-rhythm-and-chamber-context` without absorbing another region's owner. |
| `procedure-rhythm-and-chamber-context` | Owns the state and decision of `procedure-rhythm-and-chamber-context`; preserves its relationship with upstream `ep-ablation` and downstream `catheter-and-reference-registration` without absorbing another region's owner. |
| `catheter-and-reference-registration` | Owns the state and decision of `catheter-and-reference-registration`; preserves its relationship with upstream `procedure-rhythm-and-chamber-context` and downstream `three-dimensional-chamber-map` without absorbing another region's owner. |
| `three-dimensional-chamber-map` | Owns the state and decision of `three-dimensional-chamber-map`; preserves its relationship with upstream `catheter-and-reference-registration` and downstream `intracardiac-electrogram-lanes` without absorbing another region's owner. |
| `intracardiac-electrogram-lanes` | Owns the state and decision of `intracardiac-electrogram-lanes`; preserves its relationship with upstream `three-dimensional-chamber-map` and downstream `activation-voltage-and-pace-mapping-layers` without absorbing another region's owner. |
| `activation-voltage-and-pace-mapping-layers` | Owns the state and decision of `activation-voltage-and-pace-mapping-layers`; preserves its relationship with upstream `intracardiac-electrogram-lanes` and downstream `candidate-target-and-lesion-set` without absorbing another region's owner. |
| `candidate-target-and-lesion-set` | Owns the state and decision of `candidate-target-and-lesion-set`; preserves its relationship with upstream `activation-voltage-and-pace-mapping-layers` and downstream `energy-delivery-and-safety-events` without absorbing another region's owner. |
| `energy-delivery-and-safety-events` | Owns the state and decision of `energy-delivery-and-safety-events`; preserves its relationship with upstream `candidate-target-and-lesion-set` and downstream `remap-and-endpoint-proof` without absorbing another region's owner. |
| `remap-and-endpoint-proof` | Owns the state and decision of `remap-and-endpoint-proof`; preserves its relationship with upstream `energy-delivery-and-safety-events` and downstream `procedure-record` without absorbing another region's owner. |
| `procedure-record` | Owns the state and decision of `procedure-record`; preserves its relationship with upstream `remap-and-endpoint-proof` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Chamber map, local electrogram lanes, mapping layers, target/lesion register, energy/safety events and remap endpoint remain synchronized; selected point identity persists across projections
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `three-dimensional-chamber-map` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Map plus selected-point electrogram remain primary; layers become explicit switches and lesion/safety/endpoint evidence moves to a synchronized procedure rail
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `three-dimensional-chamber-map` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Verify rhythm/chamber/registration → find one map point by coordinate/list or spatial view → inspect local electrogram → classify target → record lesion and safety response → remap selected region → prove/fail endpoint → procedure record; the 3D map always has a searchable point table and no gesture-only control
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `three-dimensional-chamber-map` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `ep-ablation → procedure-rhythm-and-chamber-context → catheter-and-reference-registration → three-dimensional-chamber-map → intracardiac-electrogram-lanes → activation-voltage-and-pace-mapping-layers → candidate-target-and-lesion-set → energy-delivery-and-safety-events → remap-and-endpoint-proof → procedure-record`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes registration pending/stable/drifted, catheter connected/unavailable, map point collecting/accepted/rejected, electrogram live/frozen/noisy/missing, layer calculating/ready/stale, target candidate/confirmed/rejected, lesion planned/delivering/aborted/completed, safety threshold normal/crossed/recovered, remap pending/changed/no change, endpoint met/not met/indeterminate and procedure record draft/signed.

## State obligations

Task-specific states: registration pending/stable/drifted, catheter connected/unavailable, map point collecting/accepted/rejected, electrogram live/frozen/noisy/missing, layer calculating/ready/stale, target candidate/confirmed/rejected, lesion planned/delivering/aborted/completed, safety threshold normal/crossed/recovered, remap pending/changed/no change, endpoint met/not met/indeterminate and procedure record draft/signed.

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

- Template must select a fictional point through map and point table, synchronize its local electrogram, reveal registration drift, prevent lesion delivery until re-registration, record a safety-threshold abort, remap the treated region, distinguish no-change from unavailable evidence, and sign only after an explicit endpoint verdict
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology can be `multichannel-waveform-analysis-workbench`, `orthogonal-volume-slice-inspector`, `geospatial-raster-layer-analysis-workbench` or `spatial-change-detection-workbench`; registered intracardiac map points, point-linked electrograms, activation/voltage/pace layers, lesion delivery and mandatory remap endpoint proof are all required
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CEA-90`, `AR-CEA-91`, or `AR-CEA-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [Heart Rhythm Society statement on three-dimensional mapping systems](https://www.hrsonline.org/resource/2019-aphrs-expert-consensus-statement-three-dimensional-mapping-systems-tachycardia-developed/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [DICOM cardiac electrophysiology waveform module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.34.7.4.7.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ESC electrophysiology scientific statements](https://www.escardio.org/guidelines/scientific-documents/scientific-statements/arrhythmias-and-electrophysiology/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports reflow and bounded two-dimensional exceptions. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "cardiac-electrophysiology-ablation-map-workbench",
  "matchedSituationCodes": [
    "AR-CEA-01",
    "AR-CEA-02",
    "AR-CEA-03",
    "AR-CEA-04"
  ],
  "aliases": [
    "cardiac-electrophysiology-ablation-map-workbench",
    "ep-ablation",
    "procedure-record"
  ],
  "dominantTask": "Map and ablate a cardiac arrhythmia by registering catheter locations, linking spatial map points to intracardiac electrograms and activation/voltage evidence, selecting targets, recording lesion delivery and safety events, then remapping to prove the procedural endpoint",
  "regions": [
    "ep-ablation",
    "procedure-rhythm-and-chamber-context",
    "catheter-and-reference-registration",
    "three-dimensional-chamber-map",
    "intracardiac-electrogram-lanes",
    "activation-voltage-and-pace-mapping-layers",
    "candidate-target-and-lesion-set",
    "energy-delivery-and-safety-events",
    "remap-and-endpoint-proof",
    "procedure-record"
  ],
  "relationships": [
    "ep-ablation → procedure-rhythm-and-chamber-context → catheter-and-reference-registration → three-dimensional-chamber-map ↔ intracardiac-electrogram-lanes → activation-voltage-and-pace-mapping-layers → candidate-target-and-lesion-set → energy-delivery-and-safety-events → remap-and-endpoint-proof → procedure-record"
  ],
  "responsive": {
    "wide": "Chamber map, local electrogram lanes, mapping layers, target/lesion register, energy/safety events and remap endpoint remain synchronized; selected point identity persists across projections",
    "intermediate": "Map plus selected-point electrogram remain primary; layers become explicit switches and lesion/safety/endpoint evidence moves to a synchronized procedure rail",
    "compact": "Verify rhythm/chamber/registration → find one map point by coordinate/list or spatial view → inspect local electrogram → classify target → record lesion and safety response → remap selected region → prove/fail endpoint → procedure record; the 3D map always has a searchable point table and no gesture-only control",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "ep-ablation → procedure-rhythm-and-chamber-context → catheter-and-reference-registration → three-dimensional-chamber-map → intracardiac-electrogram-lanes → activation-voltage-and-pace-mapping-layers → candidate-target-and-lesion-set → energy-delivery-and-safety-events → remap-and-endpoint-proof → procedure-record",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "three-dimensional-chamber-map",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "registration pending/stable/drifted",
    "catheter connected/unavailable",
    "map point collecting/accepted/rejected",
    "electrogram live/frozen/noisy/missing",
    "layer calculating/ready/stale",
    "target candidate/confirmed/rejected",
    "lesion planned/delivering/aborted/completed",
    "safety threshold normal/crossed/recovered",
    "remap pending/changed/no change",
    "endpoint met/not met/indeterminate and procedure record draft/signed"
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
