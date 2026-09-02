# StarCi Core — Boundary

File này map các luật giải phẫu `CORE-BOUNDARY-n` vào family Core đang chạy: owner Common nào vẽ, đặt tên,
cắt, tách hay nâng một vùng, và Core sơn gì lên đó. Chữ `gap` ở cột cuối nghĩa là Common không công bố
owner nào cho case đó.

Nguồn gốc: `CORE-BOUNDARY-1` tới `CORE-BOUNDARY-5` từng là `BOUNDARY-1` tới `BOUNDARY-5` trong
`ui/boundary.md` đã nghỉ. Tiền tố gắn theo họ vì `knowledge/ui/presentation/boundary.md` đang công bố một
dãy `BOUNDARY-1` tới `BOUNDARY-6` sống cho token separator và border do app sở hữu, và một số đã nghỉ
không bao giờ được phát lại dưới một tiền tố đang sống. Bản thân các con số không đổi.

## CORE-BOUNDARY-1 — Một owner ranh giới dùng lại được

Một hộp vùng nhìn thấy được hay một đường tách giữa các mục ngang hàng có đúng một owner Common phát ra
trọn vẹn mép đó.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một hộp vùng | `SurfaceCard` (`data-grammar-surface-card="true"`), `SurfaceListCard` (`data-grammar-surface-list="true"` với vỏ bên trong `data-grammar-surface="true"`), hoặc `SurfaceAccordionCard` (`data-grammar-accordion-shell="true"`, `data-grammar-surface="true"` khi có `depth`) | Chỉ token, cộng luật thẻ có nhãn duy nhất trong `core/styles.css` (xem [Surface](surface.vi.md), SURFACE-2) |
| Case 2 | Một đường tách giữa các mục ngang hàng | `Divider { label: string }` → `role="separator"` với `aria-label={label}`, hai vạch `aria-hidden` `h-px bg-border` hai bên một `Text` tone muted | `--border` phân giải về `--starci-core-border` |
| Case 3 | Một vỏ thứ hai bọc quanh owner | Không phải owner Common; các renderer ở trên đã phát ra mép, bán kính, nền và bóng | Core không công bố hook bọc nào |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceListCard/index.tsx; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx; packages/grammar/src/core/primitive/Divider/index.tsx

## CORE-BOUNDARY-2 — Lồng và đường nối

Một việc lồng bên trong hay một cụm dải chạm nhau cho mỗi đường nối đúng một owner.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một vùng lồng | `depth="nested"` → `data-grammar-surface-depth="nested"`; CSS Common vẽ viền 1px `--border` trên khung bounded và bỏ bóng; vỏ list và accordion cũng phát `data-surface-context="nested"` | Màu viền phân giải về `--starci-core-border` |
| Case 2 | Nội dung lồng tự cắt lấy | `frame="frameless"` → `overflow: visible`, không viền, nền trong suốt, nên thẻ bounded lồng bên trong tự cắt | Luật thẻ có nhãn của Core loại trừ root frameless |
| Case 3 | Các dải chạm nhau trong một thẻ | `composition="joined"` → inset nội dung bằng không, `gap: 0`; các con sở hữu đường tách của mình | Màu separator phân giải về `--starci-core-separator` |
| Case 4 | Các hàng trong disclosure hay danh sách tĩnh | CSS Common vẽ `border-top: 1px solid var(--separator)` trên `.starci-core-accordion-row + .starci-core-accordion-row` và trên `.starci-core-static-row + .starci-core-static-row`, nên hàng đầu không có đường nối phía trên | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/common/styles.css

## CORE-BOUNDARY-3 — Lựa chọn thay thế có nhãn và divider

Nhãn của surface nằm bên trong component mà nó đặt tên; một divider có nhãn chỉ đứng giữa những lựa
chọn thay thế thật.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Nhãn đặt tên vùng | `Label as="h3" id={headingId}` trong hàng nhãn, được `aria-labelledby` trên khung tham chiếu (`SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard`) | Core lùi hàng nhãn của thẻ có nhãn và bounded vào để nó nằm trong vật liệu duy nhất |
| Case 2 | Hai lựa chọn thay thế thật | `Divider label` (bắt buộc) → `role="separator" aria-label` cộng cùng từ đó nhìn thấy dưới dạng `Text` muted | Tone chữ phân giải qua `--muted` → `--starci-core-muted` |
| Case 3 | Một vạch trang trí không có quan hệ | Không phải `Divider`: `label` của nó là bắt buộc và nó luôn đọc lên một separator; một vạch thuần thị giác là lựa chọn token do app sở hữu dưới `BOUNDARY-n` của presentation | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/Divider/index.tsx; packages/grammar/src/core/primitive/Label/index.tsx

## CORE-BOUNDARY-4 — Độ nâng đi theo sự che phủ

Xếp lớp, vị trí và cách đóng thuộc về owner thật sự che lên một lớp khác.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Một chú thích che lên hàng xóm | `Tooltip { content, children, placement?: "top" \| "bottom" }` → một nút `role="tooltip"` ở `z-index: 20`, hiện khi `:hover` và `:focus-within`, `transition: none` dưới `prefers-reduced-motion` | Nền và chữ phân giải về `--starci-core-foreground` trên `--starci-core-canvas`; bán kính, thời lượng và easing lấy từ token Core |
| Case 2 | Nội dung bất kỳ cần được nâng | `gap` — Common không công bố prop overlay hay độ nâng tổng quát nào | Không có gì để sơn |
| Case 3 | Surface cấp cao mang bóng | Bóng của `depth="top"` là vật liệu, không phải xếp lớp: `var(--starci-core-surface-shadow, var(--shadow-surface, …))` | `0 8px 28px oklch(21.03% 0.0059 354.13 / 0.07)`, và `none` dưới forced colors |

Source: packages/grammar/src/core/branch/Tooltip/index.tsx; packages/grammar/src/common/styles.css; packages/grammar/src/core/styles.css

## CORE-BOUNDARY-5 — State, cắt và làm phẳng theo responsive

Cùng owner giữ vùng qua thay đổi state, tràn và viewport.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Nội dung bounded cắt, frameless phơi ra | Class khung bounded `starci-core-surface` có `overflow-hidden`; frameless có `overflow-visible` | Root có nhãn và bounded cũng đặt `overflow: hidden`, nên cả root lẫn khung đều cắt |
| Case 2 | Focus bên trong owner đang cắt | Lớp phủ action toàn mặt và trigger accordion dùng `outline: 2px solid var(--focus)` với `outline-offset: -2px`, nên vòng focus nằm trong vùng cắt | `--focus` phân giải về `--starci-core-focus` (`#7248ff`), `Highlight` dưới forced colors |
| Case 3 | State đổi sơn, không đổi quyền sở hữu | `data-grammar-state="unavailable"` hạ độ mờ và `pending` đổi con trỏ; thuộc tính vùng và quan hệ nhãn không đổi | Thừa kế nguyên vẹn |
| Case 4 | Viewport hẹp lại | CSS Common sở hữu các luật responsive (form surface, rail, tabs); thuộc tính owner vẫn nằm trong DOM | `core/styles.css` không có media query theo bề rộng; Core không tự thêm bước làm phẳng nào |
| Case 5 | Forced colors | Mọi token mép phân giải về màu hệ thống | `--starci-core-border` và `--starci-core-separator` thành `CanvasText`, `--starci-core-surface-shadow` thành `none` |

Source: packages/grammar/src/core/branch/SurfaceCard/classNames.ts; packages/grammar/src/common/styles.css; packages/grammar/src/core/styles.css
