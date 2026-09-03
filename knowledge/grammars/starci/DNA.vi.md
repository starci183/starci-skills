# StarCi Core — DNA

`@starci/grammar@0.4.1` · checkout `f7167fa78d4c5edb847b16354403aec1c9d5476b` · sinh ngày 2026-09-03

File này được sinh ra từ package `@starci/grammar` đang chạy, không viết tay: danh tính, token, renderer, prop công bố, claim `data-contract` và class phát ra đều đọc thẳng từ `src/`, còn danh sách gap được chép từ bảng `## Gap` trong [Family và DNA](family.vi.md). Hãy mồi cho agent định hướng bằng đúng file này: nó nói cái gì đang tồn tại. [Idiom](idioms.vi.md) nói StarCi ghép chúng ra sao, còn [Playbook](playbook.vi.md) nói hình dạng nghiệp vụ nào cần chuỗi idiom nào. Sinh lại bằng `node scripts/generate-grammar-dna.mjs`, kiểm bằng `--check`; lệnh này cần checkout FE đã định tuyến nên không nằm trong `npm test`.

## Danh tính

| Dữ kiện | Giá trị |
| --- | --- |
| Package | `@starci/grammar` |
| Phiên bản | `0.4.1` |
| Head của checkout | `f7167fa78d4c5edb847b16354403aec1c9d5476b` |
| Family id | `core` |
| Component gốc | `CoreGrammarRoot` |
| Phạm vi family | `data-grammar-family="core"` |
| Điểm vào CSS | `@starci/grammar/core/styles.css` |
| Số đếm | 41 renderer · 59 token · 104 mục claim · 13 gap |

## Token

