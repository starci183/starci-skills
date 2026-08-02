# Master-detail rail — left rail plus work pane, URL-synced, on a STANDALONE route

> Two variants of one archetype. `Practice` (`src/components/features/practice/index.tsx`, route
> `/practice`) uses a RESIZABLE rail (`ResizableRail`); `SettingsLayout`
> (`src/components/features/profile/Settings/SettingsLayout`, route `/profile/settings/*`) uses a
> COLLAPSIBLE fixed-width rail (`CollapsibleSidebar`).

## When to use

A STANDALONE route — one with no `LearnShell` — that still has a single NAV AXIS and a list long
enough to browse (a mode and topic list, the set of settings pages) standing beside a work pane.

Two things separate it from [`docs-three-pane-reader.md`](docs-three-pane-reader.md): there are only
two panes, with no third TOC pane, and the CONTENT declares its own `p-6` because there is no shell
to do it.

## Region map

1. **Rail**, on the left, `hidden lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)]`. Two kinds, chosen
   by what the nav actually is:
   - **Resizable** (`ResizableRail` with `storageKey`, `minWidth`, `maxWidth`) when the rail holds
     nav items of VARYING width — a mode switch plus a long topic list, as in `Practice`.
   - **Collapsible fixed** (`CollapsibleSidebar` with `SidebarNavGroup` and `SidebarNavItem`) when
     the rail is a FIXED menu, as in `SettingsLayout`. It collapses to icons only and persists that
     to `localStorage`.
2. **Work pane**, on the right, `min-w-0 flex-1 p-6` — `PageHeader` (breadcrumb and title) then the
   content. The pane's state, meaning the mode or topic being viewed, is read from the URL
   (`usePracticeView`) and not from local state living inside the rail; otherwise the rail and the
   pane can disagree about what is selected.
3. **Mobile (`<lg`)** — the rail is `hidden`. `Practice` folds it into a chip row
   (`PracticeMobileNav`); `Settings` folds it into a horizontally scrolling nav row
   (`overflow-x-auto`) that sticks below the navbar.

## Related

[`when-rail.md`](when-rail.md) · [`docs-three-pane-reader.md`](docs-three-pane-reader.md) (the
three-pane variant, which lives inside `LearnShell`) · `sidebar` component canon
(`CollapsibleSidebar`, `ResizableRail`) · [`page-shell-selection.md`](page-shell-selection.md).
