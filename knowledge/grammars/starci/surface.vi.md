# StarCi Core — Surface

File này map các luật giải phẫu `CORE-SURFACE-n` vào family Core đang chạy. Ý nghĩa universal của mỗi luật
là một dòng dưới heading của nó; bảng nói renderer, slot hay prop nào của Common sở hữu case đó và
Core làm gì với nó. Chữ `gap` ở cột cuối nghĩa là Core thừa kế case nguyên vẹn và Common không công bố
gì cho nó.

Nguồn gốc: `CORE-SURFACE-1` tới `CORE-SURFACE-5` từng là `SURFACE-1` tới `SURFACE-5` trong
`ui/surface.md` đã nghỉ. Tiền tố gắn theo họ vì `knowledge/ui/presentation/surface.md` đang công bố một dãy
`SURFACE-1` tới `SURFACE-6` sống cho token surface do app sở hữu, và một số đã nghỉ không bao giờ được
phát lại dưới một tiền tố đang sống. Bản thân các con số không đổi.

Các renderer công khai của Common được export từ `packages/grammar/src/common/renderers.ts`; file
vật lý của chúng nằm dưới `packages/grammar/src/core/` như kho lưu nội bộ. Family Core chỉ thay
`GrammarRoot` (`packages/grammar/src/core/index.ts`) và đóng góp `packages/grammar/src/core/styles.css`,
nên "Core hiện thực" bên dưới hoặc là một binding token trong stylesheet đó, hoặc là luật thẻ có nhãn
duy nhất mà nó thêm vào, hoặc là không có gì.

## CORE-SURFACE-1 — Một giải phẫu compound-card duy nhất của Common

Một vùng dùng lại được là một `SurfaceCard`: một root, nhiều nhất một hàng nhãn, đúng một owner nội dung.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một vùng, một root | `SurfaceCard` render HeroUI `Card.Root` thành `<section>` (prop `render`) với `variant="transparent"`, `data-grammar-surface-card="true"` và `data-grammar-surface-labelled="true|false"` | Thừa kế nguyên vẹn; `coreGrammar` chỉ thay `GrammarRoot` |
| Case 2 | Nhiều nhất một hàng nhãn | `Card.Header` với `data-grammar-surface-label="true"` chỉ render khi có `label`; `labelEnd` hoặc `fact` chiếm chỗ cuối duy nhất | Core lùi hàng đó vào (`padding` trên `> [data-grammar-surface-label]`) chỉ với thẻ có nhãn và bounded |
| Case 3 | Đúng một owner nội dung | Một `Card.Content` cho mỗi root, mang `data-grammar-frame`, `data-grammar-state`, `data-grammar-surface-depth` và tên vùng; `data-slot="card"` và `data-slot="card-content"` là neo HeroUI mà stylesheet của các family chọn tới | Không công bố và không sơn slot nội dung thứ hai |
| Case 4 | Ứng dụng muốn cùng diện mạo | Nó import `SurfaceCard` từ `@starci/grammar/common`; `CORE_GRAMMAR_COMPONENTS` là alias đã deprecated của cùng registry | Core không export renderer riêng |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/index.ts

## CORE-SURFACE-2 — Family chọn nơi sơn vật liệu duy nhất

Cùng một DOM Common nhận vật liệu của family tại đúng một ranh giới.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Thẻ có nhãn, bounded, dưới Core | Hook trung tính `data-grammar-surface-labelled="true"` trên root và `data-grammar-frame="bounded"` trên root lẫn content; CSS Common cho khung bounded (`.starci-core-surface`) bán kính và nền, `depth="top"` có bóng, `depth="nested"` có viền 1px | `core/styles.css` sơn root có nhãn và bounded đúng một lần (bán kính `--starci-core-surface-radius`, nền `--starci-core-surface`, bóng `--starci-core-surface-shadow`, `overflow: hidden`) và đặt khung bounded bên trong thành `border: 0; border-radius: 0; background: transparent; box-shadow: none`, nên nhãn nằm bên trong vật liệu duy nhất |
| Case 2 | Thẻ tự đặt tên, không nhãn | Cùng DOM với `data-grammar-surface-labelled="false"`; khung bounded giữ sơn của Common | Luật của Core chỉ có phạm vi `data-grammar-surface-labelled="true"`, nên vật liệu vẫn ở khung bên trong |
| Case 3 | Thẻ có nhãn được highlight | Khung bounded nằm dưới lớp bọc `data-grammar-highlight="true"` | Cùng luật đó của Core cũng trung hoà `> [data-grammar-highlight="true"] > [data-grammar-frame="bounded"]`, nên highlight không đưa hộp sơn thứ hai trở lại |
| Case 4 | CSS ứng dụng chạm vào slot Common | `[data-slot="card-content"]`, `[data-grammar-frame]` và các class `.starci-core-*` là giải phẫu Common, không phải điểm mở rộng | Core không công bố hook nào cho ứng dụng; lựa chọn bề rộng và chiều cao công khai duy nhất là prop `measure` và `height` |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/styles.css; packages/grammar/src/common/styles.css

## CORE-SURFACE-3 — Frame, depth, composition, measure và height vẫn là prop đóng

