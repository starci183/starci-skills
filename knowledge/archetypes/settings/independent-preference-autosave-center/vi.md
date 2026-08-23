# Trung tâm tùy chọn tự lưu độc lập

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | independent-preference-autosave-center |
| Family | settings |
| Dominant task | Điều chỉnh các tùy chọn độc lập, mỗi thay đổi commit riêng với pending, lỗi, thử lại và hoàn tác theo từng điều khiển. |
| Search aliases | independent-preference-autosave-center; independent preference autosave center |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Điều chỉnh các tùy chọn độc lập, mỗi thay đổi commit riêng với pending, lỗi, thử lại và hoàn tác theo từng điều khiển.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-IPA-01 | Điều chỉnh các tùy chọn độc lập, mỗi thay đổi commit riêng với pending, lỗi, thử lại và hoàn tác theo từng điều khiển. | tín hiệu dương bắt buộc |
| AR-IPA-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-IPA-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-IPA-90 | một nút Save commit cả phần, tác vụ là wizard, policy accordion, matrix editor hoặc settings hub. | reject |
| AR-IPA-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-IPA-01 và AR-IPA-02 đều có bằng chứng, không có AR-IPA-90 hoặc AR-IPA-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
preference-center
├─ category-index
├─ preference-groups
├─ independent-preference-control
├─ per-control-status-and-undo
└─ reset-category-boundary
~~~

Quan hệ quan trọng: Every preference owns its own transaction; category reset is an explicit multi-control boundary and no global Save exists.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| preference-center | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa category-index, preference-groups, independent-preference-control, per-control-status-and-undo, reset-category-boundary nhưng giữ owner độc lập của từng region. |
| category-index | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Định hướng preference-groups mà không thay owner của nó. |
| preference-groups | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ category-index và ràng buộc independent-preference-control mà không gộp authority. |
| independent-preference-control | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ preference-groups và ràng buộc per-control-status-and-undo mà không gộp authority. |
| per-control-status-and-undo | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ independent-preference-control và ràng buộc reset-category-boundary mà không gộp authority. |
| reset-category-boundary | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ per-control-status-and-undo và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep category navigation and groups together with local status and undo beside each control.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Collapse category navigation while preserving group identity and independent transaction feedback.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Enter one category and stack controls with local status and undo; reset follows the visible group.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): initial/loading; saved; local pending; local failure/retry; undone; inherited/locked; dependency hidden/revealed; reset pending/partial failure; announced status.

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
| domain states | Digest preference saved independently; other controls remain unchanged. Theme preference saved independently with local confirmation. Notification preference retry succeeded at its own control. Digest preference restored without invoking a page-level transaction. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi một nút Save commit cả phần, tác vụ là wizard, policy accordion, matrix editor hoặc settings hub, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced dynamic status without unnecessary focus movement. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "independent-preference-autosave-center",
  "matchedSituationCodes": [
    "AR-IPA-01",
    "AR-IPA-02"
  ],
  "aliases": [
    "independent-preference-autosave-center",
    "independent preference autosave center"
  ],
  "dominantTask": "Adjust independent preferences whose changes commit separately with per-control pending, error, retry, and undo.",
  "regions": [
    "preference-center",
    "category-index",
    "preference-groups",
    "independent-preference-control",
    "per-control-status-and-undo",
    "reset-category-boundary"
  ],
  "relationships": [
    "Every preference owns its own transaction; category reset is an explicit multi-control boundary and no global Save exists."
  ],
  "responsive": {
    "wide": "Keep category navigation and groups together with local status and undo beside each control.",
    "intermediate": "Collapse category navigation while preserving group identity and independent transaction feedback.",
    "compact": "Enter one category and stack controls with local status and undo; reset follows the visible group.",
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
