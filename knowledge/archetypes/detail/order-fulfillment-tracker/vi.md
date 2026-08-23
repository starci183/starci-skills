# Theo dõi hoàn tất đơn hàng

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | order-fulfillment-tracker |
| Family | detail |
| Dominant task | Đối soát một đơn hàng qua nhiều tiến trình vận chuyển độc lập và xử lý ngoại lệ xuyên lô hàng. |
| Search aliases | order-fulfillment-tracker; order fulfillment tracker |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Đối soát một đơn hàng qua nhiều tiến trình vận chuyển độc lập và xử lý ngoại lệ xuyên lô hàng.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-OFT-01 | Đối soát một đơn hàng qua nhiều tiến trình vận chuyển độc lập và xử lý ngoại lệ xuyên lô hàng. | tín hiệu dương bắt buộc |
| AR-OFT-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-OFT-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-OFT-90 | chỉ có một lô hàng tuyến tính, người dùng tự đẩy giai đoạn, hoặc nhiều đơn hàng được quản lý trong bảng. | reject |
| AR-OFT-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-OFT-01 và AR-OFT-02 đều có bằng chứng, không có AR-OFT-90 hoặc AR-OFT-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
fulfillment-detail
├─ order-identity
├─ derived-overall-fulfillment
├─ parallel-shipment-groups
├─ cross-shipment-exception-priority
├─ carrier-event-histories
└─ customer-resolution-actions
~~~

Quan hệ quan trọng: Each shipment owns an external progression; overall fulfillment is derived and unresolved exceptions precede history.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| fulfillment-detail | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa order-identity, derived-overall-fulfillment, parallel-shipment-groups, cross-shipment-exception-priority, carrier-event-histories, customer-resolution-actions nhưng giữ owner độc lập của từng region. |
| order-identity | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng derived-overall-fulfillment mà không thay owner của nó. |
| derived-overall-fulfillment | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận context từ order-identity và ràng buộc parallel-shipment-groups mà không gộp authority. |
| parallel-shipment-groups | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ derived-overall-fulfillment và ràng buộc cross-shipment-exception-priority mà không gộp authority. |
| cross-shipment-exception-priority | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ parallel-shipment-groups và ràng buộc carrier-event-histories mà không gộp authority. |
| carrier-event-histories | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ cross-shipment-exception-priority và ràng buộc customer-resolution-actions mà không gộp authority. |
| customer-resolution-actions | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ carrier-event-histories và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Show shipment groups and overall stage together, with unresolved exceptions taking priority over the support rail.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Lower the summary rail without merging independent shipments into a false single timeline.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Order identity and unresolved exception precede shipment groups and disclosed histories.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): split/unfulfilled/partial; shipment in-transit/delivered/delayed/failed/returned; contradictory carrier state; stale source; derived overall status; resolution pending/success/error; permission; timezone.

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
| domain states | Shipment A selected; its independent history is retained. Shipment B is delayed and the exception is described in text. Replacement request is pending for shipment B only. Overall state remains partial until every shipment reaches a compatible terminal state. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi chỉ có một lô hàng tuyến tính, người dùng tự đẩy giai đoạn, hoặc nhiều đơn hàng được quản lý trong bảng, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [USWDS — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Hỗ trợ textual step orientation. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced dynamic status without unnecessary focus movement. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "order-fulfillment-tracker",
  "matchedSituationCodes": [
    "AR-OFT-01",
    "AR-OFT-02"
  ],
  "aliases": [
    "order-fulfillment-tracker",
    "order fulfillment tracker"
  ],
  "dominantTask": "Reconcile one order across multiple independent shipment progressions and act on cross-shipment exceptions.",
  "regions": [
    "fulfillment-detail",
    "order-identity",
    "derived-overall-fulfillment",
    "parallel-shipment-groups",
    "cross-shipment-exception-priority",
    "carrier-event-histories",
    "customer-resolution-actions"
  ],
  "relationships": [
    "Each shipment owns an external progression; overall fulfillment is derived and unresolved exceptions precede history."
  ],
  "responsive": {
    "wide": "Show shipment groups and overall stage together, with unresolved exceptions taking priority over the support rail.",
    "intermediate": "Lower the summary rail without merging independent shipments into a false single timeline.",
    "compact": "Order identity and unresolved exception precede shipment groups and disclosed histories.",
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
