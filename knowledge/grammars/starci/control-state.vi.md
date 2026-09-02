# StarCi Core — Control state

File này map các luật `CONTROL-STATE-n` vào family Core đang chạy: một control mang state pending,
không dùng được, chưa phân giải và bền vững ra sao qua các prop đã công bố, và Core sơn gì. Chữ `gap` ở
cột cuối nghĩa là Common không công bố owner nào cho case đó.

## CONTROL-STATE-1 — Danh tính ổn định qua state của action

Một action giữ tên và phần tử của nó khi đi từ nghỉ sang việc đã nhận rồi sang kết quả.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một command nhận việc | `Button isPending` → HeroUI `isDisabled` và `isPending`, `data-action-pending="true"`, một `Spinner` `aria-hidden` thay chỗ `startContent`, `endContent` bị bỏ, nhãn `children` được giữ trong một span có `aria-busy`; `TextAction isPending` → `disabled` trên `button` gốc của nó, `aria-busy`, cùng phép thay spinner, cộng một khoá bấm 300ms từ chối `onPress` lần hai | Màu spinner là `current`; Core không thêm sơn pending |
| Case 2 | Một destination đang pending | `Button href` và `TextAction href` render một thẻ neo giữ `role="link"`, đặt `aria-disabled`, và giữ lại `href` lẫn `onFollow` khi pending hay disabled; phần tử không bao giờ biến thành button | Thừa kế nguyên vẹn |
| Case 3 | Một action toàn mặt đang pending | `SurfaceCard state="pending"` đặt `data-grammar-state="pending"`, giữ lại `href` của link phủ với `tabIndex={-1}` và `aria-disabled`, hoặc `disabled` trên button phủ, và tắt `isHighlight` | CSS Common đặt `cursor: progress`; Core không sơn thêm |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/branch/SurfaceCard/index.tsx

## CONTROL-STATE-2 — Không dùng được không phải là pending

Không dùng được, việc đã nhận và nội dung ban đầu chưa phân giải là ba đầu vào, không bao giờ suy từ nhau.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Ba đầu vào riêng trên một action | `Button` và `TextAction` công bố `isDisabled`, `isPending` và `isSkeleton`; cả ba chặn kích hoạt; chỉ pending phát `aria-busy` và `data-action-pending`; chỉ skeleton ẩn nhãn (thẻ neo `Button` có `aria-hidden`, class shimmer; `TextAction` là một span `aria-hidden` với `data-loading="true"`) | Thừa kế nguyên vẹn |
| Case 2 | Một field | `Input` công bố `isDisabled` và `isSkeleton`, không có pending; skeleton render hai khối HeroUI `Skeleton` dưới `data-state="skeleton"` và không có nhãn hay control | Thừa kế nguyên vẹn |
| Case 3 | Các owner khác | `IconButton`: `isDisabled`, `isSkeleton`; `Badge`, `Icon`: `isSkeleton`; `SurfaceCard state="unavailable"` → `data-grammar-state="unavailable"` ở `var(--starci-core-disabled-opacity, 0.55)` | Core không đặt `--starci-core-disabled-opacity`; giá trị dự phòng áp dụng |
| Case 4 | Field mã một lần | `gap` — `OtpInput` công bố `disabled` và `invalid` (không phải tên `isDisabled`/`isError`) và không có đầu vào skeleton, nên state chưa phân giải của nó không có owner | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## CONTROL-STATE-3 — State bền vững có giá trị riêng

Một lựa chọn bền vững là một giá trị của ứng dụng được lái qua owner Common, không bao giờ là một state
thứ hai nằm cục bộ trong DOM.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Các view ngang hàng | `Tabs selectedKey` (bắt buộc) và `onSelect(key)`; `items` là danh mục có thứ tự; `panelId` ghi `aria-controls` lên từng tab, vừa qua prop vừa lần nữa trong một layout effect khi client sẵn sàng; HeroUI cung cấp `aria-selected` và hành vi bàn phím roving | Core không thêm luật tab theo phạm vi |
| Case 2 | Một destination đang current | `TextAction isCurrent` → `aria-current="page"` khi `appearance="route"`, ngược lại `aria-current="true"`, cộng `data-current="true"`; các appearance `route`, `choice`, `section` và `tab` đổi độ đậm, fill hoặc một viền dưới 2px khi current | Fill phân giải qua `--accent-soft` và `--accent`, mà Core chỉ bind `--accent` |
| Case 3 | Một disclosure có kiểm soát | `SurfaceAccordionCard` nhận `isOpen`/`onOpenChange` hoặc `items[].isOpen`/`onItemOpenChange` và phát `data-grammar-disclosure-state="open|closed"` cho từng hàng; HeroUI `Accordion.Root expandedKeys` được suy từ các prop đó | Thừa kế nguyên vẹn |
| Case 4 | Trước khi hydrate | `Tabs` render một placeholder `aria-hidden` (`data-grammar-tabs-client="pending"`) cho tới khi mount, nên lựa chọn chỉ quan sát được khi `ready` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/branch/Tabs/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/actionStyles.ts; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx

## CONTROL-STATE-4 — Bằng chứng và thứ bác bỏ

Mọi state control chạm tới được đều được chứng minh từ thuộc tính đã render, số lần callback và kết
quả settle, không phải từ tên class.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Thuộc tính cần chụp | `data-action-pending`, `aria-busy`, `disabled` hoặc `aria-disabled`, `data-loading`, `data-state="skeleton"`, `aria-selected`, `aria-current`, `data-current`, `data-grammar-state`, `data-grammar-disclosure-state` | Core không phát thuộc tính riêng nào ngoài `data-grammar-family="core"` trên root |
| Case 2 | Số lần callback | Đường command của `TextAction` từ chối `onPress` lần hai trong 300ms và khi không dùng được; `Button` giữ lại hẳn `onPress` khi không dùng được; lớp phủ toàn thẻ giữ lại `href` hoặc đặt `disabled` | Thừa kế nguyên vẹn |
| Case 3 | Quy trách nhiệm theo tầng | Đầu ra Common cô lập, rồi delta của Core (binding token và luật thẻ có nhãn duy nhất trong `core/styles.css`), rồi delta của ứng dụng | Delta của Core đủ nhỏ để diff thẳng với `core/styles.css` |

Source: packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/styles.css
