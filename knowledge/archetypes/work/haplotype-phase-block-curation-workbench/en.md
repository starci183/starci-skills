# Haplotype phase block curation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `haplotype-phase-block-curation-workbench` |
| Family | Work |
| Dominant task | Assemble, split, merge, flip and bridge phased haplotype blocks from read, molecule and family linkage evidence while maintaining two explicitly oriented haplotype tracks and exact allele membership, then prove Mendelian and ploidy consistency before exporting a versioned phased callset with unresolved gaps explicit |
| Search aliases | haplotype-phase-block-curation-workbench, phase-curation, phased-callset-export-and-version |
| Authority | Product-neutral page-topology authority; the archetype does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `phase-curation` owns the complete dominant task and recovery boundary.
- Every decision-changing observation retains provenance to the region that produced it.
- The completion gate evaluates every unresolved mandatory region before closure.
- Wide, intermediate, and compact change topology when a named relationship fails.
- Transformation preserves selection, draft, pending work, error recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-HPC-01` | The user must assemble, split, merge, flip and bridge phased haplotype blocks from read, molecule and family linkage evidence while maintaining two explicitly oriented haplotype tracks and exact allele membership, then prove Mendelian and ploidy consistency before exporting a versioned phased callset with unresolved gaps explicit | Require the dominant task. |
| `AR-HPC-02` | Every region in the named graph changes or proves the completion decision. | Require the complete graph and its provenance. |
| `AR-HPC-03` | The named peer or feedback relationship must stay synchronized while evidence changes. | Require synchronized projections and invalidation. |
| `AR-HPC-04` | Work state can become pending, unavailable, stale, conflicting, or recoverable after user input exists. | Require state and recovery parity in all topologies. |
| `AR-HPC-90` | An adjacent archetype named by the hard rejection owns the task more precisely. | Reject. |
| `AR-HPC-91` | A mandatory domain relationship, proof, or completion event is absent. | Reject. |
| `AR-HPC-92` | The candidate differs only by product noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `haplotype-phase-block-curation-workbench` if and only if `AR-HPC-01` through `AR-HPC-04` are evidenced, every named region and relationship is required, and none of `AR-HPC-90` through `AR-HPC-92` is present. Return `needs-evidence` when the dominant task, completion owner, overflow owner, or recovery consequence is unproved.

## Region graph

```text
├─ phase-curation
├─ sample-ploidy-reference-and-callset-version
├─ heterozygous-variant-lane
├─ read-molecule-and-family-linkage-evidence
├─ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership
├─ selected-link-confidence-and-conflict
├─ split-merge-flip-or-bridge-operation
├─ mendelian-and-ploidy-consistency-check
├─ unresolved-gap-and-phase-quality-ledger
└─ phased-callset-export-and-version
```

Required relationship: `phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence ↔ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `phase-curation` | Owns the state and decision of `phase-curation`; preserves its relationship with downstream `sample-ploidy-reference-and-callset-version` without absorbing another region's owner. |
| `sample-ploidy-reference-and-callset-version` | Owns the state and decision of `sample-ploidy-reference-and-callset-version`; preserves its relationship with upstream `phase-curation` and downstream `heterozygous-variant-lane` without absorbing another region's owner. |
| `heterozygous-variant-lane` | Owns the state and decision of `heterozygous-variant-lane`; preserves its relationship with upstream `sample-ploidy-reference-and-callset-version` and downstream `read-molecule-and-family-linkage-evidence` without absorbing another region's owner. |
| `read-molecule-and-family-linkage-evidence` | Owns the state and decision of `read-molecule-and-family-linkage-evidence`; preserves its relationship with upstream `heterozygous-variant-lane` and downstream `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` without absorbing another region's owner. |
| `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` | Owns the state and decision of `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership`; preserves its relationship with upstream `read-molecule-and-family-linkage-evidence` and downstream `selected-link-confidence-and-conflict` without absorbing another region's owner. |
| `selected-link-confidence-and-conflict` | Owns the state and decision of `selected-link-confidence-and-conflict`; preserves its relationship with upstream `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` and downstream `split-merge-flip-or-bridge-operation` without absorbing another region's owner. |
| `split-merge-flip-or-bridge-operation` | Owns the state and decision of `split-merge-flip-or-bridge-operation`; preserves its relationship with upstream `selected-link-confidence-and-conflict` and downstream `mendelian-and-ploidy-consistency-check` without absorbing another region's owner. |
| `mendelian-and-ploidy-consistency-check` | Owns the state and decision of `mendelian-and-ploidy-consistency-check`; preserves its relationship with upstream `split-merge-flip-or-bridge-operation` and downstream `unresolved-gap-and-phase-quality-ledger` without absorbing another region's owner. |
| `unresolved-gap-and-phase-quality-ledger` | Owns the state and decision of `unresolved-gap-and-phase-quality-ledger`; preserves its relationship with upstream `mendelian-and-ploidy-consistency-check` and downstream `phased-callset-export-and-version` without absorbing another region's owner. |
| `phased-callset-export-and-version` | Owns the state and decision of `phased-callset-export-and-version`; preserves its relationship with upstream `unresolved-gap-and-phase-quality-ledger` without absorbing another region's owner. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison or decision context no longer has enough measure for reading, operation, and unobscured focus.
- **Topology response:** Variant lane, both oriented A/B tracks for every selected phase block, linkage evidence, allele-membership conflict/operation controls, family/ploidy checks and unresolved-gap ledger remain simultaneously visible with synchronized variant, track and block selection
- **Navigation replacement:** None while every completion-owning relationship remains directly perceivable.
- **Sticky boundary:** Only current identity or the completion gate may persist after reserving space; short height returns it to normal flow.
- **Overflow owner:** `heterozygous-variant-lane` alone may own bounded task-necessary overflow.

### Intermediate

- **Failure trigger:** The lowest-priority support region cannot persist without compressing the active relationship or obscuring focus.
- **Topology response:** The selected block's two oriented tracks, active allele membership, supporting/conflicting evidence and proposed operation remain primary; the global variant lane, complete family/read evidence and phase-quality ledger move to synchronized drawers
- **Navigation replacement:** A labeled synchronized route opens the exact supporting region and restores query, selection, draft, scroll, and trigger focus.
- **Sticky boundary:** Current identity may persist; temporary support and actions remain in normal flow.
- **Overflow owner:** `heterozygous-variant-lane` retains bounded overflow while supporting details move to resumable views.

### Compact

- **Failure trigger:** Side-by-side operation no longer preserves readable measure, target size, or the named relationship.
- **Topology response:** Open the highest-priority phase conflict → inspect the variant pair or block in a labeled A/B allele-membership table → review a linkage evidence table → split, merge, flip or bridge through buttons/forms → verify the resulting track orientation → rerun Mendelian and ploidy checks → record the next unresolved gap → export; the global graph yields to a block-and-track ledger, and every spatial or drag edit retains a single-pointer and keyboard alternative
- **Navigation replacement:** A labeled one-primary-stage sequence replaces simultaneous panes and exposes a direct bounded review route.
- **Sticky boundary:** Only compact orientation may persist after reserving space; primary actions remain reachable in flow.
- **Overflow owner:** `heterozygous-variant-lane` uses a bounded semantic alternative; the page never owns horizontal scroll.

### Reflow

- DOM order, reading order, and meaningful focus order are `phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence → phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version`.
- CSS never reorders semantic regions.
- Long labels, translation, 400% zoom, and enlarged text wrap without losing actions or state meaning.
- A temporary view focuses its heading and returns to the exact trigger with selection and draft context intact.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag, spatial, chart, image, curve, graph, or map interaction always has a semantic button, list, coordinate, or table alternative.
- A topology change never resets work state or duplicates a pending action.
- Dynamic status uses text and semantics in addition to color, then announces without stealing focus.
- Validation retains input, exposes inline errors, focuses a summary for multiple errors, and supplies a specific recovery.
- Task parity includes callset loading/version-mismatch, variant unphased/phased/conflicted, read/molecule/family evidence available/partial/unavailable, block current/stale/split, link confidence unknown/low/high, operation draft/applied/undone, Mendelian or ploidy check pending/pass/fail/indeterminate, gap unresolved/accepted, export queued/failed/issued/superseded and evidence permission limited.

## State obligations

Task-specific states: callset loading/version-mismatch, variant unphased/phased/conflicted, read/molecule/family evidence available/partial/unavailable, block current/stale/split, link confidence unknown/low/high, operation draft/applied/undone, Mendelian or ploidy check pending/pass/fail/indeterminate, gap unresolved/accepted, export queued/failed/issued/superseded and evidence permission limited.

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

