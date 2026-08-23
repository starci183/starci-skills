# Hồ sơ giải quyết vụ việc dựa trên bằng chứng

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | evidence-led-case-resolution-dossier |
| Family | detail |
| Dominant task | Giải quyết một vụ việc có ranh giới bằng cách kiểm tiêu chí rõ ràng với bằng chứng, mâu thuẫn và khoảng trống trước khi ghi lý do. |
| Search aliases | evidence-led-case-resolution-dossier; evidence-led case resolution dossier |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Giải quyết một vụ việc có ranh giới bằng cách kiểm tiêu chí rõ ràng với bằng chứng, mâu thuẫn và khoảng trống trước khi ghi lý do.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ECD-01 | Giải quyết một vụ việc có ranh giới bằng cách kiểm tiêu chí rõ ràng với bằng chứng, mâu thuẫn và khoảng trống trước khi ghi lý do. | tín hiệu dương bắt buộc |
| AR-ECD-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ECD-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ECD-90 | trang là hồ sơ chung, hội thoại hỗ trợ, trình soạn phê duyệt, audit event hoặc list-detail đơn giản. | reject |
| AR-ECD-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ECD-01 và AR-ECD-02 đều có bằng chứng, không có AR-ECD-90 hoặc AR-ECD-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
case-dossier
├─ case-question-and-criteria
├─ criteria-status-index
├─ evidence-register
├─ contradiction-and-gap-summary
├─ selected-evidence-detail
├─ resolution-rationale
└─ decision-record
~~~

Quan hệ quan trọng: Criteria and evidence are independent many-to-many owners; rationale cannot outrun unresolved required evidence.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| case-dossier | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa case-question-and-criteria, criteria-status-index, evidence-register, contradiction-and-gap-summary, selected-evidence-detail, resolution-rationale, decision-record nhưng giữ owner độc lập của từng region. |
| case-question-and-criteria | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Định hướng criteria-status-index mà không thay owner của nó. |
| criteria-status-index | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ case-question-and-criteria và ràng buộc evidence-register mà không gộp authority. |
| evidence-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ criteria-status-index và ràng buộc contradiction-and-gap-summary mà không gộp authority. |
| contradiction-and-gap-summary | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ evidence-register và ràng buộc selected-evidence-detail mà không gộp authority. |
| selected-evidence-detail | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ contradiction-and-gap-summary và ràng buộc resolution-rationale mà không gộp authority. |
| resolution-rationale | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ selected-evidence-detail và ràng buộc decision-record mà không gộp authority. |
| decision-record | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ resolution-rationale và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep criteria, evidence, selected detail, and rationale inspectable together.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Keep criteria visible and move selected evidence detail into the temporary supporting pane; gaps remain before rationale.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage criterion, linked evidence, gaps, rationale, then decision; Back preserves both selections and the draft.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): evidence loading/missing/stale/redacted; criterion met/not-met/uncertain; contradiction open/resolved; gap owner; rationale draft/conflict; decision pending/recorded/reopened; criterion↔evidence focus.

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
| domain states | Evidence E-14 now supports criterion C-2 without hiding its limits. Contradictory evidence remains open and blocks a final decision. The required gap has an owner and a verified artifact. Rationale recorded with supporting and contradicting evidence links. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang là hồ sơ chung, hội thoại hỗ trợ, trình soạn phê duyệt, audit event hoặc list-detail đơn giản, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [GOV.UK — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Hỗ trợ review before consequential submission. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [USWDS — Patterns](https://designsystem.digital.gov/patterns/) | Hỗ trợ task-oriented public-service flows. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical keyboard order and deterministic focus return. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "evidence-led-case-resolution-dossier",
  "matchedSituationCodes": [
    "AR-ECD-01",
    "AR-ECD-02"
  ],
  "aliases": [
    "evidence-led-case-resolution-dossier",
    "evidence-led case resolution dossier"
  ],
  "dominantTask": "Resolve one bounded case by testing explicit criteria against evidence, contradictions, and gaps before recording rationale.",
  "regions": [
    "case-dossier",
    "case-question-and-criteria",
    "criteria-status-index",
    "evidence-register",
    "contradiction-and-gap-summary",
    "selected-evidence-detail",
    "resolution-rationale",
    "decision-record"
  ],
  "relationships": [
    "Criteria and evidence are independent many-to-many owners; rationale cannot outrun unresolved required evidence."
  ],
  "responsive": {
    "wide": "Keep criteria, evidence, selected detail, and rationale inspectable together.",
    "intermediate": "Keep criteria visible and move selected evidence detail into the temporary supporting pane; gaps remain before rationale.",
    "compact": "Stage criterion, linked evidence, gaps, rationale, then decision; Back preserves both selections and the draft.",
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
