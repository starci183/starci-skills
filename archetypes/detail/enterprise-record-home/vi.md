# Trang chủ hồ sơ doanh nghiệp

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | enterprise-record-home |
| Family | detail |
| Dominant task | Hiểu danh tính, vòng đời, dữ kiện chính và hành động tiếp theo của một hồ sơ doanh nghiệp trong khi ngữ cảnh liên quan vẫn chỉ đóng vai trò tham chiếu. |
| Search aliases | enterprise-record-home; enterprise record home |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Hiểu danh tính, vòng đời, dữ kiện chính và hành động tiếp theo của một hồ sơ doanh nghiệp trong khi ngữ cảnh liên quan vẫn chỉ đóng vai trò tham chiếu.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ERH-01 | Hiểu danh tính, vòng đời, dữ kiện chính và hành động tiếp theo của một hồ sơ doanh nghiệp trong khi ngữ cảnh liên quan vẫn chỉ đóng vai trò tham chiếu. | tín hiệu dương bắt buộc |
| AR-ERH-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ERH-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ERH-90 | chỉnh sửa là tác vụ chính, nhiều hồ sơ cần phân loại, hoặc trang là nội dung thuyết phục. | reject |
| AR-ERH-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ERH-01 và AR-ERH-02 đều có bằng chứng, không có AR-ERH-90 hoặc AR-ERH-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
record-home
├─ location-and-identity-header
├─ lifecycle-summary
├─ primary-record-sections
├─ related-context
└─ record-actions
~~~

Quan hệ quan trọng: Identity and lifecycle orient every section; related context supports, but never replaces, the current record decision.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| record-home | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa location-and-identity-header, lifecycle-summary, primary-record-sections, related-context, record-actions nhưng giữ owner độc lập của từng region. |
| location-and-identity-header | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng lifecycle-summary mà không thay owner của nó. |
| lifecycle-summary | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ location-and-identity-header và ràng buộc primary-record-sections mà không gộp authority. |
| primary-record-sections | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ lifecycle-summary và ràng buộc related-context mà không gộp authority. |
| related-context | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ primary-record-sections và ràng buộc record-actions mà không gộp authority. |
| record-actions | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ related-context và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep the header across the page and show primary record sections beside a supporting related-context rail only while record measure remains readable.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move related context into the temporary supporting pane while identity, lifecycle, and primary sections remain in one reading path.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage identity, lifecycle, facts, primary sections, actions, then related context; Back restores the active section.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): identity/loading; partial field failure; no related records; permission-redacted section; lifecycle transition pending/success/failure; stale concurrent update; archived/deleted record; focus action→status→record.

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
| domain states | Related record opened without changing the active section. Lifecycle transition pending; duplicate action is blocked. A concurrent update made this view stale. Current record reloaded; identity and active section are preserved. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi chỉnh sửa là tác vụ chính, nhiều hồ sơ cần phân loại, hoặc trang là nội dung thuyết phục, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [Salesforce — Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) | Hỗ trợ record identity, fields, and edit state. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Atlassian Design System — Page header](https://atlassian.design/components/page-header/) | Hỗ trợ page identity and contextual action hierarchy. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical keyboard order and deterministic focus return. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "enterprise-record-home",
  "matchedSituationCodes": [
    "AR-ERH-01",
    "AR-ERH-02"
  ],
  "aliases": [
    "enterprise-record-home",
    "enterprise record home"
  ],
  "dominantTask": "Understand the identity, lifecycle, key facts, and next action of one enterprise record while related context remains referential.",
  "regions": [
    "record-home",
    "location-and-identity-header",
    "lifecycle-summary",
    "primary-record-sections",
    "related-context",
    "record-actions"
  ],
  "relationships": [
    "Identity and lifecycle orient every section; related context supports, but never replaces, the current record decision."
  ],
  "responsive": {
    "wide": "Keep the header across the page and show primary record sections beside a supporting related-context rail only while record measure remains readable.",
    "intermediate": "Move related context into the temporary supporting pane while identity, lifecycle, and primary sections remain in one reading path.",
    "compact": "Stage identity, lifecycle, facts, primary sections, actions, then related context; Back restores the active section.",
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
