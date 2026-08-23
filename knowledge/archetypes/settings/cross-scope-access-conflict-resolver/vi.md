# Trình giải xung đột truy cập xuyên phạm vi

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | cross-scope-access-conflict-resolver |
| Family | settings |
| Dominant task | Giải quyết ý định bị chặn bằng cách so sánh chênh lệch quyền giữa các phạm vi và chọn chuyển, yêu cầu hoặc từ bỏ. |
| Search aliases | cross-scope-access-conflict-resolver; cross-scope access conflict resolver |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Giải quyết ý định bị chặn bằng cách so sánh chênh lệch quyền giữa các phạm vi và chọn chuyển, yêu cầu hoặc từ bỏ.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CAC-01 | Giải quyết ý định bị chặn bằng cách so sánh chênh lệch quyền giữa các phạm vi và chọn chuyển, yêu cầu hoặc từ bỏ. | tín hiệu dương bắt buộc |
| AR-CAC-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-CAC-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-CAC-90 | nhu cầu là kết quả quyền chung, matrix chỉnh quyền, account switcher, outage hoặc so sánh gói. | reject |
| AR-CAC-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CAC-01 và AR-CAC-02 đều có bằng chứng, không có AR-CAC-90 hoặc AR-CAC-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
access-resolver
├─ retained-intent-and-current-scope
├─ candidate-scope-list
├─ permission-delta-comparison
├─ selected-scope-consequence
├─ switch-or-request-action
└─ return-to-intent
~~~

Quan hệ quan trọng: The original intent remains retained; gained, lost, and unchanged permissions all bind to the selected candidate scope.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| access-resolver | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa retained-intent-and-current-scope, candidate-scope-list, permission-delta-comparison, selected-scope-consequence, switch-or-request-action, return-to-intent nhưng giữ owner độc lập của từng region. |
| retained-intent-and-current-scope | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Định hướng candidate-scope-list mà không thay owner của nó. |
| candidate-scope-list | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ retained-intent-and-current-scope và ràng buộc permission-delta-comparison mà không gộp authority. |
| permission-delta-comparison | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ candidate-scope-list và ràng buộc selected-scope-consequence mà không gộp authority. |
| selected-scope-consequence | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ permission-delta-comparison và ràng buộc switch-or-request-action mà không gộp authority. |
| switch-or-request-action | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận context từ selected-scope-consequence và ràng buộc return-to-intent mà không gộp authority. |
| return-to-intent | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ switch-or-request-action và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Compare at least three candidate scopes with permission deltas and consequences visible together.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Turn candidates into a selector while gained, lost, and unchanged groups remain visible.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage scope list, selected delta, consequence, action, then return to the retained intent.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): candidates loading/none; current/candidate; permission gained/lost/unknown; inaccessible scope; request pending/approved/denied; switch failure; stale intent; focus return.

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
| domain states | Team scope selected: two permissions gained and one lost. Division scope selected: one gained, two unchanged, and one lost. Restricted scope request is pending; the original intent remains retained. Returned to the blocked export intent with the approved scope selected. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi nhu cầu là kết quả quyền chung, matrix chỉnh quyền, account switcher, outage hoặc so sánh gói, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [Salesforce — Tree Grid](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-tree-grid.html) | Hỗ trợ hierarchical comparison semantics. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ scan and action relationships in dense records. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical keyboard order and deterministic focus return. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "cross-scope-access-conflict-resolver",
  "matchedSituationCodes": [
    "AR-CAC-01",
    "AR-CAC-02"
  ],
  "aliases": [
    "cross-scope-access-conflict-resolver",
    "cross-scope access conflict resolver"
  ],
  "dominantTask": "Resolve a blocked intent by comparing permission deltas across candidate scopes and choosing switch, request, or abandon.",
  "regions": [
    "access-resolver",
    "retained-intent-and-current-scope",
    "candidate-scope-list",
    "permission-delta-comparison",
    "selected-scope-consequence",
    "switch-or-request-action",
    "return-to-intent"
  ],
  "relationships": [
    "The original intent remains retained; gained, lost, and unchanged permissions all bind to the selected candidate scope."
  ],
  "responsive": {
    "wide": "Compare at least three candidate scopes with permission deltas and consequences visible together.",
    "intermediate": "Turn candidates into a selector while gained, lost, and unchanged groups remain visible.",
    "compact": "Stage scope list, selected delta, consequence, action, then return to the retained intent.",
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
