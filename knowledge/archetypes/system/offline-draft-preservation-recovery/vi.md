# Khôi phục và bảo toàn bản nháp ngoại tuyến

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | offline-draft-preservation-recovery |
| Family | system |
| Dominant task | Bảo toàn công việc sau khi kết nối lại bằng cách so sánh bản nháp cục bộ với trạng thái server và chọn kết quả đồng bộ an toàn. |
| Search aliases | offline-draft-preservation-recovery; offline draft preservation recovery |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Bảo toàn công việc sau khi kết nối lại bằng cách so sánh bản nháp cục bộ với trạng thái server và chọn kết quả đồng bộ an toàn.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ODP-01 | Bảo toàn công việc sau khi kết nối lại bằng cách so sánh bản nháp cục bộ với trạng thái server và chọn kết quả đồng bộ an toàn. | tín hiệu dương bắt buộc |
| AR-ODP-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ODP-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ODP-90 | nhu cầu là lỗi chung, diff workbench có thể sửa, conflict toast, version history hoặc xác nhận giữa trang. | reject |
| AR-ODP-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ODP-01 và AR-ODP-02 đều có bằng chứng, không có AR-ODP-90 hoặc AR-ODP-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
draft-recovery
├─ retained-task-identity
├─ local-snapshot-summary
├─ server-state-summary
├─ conflict-and-loss-analysis
├─ preservation-options
├─ merged-outcome-review
└─ sync-result
~~~

Quan hệ quan trọng: Local and server snapshots are peer evidence owners; every option explains loss before synchronization.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| draft-recovery | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa retained-task-identity, local-snapshot-summary, server-state-summary, conflict-and-loss-analysis, preservation-options, merged-outcome-review, sync-result nhưng giữ owner độc lập của từng region. |
| retained-task-identity | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng local-snapshot-summary mà không thay owner của nó. |
| local-snapshot-summary | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ retained-task-identity và ràng buộc server-state-summary mà không gộp authority. |
| server-state-summary | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ local-snapshot-summary và ràng buộc conflict-and-loss-analysis mà không gộp authority. |
| conflict-and-loss-analysis | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ server-state-summary và ràng buộc preservation-options mà không gộp authority. |
| preservation-options | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ conflict-and-loss-analysis và ràng buộc merged-outcome-review mà không gộp authority. |
| merged-outcome-review | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ preservation-options và ràng buộc sync-result mà không gộp authority. |
| sync-result | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ merged-outcome-review và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Compare local and server summaries with conflict analysis before presenting preservation options.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Stack aligned snapshot summaries while keeping outcome review visible before synchronization.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage local, server, conflicts, preservation choice, outcome review, then sync; never overwrite automatically.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): offline/local-only; reconnecting; server unchanged/changed/deleted; conflict; stale local; merge possible/impossible; sync pending/failure/retry/success; recoverable backup.

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
| domain states | Local-only edit preserved in a recoverable snapshot. Server changed while offline; aligned differences identify both versions. Preserve-both selected; no local or server text is silently discarded. Reviewed merge synchronized and the backup remains recoverable. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi nhu cầu là lỗi chung, diff workbench có thể sửa, conflict toast, version history hoặc xác nhận giữa trang, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [GitLab Pajamas — Saving and feedback](https://design.gitlab.com/patterns/saving-and-feedback/) | Hỗ trợ pending, success, failure, and recovery feedback. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [USWDS — Patterns](https://designsystem.digital.gov/patterns/) | Hỗ trợ task-oriented public-service flows. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ content availability without page-level two-dimensional scrolling. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "offline-draft-preservation-recovery",
  "matchedSituationCodes": [
    "AR-ODP-01",
    "AR-ODP-02"
  ],
  "aliases": [
    "offline-draft-preservation-recovery",
    "offline draft preservation recovery"
  ],
  "dominantTask": "Preserve work after reconnect by comparing a local draft with server state and choosing a safe synchronization outcome.",
  "regions": [
    "draft-recovery",
    "retained-task-identity",
    "local-snapshot-summary",
    "server-state-summary",
    "conflict-and-loss-analysis",
    "preservation-options",
    "merged-outcome-review",
    "sync-result"
  ],
  "relationships": [
    "Local and server snapshots are peer evidence owners; every option explains loss before synchronization."
  ],
  "responsive": {
    "wide": "Compare local and server summaries with conflict analysis before presenting preservation options.",
    "intermediate": "Stack aligned snapshot summaries while keeping outcome review visible before synchronization.",
    "compact": "Stage local, server, conflicts, preservation choice, outcome review, then sync; never overwrite automatically.",
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
