# Trình chỉnh sửa timeline đa track

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | multi-track-timeline-editor |
| Family | work |
| Dominant task | Tạo artifact theo thời gian bằng cách đặt, cắt và đồng bộ clip trên nhiều track trước khi preview và render. |
| Search aliases | multi-track-timeline-editor; multi-track timeline editor |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Tạo artifact theo thời gian bằng cách đặt, cắt và đồng bộ clip trên nhiều track trước khi preview và render.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-MTT-01 | Tạo artifact theo thời gian bằng cách đặt, cắt và đồng bộ clip trên nhiều track trước khi preview và render. | tín hiệu dương bắt buộc |
| AR-MTT-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-MTT-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-MTT-90 | trang chú thích media, hiển thị audit status, lập lịch calendar, phân trang slide hoặc dựng canvas tự do. | reject |
| AR-MTT-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-MTT-01 và AR-MTT-02 đều có bằng chứng, không có AR-MTT-90 hoặc AR-MTT-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
timeline-editor
├─ project-version-and-duration
├─ asset-bin
├─ multi-track-time-ruler
├─ playhead-and-selection
├─ clip-property-inspector
├─ transport-preview
└─ render-and-validation
~~~

Quan hệ quan trọng: Tracks, clips, playhead, preview, and render share the same coordinate and project version.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| timeline-editor | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa project-version-and-duration, asset-bin, multi-track-time-ruler, playhead-and-selection, clip-property-inspector, transport-preview, render-and-validation nhưng giữ owner độc lập của từng region. |
| project-version-and-duration | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng asset-bin mà không thay owner của nó. |
| asset-bin | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ project-version-and-duration và ràng buộc multi-track-time-ruler mà không gộp authority. |
| multi-track-time-ruler | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ asset-bin và ràng buộc playhead-and-selection mà không gộp authority. |
| playhead-and-selection | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ multi-track-time-ruler và ràng buộc clip-property-inspector mà không gộp authority. |
| clip-property-inspector | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ playhead-and-selection và ràng buộc transport-preview mà không gộp authority. |
| transport-preview | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ clip-property-inspector và ràng buộc render-and-validation mà không gộp authority. |
| render-and-validation | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ transport-preview và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Inspect asset bin, multi-track timeline, preview, and clip inspector together; the timeline alone owns two-axis overflow.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move the asset bin to the temporary pane and alternate preview with inspector while the timeline remains primary.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage track list, selected clip timeline, explicit trim controls, preview, then render review.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): assets loading/missing; clip selected/moved/trimmed/split; overlap/gap; track muted/locked; play/pause/scrub; dirty/undo-redo; render queued/progress/failure/ready; version conflict.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ anatomy đã biết và nêu vùng đang chờ. | Không tự chuyển focus. | Giữ cùng stage identity. |
| ready | Hiển thị dữ liệu demo nhất quán và product-neutral. | Focus ở control đã kích hoạt. | Giữ selection. |
| empty/not-applicable | Nêu vì sao trống và bước tiếp theo nếu có. | Focus đến recovery chỉ khi cần tiếp tục. | Không xóa vùng bắt buộc khác. |
| error/retry | Gắn lỗi với owner và cung cấp retry có giới hạn. | Multi-error chuyển đến summary; retry trả đúng owner. | Lỗi không chỉ thể hiện bằng màu. |
| permission/unavailable | Giữ orientation và giải thích giới hạn. | Không focus control bị khóa. | Cùng lý do ở mọi topology. |
| pending | Chặn duplicate và giữ label hành động có nghĩa. | Không cướp focus để báo tiến độ. | Trạng thái đi cùng action owner. |
| success | Xác nhận kết quả và continuation hợp lệ. | Chỉ chuyển focus khi giúp tiếp tục. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu phiên bản thay đổi và giữ input an toàn. | Focus đến lựa chọn recovery có ngữ cảnh. | Selection sống qua transformation. |
| domain states | Clip added at the playhead without changing other tracks. Selected clip moved one explicit time step; overlap is now reported. Clip trimmed; preview and output are stale until rendered. Version 4 rendered; preview, playhead, and validation share the same coordinates. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang chú thích media, hiển thị audit status, lập lịch calendar, phân trang slide hoặc dựng canvas tự do, hoặc khi chỉ đổi noun/card/density của archetype khác.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo quy tắc Situation codes; không suy diễn bằng cảm tính.

## Bàn giao

- Grammar nhận dữ kiện thật, semantic owner, permission, trạng thái và hậu quả action.
- Principles nhận exact grid, measure, gap, sizing, alignment, overflow, threshold, sticky offset và focus accommodation.
- Direction nhận visual character; template chỉ là một realization conforming.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các nguồn sau là bằng chứng tư vấn chính thức đã kiểm tra. Chúng không phải product truth, không đặt tên archetype này cho tổ chức nguồn và không tự cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [Apple HIG — Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) | Hỗ trợ direct manipulation with alternative actions. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI APG — Keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Hỗ trợ keyboard-complete interaction and visible focus. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "multi-track-timeline-editor",
  "matchedSituationCodes": [
    "AR-MTT-01",
    "AR-MTT-02"
  ],
  "aliases": [
    "multi-track-timeline-editor",
    "multi-track timeline editor"
  ],
  "dominantTask": "Compose a time-based artifact by placing, trimming, and synchronizing clips across tracks before preview and render.",
  "regions": [
    "timeline-editor",
    "project-version-and-duration",
    "asset-bin",
    "multi-track-time-ruler",
    "playhead-and-selection",
    "clip-property-inspector",
    "transport-preview",
    "render-and-validation"
  ],
  "relationships": [
    "Tracks, clips, playhead, preview, and render share the same coordinate and project version."
  ],
  "responsive": {
    "wide": "Inspect asset bin, multi-track timeline, preview, and clip inspector together; the timeline alone owns two-axis overflow.",
    "intermediate": "Move the asset bin to the temporary pane and alternate preview with inspector while the timeline remains primary.",
    "compact": "Stage track list, selected clip timeline, explicit trim controls, preview, then render review.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Không trả class, token, component, đường dẫn source, breakpoint cố định hoặc dữ kiện sản phẩm tự bịa.
