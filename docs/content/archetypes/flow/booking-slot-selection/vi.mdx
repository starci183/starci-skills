# Chọn slot đặt lịch

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `booking-slot-selection` |
| Family | `flow` |
| Nhiệm vụ trội | Chọn một time slot còn trống theo service, date, timezone và constraints, rồi giữ selection đủ lâu để tiếp tục. |
| Bí danh tìm kiếm | `appointment slot booking`, `date and time selection`, `availability agenda` |
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
| `BSS-01` | Chọn một time slot còn trống theo service, date, timezone và constraints, rồi giữ selection đủ lâu để tiếp tục. | tín hiệu dương bắt buộc |
| `BSS-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `BSS-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `BSS-90` | Từ chối browsing existing events, spatial seats hoặc free-form date entry. | từ chối |
| `BSS-91` | Từ chối staff scheduler hoặc one-action centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `BSS-01` và `BSS-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `BSS-90` hoặc `BSS-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
slot-booking
├─ service-and-attendee-context
├─ date-navigation
├─ availability-by-date
├─ slot-selection
├─ selected-slot-summary
└─ continue-or-waitlist
```

- **Quan hệ dùng chung:** Date và slot dùng chung một selection model; availability qualify từng slot; held selection summary cùng Continue action dùng chung availability revision.
- `slot-booking -> service-and-attendee-context`: `service-and-attendee-context` dùng named context hoặc revision từ `slot-booking` và cung cấp explicit return hoặc reconciliation path.
- `service-and-attendee-context -> date-navigation`: `date-navigation` dùng named context hoặc revision từ `service-and-attendee-context` và cung cấp explicit return hoặc reconciliation path.
- `date-navigation -> availability-by-date`: `availability-by-date` dùng named context hoặc revision từ `date-navigation` và cung cấp explicit return hoặc reconciliation path.
- `availability-by-date -> slot-selection`: `slot-selection` dùng named context hoặc revision từ `availability-by-date` và cung cấp explicit return hoặc reconciliation path.
- `slot-selection -> selected-slot-summary`: `selected-slot-summary` dùng named context hoặc revision từ `slot-selection` và cung cấp explicit return hoặc reconciliation path.
- `selected-slot-summary -> continue-or-waitlist`: `continue-or-waitlist` dùng named context hoặc revision từ `selected-slot-summary` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `slot-booking` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của slot booking; child regions không được commit bên ngoài boundary này. |
| `service-and-attendee-context` | Sở hữu orientation và immutable basis của service and attendee context để qualify mọi downstream decision. |
| `date-navigation` | Sở hữu input hoặc decision của date navigation và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `availability-by-date` | Sở hữu input hoặc decision của availability by date và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `slot-selection` | Sở hữu input hoặc decision của slot selection và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `selected-slot-summary` | Sở hữu derived state của selected slot summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `continue-or-waitlist` | Sở hữu recovery route của continue or waitlist và giữ exact state, trigger cùng return position. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Date navigation và available slots đồng hiện trong khi availability list sở hữu scan order.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Selected date đứng trước slot list và summary chuyển tới cạnh Continue.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Agenda một ngày là primary; calendar thành alternate dialog và selected slot theo ngay sau option.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `slot-booking` → `service-and-attendee-context` → `date-navigation` → `availability-by-date` → `slot-selection` → `selected-slot-summary` → `continue-or-waitlist`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `range loading` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `no slots` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `timezone` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `locale` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `selected slot` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `held slot` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `expired slot` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `concurrent slot taken` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `accessibility requirement` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `waitlist available` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `continue pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `continue error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `focus after refresh` | Chỉ di chuyển focus sau explicit action hoặc failed submit, rồi phục hồi exact trigger cùng semantic context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi date và slot chia sẻ một availability cùng hold model.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối browsing existing events, spatial seats hoặc free-form date entry.
- Từ chối staff scheduler hoặc one-action centered task.
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
| [W3C WAI-ARIA APG — Date picker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) | Calendar dialog quản lý keyboard focus và trả focus về trigger. | Là illustrative code và không thiết lập booking rules. |
| [NHS service manual — Date input](https://service-manual.nhs.uk/design-system/components/date-input) | Date entry hiện explicit format và field labels. | Không chứng minh calendar hoặc slot model. |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Primary content giữ readable và operable relationships khi space đổi. | Không quy định geometry của web template này. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "booking-slot-selection",
  "situationCodes": [
    "BSS-01",
    "BSS-02",
    "BSS-03"
  ],
  "searchAliases": [
    "appointment slot booking",
    "date and time selection",
    "availability agenda"
  ],
  "dominantTask": "Chọn một time slot còn trống theo service, date, timezone và constraints, rồi giữ selection đủ lâu để tiếp tục.",
  "regions": [
    "slot-booking",
    "service-and-attendee-context",
    "date-navigation",
    "availability-by-date",
    "slot-selection",
    "selected-slot-summary",
    "continue-or-waitlist"
  ],
  "regionRelationships": [
    "slot-booking -> service-and-attendee-context",
    "service-and-attendee-context -> date-navigation",
    "date-navigation -> availability-by-date",
    "availability-by-date -> slot-selection",
    "slot-selection -> selected-slot-summary",
    "selected-slot-summary -> continue-or-waitlist"
  ],
  "responsive": {
    "wide": "Date navigation và available slots đồng hiện trong khi availability list sở hữu scan order.",
    "intermediate": "Selected date đứng trước slot list và summary chuyển tới cạnh Continue.",
    "compact": "Agenda một ngày là primary; calendar thành alternate dialog và selected slot theo ngay sau option.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "slot-booking -> service-and-attendee-context -> date-navigation -> availability-by-date -> slot-selection -> selected-slot-summary -> continue-or-waitlist",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "range loading",
    "no slots",
    "timezone",
    "locale",
    "selected slot",
    "held slot",
    "expired slot",
    "concurrent slot taken",
    "accessibility requirement",
    "waitlist available",
    "continue pending",
    "continue error",
    "focus after refresh"
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
