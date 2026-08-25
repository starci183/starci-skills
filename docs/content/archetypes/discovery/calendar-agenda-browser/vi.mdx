# Calendar agenda browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `calendar-agenda-browser` |
| Family | Discovery |
| Dominant task | Duyệt event theo date range và inspect một event mà không phân bổ resource. |
| Search aliases | `calendar agenda, event browser, date explorer, schedule viewer` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Archetype này chỉ quyết định dominant task, required region, quan hệ vùng, responsive transformation và interaction parity.
- Grammar sở hữu semantic và product owner; Principles sở hữu exact geometry cùng breakpoint; Direction sở hữu visual character.
- Current source và research là evidence, không phải quyền copy layout hoặc tạo product fact.
- Region ID, situation code và shared state giữ nguyên qua wide, intermediate và compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-CAB-01` | Duyệt event theo date range và inspect một event mà không phân bổ resource. | Candidate khi được chứng minh. |
| `AR-CAB-02` | Mọi region trong `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-CAB-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-CAB-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-CAB-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-CAB-90` | Phân bổ resource và xử lý collision cần scheduling workbench. | Reject. |
| `AR-CAB-91` | Điều tra nhân quả quá khứ cần audit timeline. | Reject. |
| `AR-CAB-92` | Một event form là bounded task. | Reject. |

### Selection rule

Chọn `calendar-agenda-browser` chỉ khi AR-CAB-01, AR-CAB-02, AR-CAB-03 được chứng minh và không có AR-CAB-90, AR-CAB-91, AR-CAB-92. Áp dụng responsive contract khi AR-CAB-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-CAB-05.

## Region graph

```text
calendar-browser
├─ date-range-navigation
├─ calendar-index
├─ agenda-list
└─ selected-event-detail
```

Quan hệ chuẩn: `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `calendar-browser` | Sở hữu duyệt theo time context với calendar/agenda index đồng bộ; thiết lập date range, selected date, selected event, timezone và source status cho mọi child mà không hấp thụ trách nhiệm của child. |
| `date-range-navigation` | sở hữu date movement, horizon, Today return và timezone context; nhận date range, selected date, selected event, timezone và source status từ `calendar-browser` và publish cùng identity tới `calendar-index`. |
| `calendar-index` | sở hữu calendar representation bị giới hạn và publish selected date/event; nhận date range, selected date, selected event, timezone và source status từ `date-range-navigation` và publish cùng identity tới `agenda-list`. |
| `agenda-list` | sở hữu semantic event order cho cùng range/selection; nhận date range, selected date, selected event, timezone và source status từ `calendar-index` và publish cùng identity tới `selected-event-detail`. |
| `selected-event-detail` | sở hữu fact cho shared selected event mà không thành scheduling form; nhận date range, selected date, selected event, timezone và source status từ `agenda-list` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ calendar và agenda hoặc detail đồng hiện khi cell calendar còn độ rộng khả dụng.
- **Navigation replacement:** Không thay thế; calendar và agenda/detail đồng hiện khi date cell/event text còn usable.
- **Sticky boundary:** Date-range control chỉ persist khi reserve space; detail không che calendar focus.
- **Overflow owner:** Calendar own bounded two-dimensional navigation khi thật cần; agenda own semantic page flow.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giảm time horizon và chuyển detail vào overlay trước khi bảy cột không còn đọc được.
- **Navigation replacement:** Giảm time horizon và đưa detail vào overlay thay vì squeeze calendar column.
- **Sticky boundary:** Overlay trả focus về selected event/date.
- **Overflow owner:** Calendar own bounded grid; agenda vẫn ở page flow.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Đặt agenda làm primary; calendar hoặc date picker là alternate view và event detail giữ selected date.
- **Navigation replacement:** Đặt agenda làm primary; calendar/date picker là alternate view và event detail là sheet/screen.
- **Sticky boundary:** Không calendar surface nào sticky ở short-height.
- **Overflow owner:** Active agenda own page flow hoặc active calendar own bounded grid; không đồng thời cả hai.

### Reflow

