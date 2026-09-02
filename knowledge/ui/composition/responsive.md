# Responsive composition

This file answers one question: as the space available to a task changes, what must survive, and
which published query owns the change?

Responsive decisions are made before any DOM exists, because they are decisions about which regions
recompose, which branch disappears, and what the reader must still be able to do afterwards. A
device name is never an answer here; the answer is always a named query on a named owner.

## RESPONSIVE-1 — What survives when space shrinks

Governs the floor the compact composition must keep.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A task must fit into markedly less space | The compact branch keeps the required meaning, the primary action, and the current state in one readable flow, and support remains reachable from it |
| Case 2 | Content would otherwise force the page to scroll sideways | The composition recomposes; no clipping, no squeezing, and no page-level inline overflow appears in that branch |
| Case 3 | A branch is hidden in compact space | The branch is genuinely absent, and a trigger with controlled state, focus return, and a recovery path stands in its place |
| Case 4 | Parallel regions are wanted at a wider width | Every parallel region at that width resolves to a published composition that already offers the mode |
| Case 5 | The required compact behaviour has no published composition | A `GRAMMAR_REQUIRED` gap names the missing behaviour, and no parallel breakpoint is authored in its place |

## RESPONSIVE-2 — The query owner is named, not the device

Governs which space is actually being observed.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A primary column sits beside a rail | The branch names the `PrimaryRailLayout` container query at inline-size `56rem` as its owner, so a narrow container stacks inside a wide window |
| Case 2 | Shell regions recompose | Each `WorkspaceShell` boundary is named separately: the named-container queries at `72rem` and `56rem`, and the viewport rule at `69.999rem` |
| Case 3 | Global navigation switches between full and compact | `NavigationFeatureNav` is named as the owner, observing the layout viewport around `48rem` |
| Case 4 | A conversation rail switches between persistent and drawer | `ChatWorkspace` is named as the owner, observing the layout viewport through `matchMedia("(max-width: 47.999rem)")` alongside a CSS rule from `48rem` |
| Case 5 | The direction wants a generic tablet breakpoint over these regions | No breakpoint outside the published owning queries governs those regions |

Not this rule: which regions exist for the query to act on is LAYOUT-1.

## RESPONSIVE-3 — Every compact branch has exactly one owner

Governs who holds the state when a composition has two forms.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | `NavigationFeatureNav` exposes its compact trigger | The application owns the compact drawer through that extension point and supplies the same destinations, labels, state, focus return, and recovery |
| Case 2 | `ChatWorkspace` switches its rail between persistent and drawer | The composition owns the switch; the receipt passes controlled state and callbacks only, and declares no listener of its own |
| Case 3 | `PrimaryRailLayout` reflows a rail that is present | The published CSS owns the reflow, and a rail that is absent is absent in DOM rather than hidden |
| Case 4 | Both forms would render and one is merely hidden | Exactly one branch exists at a time, and the other leaves no layout and no accessibility footprint |

## RESPONSIVE-4 — Pressure that is not viewport width

Governs the other ways space runs out.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The reader zooms, enlarges text, or applies their own text spacing | The composition recomposes; no fixed text height and no clipping carries that pressure |
| Case 2 | Copy grows because it was translated or because a state added words | The receipt names that growth inside the fit decision rather than as an exception to it |
| Case 3 | Content is essentially two-dimensional and cannot reflow | Exactly one named `HorizontalScrollRegion` owns it, and the surrounding page stays inside its inline bound |
| Case 4 | A virtual keyboard, an orientation change, or a safe-area inset reduces usable space | Persistent geometry still fits, stays visible, and occludes no part of the task; a layout query staying in wide mode is not accepted as proof of fit |
| Case 5 | A state expands the surface, as an error, an expanded panel, or an overlay does | The expanded form is decided in the same receipt entry as the resting one |

Retired: RESPONSIVE-5 is retired into COVERAGE-1 and is not reused; the address stays spent.

## What this file does not decide

Which regions exist and who owns their tracks is [Layout](layout.md). Whether meaning keeps its rank
through a reflow is [Hierarchy](hierarchy.md), and whether an action group keeps its order is
[CTA](cta.md). What the receipt must enumerate about these branches is [Coverage](coverage.md).
Whether a compact branch is genuinely absent is decided in [State](state.md) and evidenced in
[Focus](../proof/focus.md).
