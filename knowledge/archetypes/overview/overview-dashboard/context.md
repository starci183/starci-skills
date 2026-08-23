# Overview dashboard

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype id | `overview-dashboard` |
| Family | Overview |
| Dominant task | Scan several unlike signals about one current scope, understand what deserves attention, and choose the next action or drill-down. |
| Search aliases | `dashboard`, `home dashboard`, `overview`, `status overview`, `KPI overview`, `operational overview`, `role overview`, `command center`, `cockpit`, `progress dashboard`, `activity dashboard`, `trang tổng quan`, `bảng điều khiển`, `màn hình tổng quan`, `bảng tiến độ` |
| Authority level | Shared, product-neutral macro topology. |

### Authority statement

This archetype decides which semantic regions an overview needs, their relative priority, their reading
order, and how simultaneous regions transform when space or content pressure removes simultaneity. It
does not decide product meaning, named source owners, visual styling, exact geometry, implementation
components, tokens, classes, or numeric breakpoints.

Rectangular summaries are not evidence for this archetype. The deciding fact is a recurring scan-to-act
task over heterogeneous signals belonging to one current actor, role, place, programme, operation, or
other scope.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-OD-01` | One return surface brings together several unlike signal families about one current scope. | Candidate. |
| `AR-OD-02` | The user scans for meaning or urgency and then chooses where to continue; reading every region in sequence is not the task. | Required for selection. |
| `AR-OD-03` | Regions have a stable relative priority: continuation, risk, deadline, progress, and activity are not interchangeable. | Preserve the hierarchy in every presentation. |
| `AR-OD-04` | Regions can load, refresh, become empty, become stale, or fail on different lifecycles. | Give each affected region an independent state owner. |
| `AR-OD-05` | Available space no longer permits the wide regions to remain simultaneous. | Transform to the declared intermediate or compact reading order without losing access. |
| `AR-OD-06` | The content is a homogeneous set of peer items whose main task is browse, filter, and comparison. | Reject; resolve a catalog or collection archetype. |
| `AR-OD-07` | One short task or one object dominates and surrounding summaries are incidental. | Reject; resolve a focused task or detail archetype. |
| `AR-OD-08` | The dominant task is sustained analysis of one dataset through dense controls, cross-filtering, or direct manipulation. | Reject; resolve an analytical workspace. |

### Resolver

Select `overview-dashboard` only when both `AR-OD-01` and `AR-OD-02` are evidenced and none of
`AR-OD-06`, `AR-OD-07`, or `AR-OD-08` better describes the dominant task. Apply
`AR-OD-03`, `AR-OD-04`, and `AR-OD-05` whenever their facts occur; they are obligations, not
optional variants.

Resolve from the user's recurring job and the relationships between information families. Do not
resolve from the number of boxes, the presence of charts, a route called “dashboard”, or resemblance to
a reference image. When evidence is mixed, name the action the surface exists to make easier and exclude
the closest boundary before selecting this archetype.

## Region graph

### Canonical regions

```text
context-header
└─ overview-body
   ├─ identity-and-summary-region
   └─ prioritized-main-region
      ├─ primary-continuation
      ├─ status-and-progress
      ├─ alerts-or-deadlines
      └─ secondary-activity
