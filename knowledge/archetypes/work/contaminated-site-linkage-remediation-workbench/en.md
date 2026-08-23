# Contaminated Site Linkage Remediation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `contaminated-site-linkage-remediation-workbench` |
| Family | Work |
| Dominant task | Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence. |
| Search aliases | `contaminated`, `linkage`, `remediation`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence.
- The required region graph remains `site-remediation → site-use-geology-and-objectives → contaminant-source-register → pathway-and-environmental-media-network ↔ receptor-register → sample-location-result-and-criteria-evidence → complete-incomplete-and-uncertain-linkage-matrix → remedy-options-bound-to-link-breaks → residual-risk-and-monitoring-model → selected-remedy-and-verification-plan`.
- The mandatory relationship remains: risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must assemble one complete and one uncertain linkage, bind samples and criteria to each, reject a remedy that leaves a pathway intact, select a remedy that breaks the material link and define monitoring plus verification for residual risk.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-17-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-17-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-17-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-17-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-17-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-17-90` | The dominant task is actually `risk-bow-tie-control-overview`. | Reject. |
| `AR-B13-17-91` | The dominant task is actually `evidence-led-case-resolution-dossier`. | Reject. |
| `AR-B13-17-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `contaminated-site-linkage-remediation-workbench` only when `AR-B13-17-01` through `AR-B13-17-05` are evidenced and none of `AR-B13-17-90` through `AR-B13-17-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
site-remediation
└─ site-use-geology-and-objectives
   └─ contaminant-source-register
      └─ pathway-and-environmental-media-network
         ↔─ receptor-register
            └─ sample-location-result-and-criteria-evidence
               └─ complete-incomplete-and-uncertain-linkage-matrix
                  └─ remedy-options-bound-to-link-breaks
                     └─ residual-risk-and-monitoring-model
                        └─ selected-remedy-and-verification-plan
```

- Required relationship: risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `site-remediation` | Owns evidence, state, and action for site remediation without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `site-use-geology-and-objectives` | Owns evidence, state, and action for site use geology and objectives without borrowing product semantics. | Follows `site-remediation` in semantic order and receives its verified context. |
| `contaminant-source-register` | Owns evidence, state, and action for contaminant source register without borrowing product semantics. | Follows `site-use-geology-and-objectives` in semantic order and receives its verified context. |
| `pathway-and-environmental-media-network` | Owns evidence, state, and action for pathway and environmental media network without borrowing product semantics. | Follows `contaminant-source-register` in semantic order and receives its verified context. |
| `receptor-register` | Owns evidence, state, and action for receptor register without borrowing product semantics. | Synchronizes bidirectionally with `pathway-and-environmental-media-network` in the same selection context. |
| `sample-location-result-and-criteria-evidence` | Owns evidence, state, and action for sample location result and criteria evidence without borrowing product semantics. | Follows `receptor-register` in semantic order and receives its verified context. |
| `complete-incomplete-and-uncertain-linkage-matrix` | Owns evidence, state, and action for complete incomplete and uncertain linkage matrix without borrowing product semantics. | Follows `sample-location-result-and-criteria-evidence` in semantic order and receives its verified context. |
| `remedy-options-bound-to-link-breaks` | Owns evidence, state, and action for remedy options bound to link breaks without borrowing product semantics. | Follows `complete-incomplete-and-uncertain-linkage-matrix` in semantic order and receives its verified context. |
| `residual-risk-and-monitoring-model` | Owns evidence, state, and action for residual risk and monitoring model without borrowing product semantics. | Follows `remedy-options-bound-to-link-breaks` in semantic order and receives its verified context. |
| `selected-remedy-and-verification-plan` | Owns evidence, state, and action for selected remedy and verification plan without borrowing product semantics. | Follows `residual-risk-and-monitoring-model` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Site/context map, linkage network, sample evidence, linkage matrix and remedy/residual-risk comparison remain visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Selected linkage and remedy evidence remain primary; complete site map, source/receptor registers and monitoring history move to drawers.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Receptor or source → candidate pathway → sample/criteria evidence → linkage verdict → remedy break point → residual risk/monitoring → select and verify; every map path has a semantic chain alternative.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `site-remediation → site-use-geology-and-objectives → contaminant-source-register → pathway-and-environmental-media-network ↔ receptor-register → sample-location-result-and-criteria-evidence → complete-incomplete-and-uncertain-linkage-matrix → remedy-options-bound-to-link-breaks → residual-risk-and-monitoring-model → selected-remedy-and-verification-plan`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must assemble one complete and one uncertain linkage, bind samples and criteria to each, reject a remedy that leaves a pathway intact, select a remedy that breaks the material link and define monitoring plus verification for residual risk.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `site-use-geology-and-objectives` | Identify the pending owner and preserve its semantic position. |
| Ready | `contaminant-source-register` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `pathway-and-environmental-media-network` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `receptor-register` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `sample-location-result-and-criteria-evidence` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `residual-risk-and-monitoring-model` | Prevent duplicate action and announce progress without moving focus. |
| Success | `selected-remedy-and-verification-plan` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `site-use-geology-and-objectives` | Keep the last safe value and require explicit recovery. |
| Focus transition | `selected-remedy-and-verification-plan` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `site-remediation` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: site model draft/current/stale, source suspected/confirmed/removed, pathway plausible/complete/interrupted/uncertain, receptor present/absent/future, sample planned/pending/qualified/rejected, criterion applicable/disputed, linkage material/not-material/unknown, remedy untested/effective/insufficient, residual risk acceptable/unacceptable and verification pending/complete/failed.

