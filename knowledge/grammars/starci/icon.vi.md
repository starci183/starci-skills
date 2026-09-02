# StarCi Core — Icon

File này map các luật cơ chế `ICON-n` vào family Core đang chạy: nguồn glyph, hộp đo được, slot đặt
và danh tính truy cập được. Chữ `gap` ở cột cuối nghĩa là Common không công bố owner nào cho case đó.

Lưu ý về tên: prop thật đang chọn hộp icon là `usage`, không phải `role` như file đã nghỉ gọi.
`IconUsage` là `"heading" | "leading" | "chip"`.

## ICON-1 — Ưu tiên nguồn và các vai đo được

Ứng dụng phân giải glyph; Common chỉ sở hữu hộp và đầu ra truy cập.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Glyph đến từ registry của app | `Icon { source: IconSource }` — một component SVG dạng hàm hoặc lớp do app chọn; Common truyền `data-component="Icon"`, `data-usage` và `focusable="false"`, và không bao giờ import thư viện glyph | Core không thêm luật icon theo phạm vi nào |
| Case 2 | Hộp được đo, không tự đặt cỡ cục bộ | `usage?: IconUsage` (mặc định `chip`) → `size-6`, `size-5`, `size-4` với `shrink-0`: `24×24`, `20×20`, `16×16` CSS px ở root 16px | Thừa kế nguyên vẹn |
| Case 3 | Glyph chưa phân giải | `isSkeleton` → một span shimmer `aria-hidden` `size-5 rounded-full` với `data-loading="true"`, bất kể `usage` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-2 — Chip gọn và trạng thái tường minh

Một thuộc tính gọn hay một state đã xác minh ghép glyph 16px với chữ nhìn thấy trong một owner trạng
thái duy nhất.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Chữ, tone và glyph trong một chip | `Badge { children, startContent, tone?: "neutral" \| "accent" \| "success" \| "warning" \| "danger", isSkeleton }` → HeroUI `Chip variant="soft" size="sm"` với `data-tone`; glyph là một `Icon usage="chip"` đặt trong `startContent` | Màu chip phân giải qua `--success`, `--warning`, `--danger`, `--accent`, mà Core bind về `--starci-core-*` |
| Case 2 | Chip chưa phân giải | `isSkeleton` ẩn `startContent`, đặt `aria-hidden` và render chữ trong suốt | Thừa kế nguyên vẹn |
| Case 3 | Chữ là bắt buộc | `gap` — `Badge` chấp nhận thiếu `children` và render một khoảng trắng không ngắt, nên chip chỉ có glyph vẫn biểu diễn được và sự hiện diện của chữ không được kiểu dữ liệu ép | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/Badge/index.tsx; packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-3 — Mỗi tab giữ danh tính icon và nhãn

Mỗi tab ngang hàng mang một nhãn ổn định và một glyph dẫn đầu, ở đầu ra gọn lẫn rộng.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một danh tính cho mỗi mục | `Tabs { label, selectedKey, items, onSelect?, panelId?, labelVisibility?: "responsive" \| "always", inset?: "page" \| "none" }` với `TabItem { id, label, leading?: ReactNode }`; mỗi tab nhận `aria-label={item.label}`, span nội dung `data-grammar-tab-id`, và một HeroUI `Tabs.Indicator` mà CSS Common cố định `2px` ở mép dưới | Core không thêm luật tab theo phạm vi; chỉ binding token áp dụng |
| Case 2 | Nhãn ở đầu ra gọn | `.starci-core-tab-label` là `display: none` dưới `48rem` và `inline` từ `min-width: 48rem`; `labelVisibility="always"` ép nó inline qua `data-grammar-tab-labels="always"` | Thừa kế nguyên vẹn |
| Case 3 | Mọi mục phải mang glyph | `gap` — `leading` là `ReactNode` tuỳ chọn, không phải `Icon` có kiểu, nên không gì ép glyph hay `usage` của nó lên từng mục | Không có gì để sơn |
| Case 4 | Trước khi hydrate | Renderer phát một placeholder `aria-hidden` với `data-grammar-tabs-client="pending"` và `min-height: 3rem`; danh tính và lựa chọn chỉ tồn tại khi `data-grammar-tabs-client="ready"` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/branch/Tabs/index.tsx; packages/grammar/src/common/styles.css

