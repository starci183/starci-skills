# Đặt chỗ theo không gian

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `spatial-seat-reservation` |
| Family | `flow` |
| Nhiệm vụ trội | Chọn và giữ chỗ theo adjacency, spatial location, accessibility, category và price trước checkout. |
| Bí danh tìm kiếm | `seat map reservation`, `accessible seat selection`, `spatial ticket hold` |
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
| `SSR-01` | Chọn và giữ chỗ theo adjacency, spatial location, accessibility, category và price trước checkout. | tín hiệu dương bắt buộc |
| `SSR-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `SSR-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `SSR-90` | Từ chối time-slot booking, map result browsing hoặc plan selection. | từ chối |
| `SSR-91` | Từ chối static venue map hoặc decorative seat chart. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `SSR-01` và `SSR-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `SSR-90` hoặc `SSR-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
seat-reservation
├─ event-and-party-context
├─ seat-map-and-legend ↔ accessible-seat-list
├─ selected-seat-summary
├─ hold-timer-and-price
└─ continue
```

- **Quan hệ dùng chung:** Map và accessible list là hai view hai chiều của cùng seat identities và selection; hold timer cùng price qualify shared selection trước Continue.
- `seat-reservation -> event-and-party-context`: `event-and-party-context` dùng named context hoặc revision từ `seat-reservation` và cung cấp explicit return hoặc reconciliation path.
- `event-and-party-context -> seat-map-and-legend`: `seat-map-and-legend` dùng named context hoặc revision từ `event-and-party-context` và cung cấp explicit return hoặc reconciliation path.
- `seat-map-and-legend -> accessible-seat-list`: `accessible-seat-list` dùng named context hoặc revision từ `seat-map-and-legend` và cung cấp explicit return hoặc reconciliation path.
- `accessible-seat-list -> selected-seat-summary`: `selected-seat-summary` dùng named context hoặc revision từ `accessible-seat-list` và cung cấp explicit return hoặc reconciliation path.
- `selected-seat-summary -> hold-timer-and-price`: `hold-timer-and-price` dùng named context hoặc revision từ `selected-seat-summary` và cung cấp explicit return hoặc reconciliation path.
- `hold-timer-and-price -> continue`: `continue` dùng named context hoặc revision từ `hold-timer-and-price` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `seat-reservation` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của seat reservation; child regions không được commit bên ngoài boundary này. |
| `event-and-party-context` | Sở hữu orientation và immutable basis của event and party context để qualify mọi downstream decision. |
| `seat-map-and-legend` | Sở hữu input hoặc decision của seat map and legend và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `accessible-seat-list` | Sở hữu input hoặc decision của accessible seat list và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `selected-seat-summary` | Sở hữu derived state của selected seat summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `hold-timer-and-price` | Sở hữu derived state của hold timer and price; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `continue` | Sở hữu commitment boundary của continue và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Bounded seat map và selected-price summary đồng hiện; map cùng accessible list chia sẻ seat identity.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Summary thành temporary trong khi map giữ operable scale và accessible list vẫn reachable.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Accessible seat list là mặc định còn map là optional full-screen view; timer ở trong flow.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `seat-reservation` → `event-and-party-context` → `seat-map-and-legend` → `accessible-seat-list` → `selected-seat-summary` → `hold-timer-and-price` → `continue`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `layout loading` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `available seat` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `selected seat` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `held seat` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `unavailable seat` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `accessible seat` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `adjacency warning` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `price change` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `hold countdown` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `hold expiry` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `concurrent conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `map unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `list parity` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `checkout pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi spatial adjacency và list parity điều khiển held seat selection.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối time-slot booking, map result browsing hoặc plan selection.
- Từ chối static venue map hoặc decorative seat chart.
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
| [W3C WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Interactive spatial grid cần keyboard navigation và focus management rõ. | Không bắt buộc grid khi semantic list rõ hơn. |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Primary content giữ readable và operable relationships khi space đổi. | Không quy định geometry của web template này. |
| [Material Design 3 — Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) | Primary và supporting regions có thể transform theo available space. | Không định nghĩa product owners hoặc breakpoints. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Required content reflow mà không tạo page-level two-dimensional scrolling. | Không quy định breakpoint hoặc region geometry. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "spatial-seat-reservation",
  "situationCodes": [
    "SSR-01",
    "SSR-02",
    "SSR-03"
  ],
  "searchAliases": [
    "seat map reservation",
    "accessible seat selection",
    "spatial ticket hold"
  ],
  "dominantTask": "Chọn và giữ chỗ theo adjacency, spatial location, accessibility, category và price trước checkout.",
  "regions": [
    "seat-reservation",
    "event-and-party-context",
    "seat-map-and-legend",
    "accessible-seat-list",
    "selected-seat-summary",
    "hold-timer-and-price",
    "continue"
  ],
  "regionRelationships": [
    "seat-reservation -> event-and-party-context",
    "event-and-party-context -> seat-map-and-legend",
    "seat-map-and-legend -> accessible-seat-list",
    "accessible-seat-list -> selected-seat-summary",
    "selected-seat-summary -> hold-timer-and-price",
    "hold-timer-and-price -> continue"
  ],
  "responsive": {
    "wide": "Bounded seat map và selected-price summary đồng hiện; map cùng accessible list chia sẻ seat identity.",
    "intermediate": "Summary thành temporary trong khi map giữ operable scale và accessible list vẫn reachable.",
    "compact": "Accessible seat list là mặc định còn map là optional full-screen view; timer ở trong flow.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "seat-reservation -> event-and-party-context -> seat-map-and-legend -> accessible-seat-list -> selected-seat-summary -> hold-timer-and-price -> continue",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "layout loading",
    "available seat",
    "selected seat",
    "held seat",
    "unavailable seat",
    "accessible seat",
    "adjacency warning",
    "price change",
    "hold countdown",
    "hold expiry",
    "concurrent conflict",
    "map unavailable",
    "list parity",
    "checkout pending"
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
