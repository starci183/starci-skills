# The REGION model — the shells, and this codebase's vocabulary of regions

> Placing a new component or feature starts by NAMING THE REGION it belongs to, and only then
> styling it. A region is the building block of a layout, and each region owns its own padding,
> sticky behaviour and width ([Calcite
> Shell](https://developers.arcgis.com/calcite-design-system/foundations/layouts/) · [Fluent 2
> layout](https://fluent2.microsoft.design/layout)).

## The real shells

| Shell | Regions | Source |
|---|---|---|
| **InnerLayout** (global, wraps EVERY page) | navbar `h-16` (sticky) · ambient background · content · footer (landing ONLY) · overlay containers (modal, drawer) · TopLoader | `src/app/InnerLayout.tsx` |
| **LearnShell** (four-column docs) | icon rail (`LearnSidebar`) · left content rail (`leftRail`, `ResizableRail`) · reading column (`p-6`, owns the measure) · on-this-page right (`rightRail`, TOC) · `fullBleed` opt-out | `features/learn/LearnShell` + `learn/layout.tsx` |
| **SettingsLayout** (two-pane manage) | collapsible rail (`CollapsibleSidebar`, sticky) · centered content column | `features/profile/Settings/SettingsLayout` |
| **PageContainer** | one centered column, `max-w-*` plus gutter | `blocks/layout/PageContainer` |

## The vocabulary — put the component in the right region

- **navbar** (top, `h-16`) and **navbar-bottom-layer** (a tab strip attached below the navbar, used
  by dashboard and profile through `useRegisterNavbarBottomLayer`).
- **icon-rail** (surface-to-surface navigation, narrow, `lg+`) · **content-rail** (a tree or list of
  content, on the left) · **reading-col** (the main content, and it owns the measure `max-w-3xl`) ·
  **on-this-page** (the TOC on the right).
- **CTA-anchor** (the primary action — hero or sticky) · **bottom-bar** (`StickyBottomBar`, mobile
  enrol) · **workspace-pane** (the full-bleed second pane —
  [`full-bleed-work-surface.md`](full-bleed-work-surface.md)).

## The rules

- **A new component starts with the question "which region?"** — global nav goes to navbar or its
  bottom layer; browsing a list goes to content-rail; the main content goes to reading-col;
  something contextual and secondary goes to on-this-page; the main action goes to CTA-anchor; a
  tool used while solving goes to workspace-pane.
- **A region owns its own chrome.** reading-col owns `p-6` and the measure (`three-tier-page-layout`
  — the narrow reading column is `max-w-3xl mx-auto`); a rail owns its sticky behaviour and its
  width. A feature never declares the column's padding itself, because `LearnShell` already does —
  see `components/sidebar`.
- **Measure belongs to the COLUMN, not to the renderer.** The max-width is the reading column's job,
  never `MarkdownContent`'s; put it in the renderer and every other consumer of that renderer
  inherits a width it did not ask for.

## Related

[`page-shell-selection.md`](page-shell-selection.md) ·
[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`responsive-regions.md`](responsive-regions.md) · `components/sidebar` (rail and shell blocks) ·
`components/header` (the `PageHeader` region) · `foundations/gap` · `foundations/sticky` ·
`foundations/breakpoints`.