## ICON-4 — Mũi tên hướng của action

Mũi tên tiến hay lùi là một glyph 16px do app chọn trong một slot action của Common; nhãn và hộp mục
tiêu đứng yên.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Vị trí mũi tên | `Button` và `TextAction` công bố `startContent` và `endContent`; pending thay `startContent` bằng một `Spinner` `aria-hidden` và bỏ `endContent`; `Button isSkeleton` bỏ cả hai | Thừa kế nguyên vẹn |
| Case 2 | Cỡ mũi tên | Glyph là một `Icon usage="chip"` (`16×16`) | Thừa kế nguyên vẹn |
| Case 3 | Chuyển động của mũi tên | `gap` — không action nào công bố neo hay thuộc tính chuyển động cho phần trang trí của nó, nên family không có gì để animate ngoài `data-component` | `core/styles.css` không định nghĩa chuyển động action nào |
| Case 4 | Soi gương theo hướng logic | `gap` — `Icon` không có hợp đồng soi gương theo hướng; registry của app chọn glyph nguyên nghĩa | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-5 — Action tiện ích chỉ có icon

Một tiện ích quen thuộc có thể chỉ có glyph khi một owner cung cấp tên, mục tiêu và lời giải thích tuỳ
chọn của nó.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Command chỉ có glyph nhưng có tên | `IconButton { source, label (bắt buộc), isActive?, isDisabled?, isSkeleton?, onPress? }` → HeroUI `Button isIconOnly variant="tertiary"` với `aria-label={label}` và `rounded-full`, bọc một `Icon usage="leading"` (`20×20`, `aria-hidden`) | Core không đặt cỡ riêng; mục tiêu đã tính được đo lúc audit |
| Case 2 | Tiện ích đang bấm hay đang active | `gap` — `isActive` chỉ phát `data-active="true"`, không có `aria-pressed`, nên một tiện ích đang active chỉ là thị giác | Không có gì để sơn |
| Case 3 | Giải thích khi hover hay focus | `Tooltip { content }` bọc control và hiện `role="tooltip"` khi `:hover` và `:focus-within` | `gap` — `aria-describedby` được đặt lên `span` bọc của tooltip, không lên control nhận focus, nên mô tả không được gắn theo chương trình vào nút |
| Case 4 | Không dùng được hay chưa phân giải | `isDisabled \|\| isSkeleton` → HeroUI `isDisabled`, `onPress` bị giữ lại; skeleton không render glyph và là một shimmer `rounded-full` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/IconButton/index.tsx; packages/grammar/src/core/branch/Tooltip/index.tsx

## ICON-6 — Truy cập, dự phòng và sự thật của state

Một glyph được đặt tên đúng một lần khi nó mang nghĩa, im lặng khi không, và trung thực khi không
phân giải được.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Glyph đứng một mình có nghĩa | `Icon ariaLabel` → `role="img"` với `aria-label`; thiếu → `aria-hidden="true"` | Thừa kế nguyên vẹn |
| Case 2 | Glyph đi kèm bên cạnh một cái tên | `IconButton` render `Icon` bên trong không có `ariaLabel`, nên glyph bị ẩn và tên của nút đứng một mình | Thừa kế nguyên vẹn |
| Case 3 | Nguồn không phân giải được | `gap` — `Icon` chỉ nhận `source`; không có hợp đồng dự phòng hay lỗi, nên một ánh xạ registry thiếu phải được app giải quyết trước khi render | Không có gì để sơn |
| Case 4 | Forced colors | Core bind `--starci-core-foreground` về `CanvasText`; glyph có đi theo `currentColor` hay không là thuộc tính của SVG của app | Binding token trong `core/styles.css` |
| Case 5 | Glyph state và chữ state | Chữ nằm trong `Badge children` với `tone`, hoặc trên `SurfaceCard state` phát ra thành `data-grammar-state`; glyph là một `Icon` riêng trong `startContent` | Core map state sang tên tone trong `core/state.ts` và sơn qua token |

Source: packages/grammar/src/core/primitive/Icon/index.tsx; packages/grammar/src/core/primitive/IconButton/index.tsx; packages/grammar/src/core/styles.css
