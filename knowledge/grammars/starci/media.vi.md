# StarCi Core — Media

File này map các luật `MEDIA-n` vào family Core đang chạy: khung media duy nhất, tỉ lệ, fit, treatment,
caption của nó, và những gì nó chưa biểu diễn được. Chữ `gap` ở cột cuối nghĩa là Common không công bố
owner nào cho case đó. Chọn asset, sinh ảnh, bản quyền và lời alt vẫn thuộc về feature workflow; Grammar
chỉ trình bày kết quả đã được duyệt.

Renderer duy nhất là `MediaFrame { children, caption?, aspect?: "landscape" | "portrait" | "square" |
"auto", fit?: "cover" | "contain", treatment?: "framed" | "plain", className? }`, mặc định `landscape`,
`cover`, `framed`. Nó render một `<figure class="starci-core-media-frame">` mang
`data-grammar-media-aspect`, `data-grammar-media-fit` và `data-grammar-media-treatment`, một viewport
`div[data-grammar-media="true"]`, và một `figcaption.starci-core-media-caption` tuỳ chọn.

## MEDIA-1 — Chọn đúng một việc tường minh cho người dùng

Media tồn tại vì một việc có tên và được trình bày qua khung Common duy nhất.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Việc được gọi tên trước asset | Không có owner Common theo thiết kế: việc, asset và bản quyền là quyết định của feature workflow | Không có gì để sơn |
| Case 2 | Asset đã duyệt được trình bày | `MediaFrame` với `aspect`, `fit` và `treatment` chọn từ việc đó; asset là con do app cung cấp | Viền viewport `--starci-core-border`, bán kính `--starci-core-surface-radius`, nền `--starci-core-surface-secondary` |
| Case 3 | Muốn dựng khung song song | `className` là hook công khai duy nhất và nó rơi lên `<figure>`, không lên viewport hay con | Core không công bố khung thứ hai |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/MediaFrame/index.tsx

## MEDIA-2 — Tỉ lệ và crop giữ nguyên chủ thể

Asset an toàn khi crop được dùng `cover` trong một tỉ lệ đã công bố; vùng tiêu điểm đã khai báo phải
luôn thấy trọn vẹn ở mọi bề rộng.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Tỉ lệ đã công bố | `aspect` → `aspect-ratio: 16 / 10` (`landscape`), `4 / 5` (`portrait`), `1` (`square`); `auto` không đặt tỉ lệ | Thừa kế nguyên vẹn |
| Case 2 | Cover chỉ khi an toàn để crop | `fit` (mặc định `cover`) → `object-fit: cover` trên con trực tiếp `img`, `picture`, `video` hay `svg` ở `width: 100%; height: 100%` | Thừa kế nguyên vẹn |
| Case 3 | Tiêu điểm lệch tâm | `gap` — không có prop `object-position` hay tiêu điểm, và `className` chạm tới figure chứ không tới con của viewport, nên một crop lệch tâm bắt buộc không có owner | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-3 — Sơ đồ và dấu hiệu dùng contain

Khi mọi pixel đều mang nghĩa thì khung contain, và nó chỉ vẽ ranh giới ở nơi chưa có vật liệu nào khác
sở hữu mép.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Không được crop gì | `fit="contain"` → `object-fit: contain` trên cùng selector con | Thừa kế nguyên vẹn |
| Case 2 | Một vùng độc lập | `treatment="framed"` (mặc định) → viewport với viền `1px`, bán kính và surface phụ | Token viền và surface phân giải về `--starci-core-border` và `--starci-core-surface-secondary`; viền thành `CanvasText` dưới forced colors |
| Case 3 | Vật liệu xung quanh sở hữu mép | `treatment="plain"` → `border-color: transparent; background: transparent` trên viewport | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-4 — Ý định truy cập và caption tường minh

Văn bản thay thế nằm trên asset, caption nằm trên figure, và không cái nào lặp lại cái kia.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Thay thế mang thông tin hay trang trí | Do con mà app cung cấp sở hữu (`alt` trên `img`); `MediaFrame` không công bố prop `alt` | Không có gì để sơn |
| Case 2 | Ngữ cảnh, ghi công hay hướng dẫn nhìn thấy | `caption?: ReactNode` → `figcaption.starci-core-media-caption` bên trong `<figure>`; figure không mang `aria-labelledby`, nên quan hệ là quan hệ figure/figcaption gốc | Kiểu chữ caption thừa kế token foreground của Core |
| Case 3 | Một danh tính, không phải ba | Common không ép; app sở hữu lời alt, caption và heading gần đó | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx

## MEDIA-5 — Tải và lỗi giữ nguyên nhiệm vụ

Một asset chậm hay hỏng giữ hình học của khung và một cách thể hiện trung thực.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Hình học được giữ chỗ | `aspect-ratio` của viewport giữ nguyên dù con có vẽ được hay không, nên khung không sụp | Thừa kế nguyên vẹn |
| Case 2 | Thể hiện đang tải hay lỗi | `gap` — `MediaFrame` không công bố prop loading hay error và không render state nào; cùng gap này được ghi trong [Family và DNA](family.vi.md) | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-6 — Nguồn gốc và sự thật của media sinh ra

Nguồn, bản quyền và quyết định sinh ảnh là bằng chứng của feature; khung không chứng minh gì về chúng.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Bản quyền và nguồn được lưu | Không có owner Common theo thiết kế; `MediaFrame` chỉ trình bày | Không có gì để sơn |
| Case 2 | Khung bị viện dẫn như sự phê duyệt | `MediaFrame` không có đầu vào về nguồn gốc, brief hay sinh ảnh, nên sự hiện diện của nó không mang tuyên bố nào như vậy | Không có gì để sơn |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx
