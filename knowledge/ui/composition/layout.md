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
| A composition name | `@grammar/common` already owns that region's tracks and geometry |
| `App` | The direction supplies content, state, and labels into a published slot |
| `—` | No published composition covers this region; the direction records the gap |

Reaching for a vendor grid where a composition name is the owner is `APP_REIMPLEMENTATION`.
Reaching for one where the owner is `—` is `COMMON_CAPABILITY_MISSING`, and the answer is to add the
reusable composition, not to author an application grid.

## LAYOUT-1 — Which regions exist at all

Governs how many visible task regions the page carries and what justifies each one.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Business content has one task and no supporting material | The receipt lists exactly one dominant region, and every further region it lists carries a named task role |
| Case 2 | A primary task has support the reader consults alongside it | The support is a rail, and the receipt names the task role that earns it |
| Case 3 | Routed page content needs shell chrome around it | `WorkspaceShell` owns the shell regions, and exactly one element is named as the main landmark |
| Case 4 | Destinations need to be grouped and browsed | `Sidebar` owns the grouping; the receipt supplies only destinations and labels into it |
| Case 5 | A conversation needs a composer that stays put | `ChatWorkspace` owns the pairing of conversation and composer |
| Case 6 | The required arrangement has no published composition | A `GRAMMAR_REQUIRED` gap names the missing composition, and no substitute arrangement appears in the tree |

Not this rule: which of several regions carries the strongest anchor is HIERARCHY-2.

## LAYOUT-2 — Every region's owner is a published composition

Governs which code decides a region's tracks, not which content sits inside them.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A primary column sits beside a support column | `PrimaryRailLayout` owns both tracks; the receipt names only `railWidth` and `align`, and no track formula appears against that region |
| Case 2 | Shell regions and the main landmark must be named | `WorkspaceShell` owns the slots, and the receipt supplies `primaryLabel` |
| Case 3 | A conversation surface needs a bounded height | `ChatWorkspace` owns the bound, and the host supplies the height it requires |
| Case 4 | The direction is tempted by a vendor grid or child width arithmetic | Every region resolves to a published composition or to a recorded gap; no vendor grid and no width arithmetic owns a region |
| Case 5 | A family wants a region to look different | The family delta replaces a renderer with compatible props only; the region's role and its number of owners are unchanged |

Not this rule: how much space separates the objects inside a region is a presentation decision.

## LAYOUT-3 — One owner per region and per scroll axis

Governs how many things may claim the same region or the same overflow axis.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Several regions coexist on one page | Each visible region resolves to exactly one composition owner and one intended track |
| Case 2 | Content is essentially wider than its column, such as a table | Exactly one named `HorizontalScrollRegion` owns the inline axis, and no page-level inline scroll exists |
| Case 3 | Block flow must be bounded inside a region | `VerticalScrollRegion isScrollable`, or the exact named composition, owns that block axis |
| Case 4 | A conversation must scroll while its composer stays put | `ChatWorkspace` owns conversation scrolling, and the composer is its sibling outside that scroller |
| Case 5 | A nested scroller is proposed | Each nested scroller carries a different named axis or a different named task from its ancestor |

Not this rule: whether a scroll region can actually be reached and traversed by keyboard once
rendered is FOCUS-2.

## LAYOUT-4 — Regions that leave normal flow

Governs sticky, fixed, drawer, floating, reordered, and conditionally absent regions.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A support column should stay in view while the primary column scrolls | `Rail mode="sticky"` carries its published bound, and below the narrow width the region returns to normal flow |
| Case 2 | An overlay needs bounded fixed geometry | `WorkspaceShell.floatingLayer` supplies geometry only; if focus containment and dismissal are also required, the receipt names a modal owner or records a gap |
| Case 3 | Compact space cannot hold the conversation rail inline | `ChatWorkspace` owns the drawer, and the receipt supplies `isRailOpen` and `onRailOpenChange` |
| Case 4 | A region is absent in the current state | No wrapper, track, divider, rule, spacer, or reserved scroll range for that region survives its absence |
| Case 5 | The direction wants a different visual order at one width | DOM, reading, focus, and action order are identical to task order at every width; the composition differs, the order does not |

Not this rule: whether the projection actually clears the content beneath it at a given viewport is
observed by the audit operator, not settled here.

Retired: LAYOUT-5 is retired into COVERAGE-1 and is not reused; the address stays spent.

## What this file does not decide

Which rank the content inside a region carries is [Hierarchy](hierarchy.md). How a region recomposes
as space changes is [Responsive](responsive.md). Which action inside a region is dominant is
[CTA](cta.md) and [Accent](accent.md). What the receipt must enumerate about these regions is
[Coverage](coverage.md). Whether the rendered result matches this direction is the audit operator's
business, in [Focus](../proof/focus.md), [Accessibility](../proof/accessibility.md),
[Motion](../proof/motion.md), and [Render truth](../proof/render-truth.md).
