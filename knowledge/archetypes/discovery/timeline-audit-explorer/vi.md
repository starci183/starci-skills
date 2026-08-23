# Timeline audit explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `timeline-audit-explorer` |
| Family | Discovery |
| Dominant task | Tái dựng thứ tự, correlation và nguyên nhân của các event đã xảy ra. |
| Search aliases | `audit timeline, event investigation, causal history, correlated events` |
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
| `AR-TAE-01` | Tái dựng thứ tự, correlation và nguyên nhân của các event đã xảy ra. | Candidate khi được chứng minh. |
| `AR-TAE-02` | Mọi region trong `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-TAE-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-TAE-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-TAE-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-TAE-90` | Activity feed hội thoại không điều tra nhân quả. | Reject. |
| `AR-TAE-91` | Raw log append-only thiếu cấu trúc correlation. | Reject. |
| `AR-TAE-92` | Timeline lịch và status sở hữu tương lai hoặc tiến triển state. | Reject. |

### Selection rule

Chọn `timeline-audit-explorer` chỉ khi AR-TAE-01, AR-TAE-02, AR-TAE-03 được chứng minh và không có AR-TAE-90, AR-TAE-91, AR-TAE-92. Áp dụng responsive contract khi AR-TAE-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-TAE-05.

## Region graph

```text
audit-explorer
├─ time-and-actor-filters
├─ chronological-spine
├─ correlation-groups
├─ selected-event-detail
└─ related-evidence
```

Quan hệ chuẩn: `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `audit-explorer` | Sở hữu event sequence điều tra, correlation và causal evidence; thiết lập time range, actor filter, chronological position, group và selected event cho mọi child mà không hấp thụ trách nhiệm của child. |
| `time-and-actor-filters` | sở hữu investigation session và chronological interpretation; nhận time range, actor filter, chronological position, group và selected event từ `audit-explorer` và publish cùng identity tới `chronological-spine`. |
| `chronological-spine` | sở hữu time/actor/source/timezone constraint đã commit; nhận time range, actor filter, chronological position, group và selected event từ `time-and-actor-filters` và publish cùng identity tới `correlation-groups`. |
| `correlation-groups` | sở hữu timestamp order làm semantic axis; nhận time range, actor filter, chronological position, group và selected event từ `chronological-spine` và publish cùng identity tới `selected-event-detail`. |
| `selected-event-detail` | sở hữu correlation identity xuyên event mà không đổi timestamp order; nhận time range, actor filter, chronological position, group và selected event từ `correlation-groups` và publish cùng identity tới `related-evidence`. |
| `related-evidence` | sở hữu selected event payload và causal context; nhận time range, actor filter, chronological position, group và selected event từ `selected-event-detail` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ timeline và detail rail đồng hiện trong khi group marker và time scale vẫn đọc được.
- **Navigation replacement:** Không thay thế; filter, chronological spine và detail cùng visible khi time scale còn legible.
- **Sticky boundary:** Chỉ filter được persist khi reserved space giữ event focus visible; detail không float trên spine.
- **Overflow owner:** Chronological page flow own vertical reading; related evidence chỉ scroll trong bounded detail rail.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Chuyển detail vào drawer để chronological spine giữ độ rộng và tính liên tục khi đọc.
- **Navigation replacement:** Đưa event detail vào drawer và giữ chronological spine ở readable width.
- **Sticky boundary:** Drawer chỉ trap focus khi modal và trả về selected event.
- **Overflow owner:** Spine own page flow; drawer chỉ own internal detail scroll.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Hiển thị một stream theo thời gian với heading nhóm; detail trở về đúng event anchor.
- **Navigation replacement:** Dùng một chronological event stream có group heading; detail Back trả đúng event anchor.
- **Sticky boundary:** Không timeline surface nào sticky ở short-height.
- **Overflow owner:** Page flow own event stream; detail sheet chỉ own temporary internal overflow.

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
| Initial/loading | `time-and-actor-filters` | Tải time range và source đang tải mà không thay time range, actor filter, chronological position, group và selected event đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `selected-event-detail` | Expose ordered event, expanded correlation group và selected event dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `chronological-spine` | Biểu diễn không có event trong committed range; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `selected-event-detail` | Khi partial source failure hoặc selected event bị xóa, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `selected-event-detail` | Biểu diễn evidence source unavailable được nêu mà không suy diễn absence; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `related-evidence` | Trong khi range refresh, event detail load hoặc export đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `related-evidence` | Sau khi export/source retry hoàn tất tại cùng event anchor, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `selected-event-detail` | Khi late-arriving event làm đổi sequence/correlation, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `time-and-actor-filters` | đóng detail và compact Back trả đúng selected event anchor. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `audit-explorer` | Resize giữ time range, actor filter, chronological position, group và selected event, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Tái dựng thứ tự, correlation và nguyên nhân của các event đã xảy ra.
- Mọi required region và quan hệ `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Activity feed hội thoại không điều tra nhân quả.
- Raw log append-only thiếu cấu trúc correlation.
- Timeline lịch và status sở hữu tương lai hoặc tiến triển state.
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
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Evidence cho structured scanning, sorting, and bounded tabular regions. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Purview — Search the audit log](https://learn.microsoft.com/en-us/purview/audit-search) | Evidence cho time, actor, activity, detail, and partial audit investigation. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: timeline-audit-explorer
situationCodes: AR-TAE-01, AR-TAE-02, AR-TAE-03, AR-TAE-04, AR-TAE-05
searchAliases: audit timeline, event investigation, causal history, correlated events
dominantTask: Tái dựng thứ tự, correlation và nguyên nhân của các event đã xảy ra.
regions: audit-explorer, time-and-actor-filters, chronological-spine, correlation-groups, selected-event-detail, related-evidence
regionRelationships: audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence
responsive:
  wide: Giữ timeline và detail rail đồng hiện trong khi group marker và time scale vẫn đọc được.
  intermediate: Chuyển detail vào drawer để chronological spine giữ độ rộng và tính liên tục khi đọc.
  compact: Hiển thị một stream theo thời gian với heading nhóm; detail trở về đúng event anchor.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence
  navigationReplacement: Dùng một chronological event stream có group heading; detail Back trả đúng event anchor.
  stickyBehavior: Không timeline surface nào sticky ở short-height.
  overflowOwner: Page flow own event stream; detail sheet chỉ own temporary internal overflow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
