# Chọn và mua plan

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `plan-selection-purchase` |
| Family | `flow` |
| Nhiệm vụ trội | So sánh trade-off liên quan quyết định, chọn billing terms và hoàn tất purchase với price cùng consequence gắn vào selection. |
| Bí danh tìm kiếm | `pricing plan purchase`, `subscription selection`, `plan and billing checkout` |
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
| `PSP-01` | So sánh trade-off liên quan quyết định, chọn billing terms và hoàn tất purchase với price cùng consequence gắn vào selection. | tín hiệu dương bắt buộc |
| `PSP-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `PSP-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `PSP-90` | Từ chối broad comparison matrix hoặc multi-line-item cart. | từ chối |
| `PSP-91` | Từ chối detail decision rail, upgrade micro-action hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `PSP-01` và `PSP-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `PSP-90` hoặc `PSP-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
plan-purchase
├─ purchase-context
├─ plan-options-and-differences
├─ billing-term-control
├─ selected-plan-summary
├─ payment-or-confirmation
└─ purchase-action
```

- **Quan hệ dùng chung:** Plan và billing term tạo một shared selection; price, eligibility, payment và purchase consequence luôn gắn cùng selection revision.
- `plan-purchase -> purchase-context`: `purchase-context` dùng named context hoặc revision từ `plan-purchase` và cung cấp explicit return hoặc reconciliation path.
- `purchase-context -> plan-options-and-differences`: `plan-options-and-differences` dùng named context hoặc revision từ `purchase-context` và cung cấp explicit return hoặc reconciliation path.
- `plan-options-and-differences -> billing-term-control`: `billing-term-control` dùng named context hoặc revision từ `plan-options-and-differences` và cung cấp explicit return hoặc reconciliation path.
- `billing-term-control -> selected-plan-summary`: `selected-plan-summary` dùng named context hoặc revision từ `billing-term-control` và cung cấp explicit return hoặc reconciliation path.
- `selected-plan-summary -> payment-or-confirmation`: `payment-or-confirmation` dùng named context hoặc revision từ `selected-plan-summary` và cung cấp explicit return hoặc reconciliation path.
- `payment-or-confirmation -> purchase-action`: `purchase-action` dùng named context hoặc revision từ `payment-or-confirmation` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `plan-purchase` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của plan purchase; child regions không được commit bên ngoài boundary này. |
| `purchase-context` | Sở hữu orientation và immutable basis của purchase context để qualify mọi downstream decision. |
| `plan-options-and-differences` | Sở hữu input hoặc decision của plan options and differences và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `billing-term-control` | Sở hữu input hoặc decision của billing term control và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `selected-plan-summary` | Sở hữu derived state của selected plan summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `payment-or-confirmation` | Sở hữu input hoặc decision của payment or confirmation và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `purchase-action` | Sở hữu commitment boundary của purchase action và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Một tập plan nhỏ đồng hiện với shared attributes trong khi selected summary giữ vai trò support.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Explicit plan selector giảm số options đồng hiện trong khi key differences và current price vẫn kế cận.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Một plan mỗi lần hoặc vertical options giữ essentials và selected price mà không phụ thuộc horizontal carousel.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `plan-purchase` → `purchase-context` → `plan-options-and-differences` → `billing-term-control` → `selected-plan-summary` → `payment-or-confirmation` → `purchase-action`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `no selection` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `billing interval changed` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `plan unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `recommended plan` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `eligibility constraint` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `price recalculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `tax recalculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `discount invalid` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `payment pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `payment declined` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `terms changed` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `purchase conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `success handoff` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi một selected plan và billing term là shared state xuyên purchase.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối broad comparison matrix hoặc multi-line-item cart.
- Từ chối detail decision rail, upgrade micro-action hoặc centered task.
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
| [Stripe — Checkout documentation](https://docs.stripe.com/payments/checkout) | Purchase completion giữ payment outcome và retry states rõ. | Không định nghĩa plan comparison hoặc visual layout. |
| [Shopify — App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Commerce surface phân biệt primary work với supporting status. | Không định nghĩa fictional cart hoặc price calculation này. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Content-driven layout thích nghi trong khi giữ hierarchy. | Không định nghĩa exact regions hoặc thresholds. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Required content reflow mà không tạo page-level two-dimensional scrolling. | Không quy định breakpoint hoặc region geometry. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "plan-selection-purchase",
  "situationCodes": [
    "PSP-01",
    "PSP-02",
    "PSP-03"
  ],
  "searchAliases": [
    "pricing plan purchase",
    "subscription selection",
    "plan and billing checkout"
  ],
  "dominantTask": "So sánh trade-off liên quan quyết định, chọn billing terms và hoàn tất purchase với price cùng consequence gắn vào selection.",
  "regions": [
    "plan-purchase",
    "purchase-context",
    "plan-options-and-differences",
    "billing-term-control",
    "selected-plan-summary",
    "payment-or-confirmation",
    "purchase-action"
  ],
  "regionRelationships": [
    "plan-purchase -> purchase-context",
    "purchase-context -> plan-options-and-differences",
    "plan-options-and-differences -> billing-term-control",
    "billing-term-control -> selected-plan-summary",
    "selected-plan-summary -> payment-or-confirmation",
    "payment-or-confirmation -> purchase-action"
  ],
  "responsive": {
    "wide": "Một tập plan nhỏ đồng hiện với shared attributes trong khi selected summary giữ vai trò support.",
    "intermediate": "Explicit plan selector giảm số options đồng hiện trong khi key differences và current price vẫn kế cận.",
    "compact": "Một plan mỗi lần hoặc vertical options giữ essentials và selected price mà không phụ thuộc horizontal carousel.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "plan-purchase -> purchase-context -> plan-options-and-differences -> billing-term-control -> selected-plan-summary -> payment-or-confirmation -> purchase-action",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "no selection",
    "billing interval changed",
    "plan unavailable",
    "recommended plan",
    "eligibility constraint",
    "price recalculating",
    "tax recalculating",
    "discount invalid",
    "payment pending",
    "payment declined",
    "terms changed",
    "purchase conflict",
    "success handoff"
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