Hình học được chọn từ các enum đã công bố, không bao giờ từ CSS con cháu hay lớp bọc bù trừ.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Cấp cao nhất hay lồng | `depth?: "top" \| "nested"` → `data-grammar-surface-depth` trên `Card.Content`; CSS Common: top không viền và có bóng surface, nested có viền 1px `--border` và không bóng | `--border` phân giải về `--starci-core-border`, bóng về `--starci-core-surface-shadow` |
| Case 2 | Nội dung đã tự sở hữu ranh giới | `frame?: "bounded" \| "frameless"` → `data-grammar-frame`; frameless thêm `starci-core-frameless-surface`: `overflow: visible`, không viền, nền trong suốt, padding nội dung bằng không | Luật thẻ có nhãn của Core chỉ chạy với `data-grammar-frame="bounded"`, nên thẻ frameless không nhận sơn nào từ Core |
| Case 3 | Các dải con chạm nhau | `composition?: "single" \| "joined"` → `data-grammar-surface-composition` trên root, content và vùng cuộn; nội dung joined tính ra `padding: 0; gap: 0` theo cột | Thừa kế; đường nối bên trong các dải joined thuộc về con |
| Case 4 | Bề rộng form | `measure?: "content" \| "form" \| "formCompact"` → `starci-core-form-surface` (`min(100%, var(--starci-core-form-measure, 30rem))`) và `--compact` (`28rem`) | Core không đặt `--starci-core-form-measure` lẫn biến compact; mặc định của Common áp dụng |
| Case 5 | Các mục ngang hàng kéo cùng chiều cao | `height?: "auto" \| "fill"` → `starci-core-surface-card--fill` và `data-grammar-surface-height="fill"`; CSS Common nối `height: 100%` qua root, lớp bọc highlight, khung và content | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceCard/classNames.ts; packages/grammar/src/common/styles.css

## CORE-SURFACE-4 — State, action toàn mặt, cuộn và highlight giữ một owner

State của surface, action toàn mặt duy nhất, owner cuộn duy nhất và highlight duy nhất đều do cùng
một renderer phát ra.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Presentation state | `state?: PresentationState` (`neutral \| informative \| affirmative \| cautionary \| negative \| pending \| unavailable`), kiểm bởi `assertPresentationState`, phát ra thành `data-grammar-state` và `data-grammar-treatment`; CSS Common render `unavailable` ở `var(--starci-core-disabled-opacity, 0.55)` và `pending` với `cursor: progress` | `treatmentFor` trong `core/state.ts` map state sang tên tone (`quiet`, `positive`, `information`, `warning`, `danger`, `inactive`, `pending`); Core không đặt `--starci-core-disabled-opacity`, nên giá trị dự phòng áp dụng |
| Case 2 | Một action toàn mặt | `wholeAction?: { kind: "link", href, label } \| { kind: "button", press, label }` → một `<a data-grammar-whole-action="link">` hoặc `<button data-grammar-whole-action="button">` định vị tuyệt đối bên trong khung; root mang `data-grammar-interaction="whole-action"`; `unavailable` và `pending` giữ lại `href`, đặt `tabIndex={-1}` và `aria-disabled`, hoặc `disabled` | CSS Common sơn fill hover và focus-visible qua `--accent-soft` với dự phòng `--starci-core-surface-secondary` và fill active bằng cách trộn `--starci-core-accent`; Core bind `--focus`, `--accent` và `--surface-secondary`, và không định nghĩa `--accent-soft` |
| Case 3 | Một owner cuộn | `scroll?: "page" \| "contained"` hoặc `isScrollable` → `data-grammar-scroll="contained"` trên khung và `VerticalScrollRegion` trở thành HeroUI `ScrollShadow orientation="vertical"`; CSS Common giới hạn ở `var(--starci-core-contained-max-height, calc(100dvh - 3rem))` với `overscroll-behavior: contain` | Core không đặt `--starci-core-contained-max-height`; mặc định của Common áp dụng |
| Case 4 | Một highlight, tắt khi pending | `isHighlight?: boolean` → lớp bọc `data-grammar-highlight="true"` với một vệt quét `aria-hidden` (`conic-gradient` của `--starci-core-accent`, quay 3s, `animation: none` dưới `prefers-reduced-motion`); renderer bỏ lớp bọc khi `state === "pending"` | Màu accent phân giải về `--starci-core-accent`; luật thẻ có nhãn xử lý khung bên dưới lớp bọc (SURFACE-2 Case 3) |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/state.ts; packages/grammar/src/common/styles.css

## CORE-SURFACE-5 — Quyền sở hữu heading hiện là một gap chính xác của Common

Cấp heading của một surface có nhãn đáng lẽ đi theo ngữ cảnh outline; hôm nay nó chưa làm được.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Nhãn cần cấp mà outline cha ngụ ý | `SurfaceCard`, `SurfaceListCard` và `SurfaceAccordionCard` đều render `Label as="h3" id={headingId}`; `LabelProps.as` là `"span" \| "h3"` và không prop surface nào lộ nó ra | `gap` — không có cấp heading có kiểu và không có khả năng gắn nhãn bằng heading bên ngoài, nên một surface mà cấp đúng không phải 3 thì không có owner |
| Case 2 | Surface tự đặt tên | Chỉ `ariaLabel` đặt `aria-label` lên khung và không phát heading | Thừa kế nguyên vẹn |
| Case 3 | Surface dạng danh sách ẩn nhãn | `SurfaceListCard labelHidden` bỏ hàng nhãn, đặt `data-grammar-label-visibility="hidden"` và đặt tên vỏ bằng `aria-label` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/Label/index.tsx; packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceListCard/index.tsx; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx
