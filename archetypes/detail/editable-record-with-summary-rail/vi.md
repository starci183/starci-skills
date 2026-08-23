# Hồ sơ chỉnh sửa với thanh tóm tắt

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | editable-record-with-summary-rail |
| Family | detail |
| Dominant task | Tạo hoặc chỉnh sửa một hồ sơ có cấu trúc dài trong khi đối chiếu tóm tắt dẫn xuất và hoàn tất một giao dịch lưu hoặc hủy rõ ràng. |
| Search aliases | editable-record-with-summary-rail; editable record with summary rail |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Tạo hoặc chỉnh sửa một hồ sơ có cấu trúc dài trong khi đối chiếu tóm tắt dẫn xuất và hoàn tất một giao dịch lưu hoặc hủy rõ ràng.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ERS-01 | Tạo hoặc chỉnh sửa một hồ sơ có cấu trúc dài trong khi đối chiếu tóm tắt dẫn xuất và hoàn tất một giao dịch lưu hoặc hủy rõ ràng. | tín hiệu dương bắt buộc |
| AR-ERS-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ERS-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ERS-90 | các điều khiển tự lưu độc lập, tác vụ là wizard, hoặc trang chỉ đọc dạng tường thuật. | reject |
| AR-ERS-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ERS-01 và AR-ERS-02 đều có bằng chứng, không có AR-ERS-90 hoặc AR-ERS-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
record-editor
├─ breadcrumb-and-editor-header
├─ defining-fields
├─ supporting-field-sections
├─ summary-rail
└─ validation-and-save-boundary
~~~

Quan hệ quan trọng: Defining fields own identity; the summary reflects the draft and never becomes a second input source.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| record-editor | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa breadcrumb-and-editor-header, defining-fields, supporting-field-sections, summary-rail, validation-and-save-boundary nhưng giữ owner độc lập của từng region. |
| breadcrumb-and-editor-header | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Định hướng defining-fields mà không thay owner của nó. |
| defining-fields | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ breadcrumb-and-editor-header và ràng buộc supporting-field-sections mà không gộp authority. |
| supporting-field-sections | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ defining-fields và ràng buộc summary-rail mà không gộp authority. |
| summary-rail | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ supporting-field-sections và ràng buộc validation-and-save-boundary mà không gộp authority. |
| validation-and-save-boundary | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ summary-rail và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep the editor primary, the derived summary visible, and a save boundary that reserves space below the final field.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Turn the summary rail into the temporary supporting pane while grouping and dirty state remain visible.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Use one dependency-ordered form sequence and expose the summary before the final save boundary; sticky actions yield at short height.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): field schema loading; pristine/dirty; inline validation; multi-error summary; derived summary updating; save pending/success/error; discard confirmation; read-only; stale conflict; focus error-summary→field.

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
| domain states | Draft changed; the derived summary is stale until recalculated. Validation found two linked fields and focused the error summary. Save succeeded once; the pending guard prevented duplication. Latest values merged; the edited field and focus target are retained. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi các điều khiển tự lưu độc lập, tác vụ là wizard, hoặc trang chỉ đọc dạng tường thuật, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [Shopify — Details template](https://shopify.dev/docs/api/app-home/patterns/templates/details) | Hỗ trợ detail composition and contextual actions. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [GitLab Pajamas — Forms](https://design.gitlab.com/patterns/forms/) | Hỗ trợ field grouping and validation feedback. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ focus visibility around sticky and temporary surfaces. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "editable-record-with-summary-rail",
  "matchedSituationCodes": [
    "AR-ERS-01",
    "AR-ERS-02"
  ],
  "aliases": [
    "editable-record-with-summary-rail",
    "editable record with summary rail"
  ],
  "dominantTask": "Create or edit one long structured record while consulting a derived summary and completing one explicit save or discard transaction.",
  "regions": [
    "record-editor",
    "breadcrumb-and-editor-header",
    "defining-fields",
    "supporting-field-sections",
    "summary-rail",
    "validation-and-save-boundary"
  ],
  "relationships": [
    "Defining fields own identity; the summary reflects the draft and never becomes a second input source."
  ],
  "responsive": {
    "wide": "Keep the editor primary, the derived summary visible, and a save boundary that reserves space below the final field.",
    "intermediate": "Turn the summary rail into the temporary supporting pane while grouping and dirty state remain visible.",
    "compact": "Use one dependency-ordered form sequence and expose the summary before the final save boundary; sticky actions yield at short height.",
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
