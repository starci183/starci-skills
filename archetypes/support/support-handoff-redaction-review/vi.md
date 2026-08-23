# Đánh giá che dữ liệu khi bàn giao hỗ trợ

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | support-handoff-redaction-review |
| Family | support |
| Dominant task | Đánh giá các mục hỗ trợ đã thu thập, quyết định giữ, che hoặc bỏ từng mục và preview chính xác nội dung bên nhận nhận được. |
| Search aliases | support-handoff-redaction-review; support handoff redaction review |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Đánh giá các mục hỗ trợ đã thu thập, quyết định giữ, che hoặc bỏ từng mục và preview chính xác nội dung bên nhận nhận được.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-SHR-01 | Đánh giá các mục hỗ trợ đã thu thập, quyết định giữ, che hoặc bỏ từng mục và preview chính xác nội dung bên nhận nhận được. | tín hiệu dương bắt buộc |
| AR-SHR-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-SHR-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-SHR-90 | tác vụ là soạn yêu cầu, diff tài liệu, quản lý tệp, share dialog hoặc hội thoại trực tiếp. | reject |
| AR-SHR-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-SHR-01 và AR-SHR-02 đều có bằng chứng, không có AR-SHR-90 hoặc AR-SHR-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
redaction-review
├─ handoff-purpose-and-recipient
├─ captured-item-queue
├─ selected-item-redaction-editor
├─ privacy-risk-summary
├─ recipient-preview
└─ consent-and-handoff
~~~

Quan hệ quan trọng: Source item, redaction decision, privacy risk, and recipient output remain separate owners.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| redaction-review | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa handoff-purpose-and-recipient, captured-item-queue, selected-item-redaction-editor, privacy-risk-summary, recipient-preview, consent-and-handoff nhưng giữ owner độc lập của từng region. |
| handoff-purpose-and-recipient | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng captured-item-queue mà không thay owner của nó. |
| captured-item-queue | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ handoff-purpose-and-recipient và ràng buộc selected-item-redaction-editor mà không gộp authority. |
| selected-item-redaction-editor | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ captured-item-queue và ràng buộc privacy-risk-summary mà không gộp authority. |
| privacy-risk-summary | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận context từ selected-item-redaction-editor và ràng buộc recipient-preview mà không gộp authority. |
| recipient-preview | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ privacy-risk-summary và ràng buộc consent-and-handoff mà không gộp authority. |
| consent-and-handoff | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận trạng thái đã verify từ recipient-preview và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Inspect queue, editor, and recipient preview together while unresolved privacy risk stays associated with the item.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move recipient preview into the temporary pane while queue and editor remain primary.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage queue, editor, preview, consent, and handoff; Back restores the exact item and redaction draft.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): item loading/unsupported; retain/redact/omit; detected sensitive data; unresolved risk; stale preview; changed recipient; missing consent; handoff pending/failure/success; audit record.

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
| domain states | Account token redacted locally; source capture remains unchanged. Unsupported attachment omitted with an audit reason. Recipient preview refreshed and unresolved risk count is zero. Consent recorded; handoff completed with a traceable receipt. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi tác vụ là soạn yêu cầu, diff tài liệu, quản lý tệp, share dialog hoặc hội thoại trực tiếp, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [USWDS — File input](https://designsystem.digital.gov/components/file-input/) | Hỗ trợ file capture state and accessible labeling. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [GOV.UK Design System — Patterns](https://design-system.service.gov.uk/patterns/) | Hỗ trợ clear task sequence and recovery. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ focus visibility around sticky and temporary surfaces. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "support-handoff-redaction-review",
  "matchedSituationCodes": [
    "AR-SHR-01",
    "AR-SHR-02"
  ],
  "aliases": [
    "support-handoff-redaction-review",
    "support handoff redaction review"
  ],
  "dominantTask": "Review captured support items, decide retain, redact, or omit per item, and preview exactly what a recipient receives.",
  "regions": [
    "redaction-review",
    "handoff-purpose-and-recipient",
    "captured-item-queue",
    "selected-item-redaction-editor",
    "privacy-risk-summary",
    "recipient-preview",
    "consent-and-handoff"
  ],
  "relationships": [
    "Source item, redaction decision, privacy risk, and recipient output remain separate owners."
  ],
  "responsive": {
    "wide": "Inspect queue, editor, and recipient preview together while unresolved privacy risk stays associated with the item.",
    "intermediate": "Move recipient preview into the temporary pane while queue and editor remain primary.",
    "compact": "Stage queue, editor, preview, consent, and handoff; Back restores the exact item and redaction draft.",
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
