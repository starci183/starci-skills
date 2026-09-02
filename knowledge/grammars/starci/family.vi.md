# StarCi Core family và DNA

## Family identity

StarCi Core được định nghĩa bởi `coreGrammar` và được chọn bằng `CoreGrammarRoot`. Nó hiện thực Common contract; nó không phải parent của Common hay family khác. `CORE_GRAMMAR_COMPONENTS` chỉ còn là compatibility alias tới `COMMON_GRAMMAR_COMPONENTS`.

Luật universal áp dụng: [TONE-1..3](../../ui/presentation/tone.vi.md), [ACCENT-1..5](../../ui/composition/accent.vi.md), [BOUNDARY-1..6](../../ui/presentation/boundary.vi.md), [FONT-1..6](../../ui/presentation/font.vi.md), [GAP-0..6](../../ui/presentation/gap.vi.md) và [PADDING-0..8](../../ui/presentation/padding.vi.md).

## Hướng dependency CSS

`core/styles.css` import `common/styles.css`. Common cung cấp renderer anatomy, geometry, cấu trúc state, responsive composition và spacing universal `--grammar-*`. Core chỉ cung cấp value theo scope family và theme binding. Common không import Core; family khác không import Core.

## Core DNA

`STARCI_CORE_DNA`, token name, default light/dark và legacy spacing alias chỉ được publish từ `@starci/grammar/core`. Core bind các semantic variable gồm canvas/background, surface, foreground, muted, border/separator, accent/focus, cặp success/warning/danger/info, field, radius, shadow và motion.

Nguồn spacing universal là Common: `COMMON_SPACING_SCALE` và `COMMON_SPACING_TOKENS`. `--starci-core-page-inset`, `--starci-core-region-gap`, `--starci-core-section-gap`, `--starci-core-row-gap` và `--starci-core-inline-gap` là compatibility alias tới `--grammar-*`, không phải scale thứ hai.

## Binding theme và accessibility

Core hỗ trợ light, explicit dark, system dark, forced colors, focus-visible và reduced motion dưới Core root. Nó giữ semantics Common và không được dùng palette hay motion để đổi business truth. Luật áp dụng: [A11Y-1..4](../../ui/proof/accessibility.vi.md), [FOCUS-1..4](../../ui/proof/focus.vi.md), [MOTION-1..4](../../ui/proof/motion.vi.md) và [STATE-1..4](../../ui/composition/state.vi.md).

## Behavior family và gap có bằng chứng source

- Core giữ Common `SurfaceCard` renderer/props/semantics và dùng family-scoped CSS cùng hook neutral `data-grammar-surface-labelled` để paint outer labelled card thành một material box. Inner bounded frame trở thành transparent/không shadow nên label visually inside Core material. Test đối xứng của Heritage chỉ paint inner frame, giữ label ở ngoài mà không tạo contract thứ hai.
- `ButtonVariant` chưa có destructive/danger variant ([CTA-4](../../ui/composition/cta.vi.md)).
- Common chưa có owner tổng quát cho modal focus containment/restoration ([FOCUS-3](../../ui/proof/focus.vi.md)).
- `MediaFrame` chưa có prop loading/error explicit ([MEDIA-5](media.vi.md)).
