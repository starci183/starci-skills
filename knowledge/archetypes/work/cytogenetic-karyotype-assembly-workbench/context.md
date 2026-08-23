# Cytogenetic karyotype assembly workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `cytogenetic-karyotype-assembly-workbench` |
| Family | Work |
| Dominant task | Assemble and interpret a cytogenetic karyotype by selecting metaphase cells, pairing chromosome objects into homolog positions, inspecting bands and breakpoints, counting clone/mosaic patterns across cells, validating an ISCN expression, and signing the abnormality conclusion |
| Search aliases | cytogenetic-karyotype-assembly-workbench, karyotype-assembly, abnormality-conclusion-and-signout |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `karyotype-assembly` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CKA-01` | The user must assemble and interpret a cytogenetic karyotype by selecting metaphase cells, pairing chromosome objects into homolog positions, inspecting bands and breakpoints, counting clone/mosaic patterns across cells, validating an ISCN expression, and signing the abnormality conclusion | Require the dominant task. |
| `AR-CKA-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-CKA-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-CKA-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-CKA-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-CKA-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-CKA-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `cytogenetic-karyotype-assembly-workbench` if and only if `AR-CKA-01` through `AR-CKA-04` are evidenced, every named region and relationship is required, and none of `AR-CKA-90` through `AR-CKA-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ karyotype-assembly
├─ specimen-culture-and-metaphase-set
├─ metaphase-cell-gallery
├─ chromosome-object-bin
├─ homolog-pair-karyogram-grid
├─ band-ideogram-and-breakpoint-inspector
├─ clone-and-mosaic-cell-count-ledger
├─ iscn-expression-composer-and-validator
└─ abnormality-conclusion-and-signout
```

