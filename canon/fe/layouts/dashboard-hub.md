# Dashboard hub — navbar tab strip over a centered bare-identity / panel two-column

> Grounded in `Dashboard` (`src/components/features/dashboard/index.tsx`, route `/dashboard`) — the
> logged-in home, GitHub-shaped. `PublicProfile` (route `/profile/[username]`) reuses the SAME
> layout: one archetype, two subjects.

## When to use

Several PEER areas of content under one identity or scope (Overview · Explore · Courses ·
Community…), where the nav is not hierarchical and therefore needs no rail — see
[`when-rail.md`](when-rail.md). Switching area is a TAB, single-select and mutually exclusive, not a
button group.

## Region map

1. **Tab strip = the navbar BOTTOM LAYER** — `DashboardTabsBar`, registered through
   `useRegisterNavbarBottomLayer`. It carries no sticky and no border of its own: the navbar root
   owns the one `border-b`, which falls below the last layer. A second border here reads as two
   separate bars stacked on each other.
2. **Body** — `mx-auto max-w-6xl`, two columns from `md:`:
   - **Left aside** (`w-72 shrink-0`) — identity and standing, BARE, not wrapped in a card, and it
     STAYS PUT across every tab (`DashboardIdentity`).
   - **Right main** (`min-w-0 flex-1`) — the panel of the tab currently selected. **Only the active
     panel MOUNTS**: each tab runs its own query lazily, so an unselected tab neither renders nor
     fetches while idle.
3. **Mobile** — aside first, then content, stacked VERTICALLY in the same DOM order. No rail, no
   drawer.

The current tab reads and writes `?tab=` through a shared store (`useDashboardTabStore`) rather than
local state, so that the link to a particular tab can be shared.

## Related

[`when-rail.md`](when-rail.md) (why there is no rail here) · `tabs` component canon
(navbar bottom layer; single-select becomes tabs) · `course-home-no-duplicate-surfaces` and
`surface-lands-on-dashboard-no-auto-forward` (the IA around home and dashboard: do not repeat a
surface, do not auto-forward away from the hub) · [`page-shell-selection.md`](page-shell-selection.md).
