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

Core hỗ trợ light, explicit dark, system dark, forced colors, focus-visible và reduced motion dưới Core root. Nó giữ semantics Common và không được dùng palette hay motion để đổi business truth. Luật áp dụng: [A11Y-1..4](../../ui/proof/accessibility.vi.md), [FOCUS-1..4](../../ui/proof/focus.vi.md), [MOTION-1..4](../../ui/proof/motion.vi.md) và [STATE-1..3](../../ui/composition/state.vi.md).

## Behavior family và gap có bằng chứng source

- Core giữ Common `SurfaceCard` renderer/props/semantics và dùng family-scoped CSS cùng hook neutral `data-grammar-surface-labelled` để paint outer labelled card thành một material box. Inner bounded frame trở thành transparent/không shadow nên label visually inside Core material. Test đối xứng của Heritage chỉ paint inner frame, giữ label ở ngoài mà không tạo contract thứ hai.
- `ButtonVariant` chưa có destructive/danger variant ([CTA-4](../../ui/composition/cta.vi.md)).
- Common chưa có owner tổng quát cho modal focus containment/restoration ([FOCUS-3](../../ui/proof/focus.vi.md)).

## Gap

Những năng lực package đang chạy không công bố, đọc từ đúng source renderer mà mỗi dòng nêu tên. Bảng
này là bản kiểm kê gap duy nhất của family: `scripts/generate-grammar-dna.mjs` chép nó sang
[DNA](DNA.vi.md), nên một gap ghi ở chỗ khác là chưa được công bố. Mỗi dòng nói cái gì đang thiếu,
không nói nó từng treo vào luật nào.

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
| `StaticStateRow` | claim `GAP-2 PADDING-2` trong khi CSS đặt `gap: .75rem` (GAP-3) và `padding: 1rem` (PADDING-4); gap gọn `.5rem` chỉ có dưới một container query, nên claim đã publish không khớp giá trị render | `packages/grammar/src/core/composite/StaticStateRow/index.tsx`; `packages/grammar/src/common/styles.css` (`.starci-core-static-row`) |
| `SurfaceAccordionCard` | trigger claim `PADDING-4 PADDING-3` trong khi `.starci-core-accordion-trigger` chỉ đặt `padding: 1rem`, nên PADDING-3 không có hình dạng render nào | `packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx`; `packages/grammar/src/common/styles.css` (`.starci-core-accordion-trigger`) |
| `HorizontalScrollRegion`, `VerticalScrollRegion` | cả hai chỉ render một `ScrollShadow` trần, không class, không claim; `.starci-core-horizontal-scroll-region` (padding-block, con max-content, chặn overscroll) do nơi gọi áp vào, nên vùng cuộn không sở hữu thứ gì audit đo được | `packages/grammar/src/core/composite/HorizontalScrollRegion/index.tsx`; `packages/grammar/src/core/composite/VerticalScrollRegion/index.tsx`; `packages/grammar/src/common/styles.css` (`.starci-core-horizontal-scroll-region`) |
| `SectionHeader` | gap gốc (`1.5rem`, GAP-5) và gap cột copy (`0.375rem`, ngoài thang) không mang claim; chỉ tiêu đề mang `MARGIN-0 FLOW-3`, nên khoảng cách của header không có chủ đã publish | `packages/grammar/src/core/composite/SectionHeader/index.tsx`; `packages/grammar/src/common/styles.css` (`.starci-core-section-header`, `.starci-core-section-header-copy`) |