## Boundaries

### Accept

- Accept when the dominant task is: Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `risk-bow-tie-control-overview`, `evidence-led-case-resolution-dossier`, map-led monitor or impact-likelihood matrix; site-specific environmental media, source–pathway–receptor completeness, sampling criteria, remedy-to-linkage break semantics and residual verification are mandatory—there is no single central event.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources are current official pages verified during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Environment Agency LCRM Stage 1](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm/lcrm-stage-1-risk-assessment) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Land contamination risk management](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA Superfund risk assessment](https://www.epa.gov/risk/superfund-risk-assessment) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "contaminated-site-linkage-remediation-workbench",
  "situationCodes": [
    "<matched AR-B13-17-* codes>"
  ],
  "searchAliases": [
    "contaminated",
    "linkage",
    "remediation",
    "workbench"
  ],
  "dominantTask": "Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence.",
  "regions": [
    "site-remediation",
    "site-use-geology-and-objectives",
    "contaminant-source-register",
    "pathway-and-environmental-media-network",
    "receptor-register",
    "sample-location-result-and-criteria-evidence",
    "complete-incomplete-and-uncertain-linkage-matrix",
    "remedy-options-bound-to-link-breaks",
    "residual-risk-and-monitoring-model",
    "selected-remedy-and-verification-plan"
  ],
  "relationships": [
    "risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes."
  ],
  "responsive": {
    "wide": "Site/context map, linkage network, sample evidence, linkage matrix and remedy/residual-risk comparison remain visible.",
    "intermediate": "Selected linkage and remedy evidence remain primary; complete site map, source/receptor registers and monitoring history move to drawers.",
    "compact": "Receptor or source → candidate pathway → sample/criteria evidence → linkage verdict → remedy break point → residual risk/monitoring → select and verify; every map path has a semantic chain alternative.",
    "reflow": [
      "site-remediation",
      "site-use-geology-and-objectives",
      "contaminant-source-register",
      "pathway-and-environmental-media-network",
      "receptor-register",
      "sample-location-result-and-criteria-evidence",
      "complete-incomplete-and-uncertain-linkage-matrix",
      "remedy-options-bound-to-link-breaks",
      "residual-risk-and-monitoring-model",
      "selected-remedy-and-verification-plan"
    ]
  },
  "stateObligations": "site model draft/current/stale, source suspected/confirmed/removed, pathway plausible/complete/interrupted/uncertain, receptor present/absent/future, sample planned/pending/qualified/rejected, criterion applicable/disputed, linkage material/not-material/unknown, remedy untested/effective/insufficient, residual risk acceptable/unacceptable and verification pending/complete/failed.",
  "boundaryVerdict": "accept | reject | needs-evidence | duplicate-or-variation",
  "grammarHandoff": "Bind product-specific owners, labels, permissions, actions, and truthful states.",
  "principlesHandoff": "Resolve exact geometry, measure, spacing, alignment, overflow, and relationship-driven transitions.",
  "confidence": "high | medium | low",
  "evidenceClasses": [
    "dominant-task",
    "region-graph",
    "responsive-parity",
    "state-family",
    "boundary",
    "official-research"
  ]
}
```