- Template must join two fictional variants into a block from read linkage, assign each allele to one labeled A/B track, surface contradictory family evidence, split then flip or bridge a block through non-drag controls, prove that flip swaps track orientation rather than relation direction, rerun and announce Mendelian/ploidy checks, keep one unresolved gap explicit, undo one operation without losing provenance, and export a new phased-callset version at every width
- Accept a variation only when the dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject when the topology could be `genomic-locus-read-evidence-inspector`, `pedigree-inheritance-risk-workbench`, `entity-resolution-cluster-adjudicator`, `phylogeny-alignment-comparison-explorer` or `archaeological-stratigraphic-phasing-workbench`; read inspection, recurrence risk, record clustering, taxon trees, precedence DAGs, acyclicity, dating evidence or interpretive phase grouping are insufficient. Two explicitly oriented haplotype tracks, one-track allele membership, read/molecule/family linkage, reversible membership operations with track-specific flip semantics and post-operation Mendelian/ploidy validation are mandatory
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-HPC-90`, `AR-HPC-91`, or `AR-HPC-92`. Return `needs-evidence` when business truth does not prove the dominant task, relationship, overflow owner, or completion consequence.

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
| [GA4GH VCF 4.5 specification](https://samtools.github.io/hts-specs/VCFv4.5.pdf) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [GA4GH VRS Cis-Phased Block](https://vrs.ga4gh.org/en/stable/concepts/MolecularVariation/CisPhasedBlock.html) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [ClinGen PM3 in-trans guidance](https://www.clinicalgenome.org/docs/pm3-recommendation-for-in-trans-criterion-pm3-version-1.0/) | Supports task-domain workflow and evidence obligations. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [WAI-ARIA APG — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports hierarchical grid semantics. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports single-pointer alternatives to drag. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports semantic and focus order. | Does not prove product truth, exact geometry, breakpoints, components, or visual direction. |

## Output

```json
{
  "archetypeId": "haplotype-phase-block-curation-workbench",
  "matchedSituationCodes": [
    "AR-HPC-01",
    "AR-HPC-02",
    "AR-HPC-03",
    "AR-HPC-04"
  ],
  "aliases": [
    "haplotype-phase-block-curation-workbench",
    "phase-curation",
    "phased-callset-export-and-version"
  ],
  "dominantTask": "Assemble, split, merge, flip and bridge phased haplotype blocks from read, molecule and family linkage evidence while maintaining two explicitly oriented haplotype tracks and exact allele membership, then prove Mendelian and ploidy consistency before exporting a versioned phased callset with unresolved gaps explicit",
  "regions": [
    "phase-curation",
    "sample-ploidy-reference-and-callset-version",
    "heterozygous-variant-lane",
    "read-molecule-and-family-linkage-evidence",
    "phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership",
    "selected-link-confidence-and-conflict",
    "split-merge-flip-or-bridge-operation",
    "mendelian-and-ploidy-consistency-check",
    "unresolved-gap-and-phase-quality-ledger",
    "phased-callset-export-and-version"
  ],
  "relationships": [
    "phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence ↔ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version"
  ],
  "responsive": {
    "wide": "Variant lane, both oriented A/B tracks for every selected phase block, linkage evidence, allele-membership conflict/operation controls, family/ploidy checks and unresolved-gap ledger remain simultaneously visible with synchronized variant, track and block selection",
    "intermediate": "The selected block's two oriented tracks, active allele membership, supporting/conflicting evidence and proposed operation remain primary; the global variant lane, complete family/read evidence and phase-quality ledger move to synchronized drawers",
    "compact": "Open the highest-priority phase conflict → inspect the variant pair or block in a labeled A/B allele-membership table → review a linkage evidence table → split, merge, flip or bridge through buttons/forms → verify the resulting track orientation → rerun Mendelian and ploidy checks → record the next unresolved gap → export; the global graph yields to a block-and-track ledger, and every spatial or drag edit retains a single-pointer and keyboard alternative",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence → phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "heterozygous-variant-lane",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "callset loading/version-mismatch",
    "variant unphased/phased/conflicted",
    "read/molecule/family evidence available/partial/unavailable",
    "block current/stale/split",
    "link confidence unknown/low/high",
    "operation draft/applied/undone",
    "Mendelian or ploidy check pending/pass/fail/indeterminate",
    "gap unresolved/accepted",
    "export queued/failed/issued/superseded and evidence permission limited"
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
