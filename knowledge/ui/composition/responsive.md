# Responsive composition

This file answers one question: as the space available to a task changes, what must survive, and
which published query owns the change?

Responsive decisions are made before any DOM exists, because they are decisions about which regions
recompose, which branch disappears, and what the reader must still be able to do afterwards. A
device name is never an answer here; the answer is always a named query on a named owner.

## RESPONSIVE-1 — What survives when space shrinks

Governs the floor the compact composition must keep.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A task must fit into markedly less space | One readable compact flow keeps the required meaning, the primary action, and the current state; support stays reachable |
| Case 2 | Content would otherwise force the page to scroll sideways | The composition recomposes rather than clipping, squeezing, or letting the page overflow inline |
| Case 3 | A branch is hidden in compact space | It is genuinely absent, and a trigger with controlled state, focus return, and a recovery path stands in for it |
| Case 4 | Parallel regions are wanted at a wider width | They are added only where a published composition already offers that mode |
| Case 5 | The required compact behaviour has no published composition | The direction records the missing reusable behaviour instead of authoring a parallel breakpoint |

## RESPONSIVE-2 — The query owner is named, not the device

Governs which space is actually being observed.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A primary column sits beside a rail | The owner is the `PrimaryRailLayout` named container query at inline-size `56rem`, so a narrow container stacks even inside a wide window |
| Case 2 | Shell regions recompose | `WorkspaceShell` mixes named-container queries at `72rem` and `56rem` with a viewport rule at `69.999rem`; each is named separately |
| Case 3 | Global navigation switches between full and compact | `NavigationFeatureNav` observes the layout viewport around `48rem` |
| Case 4 | A conversation rail switches between persistent and drawer | `ChatWorkspace` observes the layout viewport, through `matchMedia("(max-width: 47.999rem)")` alongside a CSS rule from `48rem` |
| Case 5 | The direction wants a generic tablet breakpoint over these regions | It does not exist. The owning query already decides, and a second breakpoint creates a competing owner |

Not this rule: which regions exist for the query to act on is LAYOUT-1.

## RESPONSIVE-3 — Every compact branch has exactly one owner

Governs who holds the state when a composition has two forms.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | `NavigationFeatureNav` exposes its compact trigger | The compact drawer is application-owned by contract, so the direction supplies the same destinations, labels, state, focus return, and recovery through that extension point |
| Case 2 | `ChatWorkspace` switches its rail between persistent and drawer | The composition owns the switch; the direction passes controlled state and callbacks and adds no listener of its own |
| Case 3 | `PrimaryRailLayout` reflows a rail that is present | The published CSS owns the reflow, and an absent rail is absent in DOM rather than hidden |
| Case 4 | Both forms would render and one is merely hidden | Not allowed. One branch exists at a time, and the other leaves no layout or accessibility footprint |

## RESPONSIVE-4 — Pressure that is not viewport width

Governs the other ways space runs out.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The reader zooms, enlarges text, or applies their own text spacing | The composition recomposes; fixed text heights and clipping are not the answer |
| Case 2 | Copy grows because it was translated or because a state added words | The growth is part of the fit decision, not an exception to it |
| Case 3 | Content is essentially two-dimensional and cannot reflow | One named `HorizontalScrollRegion` owns it, and the page around it stays within its inline bound |
| Case 4 | A virtual keyboard, an orientation change, or a safe-area inset reduces usable space | Persistent geometry must still fit, stay visible, and not occlude the task. A layout query staying in wide mode does not prove visual fit |
| Case 5 | A state expands the surface, as an error, an expanded panel, or an overlay does | The expanded form is decided at the same time as the resting one |

## RESPONSIVE-5 — Boundaries the direction commits to

Governs what the audit will be asked to sample.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A composition has a named query boundary | The direction names the boundary and the space that must be varied to reach it, container inline-size or layout viewport |
| Case 2 | One composition mixes container and viewport owners | Each owner gets its own named commitment; one sample does not stand in for the other |
| Case 3 | The widest named content and the pressure states are known | They are named up front, so the audit exercises the real worst case |
| Case 4 | A family or the application adds a delta | Each layer is isolated, so a lost compact trigger can be attributed to the layer that lost it |

Not this rule: running the samples and recording geometry is the audit operator's work.

## What this file does not decide

Which regions exist and who owns their tracks is [Layout](layout.md). Whether meaning keeps its rank
through a reflow is [Hierarchy](hierarchy.md), and whether an action group keeps its order is
[CTA](cta.md). Whether a compact branch is genuinely absent is decided in [State](state.md) and
evidenced in [Focus](../proof/focus.md).
