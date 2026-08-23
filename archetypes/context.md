# Archetype authority router

## LOADS

None.

## Record

Archetypes are reusable, product-neutral page topologies. They resolve a page's dominant task, required region
graph and responsive transformation before a routed product Grammar selects semantic owners and before Principles
resolve any remaining geometry. An archetype is not a visual style, component catalogue, route name or business
feature. The same archetype may be consumed by several products and several Grammars.

Each promoted record is a durable, multi-source synthesis of established interaction, adaptive-layout and
accessibility practice. A current or legacy implementation can prove product content, behavior, constraints and
available capability; it does not prove that its macro layout is correct. Apply the selected archetype to the
existing surface as a conformance test instead of treating that surface as a template.

This router is also the search index. Match the request against `Use when`, `Avoid when` and `Search aliases`, then
load only the selected runtime target. Never load the complete shelf merely to choose by resemblance.

Each leaf may carry one `template.html`: a self-contained, responsive illustration of one valid realization. Load
it only after the text record selects the archetype. It can make topology and transformation easier to see, but it
is not a second authority: when markup and record differ, the record wins, and product content or styling is never
copied from the template by default.

## Authority boundary

| Layer | Owns | Must not own |
|---|---|---|
| Archetype | dominant task, required regions, region relationships, wide/intermediate/compact transformations, reading order and interaction parity | product components, tokens, classes, exact breakpoints or business facts |
| Grammar | semantic outcomes and product/profile owners for each resolved region | a replacement macro topology |
| Principles | exact flow, grid, size, gap, overflow, alignment and responsive deltas left unresolved | the page's dominant task or required region set |

## Table of contents and search index

| Category | ID | Use when | Avoid when | Search aliases | Runtime target | Illustrative template |
|---|---|---|---|---|---|---|
| Overview | `overview-dashboard` | a returning user scans heterogeneous status, progress, risk and continuation signals before acting | the items are comparable peers, one bounded task, or one deep analytical dataset | dashboard, overview, home, KPI, cockpit, status hub | `archetypes/overview/overview-dashboard/context.md` | `archetypes/overview/overview-dashboard/template.html` |
| Work | `assessment-workbench` | one finite assessment needs a dominant question stage plus progress, save, review and submit behavior; a question navigator exists only for non-linear movement | one independent question, a linear drill with no whole-session submit, or reading-first content | quiz, exam, assessment, test, question navigator, answer workspace | `archetypes/work/assessment-workbench/context.md` | `archetypes/work/assessment-workbench/template.html` |
| Work | `operational-collection-workbench` | a user repeatedly finds, inspects and acts on comparable operational records while preserving collection context | heterogeneous dashboard signals, card discovery, one short task, narrative detail or finite assessment | worklist, queue, admin table, operations, moderation, master detail, record processing | `archetypes/work/operational-collection-workbench/context.md` | `archetypes/work/operational-collection-workbench/template.html` |
| Task | `centered-single-task` | one short, bounded operation or terminal result deserves the viewport's undivided attention | a long multi-section form, reference material beside the task, or a browse/compare surface | login, sign in, OTP, reset, confirmation, invite, single task | `archetypes/task/centered-single-task/context.md` | `archetypes/task/centered-single-task/template.html` |
| Discovery | `searchable-card-catalog` | comparable peer items are discovered, narrowed and compared through search, filters, sort or view changes | heterogeneous dashboard signals, hierarchical content, or one already-known query result | catalog, catalogue, library, directory, gallery, browse, courses, products | `archetypes/discovery/searchable-card-catalog/context.md` | `archetypes/discovery/searchable-card-catalog/template.html` |
| Detail | `narrative-detail-with-decision-rail` | a long narrative about one subject supports one prominent decision with persistent decisive facts | the supporting region is navigation/outline, peers are being compared, or the task is short and self-contained | detail, product detail, course detail, service detail, pricing rail, enroll, apply | `archetypes/detail/narrative-detail-with-decision-rail/context.md` | `archetypes/detail/narrative-detail-with-decision-rail/template.html` |

