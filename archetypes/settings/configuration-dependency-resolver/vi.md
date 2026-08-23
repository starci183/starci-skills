# Trình giải quyết phụ thuộc cấu hình

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | configuration-dependency-resolver |
| Family | settings |
| Dominant task | Lần theo một vi phạm cấu hình qua đường phụ thuộc, so sánh các cách giải hợp lệ và áp dụng an toàn. |
| Search aliases | configuration-dependency-resolver; configuration dependency resolver |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Lần theo một vi phạm cấu hình qua đường phụ thuộc, so sánh các cách giải hợp lệ và áp dụng an toàn.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CDR-01 | Lần theo một vi phạm cấu hình qua đường phụ thuộc, so sánh các cách giải hợp lệ và áp dụng an toàn. | tín hiệu dương bắt buộc |
| AR-CDR-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-CDR-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-CDR-90 | nhu cầu là monitor thụ động, tạo rule, validation thường, kiểm provenance hoặc chỉnh workflow. | reject |
| AR-CDR-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CDR-01 và AR-CDR-02 đều có bằng chứng, không có AR-CDR-90 hoặc AR-CDR-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
dependency-resolver
├─ violation-summary
├─ dependency-constraint-graph
├─ selected-constraint-evidence
├─ candidate-resolution-set
├─ before-after-resolution-preview
└─ apply-and-verification
~~~

Quan hệ quan trọng: The graph explains causality; the preview owns consequences and verification owns whether apply may stand.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| dependency-resolver | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa violation-summary, dependency-constraint-graph, selected-constraint-evidence, candidate-resolution-set, before-after-resolution-preview, apply-and-verification nhưng giữ owner độc lập của từng region. |
| violation-summary | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Định hướng dependency-constraint-graph mà không thay owner của nó. |
| dependency-constraint-graph | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ violation-summary và ràng buộc selected-constraint-evidence mà không gộp authority. |
| selected-constraint-evidence | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ dependency-constraint-graph và ràng buộc candidate-resolution-set mà không gộp authority. |
| candidate-resolution-set | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ selected-constraint-evidence và ràng buộc before-after-resolution-preview mà không gộp authority. |
| before-after-resolution-preview | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ candidate-resolution-set và ràng buộc apply-and-verification mà không gộp authority. |
| apply-and-verification | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ before-after-resolution-preview và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Compare violations, dependency path, selected evidence, and before/after preview together.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move the graph into the temporary pane while violations, active path summary, and preview remain primary.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage violation, dependency path, candidates, preview, apply, and verification; the graph may become a path list.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): detecting; no violations; selected constraint; incomplete graph; cyclic dependency; candidate calculating/incompatible; stale preview; apply pending/failure/rollback; verification pass/fail.

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
| domain states | Constraint C-7 selected with its dependency path. Resolution A preview changes two dependent values; resolution B remains comparable. Candidate applied locally; verification is pending and duplicate apply is blocked. Verification failed, so rollback restored the selected path and prior values. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi nhu cầu là monitor thụ động, tạo rule, validation thường, kiểm provenance hoặc chỉnh workflow, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [GitLab Pajamas — Progressive disclosure](https://design.gitlab.com/patterns/progressive-disclosure/) | Hỗ trợ graduated disclosure of dependency detail. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced dynamic status without unnecessary focus movement. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "configuration-dependency-resolver",
  "matchedSituationCodes": [
    "AR-CDR-01",
    "AR-CDR-02"
  ],
  "aliases": [
    "configuration-dependency-resolver",
    "configuration dependency resolver"
  ],
  "dominantTask": "Trace one configuration violation through its dependency path, compare valid resolutions, and apply one safely.",
  "regions": [
    "dependency-resolver",
    "violation-summary",
    "dependency-constraint-graph",
    "selected-constraint-evidence",
    "candidate-resolution-set",
    "before-after-resolution-preview",
    "apply-and-verification"
  ],
  "relationships": [
    "The graph explains causality; the preview owns consequences and verification owns whether apply may stand."
  ],
  "responsive": {
    "wide": "Compare violations, dependency path, selected evidence, and before/after preview together.",
    "intermediate": "Move the graph into the temporary pane while violations, active path summary, and preview remain primary.",
    "compact": "Stage violation, dependency path, candidates, preview, apply, and verification; the graph may become a path list.",
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
