# Paged presentation stage

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `paged-presentation-stage` |
| Family | Discovery |
| Dominant task | Đi qua các frame rời theo thứ tự với thumbnail, progress và presenter note tùy chọn. |
| Search aliases | `slide viewer, presentation stage, paged deck, frame navigator` |
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
| `AR-PPS-01` | Đi qua các frame rời theo thứ tự với thumbnail, progress và presenter note tùy chọn. | Candidate khi được chứng minh. |
| `AR-PPS-02` | Mọi region trong `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-PPS-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-PPS-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-PPS-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-PPS-90` | Media liên tục cần theater queue. | Reject. |
| `AR-PPS-91` | Canvas có edit cần authoring workbench. | Reject. |
| `AR-PPS-92` | Tài liệu long-form cần manuscript reader. | Reject. |

### Selection rule

Chọn `paged-presentation-stage` chỉ khi AR-PPS-01, AR-PPS-02, AR-PPS-03 được chứng minh và không có AR-PPS-90, AR-PPS-91, AR-PPS-92. Áp dụng responsive contract khi AR-PPS-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-PPS-05.

## Region graph

```text
presentation
├─ thumbnail-navigator
├─ primary-stage
├─ previous-next-progress
└─ presenter-notes
```

Quan hệ chuẩn: `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `presentation` | Sở hữu navigation theo thứ tự qua discrete frame cùng orientation aid; thiết lập current frame, visited frame, progress, fullscreen state và note availability cho mọi child mà không hấp thụ trách nhiệm của child. |
| `thumbnail-navigator` | sở hữu direct frame selection và visited-frame orientation; nhận current frame, visited frame, progress, fullscreen state và note availability từ `presentation` và publish cùng identity tới `primary-stage`. |
| `primary-stage` | sở hữu discrete current frame và giữ aspect relationship; nhận current frame, visited frame, progress, fullscreen state và note availability từ `thumbnail-navigator` và publish cùng identity tới `previous-next-progress`. |
| `previous-next-progress` | sở hữu previous/next deterministic và current count; nhận current frame, visited frame, progress, fullscreen state và note availability từ `primary-stage` và publish cùng identity tới `presenter-notes`. |
| `presenter-notes` | sở hữu optional presenter context cho current frame; nhận current frame, visited frame, progress, fullscreen state và note availability từ `previous-next-progress` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ thumbnail, stage bảo toàn tỉ lệ và note đồng hiện chỉ khi stage vẫn primary và keyboard focus không bị canvas nuốt.
- **Navigation replacement:** Không thay thế; thumbnail, primary stage và note đồng hiện khi stage còn usable.
- **Sticky boundary:** Stage control chỉ persist trong reserved space; note không overlay focused stage content.
- **Overflow owner:** Thumbnail navigator có thể own bounded vertical overflow; stage không own page scroll.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Thu gọn note hoặc thumbnail theo ưu tiên task trước khi stage mất kích thước hữu ích.
- **Navigation replacement:** Đưa note hoặc thumbnail vào collapsible region theo task priority.
- **Sticky boundary:** Temporary region trả focus về đúng trigger.
- **Overflow owner:** Page flow own stage; temporary navigation chỉ own internal list.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Giữ stage, previous/next rõ ràng và current count làm primary; thumbnail cùng note mở trong sheet không phụ thuộc swipe.
- **Navigation replacement:** Giữ stage, Previous/Next rõ và current count theo sequence; thumbnail/note mở trong sheet.
- **Sticky boundary:** Control reserve space và yield ở short-height.
- **Overflow owner:** Page flow own stage; sheet own temporary internal overflow.

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
| Initial/loading | `thumbnail-navigator` | Tải deck và current frame đang tải mà không thay current frame, visited frame, progress, fullscreen state và note availability đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `previous-next-progress` | Expose current frame, visited state, progress và note dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `primary-stage` | Biểu diễn missing frame hoặc note unavailable nhưng navigation vẫn giữ; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `previous-next-progress` | Khi frame load/fullscreen lỗi tại current index, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `previous-next-progress` | Biểu diễn note unavailable mà không chặn frame navigation; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `presenter-notes` | Trong khi frame change, fullscreen entry hoặc note load đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `presenter-notes` | Sau khi frame change hoặc fullscreen exit hoàn tất tại cùng deck position, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `previous-next-progress` | Khi deck revision làm visited/current frame invalid, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `thumbnail-navigator` | focus stage↔thumbnail và đóng sheet trả đúng frame trigger. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `presentation` | Resize giữ current frame, visited frame, progress, fullscreen state và note availability, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Đi qua các frame rời theo thứ tự với thumbnail, progress và presenter note tùy chọn.
- Mọi required region và quan hệ `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Media liên tục cần theater queue.
- Canvas có edit cần authoring workbench.
- Tài liệu long-form cần manuscript reader.
- Câu hỏi assessment có semantic submit toàn session.
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
| [Apple Human Interface Guidelines — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Evidence cho pane relationships and collapse. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Evidence cho adaptive layout and content priority. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) | Evidence cho explicit sequential controls and announced position. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: paged-presentation-stage
situationCodes: AR-PPS-01, AR-PPS-02, AR-PPS-03, AR-PPS-04, AR-PPS-05
searchAliases: slide viewer, presentation stage, paged deck, frame navigator
dominantTask: Đi qua các frame rời theo thứ tự với thumbnail, progress và presenter note tùy chọn.
regions: presentation, thumbnail-navigator, primary-stage, previous-next-progress, presenter-notes
regionRelationships: presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes
responsive:
  wide: Giữ thumbnail, stage bảo toàn tỉ lệ và note đồng hiện chỉ khi stage vẫn primary và keyboard focus không bị canvas nuốt.
  intermediate: Thu gọn note hoặc thumbnail theo ưu tiên task trước khi stage mất kích thước hữu ích.
  compact: Giữ stage, previous/next rõ ràng và current count làm primary; thumbnail cùng note mở trong sheet không phụ thuộc swipe.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes
  navigationReplacement: Giữ stage, Previous/Next rõ và current count theo sequence; thumbnail/note mở trong sheet.
  stickyBehavior: Control reserve space và yield ở short-height.
  overflowOwner: Page flow own stage; sheet own temporary internal overflow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