| Token | Mặc định |
| --- | --- |
| `--starci-core-accent` | `#7547ff` |
| `--starci-core-accent-foreground` | `oklch(100% 0 0)` |
| `--starci-core-border` | `oklch(90% 0.0015 354.13)` |
| `--starci-core-canvas` | `oklch(97.02% 0.0015 354.13)` |
| `--starci-core-contained-max-height` | `calc(100dvh - 3rem)` |
| `--starci-core-control-radius` | `0.75rem` |
| `--starci-core-copy-gap` | `0.25rem` |
| `--starci-core-danger` | `oklch(65.32% 0.2335 37.78)` |
| `--starci-core-danger-foreground` | `oklch(99.11% 0 0)` |
| `--starci-core-disabled-opacity` | `0.55` |
| `--starci-core-field-gap` | `0.5rem` |
| `--starci-core-focus` | `#7248ff` |
| `--starci-core-foreground` | `oklch(21.03% 0.0015 354.13)` |
| `--starci-core-form-compact-measure` | `28rem` |
| `--starci-core-form-measure` | `30rem` |
| `--starci-core-highlight-angle` | `360deg` |
| `--starci-core-highlight-inset` | `0` |
| `--starci-core-info` | `oklch(72% 0.17 250)` |
| `--starci-core-info-foreground` | `oklch(21.03% 0.0059 250)` |
| `--starci-core-inline-gap` | `var(--grammar-inline-gap)` |
| `--starci-core-motion-duration` | `180ms` |
| `--starci-core-motion-easing` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--starci-core-muted` | `oklch(55.17% 0.003 354.13)` |
| `--starci-core-navbar-z` | `50` |
| `--starci-core-page-inset` | `var(--grammar-page-inset)` |
| `--starci-core-page-measure` | `80rem` |
| `--starci-core-pill-radius` | `999px` |
| `--starci-core-rail-collapsed` | `4rem` |
| `--starci-core-rail-compact` | `16rem` |
| `--starci-core-rail-gap` | `1rem` |
| `--starci-core-rail-gap-compact` | `0.75rem` |
| `--starci-core-rail-offset` | `5.5rem` |
| `--starci-core-rail-standard` | `20rem` |
| `--starci-core-rail-wide` | `24rem` |
| `--starci-core-reading-measure` | `72ch` |
| `--starci-core-region-gap` | `var(--grammar-region-gap)` |
| `--starci-core-row-gap` | `var(--grammar-row-gap)` |
| `--starci-core-row-gap-compact` | `0.5rem` |
| `--starci-core-row-inset` | `1rem` |
| `--starci-core-section-gap` | `var(--grammar-section-gap)` |
| `--starci-core-separator` | `oklch(92% 0.0015 354.13)` |
| `--starci-core-subnav-offset` | `4rem` |
| `--starci-core-subnav-z` | `40` |
| `--starci-core-success` | `oklch(73.29% 0.1941 162.85)` |
| `--starci-core-success-foreground` | `oklch(21.03% 0.0059 162.85)` |
| `--starci-core-surface` | `oklch(100% 0.0008 354.13)` |
| `--starci-core-surface-inset` | `1rem` |
| `--starci-core-surface-radius` | `1rem` |
| `--starci-core-surface-secondary` | `oklch(95.24% 0.0012 354.13)` |
| `--starci-core-surface-shadow` | `0 8px 28px oklch(21.03% 0.0059 354.13 / 0.07)` |
| `--starci-core-warning` | `oklch(78.19% 0.159 84.37)` |
| `--starci-core-warning-foreground` | `oklch(21.03% 0.0059 84.37)` |
| `--starci-core-workspace-floating-inset` | `1rem` |
| `--starci-core-workspace-floating-max` | `22rem` |
| `--starci-core-workspace-floating-z` | `40` |
| `--starci-core-workspace-leading-seam` | `2rem` |
| `--starci-core-workspace-navigation-track` | `minmax(14rem, var(--starci-core-workspace-navigation-width, 18rem))` |
| `--starci-core-workspace-navigation-width` | `18rem` |
| `--starci-core-workspace-rail-track` | `minmax(16rem, var(--starci-core-rail-standard, 20rem))` |

## Renderer

| Renderer | Loại | Prop có tập giá trị đóng | Claim | Class |
| --- | --- | --- | --- | --- |
| `GrammarRoot` `GrammarRootProps` | primitive | theme: `system` \| `light` \| `dark` | — | — |
| `PageContainer` `PageContainerProps` | primitive | measure: `reading` \| `product` \| `full` | computed: MARGIN-AUTO MEASURE-1 | `starci-core-page-container` |
| `Badge` `BadgeProps` | primitive | tone: `neutral` \| `accent` \| `success` \| `warning` \| `danger` | — | — |
| `Button` `ButtonProps` | primitive | variant: `primary` \| `secondary` \| `tertiary` \| `outline` \| `ghost`; size: `sm` \| `md` \| `lg`; target: `_blank` \| `_self`; type: `button` \| `submit` \| `reset` | — | — |
| `Divider` `DividerProps` | primitive | — | BOUNDARY-5 GAP-3 | — |
| `Heading` `HeadingProps` | primitive | level: `1` \| `2` \| `3` \| `4`; scale: `standard` \| `display` | computed: FONT-1 FONT-2 FONT-3 FONT-4 FONT-6 TONE-2 | — |
| `Icon` `IconProps` | primitive | usage: `heading` \| `leading` \| `chip` | — | — |
| `IconTile` `IconTileProps` | primitive | source: IconSource; tone: `neutral` \| `accent` \| `success` \| `warning` \| `danger`; size: `sm` \| `md` | computed: OVERFLOW-2 SURFACE-4 SURFACE-5 TONE-2 | — |
| `IconButton` `IconButtonProps` | primitive | source: IconSource | — | — |
| `Label` `LabelProps` | primitive | depth: `top` \| `nested`; as: `span` \| `h3` | computed: FONT-1 FONT-2 MARGIN-0 | `starci-core-label` |
| `Input` `InputProps` | primitive | kind: `email` \| `password` \| `newPassword` \| `code` \| `text`; variant: `primary` \| `secondary` | FONT-1 GAP-2 TONE-2 | — |
| `Progress` `ProgressProps` | primitive | — | MEASURE-2 | — |
| `Text` `TextProps` | primitive | as: `div` \| `p` \| `span`; size: `xs` \| `sm` \| `md` \| `metric-lead`; tone: `default` \| `muted` \| `accent`; weight: `normal` \| `medium` \| `semibold`; live: `off` \| `polite` \| `assertive` | computed: FONT-1 FONT-2 FONT-3 FONT-5 GAP-2 TONE-1 TONE-2 TONE-3 | — |
| `TextAction` `TextActionProps` | primitive | appearance: ActionAppearance; size: ActionTextSize; target: `_blank` \| `_self` | computed: FONT-1 FONT-2 FONT-3 GAP-2 MEASURE-3 PADDING-1 PADDING-2 PADDING-3 SURFACE-4 TONE-1 TONE-2 TONE-3 | — |
| `SectionHeader` `SectionHeaderProps` | primitive | level: `1` \| `2` \| `3` \| `4`; composition: `section-header` \| `context-intro` | FLOW-3 GAP-2 GAP-5 MARGIN-0 | `starci-core-section-action` `starci-core-section-description` `starci-core-section-eyebrow` `starci-core-section-header` `starci-core-section-header-copy` `starci-core-section-title` |
| `MediaFrame` `MediaFrameProps` | primitive | aspect: `landscape` \| `portrait` \| `square` \| `auto`; fit: `cover` \| `contain`; treatment: `framed` \| `plain` | FLOW-3 GAP-2 MARGIN-0 computed: BOUNDARY-5 OVERFLOW-2 SURFACE-1 SURFACE-3 | `starci-core-media-caption` `starci-core-media-frame` `starci-core-media-viewport` |
| `IncludedMark` `IncludedMarkProps` | primitive | — | — | `starci-core-included-mark` |
| `RankArtwork` `RankArtworkProps` | primitive | kind: `first` \| `second` \| `third` \| `cup` | — | `starci-core-rank-artwork` |
| `SurfaceCopyGroup` `SurfaceCopyGroupProps` | primitive | density: `compact` \| `comfortable` | computed: GAP-2 GAP-3 | `starci-core-surface-copy-group` |
| `PrimaryRailLayout` `PrimaryRailLayoutProps` | composition | railWidth: `compact` \| `standard` \| `wide`; align: `start` \| `stretch` | GAP-5 | `starci-core-primary-rail-container` `starci-core-primary-rail-layout` `starci-core-primary-region` `starci-core-rail-region` |
| `NavigationFeatureNav` `NavigationFeatureNavProps` | composition | position: `static` \| `sticky` | BOUNDARY-1 GAP-2 GAP-3 MEASURE-2 PADDING-3 | `starci-core-navigation-feature-nav` `starci-core-navigation-feature-nav-actions` `starci-core-navigation-feature-nav-compact-navigation` `starci-core-navigation-feature-nav-feature` `starci-core-navigation-feature-nav-identity` `starci-core-navigation-feature-nav-navigation` `starci-core-navigation-feature-nav-primary` |
| `Sidebar` `SidebarProps` | composition | source: IconSource; presentation: `rail` \| `drawer`; toggleSource: IconSource | FLOW-4 FONT-1 FONT-2 GAP-1 PADDING-0 PADDING-1 PADDING-2 PADDING-3 TONE-2 computed: GAP-3 MEASURE-2 MEASURE-6 OVERFLOW-2 SURFACE-4 TONE-1 | — |
| `WorkspaceShell` `WorkspaceShellProps` | composition | navigationTrack: `fixed` \| `intrinsic`; navigationVisibility: `always` \| `wide`; railMode: `flow` \| `sticky`; railWidth: `compact` \| `standard` \| `wide`; railInset: `none` \| `content`; railPosition: `leading` \| `trailing`; align: `start` \| `stretch` | BOUNDARY-1 BOUNDARY-4 GAP-5 MARGIN-5 MEASURE-1 OVERFLOW-4 | `starci-core-workspace-shell` `starci-core-workspace-shell-compact-header` `starci-core-workspace-shell-compact-navigation` `starci-core-workspace-shell-floating-layer` `starci-core-workspace-shell-header` `starci-core-workspace-shell-layout` `starci-core-workspace-shell-leading-rule` `starci-core-workspace-shell-navigation` `starci-core-workspace-shell-primary` `starci-core-workspace-shell-rail` |
| `ChatWorkspace` `ChatWorkspaceProps` | composition | railWidth: `compact` \| `standard` \| `wide` | BOUNDARY-1 FONT-2 GAP-5 OVERFLOW-2 OVERFLOW-4 OVERFLOW-5 PADDING-0 PADDING-2 PADDING-3 PADDING-4 SURFACE-2 TONE-1 | `starci-core-chat-workspace` `starci-core-chat-workspace-composer` `starci-core-chat-workspace-conversation` `starci-core-chat-workspace-drawer-body` `starci-core-chat-workspace-drawer-close` `starci-core-chat-workspace-drawer-content` `starci-core-chat-workspace-drawer-dialog` `starci-core-chat-workspace-header` `starci-core-chat-workspace-inline-rail` `starci-core-chat-workspace-layout` `starci-core-chat-workspace-layout-without-rail` `starci-core-chat-workspace-overlay-rail` `starci-core-chat-workspace-primary` `starci-core-chat-workspace-rail-trigger` `starci-core-chat-workspace-rail-trigger-boundary` |
| `StateMark` `StateMarkProps` | core | state: PresentationState | — | — |
| `LeadingNumber` `LeadingNumberProps` | core | — | — | — |
| `OtpInput` `OtpInputProps` | core | — | OVERFLOW-3 OVERFLOW-5 PADDING-1 | — |
| `StaticStateRow` `StaticStateRowProps` | composite | state: PresentationState | BOUNDARY-3 GAP-1 GAP-3 PADDING-4 | — |
| `EmptyNotice` `EmptyNoticeProps` | composite | iconSource: IconSource; actionVariant: ButtonVariant | GAP-3 PADDING-4 | — |
| `HorizontalScrollRegion` `HorizontalScrollRegionProps` | composite | — | MEASURE-3 OVERFLOW-3 OVERFLOW-5 PADDING-1 | `starci-core-horizontal-scroll-region` |
| `VerticalScrollRegion` `VerticalScrollRegionProps` | composite | — | MEASURE-7 OVERFLOW-3 | — |
| `SurfaceCard` `SurfaceCardProps` | branch | depth: `top` \| `nested`; state: PresentationState; frame: `bounded` \| `frameless`; scroll: `page` \| `contained`; composition: `single` \| `joined`; measure: `content` \| `form` \| `formCompact`; height: `auto` \| `fill` | GAP-2 computed: BOUNDARY-5 BOUNDARY-6 GAP-0 OVERFLOW-1 OVERFLOW-2 PADDING-0 PADDING-4 SURFACE-1 SURFACE-2 SURFACE-4 | `starci-core-frameless-surface` `starci-core-surface` `starci-core-surface-card` `starci-core-surface-card--fill` `starci-core-surface-content` `starci-core-surface-highlight` `starci-core-surface-highlight-sweep` `starci-core-surface-label` |
| `SurfaceListCard` `SurfaceListCardProps` | branch | depth: `top` \| `nested` | GAP-2 OVERFLOW-2 PADDING-0 SURFACE-2 computed: FONT-1 FONT-2 TONE-2 | `starci-core-list-shell` `starci-core-owned-collection` `starci-core-surface` `starci-core-surface-footer` `starci-core-surface-label` `starci-core-surface-list` |
| `FencedCodeBlock` `FencedCodeBlockProps` | branch | measure: `reading` \| `compact` | OVERFLOW-4 | — |
| `MarkdownArticle` `MarkdownArticleProps` | branch | measure: `reading` \| `compact` | OVERFLOW-4 | — |
| `MarkdownTableFrame` `MarkdownTableFrameProps` | branch | measure: `reading` \| `compact` | OVERFLOW-4 | — |
| `SurfaceAccordionCard` `SurfaceAccordionCardProps` | branch | depth: `top` \| `nested` | BOUNDARY-3 GAP-2 MARGIN-0 PADDING-0 PADDING-4 PADDING-8 TONE-1 computed: BOUNDARY-5 BOUNDARY-6 OVERFLOW-1 OVERFLOW-2 SURFACE-1 SURFACE-2 | `starci-core-accordion-body` `starci-core-accordion-heading` `starci-core-accordion-panel` `starci-core-accordion-row` `starci-core-accordion-scroll-region` `starci-core-accordion-shell` `starci-core-accordion-trigger` `starci-core-surface-accordion-card` |
| `Rail` `RailProps` | branch | height: `content` \| `fill`; mode: `flow` \| `sticky`; width: `compact` \| `standard` \| `wide`; state: PresentationState; collapse: `expanded` \| `collapsed`; motion: `static` \| `animated` \| `reduced`; inset: `none` \| `content` | GAP-4 computed: MEASURE-6 OVERFLOW-3 PADDING-3 PADDING-5 | `starci-core-rail` `starci-core-rail-body` `starci-core-rail-footer` `starci-core-rail-frame` `starci-core-visually-hidden` |
| `Subnav` `SubnavProps` | branch | position: `static` \| `sticky`; visibility: `always` \| `compact` | BOUNDARY-1 FLOW-4 GAP-2 GAP-3 PADDING-3 | `starci-core-subnav` `starci-core-subnav-identity` `starci-core-subnav-leading` `starci-core-subnav-title` `starci-core-subnav-toggle` |
| `Tabs` `TabsProps` | branch | labelVisibility: `responsive` \| `always`; inset: `page` \| `none` | FLOW-2 GAP-2 OVERFLOW-4 PADDING-3 computed: PADDING-5 | `starci-core-tab-content` `starci-core-tab-label` `starci-core-tabs` `starci-core-tabs-frame` `starci-core-tabs-scroll` |
| `Tooltip` `TooltipProps` | branch | placement: `top` \| `bottom` | FLOW-2 FONT-1 PADDING-1 PADDING-2 | `starci-core-tooltip` `starci-core-tooltip-content` |

## Gap

| Component | Năng lực còn thiếu | Bằng chứng |
| --- | --- | --- |
| `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard` | không có cấp heading có kiểu và không có khả năng gắn nhãn bằng heading bên ngoài, nên một surface mà cấp đúng không phải 3 thì không có owner | `packages/grammar/src/core/primitive/Label/index.tsx`; `packages/grammar/src/core/branch/SurfaceCard/index.tsx` |
| Owner overlay của Common | Common không công bố prop overlay hay độ nâng tổng quát nào | `packages/grammar/src/core/branch/Tooltip/index.tsx`; `packages/grammar/src/common/styles.css` |
| `Badge` | `Badge` chấp nhận thiếu `children` và render một khoảng trắng không ngắt, nên chip chỉ có glyph vẫn biểu diễn được và sự hiện diện của chữ không được kiểu dữ liệu ép | `packages/grammar/src/core/primitive/Badge/index.tsx` |
| `Tabs` | `leading` là `ReactNode` tuỳ chọn, không phải `Icon` có kiểu, nên không gì ép glyph hay `usage` của nó lên từng mục | `packages/grammar/src/core/branch/Tabs/index.tsx` |
| `Button`, `TextAction` | không action nào công bố neo hay thuộc tính chuyển động cho phần trang trí của nó, nên family không có gì để animate ngoài `data-component` | `packages/grammar/src/core/primitive/Button/index.tsx`; `packages/grammar/src/core/primitive/TextAction/index.tsx` |
| `Icon` | `Icon` không có hợp đồng soi gương theo hướng; registry của app chọn glyph nguyên nghĩa | `packages/grammar/src/core/primitive/Icon/index.tsx` |
| `IconButton` | `isActive` chỉ phát `data-active="true"`, không có `aria-pressed`, nên một tiện ích đang active chỉ là thị giác | `packages/grammar/src/core/primitive/IconButton/index.tsx` |
| `Tooltip` | `aria-describedby` được đặt lên `span` bọc của tooltip, không lên control nhận focus, nên mô tả không được gắn theo chương trình vào nút | `packages/grammar/src/core/branch/Tooltip/index.tsx` |
| `Icon` | `Icon` chỉ nhận `source`; không có hợp đồng dự phòng hay lỗi, nên một ánh xạ registry thiếu phải được app giải quyết trước khi render | `packages/grammar/src/core/primitive/Icon/index.tsx` |
| `MediaFrame` | không có prop `object-position` hay tiêu điểm, và `className` chạm tới figure chứ không tới con của viewport, nên một crop lệch tâm bắt buộc không có owner | `packages/grammar/src/core/primitive/MediaFrame/index.tsx`; `packages/grammar/src/common/styles.css` |
| `MediaFrame` | `MediaFrame` không công bố prop loading hay error và không render state nào | `packages/grammar/src/core/primitive/MediaFrame/index.tsx` |
| `OtpInput` | `OtpInput` công bố `disabled` và `invalid` (không phải tên `isDisabled`/`isError`) và không có đầu vào skeleton, nên state chưa phân giải của nó không có owner | `packages/grammar/src/core/OtpInput.tsx` |
| `OtpInput` | `OtpInput` không công bố slot `label`, `hint` hay `errorMessage`; chỉ `describedBy` nối tới chữ bên ngoài, nên danh tính nhìn thấy của nó không có owner Common | `packages/grammar/src/core/OtpInput.tsx` |
