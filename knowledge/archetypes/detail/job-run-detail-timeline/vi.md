# Chi tiết lần chạy theo dòng bước

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | job-run-detail-timeline |
| Family | detail |
| Dominant task | Xác định một lần thực thi đang ở đâu, vì sao dừng hoặc thất bại và hành động khôi phục nào áp dụng cho chính lần chạy đó. |
| Search aliases | job-run-detail-timeline; job run detail timeline |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Xác định một lần thực thi đang ở đâu, vì sao dừng hoặc thất bại và hành động khôi phục nào áp dụng cho chính lần chạy đó.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-JRD-01 | Xác định một lần thực thi đang ở đâu, vì sao dừng hoặc thất bại và hành động khôi phục nào áp dụng cho chính lần chạy đó. | tín hiệu dương bắt buộc |
| AR-JRD-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-JRD-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-JRD-90 | trang quản lý nhiều lần chạy, chỉ duyệt log không có bước, hoặc trình bày audit timeline. | reject |
| AR-JRD-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-JRD-01 và AR-JRD-02 đều có bằng chứng, không có AR-JRD-90 hoặc AR-JRD-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
run-detail
├─ run-identity-status-actions
├─ ordered-step-timeline
├─ active-or-failed-step
├─ bounded-log-output
├─ artifacts
└─ run-metadata
~~~

Quan hệ quan trọng: Ordered steps own progress meaning; the bounded log owns technical overflow, while artifacts and metadata support diagnosis.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| run-detail | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa run-identity-status-actions, ordered-step-timeline, active-or-failed-step, bounded-log-output, artifacts, run-metadata nhưng giữ owner độc lập của từng region. |
| run-identity-status-actions | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng ordered-step-timeline mà không thay owner của nó. |
| ordered-step-timeline | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ run-identity-status-actions và ràng buộc active-or-failed-step mà không gộp authority. |
| active-or-failed-step | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ ordered-step-timeline và ràng buộc bounded-log-output mà không gộp authority. |
| bounded-log-output | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ active-or-failed-step và ràng buộc artifacts mà không gộp authority. |
| artifacts | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ bounded-log-output và ràng buộc run-metadata mà không gộp authority. |
| run-metadata | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận trạng thái đã verify từ artifacts và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Compare the step timeline and bounded log while artifacts and metadata remain supporting context.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move metadata and artifacts into the temporary supporting pane; keep the current step and log usable together.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Prioritize status, failed step, recovery, log excerpt, artifacts, then metadata; full logs remain bounded.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): queued; running incremental updates; succeeded; failed; cancelling/cancelled; retry pending; disconnected/stale stream; empty/truncated log; artifact pending/unavailable; permission; announced step changes.

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
| domain states | Run queued; known anatomy remains visible. Selected step is running and its status was announced. The selected step failed; log evidence and retry stay associated. Retry passed; artifacts now match the completed run version. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang quản lý nhiều lần chạy, chỉ duyệt log không có bước, hoặc trình bày audit timeline, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [GitLab Pajamas — Loading](https://design.gitlab.com/patterns/loading/) | Hỗ trợ partial and incremental loading states. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Salesforce — Progress Indicator](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-progress-indicator.html) | Hỗ trợ ordered step state. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced dynamic status without unnecessary focus movement. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "job-run-detail-timeline",
  "matchedSituationCodes": [
    "AR-JRD-01",
    "AR-JRD-02"
  ],
  "aliases": [
    "job-run-detail-timeline",
    "job run detail timeline"
  ],
  "dominantTask": "Determine where one execution is, why it stopped or failed, and which recovery action applies to that run.",
  "regions": [
    "run-detail",
    "run-identity-status-actions",
    "ordered-step-timeline",
    "active-or-failed-step",
    "bounded-log-output",
    "artifacts",
    "run-metadata"
  ],
  "relationships": [
    "Ordered steps own progress meaning; the bounded log owns technical overflow, while artifacts and metadata support diagnosis."
  ],
  "responsive": {
    "wide": "Compare the step timeline and bounded log while artifacts and metadata remain supporting context.",
    "intermediate": "Move metadata and artifacts into the temporary supporting pane; keep the current step and log usable together.",
    "compact": "Prioritize status, failed step, recovery, log excerpt, artifacts, then metadata; full logs remain bounded.",
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
