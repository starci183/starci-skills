# Surface, layout, navigation, responsive và media của StarCi Core

## Surface và material

Common sở hữu `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard`, state, scroll, action prop, semantic relationship và hook ổn định. Core bind surface color, radius, border, shadow và depth dưới family scope. Binding: [SURFACE-1..6](../../ui/presentation/surface.vi.md), [BOUNDARY-1..6](../../ui/presentation/boundary.vi.md), [GAP-0..6](../../ui/presentation/gap.vi.md) và [PADDING-0..8](../../ui/presentation/padding.vi.md).

Với `SurfaceCard` bounded có label, Core dùng outer `data-grammar-surface-card` của Common làm material paint boundary duy nhất, thêm label inset ở đó và làm inner bounded frame transparent/không shadow. Vì vậy label nằm visually inside một Core material box trong khi props, heading relationship, content region, state, whole action và accessibility vẫn thuộc Common. Heritage chứng minh lựa chọn family đối xứng bằng cách chỉ paint inner frame nên label nằm ngoài; đây là family variance, không phải contract thứ hai.

Hook ổn định: `data-grammar-surface-card`, `data-grammar-surface-labelled`, `data-grammar-surface-label`, `data-grammar-surface-content` và `data-grammar-frame`.

## Ownership layout vô danh

`WorkspaceShell`, `Sidebar`, `PrimaryRailLayout`, `Rail`, `NavigationFeatureNav`, `Subnav`, `Tabs`, `ChatWorkspace` và scroll region sở hữu geometry dùng lại. Binding: [LAYOUT-1..4](../../ui/composition/layout.vi.md), [RESPONSIVE-1..4](../../ui/composition/responsive.vi.md) và [MEASURE-1..5](../../ui/presentation/measure.vi.md).

```tsx
import { Sidebar, WorkspaceShell } from "@starci/grammar/common"

<WorkspaceShell
  navigation={<Sidebar {...sidebarProps} />}
  navigationLabel="Điều hướng học tập"
  primary={<FeatureContent />}
  primaryLabel="Không gian học tập"
  rail={<FeatureRail />}
  railLabel="Ngữ cảnh học tập"
  compactNavigation={<ProductRouteActions />}
  compactNavigationLabel="Điều hướng học tập"
/>
```

Feature code chọn slot và map route/state; không dựng lại grid. Slot tùy chọn có zero footprint khi vắng. Mỗi intentional overflow axis có đúng một owner reachable.

## Vì sao Learn nằm ngoài Grammar

`LearnShellLayout` là connected StarCi product code vì nó biết learning route, course selection, gate và persistence. Nó compose anonymous Common layout bên trên. Chính chữ “Learn” là lý do nó không nằm trong Grammar. Cùng luật áp dụng cho adapter Console của Nivo. Grammar không có identity `Learn*`, `Console*`, `Dashboard*` hay `Navbar*`.

## Binding responsive và navigation

Core CSS bind Common anatomy vào intrinsic track, container/media transition, compact navigation, drawer/persistent rail, focus reachability và reduced motion. Projection wide/compact mở cùng destination/effect; duplicate bị ẩn không để lại layout hay focus residue.

## Media và image art direction

Feature/content workflow sở hữu quyết định có cần image hay không, có generate hay không, generation brief, factual provenance, alt meaning và chọn asset. Grammar không bao giờ quyết định gọi image generation.

Sau khi chọn asset, Common `MediaFrame` sở hữu aspect, fit, treatment, caption, frame semantics và geometry ổn định. Core chỉ sở hữu family presentation—crop discipline, border/radius/material và theme behavior. Dùng `contain` khi crop có thể làm mất meaning. Prop loading/error còn thiếu vẫn là Common gap. Binding: [TRUTH-1..4](../../ui/proof/render-truth.vi.md) và idiom [Generated art is a band, not a card](idioms.vi.md).