## Resolution

1. Record the page's dominant user task, required visible outcomes, candidate regions and known narrow-width
   failures from routed business and current-source evidence.
2. Search this index by need and negative boundary, not by route, product or component name.
3. Load exactly one candidate runtime target and test every recognition sign and boundary in that record.
4. Return one exact match only when its dominant task, required region graph and responsive contract all hold.
5. Compare the current or legacy macro layout with the selected record and store a separate session verdict:
   `conform`, `layout-drift` or `needs-evidence`. A mismatch is corrected as `layout-drift` unless routed business
   truth or an explicit owner-approved exception requires the departure.
6. Preserve the selected archetype through Grammar resolution and Principle compilation. Grammar may bind region
   owners; Principles may resolve exact geometry; neither may delete or silently replace required topology.
7. If no record matches, return `new-required` with the missing dominant-task or region-relationship fact. Do not
   force the nearest archetype. If several match, return the fact that still separates them.

## Laws

1. `ARCHETYPE-1` — Selection is based on dominant task plus region graph plus responsive contract, never on a
   screen name, visual style, product name or existing component.
2. `ARCHETYPE-2` — One page resolves to one primary archetype. A nested independently owned workspace may resolve
   its own archetype only when it has its own state, region graph and interaction boundary.
3. `ARCHETYPE-3` — Wide, intermediate and compact behavior preserve semantic reading order, reachable actions,
   state meaning, keyboard access and recovery. Compact is not "stack every desktop box".
4. `ARCHETYPE-4` — Breakpoints occur when a named relationship fails. Archetypes describe the structural response;
   Principles choose exact measures and emitted classes.
5. `ARCHETYPE-5` — A density change, card count, colour, typography, spacing value or product noun is a variation,
   not a new archetype.
6. `ARCHETYPE-6` — External research and StarCi source are evidence for promoting this shared authority; neither
   becomes a product fact or licenses source-specific component names inside an archetype.
7. `ARCHETYPE-7` — Current and legacy geometry have no correctness veto. Preserve their evidenced product facts,
   behaviors and source owners, but classify conflicting macro topology as `layout-drift`; only binding business
   truth or an explicit owner-approved exception may justify the conflict.
8. `ARCHETYPE-8` — `template.html` illustrates one conforming realization and complete responsive transformation;
   it never overrides the leaf record, becomes product truth or licenses copy-paste implementation.

## Output

Return the selected leaf's exact output fields. The consuming design session stores the separate
`sourceLayoutVerdict: conform | layout-drift | needs-evidence` beside this receipt so source conformance is not
confused with archetype selection:

```text
archetypeId: <id>
situationCodes: <matched codes>
searchAliases: <matched aliases>
dominantTask: <one task>
regions: <required region roles>
regionRelationships: <ordered macro relationships>
responsive:
  wide: <structure>
  intermediate: <failure and response>
  compact: <replacement structure>
  reflow: <preserved order>
  readingOrder: <semantic order>
  navigationReplacement: <none or exact replacement behavior>
  stickyBehavior: <what may persist and its safety boundary>
  overflowOwner: <one owner per axis>
  interactionParity: <actions and states retained>
stateObligations: <required state families>
boundaryVerdict: <accept | reject | needs-evidence>
grammarHandoff: <semantic regions needing product owners>
principlesHandoff: <unresolved geometry axes only>
confidence: <high | medium | low, with evidence>
evidence: <business/current source/research classes, no invented fact>
```

## Stops

- The dominant task or required visible outcome is unknown.
- A candidate matches by name but fails its negative boundary or compact interaction parity.
- Several archetypes remain possible because one material region relationship is undecided.
- The requested structure requires an archetype absent from this index; return `new-required` instead of adapting a
  nearby record beyond its stated boundary.