- DOM order và reading order theo region graph; CSS không reorder semantic.
- Resize không reset query, selection, anchor, progress, path hoặc recovery state.
- Text zoom, bản dịch dài, missing media và user content không làm mất label, relationship hoặc recovery route.
- Page không tạo horizontal scroll; bounded exception thuộc đúng overflow owner đã khai báo.

### Interaction parity

- Mọi wide action, state, recovery route và keyboard path tồn tại ở intermediate và compact.
- Temporary surface hỗ trợ Escape hoặc cancel, giữ modal focus và trả focus đúng trigger.
- Dynamic status được announce không cướp focus; visual state không chỉ dựa vào color.
- Pointer, hover, gesture và motion luôn có keyboard hoặc static alternative.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `date-range-navigation` | Tải date range và calendar source loading độc lập mà không thay date range, selected date, selected event, timezone và source status đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `agenda-list` | Expose selected date/event đồng bộ giữa calendar và agenda dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `calendar-index` | Biểu diễn không có event trong selected date nhưng navigation vẫn available; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `agenda-list` | Khi partial calendar source failure hoặc selected event bị xóa, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `agenda-list` | Biểu diễn calendar source unavailable mà không suy diễn no event; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `selected-event-detail` | Trong khi range change, source retry hoặc event detail load đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `selected-event-detail` | Sau khi Today return hoặc retry hoàn tất tại cùng time context, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `agenda-list` | Khi recurring instance hoặc timezone revision đổi occurrence hiển thị, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `date-range-navigation` | focus calendar↔agenda và đóng detail trả selected date/event. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `calendar-browser` | Resize giữ date range, selected date, selected event, timezone và source status, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Duyệt event theo date range và inspect một event mà không phân bổ resource.
- Mọi required region và quan hệ `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Phân bổ resource và xử lý collision cần scheduling workbench.
- Điều tra nhân quả quá khứ cần audit timeline.
- Một event form là bounded task.
- Reject khi khác archetype hiện có chỉ ở product noun, card count, density, color, component hoặc state.

### Boundary verdict

Trả `accept` khi selection rule và parity pass. Trả `reject` cho rejection evidence, `duplicate-or-variation` cho biến thể noun hoặc presentation, và `needs-evidence` khi thiếu một fact phân biệt.

## Handoff

Grammar gán semantic và product owner cho từng region. Principles resolve exact grid, measure, gap, size, alignment, overflow exception và breakpoint sau topology selection. Direction resolve visual character.

## Non-binding research evidence

### Evidence boundary

Các nguồn official này là evidence advisory cho topology, interaction và accessibility. Chúng không phải product truth, không biến tên archetype tổng hợp thành thuật ngữ official và không cấp quyền copy geometry, component tree, breakpoint hoặc visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Evidence cho adaptive layout and content priority. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Evidence cho keyboard access to two-dimensional information. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Evidence cho structured scanning, sorting, and bounded tabular regions. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: calendar-agenda-browser
situationCodes: AR-CAB-01, AR-CAB-02, AR-CAB-03, AR-CAB-04, AR-CAB-05
searchAliases: calendar agenda, event browser, date explorer, schedule viewer
dominantTask: Duyệt event theo date range và inspect một event mà không phân bổ resource.
regions: calendar-browser, date-range-navigation, calendar-index, agenda-list, selected-event-detail
regionRelationships: calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail
responsive:
  wide: Giữ calendar và agenda hoặc detail đồng hiện khi cell calendar còn độ rộng khả dụng.
  intermediate: Giảm time horizon và chuyển detail vào overlay trước khi bảy cột không còn đọc được.
  compact: Đặt agenda làm primary; calendar hoặc date picker là alternate view và event detail giữ selected date.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: calendar-browser → date-range-navigation → calendar-index → agenda-list → selected-event-detail
  navigationReplacement: Đặt agenda làm primary; calendar/date picker là alternate view và event detail là sheet/screen.
  stickyBehavior: Không calendar surface nào sticky ở short-height.
  overflowOwner: Active agenda own page flow hoặc active calendar own bounded grid; không đồng thời cả hai.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
