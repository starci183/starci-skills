# Trình phân bổ hạn mức có ràng buộc

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | constrained-quota-allocation-editor |
| Family | settings |
| Dominant task | Phân bổ một tổng bất biến cho các bên nhận trong khi đối soát số dư còn lại và ràng buộc xuyên hàng. |
| Search aliases | constrained-quota-allocation-editor; constrained quota allocation editor |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Phân bổ một tổng bất biến cho các bên nhận trong khi đối soát số dư còn lại và ràng buộc xuyên hàng.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CQA-01 | Phân bổ một tổng bất biến cho các bên nhận trong khi đối soát số dư còn lại và ràng buộc xuyên hàng. | tín hiệu dương bắt buộc |
| AR-CQA-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-CQA-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-CQA-90 | tác vụ là permissions matrix, tùy chọn độc lập, chỉnh spreadsheet tự do, transfer list hoặc scheduler. | reject |
| AR-CQA-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CQA-01 và AR-CQA-02 đều có bằng chứng, không có AR-CQA-90 hoặc AR-CQA-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
quota-editor
├─ scope-and-conserved-total
├─ recipient-allocation-collection
├─ remaining-balance-ledger
├─ cross-row-constraint-summary
├─ selected-recipient-editor
└─ whole-plan-review-and-commit
~~~

Quan hệ quan trọng: The conserved total and remaining ledger are global invariant owners; no recipient row can commit independently.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| quota-editor | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa scope-and-conserved-total, recipient-allocation-collection, remaining-balance-ledger, cross-row-constraint-summary, selected-recipient-editor, whole-plan-review-and-commit nhưng giữ owner độc lập của từng region. |
| scope-and-conserved-total | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Định hướng recipient-allocation-collection mà không thay owner của nó. |
| recipient-allocation-collection | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ scope-and-conserved-total và ràng buộc remaining-balance-ledger mà không gộp authority. |
| remaining-balance-ledger | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận context từ recipient-allocation-collection và ràng buộc cross-row-constraint-summary mà không gộp authority. |
| cross-row-constraint-summary | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ remaining-balance-ledger và ràng buộc selected-recipient-editor mà không gộp authority. |
| selected-recipient-editor | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ cross-row-constraint-summary và ràng buộc whole-plan-review-and-commit mà không gộp authority. |
| whole-plan-review-and-commit | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận trạng thái đã verify từ selected-recipient-editor và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep allocations beside a persistent balance and constraint summary; the row editor stays subordinate to whole-plan review.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Reduce comparison columns and move the selected recipient editor into the temporary pane while balance remains visible.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage allocation list, recipient edit, balance and violations, then whole-plan commit.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): unallocated/overallocated/balanced; recipient min/max/locked; invalid unit; calculating total; bulk distribution; dirty plan; commit pending/conflict; stale capacity.

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
| domain states | Alpha allocation is 40; 60 units remain. Beta allocation is 35; 25 units remain and all cross-row constraints pass so far. Gamma allocation is 25; the conserved total is balanced at 100. Whole plan committed once; no row was committed independently. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi tác vụ là permissions matrix, tùy chọn độc lập, chỉnh spreadsheet tự do, transfer list hoặc scheduler, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ scan and action relationships in dense records. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ content availability without page-level two-dimensional scrolling. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "constrained-quota-allocation-editor",
  "matchedSituationCodes": [
    "AR-CQA-01",
    "AR-CQA-02"
  ],
  "aliases": [
    "constrained-quota-allocation-editor",
    "constrained quota allocation editor"
  ],
  "dominantTask": "Allocate one conserved total across recipients while reconciling remaining balance and cross-row constraints.",
  "regions": [
    "quota-editor",
    "scope-and-conserved-total",
    "recipient-allocation-collection",
    "remaining-balance-ledger",
    "cross-row-constraint-summary",
    "selected-recipient-editor",
    "whole-plan-review-and-commit"
  ],
  "relationships": [
    "The conserved total and remaining ledger are global invariant owners; no recipient row can commit independently."
  ],
  "responsive": {
    "wide": "Keep allocations beside a persistent balance and constraint summary; the row editor stays subordinate to whole-plan review.",
    "intermediate": "Reduce comparison columns and move the selected recipient editor into the temporary pane while balance remains visible.",
    "compact": "Stage allocation list, recipient edit, balance and violations, then whole-plan commit.",
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
