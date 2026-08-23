# Luồng cart checkout

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `cart-checkout-flow` |
| Family | `flow` |
| Nhiệm vụ trội | Xác nhận line items, cung cấp fulfillment, contact và payment, rà soát totals rồi submit một order không trùng lặp. |
| Bí danh tìm kiếm | `multi-item checkout`, `cart payment flow`, `order submission checkout` |
| Thẩm quyền | Macro topology và behavior contract trung lập sản phẩm. |

### Bất biến

- Archetype chỉ sở hữu dominant task, required regions, quan hệ vùng, responsive transformations, interaction parity và state families.
- Grammar sở hữu product nouns, semantic owners, domain rules và state transitions.
- Principles sở hữu exact geometry, measure, gap, alignment, overflow values và responsive thresholds.
- Direction sở hữu visual character; template chỉ là một realization trung tính và conforming.
- Reading order, DOM order và focus order giữ cùng semantic sequence ở mọi topology.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `CCF-01` | Xác nhận line items, cung cấp fulfillment, contact và payment, rà soát totals rồi submit một order không trùng lặp. | tín hiệu dương bắt buộc |
| `CCF-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `CCF-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `CCF-90` | Từ chối one-plan purchase hoặc generic review ledger. | từ chối |
| `CCF-91` | Từ chối receipt, donation hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `CCF-01` và `CCF-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `CCF-90` hoặc `CCF-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
checkout
├─ cart-line-items
├─ fulfillment-and-contact
├─ payment-input
├─ order-price-summary
├─ review-and-terms
└─ place-order-action
```

- **Quan hệ dùng chung:** Price summary được suy ra từ line items và fulfillment; payment cùng terms dùng reviewed total đó; Place order commit một guarded order revision.
- `checkout -> cart-line-items`: `cart-line-items` dùng named context hoặc revision từ `checkout` và cung cấp explicit return hoặc reconciliation path.
- `cart-line-items -> fulfillment-and-contact`: `fulfillment-and-contact` dùng named context hoặc revision từ `cart-line-items` và cung cấp explicit return hoặc reconciliation path.
- `fulfillment-and-contact -> payment-input`: `payment-input` dùng named context hoặc revision từ `fulfillment-and-contact` và cung cấp explicit return hoặc reconciliation path.
- `payment-input -> order-price-summary`: `order-price-summary` dùng named context hoặc revision từ `payment-input` và cung cấp explicit return hoặc reconciliation path.
- `order-price-summary -> review-and-terms`: `review-and-terms` dùng named context hoặc revision từ `order-price-summary` và cung cấp explicit return hoặc reconciliation path.
- `review-and-terms -> place-order-action`: `place-order-action` dùng named context hoặc revision từ `review-and-terms` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `checkout` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của checkout; child regions không được commit bên ngoài boundary này. |
| `cart-line-items` | Sở hữu input hoặc decision của cart line items và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `fulfillment-and-contact` | Sở hữu input hoặc decision của fulfillment and contact và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `payment-input` | Sở hữu input hoặc decision của payment input và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `order-price-summary` | Sở hữu derived state của order price summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `review-and-terms` | Sở hữu input hoặc decision của review and terms và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `place-order-action` | Sở hữu commitment boundary của place order action và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Checkout form là primary; derived order summary chỉ hỗ trợ khi focus và validation không bị che.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Order summary thành collapsible trong khi total và material price changes vẫn hiện trước payment.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Task thành cart, fulfillment, payment và review với final total cùng line items trước Place order.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `checkout` → `cart-line-items` → `fulfillment-and-contact` → `payment-input` → `order-price-summary` → `review-and-terms` → `place-order-action`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `empty cart` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `changed cart` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `stock unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `quantity conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `shipping recalculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `tax recalculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `promo invalid` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `payment pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `payment declined` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `payment retry` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `price stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `duplicate prevention` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `success handoff` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `recoverable draft` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi nhiều priced line items cấp dữ liệu cho fulfillment, payment và một order submission.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối one-plan purchase hoặc generic review ledger.
- Từ chối receipt, donation hoặc centered task.
- Từ chối khi khác biệt chỉ là product noun, card count, density, color, component hoặc state variation.

### Phán quyết ranh giới

- Mặc định `needs-evidence`; `accept` chỉ hợp lệ theo executable selection rule ở trên.

## Bàn giao

- **Grammar:** Cung cấp product actors, nouns, semantic owners, domain rules, eligibility, transition và consequence.
- **Principles:** Giải quyết exact grid, measure, gap, size, alignment, overflow, sticky offsets và content-driven thresholds.
- **Direction:** Giải quyết visual character mà không thay topology hoặc ownership.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các nguồn dưới đây là bằng chứng so sánh mang tính tham khảo. Chúng không phải product truth, không chọn Grammar owner, không cấp quyền copy geometry hoặc component tree, và không override authority của Source.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [GOV.UK Design System — Payment card details](https://design-system.service.gov.uk/patterns/payment-card-details/) | Payment collection cần field ownership và error recovery rõ. | Không định nghĩa cart, pricing hoặc processor rules. |
| [Shopify — App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Commerce surface phân biệt primary work với supporting status. | Không định nghĩa fictional cart hoặc price calculation này. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submission hỗ trợ review, correction và confirmation. | Không định nghĩa domain consequence hoặc approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "cart-checkout-flow",
  "situationCodes": [
    "CCF-01",
    "CCF-02",
    "CCF-03"
  ],
  "searchAliases": [
    "multi-item checkout",
    "cart payment flow",
    "order submission checkout"
  ],
  "dominantTask": "Xác nhận line items, cung cấp fulfillment, contact và payment, rà soát totals rồi submit một order không trùng lặp.",
  "regions": [
    "checkout",
    "cart-line-items",
    "fulfillment-and-contact",
    "payment-input",
    "order-price-summary",
    "review-and-terms",
    "place-order-action"
  ],
  "regionRelationships": [
    "checkout -> cart-line-items",
    "cart-line-items -> fulfillment-and-contact",
    "fulfillment-and-contact -> payment-input",
    "payment-input -> order-price-summary",
    "order-price-summary -> review-and-terms",
    "review-and-terms -> place-order-action"
  ],
  "responsive": {
    "wide": "Checkout form là primary; derived order summary chỉ hỗ trợ khi focus và validation không bị che.",
    "intermediate": "Order summary thành collapsible trong khi total và material price changes vẫn hiện trước payment.",
    "compact": "Task thành cart, fulfillment, payment và review với final total cùng line items trước Place order.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "checkout -> cart-line-items -> fulfillment-and-contact -> payment-input -> order-price-summary -> review-and-terms -> place-order-action",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "empty cart",
    "changed cart",
    "stock unavailable",
    "quantity conflict",
    "shipping recalculating",
    "tax recalculating",
    "promo invalid",
    "payment pending",
    "payment declined",
    "payment retry",
    "price stale",
    "duplicate prevention",
    "success handoff",
    "recoverable draft"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product actors và nouns",
    "semantic owners",
    "domain rules và transitions"
  ],
  "principlesHandoff": [
    "exact geometry và thresholds",
    "measure và spacing",
    "sticky offsets và overflow values"
  ],
  "confidence": "high",
  "evidence": [
    "dominant-task",
    "region-relationship",
    "responsive-failure",
    "state-family",
    "official-research"
  ]
}
```

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.