Required relationship: `karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid ↔ band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `karyotype-assembly` | Owns the state and decision of `karyotype-assembly`; preserves its relationship with downstream `specimen-culture-and-metaphase-set` without absorbing another region's owner. |
| `specimen-culture-and-metaphase-set` | Owns the state and decision of `specimen-culture-and-metaphase-set`; preserves its relationship with upstream `karyotype-assembly` and downstream `metaphase-cell-gallery` without absorbing another region's owner. |
| `metaphase-cell-gallery` | Owns the state and decision of `metaphase-cell-gallery`; preserves its relationship with upstream `specimen-culture-and-metaphase-set` and downstream `chromosome-object-bin` without absorbing another region's owner. |
| `chromosome-object-bin` | Owns the state and decision of `chromosome-object-bin`; preserves its relationship with upstream `metaphase-cell-gallery` and downstream `homolog-pair-karyogram-grid` without absorbing another region's owner. |
| `homolog-pair-karyogram-grid` | Owns the state and decision of `homolog-pair-karyogram-grid`; preserves its relationship with upstream `chromosome-object-bin` and downstream `band-ideogram-and-breakpoint-inspector` without absorbing another region's owner. |
| `band-ideogram-and-breakpoint-inspector` | Owns the state and decision of `band-ideogram-and-breakpoint-inspector`; preserves its relationship with upstream `homolog-pair-karyogram-grid` and downstream `clone-and-mosaic-cell-count-ledger` without absorbing another region's owner. |
| `clone-and-mosaic-cell-count-ledger` | Owns the state and decision of `clone-and-mosaic-cell-count-ledger`; preserves its relationship with upstream `band-ideogram-and-breakpoint-inspector` and downstream `iscn-expression-composer-and-validator` without absorbing another region's owner. |
| `iscn-expression-composer-and-validator` | Owns the state and decision of `iscn-expression-composer-and-validator`; preserves its relationship with upstream `clone-and-mosaic-cell-count-ledger` and downstream `abnormality-conclusion-and-signout` without absorbing another region's owner. |
| `abnormality-conclusion-and-signout` | Owns the state and decision of `abnormality-conclusion-and-signout`; preserves its relationship with upstream `iscn-expression-composer-and-validator` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Metaphase gallery, unassigned chromosome bin, homolog-pair grid, band/breakpoint inspector, clone ledger and ISCN validator remain simultaneous; every assembled object retains cell provenance
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `metaphase-cell-gallery` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** Homolog grid and selected chromosome/breakpoint remain primary; metaphase gallery collapses to a selector and clone/ISCN evidence alternates in a secondary pane
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `metaphase-cell-gallery` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Select metaphase → review unassigned objects → assign one homolog pair with button/list alternatives to drag → inspect band/breakpoint → update clone counts across cells → compose/validate ISCN → conclusion/signout; no tiny full karyogram is required for editing
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `metaphase-cell-gallery` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid → band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes specimen/culture pending/failed/ready, metaphase accepted/rejected/unavailable, chromosome unassigned/paired/ambiguous, homolog slot empty/complete/conflicting, band coordinate unknown/selected, breakpoint draft/confirmed, clone count incomplete/threshold met/mosaic, ISCN parsing/valid/invalid/stale, conclusion draft/signed/amended and image permission unavailable.

## State obligations

Task-specific states: specimen/culture pending/failed/ready, metaphase accepted/rejected/unavailable, chromosome unassigned/paired/ambiguous, homolog slot empty/complete/conflicting, band coordinate unknown/selected, breakpoint draft/confirmed, clone count incomplete/threshold met/mosaic, ISCN parsing/valid/invalid/stale, conclusion draft/signed/amended and image permission unavailable.

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

- Template must accept/reject fictional metaphases, place chromosomes through both drag and button/select controls, catch a duplicate homolog assignment, inspect a named band breakpoint, reconcile clone counts across at least three cells, focus an ISCN validation error, and preserve the signed prior expression when amended
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the result is `entity-resolution-cluster-adjudicator`, `genomic-locus-read-evidence-inspector`, `canvas-inspector-studio` or `multichannel-microscopy-analysis-workbench`; metaphase-specific chromosome objects, homolog-pair assembly, band/breakpoint semantics, cross-cell clone counts and ISCN validation are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-CKA-90`, `AR-CKA-91`, or `AR-CKA-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [HUGO nomenclature standards including ISCN](https://www.hugo-international.org/standards/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [NCBI Bookshelf karyotyping and cytogenetics](https://www.ncbi.nlm.nih.gov/books/NBK563293/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [PubMed record for ISCN 2024](https://pubmed.ncbi.nlm.nih.gov/39571546/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [published 2026 erratum](https://pubmed.ncbi.nlm.nih.gov/41379737/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard grid semantics. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "cytogenetic-karyotype-assembly-workbench",
  "matchedSituationCodes": [
    "AR-CKA-01",
    "AR-CKA-02",
    "AR-CKA-03",
    "AR-CKA-04"
  ],
  "aliases": [
    "cytogenetic-karyotype-assembly-workbench",
    "karyotype-assembly",
    "abnormality-conclusion-and-signout"
  ],
  "dominantTask": "Assemble and interpret a cytogenetic karyotype by selecting metaphase cells, pairing chromosome objects into homolog positions, inspecting bands and breakpoints, counting clone/mosaic patterns across cells, validating an ISCN expression, and signing the abnormality conclusion",
  "regions": [
    "karyotype-assembly",
    "specimen-culture-and-metaphase-set",
    "metaphase-cell-gallery",
    "chromosome-object-bin",
    "homolog-pair-karyogram-grid",
    "band-ideogram-and-breakpoint-inspector",
    "clone-and-mosaic-cell-count-ledger",
    "iscn-expression-composer-and-validator",
    "abnormality-conclusion-and-signout"
  ],
  "relationships": [
    "karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid ↔ band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout"
  ],
  "responsive": {
    "wide": "Metaphase gallery, unassigned chromosome bin, homolog-pair grid, band/breakpoint inspector, clone ledger and ISCN validator remain simultaneous; every assembled object retains cell provenance",
    "intermediate": "Homolog grid and selected chromosome/breakpoint remain primary; metaphase gallery collapses to a selector and clone/ISCN evidence alternates in a secondary pane",
    "compact": "Select metaphase → review unassigned objects → assign one homolog pair with button/list alternatives to drag → inspect band/breakpoint → update clone counts across cells → compose/validate ISCN → conclusion/signout; no tiny full karyogram is required for editing",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid → band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "metaphase-cell-gallery",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "specimen/culture pending/failed/ready",
    "metaphase accepted/rejected/unavailable",
    "chromosome unassigned/paired/ambiguous",
    "homolog slot empty/complete/conflicting",
    "band coordinate unknown/selected",
    "breakpoint draft/confirmed",
    "clone count incomplete/threshold met/mosaic",
    "ISCN parsing/valid/invalid/stale",
    "conclusion draft/signed/amended and image permission unavailable"
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
