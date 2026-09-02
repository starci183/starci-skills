# StarCi Core surfaces, layout, navigation, responsive behavior, and media

## Surfaces and material

Common owns `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard`, state, scroll, action props, semantic relationships, and stable hooks. Core binds surface colors, radius, borders, shadow, and depth under family scope. Bindings: [SURFACE-1..5](../../ui/presentation/surface.md), [BOUNDARY-1..5](../../ui/presentation/boundary.md), [GAP-1..5](../../ui/presentation/gap.md), and [PADDING-1..5](../../ui/presentation/padding.md).

For a labelled bounded `SurfaceCard`, Core uses the Common outer `data-grammar-surface-card` as the single material paint boundary, adds label inset there, and makes the inner bounded frame transparent/no-shadow. The label is therefore visually inside one Core material box while props, heading relationship, content region, state, whole action, and accessibility remain Common. Heritage proves the symmetric family choice by painting only its inner frame, so its label remains outside; this is evidence of family variance, not a second contract.

Stable hooks: `data-grammar-surface-card`, `data-grammar-surface-labelled`, `data-grammar-surface-label`, `data-grammar-surface-content`, and `data-grammar-frame`.

## Anonymous layout ownership

`WorkspaceShell`, `Sidebar`, `PrimaryRailLayout`, `Rail`, `NavigationFeatureNav`, `Subnav`, `Tabs`, `ChatWorkspace`, and scroll regions own reusable geometry. Bindings: [LAYOUT-1..5](../../ui/composition/layout.md), [RESPONSIVE-1..5](../../ui/composition/responsive.md), and [MEASURE-1..5](../../ui/presentation/measure.md).

```tsx
import { Sidebar, WorkspaceShell } from "@starci/grammar/common"

<WorkspaceShell
  navigation={<Sidebar {...sidebarProps} />}
  navigationLabel="Learning navigation"
  primary={<FeatureContent />}
  primaryLabel="Learning workspace"
  rail={<FeatureRail />}
  railLabel="Learning context"
  compactNavigation={<ProductRouteActions />}
  compactNavigationLabel="Learning navigation"
/>
```

Feature code selects slots and maps routes/state; it does not recreate the grid. Optional slots have zero footprint when absent. Each intentional overflow axis has one reachable owner.

## Why Learn stays outside Grammar

`LearnShellLayout` is connected StarCi product code because it knows learning routes, course selection, gates, and persistence. It composes the anonymous Common layout above. Its word “Learn” is exactly why it is not in Grammar. The same rule applies to Nivo Console adapters. Grammar has no `Learn*`, `Console*`, `Dashboard*`, or `Navbar*` identity.

## Responsive and navigation binding

Core CSS binds Common anatomy to intrinsic tracks, container/media transitions, compact navigation, drawer/persistent rail, focus reachability, and reduced motion. Wide and compact projections expose the same destinations and effects; hidden duplicates leave no layout or focus residue.

## Media and image art direction

Feature/content workflow owns whether an image should exist, whether it is generated, the generation brief, factual provenance, alt meaning, and asset selection. Grammar never decides to call image generation.

After selection, Common `MediaFrame` owns aspect, fit, treatment, caption, frame semantics, and stable geometry. Core owns only family presentation—crop discipline, border/radius/material, and theme behavior. Use `contain` when cropping could remove meaning. The missing loading/error prop remains a Common gap. Bindings: [MEDIA-1..6](media.md), [ICON-1..6](icon.md), and [RENDER-TRUTH-1..4](../../ui/proof/render-truth.md).