```

- `context-header` identifies the current scope and the time, mode, or status needed to interpret it.
  It is page context, not the product's global shell.
- `identity-and-summary-region` answers whose or what overview this is and supplies the smallest stable
  summary needed before detailed signals make sense.
- `primary-continuation` exposes the highest-value next step or drill-down available now.
- `status-and-progress` explains movement, completion, health, or standing over a meaningful interval.
- `alerts-or-deadlines` carries exceptional attention claims whose urgency can change ordinary order.
- `secondary-activity` provides recent or lower-priority context without competing with the next step.

A product does not manufacture content for every leaf. An absent leaf is omitted with its meaning and
space; it is not replaced by a decorative empty region. The two top-level body responsibilities and at
least one decision-driving main leaf must remain identifiable.

### Relationship invariants

1. The context header precedes the overview body in logical reading order.
2. Identity and summary establish scope before the prioritized main region, even when wide presentation
   places them side by side.
3. Main leaves are ranked responsibilities, not an interchangeable mosaic. Visual area never silently
   rewrites priority.
4. An urgent alert may precede primary continuation only when business severity justifies interruption;
   ordinary activity never does.
5. A region may lead to deeper work, but the dashboard does not absorb that workflow merely to keep the
   user on one surface.
6. State ownership follows semantic regions, so one slow or failed region does not erase unaffected
   context or actions.

## Responsive contract

### Wide

- Present `identity-and-summary-region` and `prioritized-main-region` simultaneously when both retain
  useful measure. The summary may be a supporting rail or leading band according to product grammar.
- Continuation and time-critical information receive the first reading positions. Status, progress, and
  activity may share rows only when hierarchy remains legible.
- Keep one page-level vertical reading flow. Local overflow is allowed only when the information
  intrinsically requires it; the page does not gain a decorative horizontal browsing axis.
- Sticky behaviour is earned by a persistent task, not spare wide space. No overview region is sticky
  by default.

### Intermediate

- Transform when summary, labels, actions, or main signals cease to remain usable together; do not
  infer a device category.
- Reduce simultaneous groupings before compressing their content. Identity and summary may become a
  leading band, a shorter summary, or the first section in flow.
- Keep primary continuation and any urgent alert ahead of secondary activity. Secondary regions move
  lower; they do not disappear.
- If a wide rail carried local navigation, replace it with an in-flow navigation summary or an explicit
  reveal control whose current state remains visible.

### Compact

- Use one principal vertical flow: context, identity or scope summary, urgent attention when present,
  primary continuation, status and progress, then secondary activity.
- Remove side-by-side dependence. A summary may be concise or progressively disclosed, but essential
  scope and status remain visible before dependent content.
- Every wide action remains reachable near the content it affects. Do not collect unrelated actions
  into one ambiguous compact control.
- Prefer page scrolling. A locally scrollable region must have an intrinsic two-dimensional reason and
  must not trap ordinary reading or keyboard movement.
- Persistent top or bottom actions are allowed only when genuinely cross-region and unable to cover
  focused content, status, or the end of the page.

### Reflow

- Reflow follows content stress: narrow space, enlarged text, zoom, long translations, long identifiers,
  changed writing direction, and user-generated content exercise the same contract.
- Preserve semantic source order. Visual rearrangement must not make visual, keyboard, and
  assistive-technology reading sequences disagree.
- Text and ordinary regions reflow without page-level two-dimensional scrolling or loss. An intrinsically
  two-dimensional chart or diagram owns its bounded exception and provides an equivalent summary or route
  to the same facts.
- Long labels and values wrap or gain an accessible reveal path; truncation is never the only route to
  meaning. Region headings and their actions remain associated after wrapping.
- Loading, empty, error, stale, and populated presentations retain the same region order so asynchronous
  completion cannot reshuffle the dashboard.

### Interaction parity

- Every action, drill-down, explanation, refresh, recovery path, and state available wide remains
  reachable at intermediate and compact presentations.
- Replaced navigation preserves current location and the same destinations. Closing disclosed content
  returns focus to its opener.
- Refresh and retry preserve current scope and do not move focus or reading position without an
  announced reason.
- Information encoded by adjacency or colour wide gains a textual or structural equivalent after reflow.
- Region order changes only through the declared priority rule; response arrival, personalization, and
  viewport changes do not silently change page meaning.

## State obligations

### Required state matrix

| State | Owning region | Obligation |
|---|---|---|
| Initial load | Each data-bearing region | Reserve semantic position and identify what is pending without blocking known page context. |
| Incremental refresh | Refreshed region | Keep the previous safe value, mark refresh activity, and avoid resetting unrelated regions. |
| Partial data | Affected region and dependants | State what is present and unavailable; never present incomplete data as a complete overview. |
| Stale data | Affected region | Expose staleness and recovery while retaining the last safe interpretation. |
| Empty region | Affected region | Explain meaningful absence or omit an optional leaf; never imitate loading. |
| Whole-overview empty | Overview body | Explain why no signals exist and provide the next valid route when one exists. |
| Recoverable error | Affected region | Keep unaffected regions usable and provide a local retry or alternate route. |
| Scope or authorization failure | Page context | Prevent misleading cross-scope data, identify the blocked scope, and provide safe recovery or exit. |
| New urgent signal | Alerts or deadlines | Announce without unexpectedly stealing focus; reorder only under the declared severity rule. |

### State invariants

1. One region's latency or failure does not create a full-page loading or error state while page context
   and other regions remain valid.
2. Loading, empty, unavailable, stale, and error carry distinct meanings.
3. Placeholder completion does not change logical order or make the primary task jump between regions.
4. A derived summary discloses incomplete source regions and never reports false certainty.
5. Recovery is owned as locally as the failure unless page identity, authorization, or scope is invalid.

## Boundaries

### Use when

- A person returns periodically to orient before choosing among several meaningful next moves.
- Multiple signal families describe one current scope with unequal urgency or decision value.
- A big-picture view remains useful even though detailed work happens elsewhere.
- Partial availability must degrade region by region rather than collapse the page.

### Refuse and route

| Evidence | Refusal | Route |
|---|---|---|
| `AR-OD-06`: peer items share one comparable anatomy and discovery controls determine the result set. | The surface is a collection, even if every item is boxed. | `searchable-card-catalog` or another collection archetype. |
| `AR-OD-07`: one short action is the real job. | Surrounding summaries distract from completion. | A focused single-task archetype. |
| `AR-OD-07`: one object and its decision dominate. | This is object understanding, not return orientation. | A detail archetype. |
| `AR-OD-08`: dense manipulation of one dataset occupies the session. | Summary hierarchy cannot carry analytical work. | An analytical workspace. |
| A finite sequence of questions or steps owns progress and submission. | The user is conducting a session, not scanning an overview. | An assessment or guided-work archetype. |

### Variants, not new archetypes

- Presentation, operational, learning-progress, personal, team, and executive overviews remain this
  archetype when dominant task and region relationships match.
- A supporting rail versus a leading summary band is a responsive or grammar decision.
- Different counts of metrics, charts, alerts, or activity records do not create new archetypes.
- Colour, density, card treatment, illustration, and motion never distinguish an archetype.

## Handoff

### Archetype → Grammar

Pass the selected situation codes, dominant task, ordered region ids, relationships, permitted
omissions, severity ordering exception, responsive transformations, and state obligations. Grammar
resolves what the scope means in the selected product family, which semantic owners fulfill the regions,
which actions and states are legitimate, and which existing product capabilities may be used.

Grammar may specialize labels and meaning but may not turn heterogeneous ranked regions into a peer
catalog, erase a required recovery path, or remove compact access to a wide action without returning to
archetype resolution.

### Grammar → Principles

After grammar selects semantic owners, principles resolve exact grid, flow, measure, spacing, alignment,
ordering realization, sticky realization, overflow containment, and content-driven transition points.
Principles may adapt geometry; they may not change dominant task, region ownership, priority, or
interaction parity.

This archetype emits no implementation component, class, token, exact dimension, or numeric breakpoint.

## Non-binding research evidence

### External official evidence

- [Carbon Design System — Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
  supports a big-picture view, explicit hierarchy, reduced distraction, and a distinction between
  presentation and exploration dashboards.
- [SAP Fiori — Overview Page](https://experience.sap.com/fiori-design-web/v1-78/overview-page/)
  describes a role-relevant overview from which people identify issues needing attention and navigate
  to deeper work.
- [Material Design — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
  provides adaptive feed and supporting-pane precedents across available-space configurations.
- [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) requires ordinary
  content to remain available and functional through reflow while bounding genuine two-dimensional
  exceptions.

These sources informed the challenge; none selects StarCi meaning, implementation, or visual treatment.

### StarCi evidence

The current StarCi learning dashboard supplies observed product facts and implementation capability for
scope, continuation, progress, attention, activity and narrow reflow. It does not prove that the current
composition is correct. Only relationships that independently pass this record corroborate the archetype;
conflicts are `layout-drift`. The source never authorizes copying its content, owners, geometry or styling.

### Evidence boundary

Research and current source are advisory provenance. Binding authority here is the recognition rule,
region graph, responsive contract, state obligations, boundaries, and handoff. A source change or
external guideline update does not silently rewrite that authority.

## Output

### Runtime record

Emit exactly this closed JSON field set; do not add, remove, or rename fields:

```json
{
  "archetypeId": "overview-dashboard",
  "situationCodes": ["<matched AR-OD-* codes>"],
  "searchAliases": [
    "dashboard",
    "home dashboard",
    "overview",
    "status overview",
    "KPI overview",
    "operational overview",
    "role overview",
    "command center",
    "cockpit",
    "progress dashboard",
    "activity dashboard",
    "trang tổng quan",
    "bảng điều khiển",
    "màn hình tổng quan",
    "bảng tiến độ"
  ],
  "dominantTask": "<one evidence-backed scan-to-act sentence>",
  "regions": ["<ordered canonical region ids remaining after evidenced omissions>"],
  "regionRelationships": ["<ordered parent, priority, and state-ownership relations>"],
  "responsive": {
    "wide": "<simultaneous region presentation>",
    "intermediate": "<first content-driven transformation>",
    "compact": "<single-flow presentation>",
    "reflow": "<zoom, long-content, writing-direction, and overflow obligations>",
    "readingOrder": "<one logical order shared by visual, keyboard, and assistive reading>",
    "navigationReplacement": "<replacement for displaced local navigation, or none>",
    "stickyBehavior": "<earned persistent behaviour and release condition, or none>",
    "overflowOwner": "<page or named intrinsically two-dimensional region>",
    "interactionParity": "<how every wide action and state remains reachable>"
  },
  "stateObligations": ["<applicable state and recovery obligations>"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<unresolved product meaning and semantic-owner decisions>"],
  "principlesHandoff": ["<unresolved geometry and realization decisions>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business facts>", "<verified source capability>", "<non-binding research>"]
}
```
