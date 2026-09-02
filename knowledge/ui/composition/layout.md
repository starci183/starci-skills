# Layout composition

This file answers one question: before any DOM exists, which visible task regions does this page
have, and who owns each one?

Layout is the first composition decision. It settles how many regions the reader sees, which
published composition owns each region's tracks and scrolling, and what happens to a region that
leaves normal flow or disappears. Everything measured after the page renders belongs to the audit
operator, not to this file.

## Owner vocabulary

| Owner | Meaning |
| --- | --- |
| A composition name | `@starci/grammar/common` already owns that region's tracks and geometry |
| `App` | The direction supplies content, state, and labels into a published slot |
| `—` | No published composition covers this region; the direction records the gap |

Reaching for a vendor grid where a composition name is the owner is `APP_REIMPLEMENTATION`.
Reaching for one where the owner is `—` is `COMMON_CAPABILITY_MISSING`, and the answer is to add the
reusable composition, not to author an application grid.

## LAYOUT-1 — Which regions exist at all

Governs how many visible task regions the page carries and what justifies each one.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Business content has one task and no supporting material | One dominant region. A second track is added only for a named task role, never to fill whitespace |
| Case 2 | A primary task has support the reader consults alongside it | The support is a rail, and the direction names the task role that earns it |
| Case 3 | Routed page content needs shell chrome around it | `WorkspaceShell` owns the shell regions and which element is the main landmark |
| Case 4 | Destinations need to be grouped and browsed | `Sidebar` owns the grouping; the direction supplies destinations and labels |
| Case 5 | A conversation needs a composer that stays put | `ChatWorkspace` owns the pairing of conversation and composer |
| Case 6 | The required arrangement has no published composition | The direction stops and records the missing reusable composition |

Not this rule: which of several regions carries the strongest anchor is HIERARCHY-2.

## LAYOUT-2 — Every region's owner is a published composition

Governs which code decides a region's tracks, not which content sits inside them.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A primary column sits beside a support column | `PrimaryRailLayout` owns both tracks; the direction chooses `railWidth` and `align` and authors no track formula |
| Case 2 | Shell regions and the main landmark must be named | `WorkspaceShell` owns the slots; the direction supplies `primaryLabel` |
| Case 3 | A conversation surface needs a bounded height | `ChatWorkspace` owns it, and the host supplies the height it requires |
| Case 4 | The direction is tempted by a vendor grid or child width arithmetic | It does not. The region either uses the published composition or the gap is recorded |
| Case 5 | A family wants a region to look different | A family may replace a renderer compatibly; it may not change roles or the number of owners |

Not this rule: how much space separates the objects inside a region is a presentation decision.

## LAYOUT-3 — One owner per region and per scroll axis

Governs how many things may claim the same region or the same overflow axis.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Several regions coexist on one page | Each visible region has exactly one composition owner and one intended track |
| Case 2 | Content is essentially wider than its column, such as a table | One named `HorizontalScrollRegion` owns the inline axis, and the page itself does not scroll sideways |
| Case 3 | Block flow must be bounded inside a region | `VerticalScrollRegion isScrollable` or the exact composition owns it |
| Case 4 | A conversation must scroll while its composer stays put | `ChatWorkspace` owns conversation scrolling and the composer is its sibling, outside that scroller |
| Case 5 | A nested scroller is proposed | It is allowed only when the two owners carry different named axes or different named tasks |

Not this rule: whether a scroll region can actually be reached and traversed by keyboard once
rendered is FOCUS-2.

## LAYOUT-4 — Regions that leave normal flow

Governs sticky, fixed, drawer, floating, reordered, and conditionally absent regions.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A support column should stay in view while the primary column scrolls | `Rail mode="sticky"` and its published bound; below the narrow width it returns to normal flow |
| Case 2 | An overlay needs bounded fixed geometry | `WorkspaceShell.floatingLayer` supplies geometry only. If the overlay also needs focus containment and dismissal, the direction names a modal owner or records the gap |
| Case 3 | Compact space cannot hold the conversation rail inline | `ChatWorkspace` owns the drawer; the direction supplies `isRailOpen` and `onRailOpenChange` |
| Case 4 | A region is absent in the current state | Absence contributes no wrapper, track, divider, rule, spacer, or reserved scroll range |
| Case 5 | The direction wants a different visual order at one width | DOM, reading, focus, and action order stay in task order; the composition changes, not the visual order |

Not this rule: whether the projection actually clears the content beneath it at a given viewport is
observed by the audit operator, not settled here.

## LAYOUT-5 — Coverage the direction commits to

Governs which states and widths the composition promises to hold, so the audit has a fixed matrix
rather than a guess.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A region's shape depends on how much content arrives | Empty, sparse, dense, and wrapped states are named as in scope |
| Case 2 | The page carries a sticky, fixed, or drawer region | The transition widths and the terminal clearance the projection must hold are named |
| Case 3 | A scroll owner was declared | Start, middle, and end reachability plus scroll restoration are named as in scope |
| Case 4 | A family or the application adds a delta over the composition | Each layer is isolated separately, so a failure can be attributed |

Not this rule: taking the measurements is the audit operator's work. This rule only fixes what must
be measured.

## What this file does not decide

Which rank the content inside a region carries is [Hierarchy](hierarchy.md). How a region recomposes
as space changes is [Responsive](responsive.md). Which action inside a region is dominant is
[CTA](cta.md) and [Accent](accent.md). Whether the rendered result matches this direction is the
audit operator's business, in [Focus](../proof/focus.md), [Accessibility](../proof/accessibility.md),
[Motion](../proof/motion.md), and [Render truth](../proof/render-truth.md).
