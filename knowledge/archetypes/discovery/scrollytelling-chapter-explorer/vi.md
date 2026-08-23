# Scrollytelling chapter explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scrollytelling-chapter-explorer` |
| Family | Discovery |
| Dominant task | Đi qua các chương được biên soạn trong khi bằng chứng trực quan phối hợp giải thích đúng luận điểm đang đọc. |
| Search aliases | `scrollytelling, chapter narrative, evidence story, guided explainer` |
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
| `AR-SCX-01` | Đi qua các chương được biên soạn trong khi bằng chứng trực quan phối hợp giải thích đúng luận điểm đang đọc. | Candidate khi được chứng minh. |
| `AR-SCX-02` | Mọi region trong `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-SCX-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-SCX-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-SCX-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-SCX-90` | Dashboard phân tích sở hữu bằng chứng cross-filter. | Reject. |
| `AR-SCX-91` | Trình đọc bản thảo sở hữu ghi chú tĩnh quanh việc đọc liên tục. | Reject. |
| `AR-SCX-92` | Presentation phân trang sở hữu các frame rời. | Reject. |

### Selection rule

Chọn `scrollytelling-chapter-explorer` chỉ khi AR-SCX-01, AR-SCX-02, AR-SCX-03 được chứng minh và không có AR-SCX-90, AR-SCX-91, AR-SCX-92. Áp dụng responsive contract khi AR-SCX-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-SCX-05.

## Region graph

```text
scrollytelling
├─ chapter-navigation
├─ ordered-narrative-chapters
├─ coordinated-visual-stage
├─ active-claim-annotation
└─ evidence-sources-and-progress
```

Quan hệ chuẩn: `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `scrollytelling` | Sở hữu hành trình chapter được biên soạn và sự phối hợp claim–evidence; thiết lập chapter active, claim anchor, evidence identity và reading progress cho mọi child mà không hấp thụ trách nhiệm của child. |
| `chapter-navigation` | cung cấp navigation trực tiếp và deep link tới chapter nhưng không sở hữu reading progress; nhận chapter active, claim anchor, evidence identity và reading progress từ `scrollytelling` và publish cùng identity tới `ordered-narrative-chapters`. |
| `ordered-narrative-chapters` | sở hữu việc đọc chapter liên tục và xác định claim nào đang trong context; nhận chapter active, claim anchor, evidence identity và reading progress từ `chapter-navigation` và publish cùng identity tới `coordinated-visual-stage`. |
| `coordinated-visual-stage` | hiển thị evidence cho active claim nhưng không sở hữu page scroll hoặc focus; nhận chapter active, claim anchor, evidence identity và reading progress từ `ordered-narrative-chapters` và publish cùng identity tới `active-claim-annotation`. |
| `active-claim-annotation` | gắn claim đang thấy với evidence identity và annotation tương ứng; nhận chapter active, claim anchor, evidence identity và reading progress từ `coordinated-visual-stage` và publish cùng identity tới `evidence-sources-and-progress`. |
| `evidence-sources-and-progress` | sở hữu citation, availability, reduced-motion alternative và progress feedback; nhận chapter active, claim anchor, evidence identity và reading progress từ `active-claim-annotation` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ điều hướng chương, phần kể chuyện dễ đọc và visual stage sticky không che nội dung đồng thời khi từng vùng còn dùng được.
- **Navigation replacement:** Không thay thế; chapter link vẫn trực tiếp.
- **Sticky boundary:** Chỉ coordinated visual stage được persist và phải yield trước khi che heading hoặc focus.
- **Overflow owner:** Page flow sở hữu vertical reading; visual stage không có scroll độc lập.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Thay rail chương bằng điều hướng disclosure và giảm độ bám của visual trước khi độ dài dòng kể chuyện mất khả dụng.
- **Navigation replacement:** Thay chapter rail bằng disclosure có tên và vẫn hiển thị active chapter.
- **Sticky boundary:** Visual stage bỏ persistence trước khi narrative measure thất bại.
- **Overflow owner:** Page flow vẫn là vertical scroll owner duy nhất.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Đặt mỗi visual ngay tại luận điểm mà nó hỗ trợ và mở điều hướng chương trong TOC sheet với phương án tĩnh tương đương khi giảm chuyển động.
- **Navigation replacement:** Dùng TOC sheet trả focus về trigger và giữ chapter anchor.
- **Sticky boundary:** Không evidence surface nào sticky; evidence nằm inline tại claim.
- **Overflow owner:** Page flow sở hữu reading; không tạo nested scroll.

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
| Initial/loading | `chapter-navigation` | Tải chapter deep-link và coordinated visual đang tải mà không thay chapter active, claim anchor, evidence identity và reading progress đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `active-claim-annotation` | Expose active claim, active visual và reading progress dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `ordered-narrative-chapters` | Biểu diễn visual không hỗ trợ hoặc source unavailable kèm text alternative; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `active-claim-annotation` | Khi visual hoặc source lỗi nhưng chapter text vẫn được giữ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `active-claim-annotation` | Biểu diễn evidence source bị hạn chế mà không suy diễn hidden content; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `evidence-sources-and-progress` | Trong khi retry visual hoặc source, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `evidence-sources-and-progress` | Sau khi evidence phục hồi tại đúng claim anchor, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `active-claim-annotation` | Khi evidence revision hoặc resize có thể làm claim và visual lệch nhau, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `chapter-navigation` | đóng TOC trả focus về trigger; evidence change không di chuyển focus. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `scrollytelling` | Resize giữ chapter active, claim anchor, evidence identity và reading progress, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Đi qua các chương được biên soạn trong khi bằng chứng trực quan phối hợp giải thích đúng luận điểm đang đọc.
- Mọi required region và quan hệ `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Dashboard phân tích sở hữu bằng chứng cross-filter.
- Trình đọc bản thảo sở hữu ghi chú tĩnh quanh việc đọc liên tục.
- Presentation phân trang sở hữu các frame rời.
- Parallax trang trí không có quan hệ luận điểm–bằng chứng.
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
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Evidence cho adaptive layout and content priority. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Evidence cho reflow without two-dimensional page scrolling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [MDN — IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) | Evidence cho coordination with viewport entry without synchronous scroll polling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: scrollytelling-chapter-explorer
situationCodes: AR-SCX-01, AR-SCX-02, AR-SCX-03, AR-SCX-04, AR-SCX-05
searchAliases: scrollytelling, chapter narrative, evidence story, guided explainer
dominantTask: Đi qua các chương được biên soạn trong khi bằng chứng trực quan phối hợp giải thích đúng luận điểm đang đọc.
regions: scrollytelling, chapter-navigation, ordered-narrative-chapters, coordinated-visual-stage, active-claim-annotation, evidence-sources-and-progress
regionRelationships: scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress
responsive:
  wide: Giữ điều hướng chương, phần kể chuyện dễ đọc và visual stage sticky không che nội dung đồng thời khi từng vùng còn dùng được.
  intermediate: Thay rail chương bằng điều hướng disclosure và giảm độ bám của visual trước khi độ dài dòng kể chuyện mất khả dụng.
  compact: Đặt mỗi visual ngay tại luận điểm mà nó hỗ trợ và mở điều hướng chương trong TOC sheet với phương án tĩnh tương đương khi giảm chuyển động.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: scrollytelling → chapter-navigation → ordered-narrative-chapters → coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress
  navigationReplacement: Dùng TOC sheet trả focus về trigger và giữ chapter anchor.
  stickyBehavior: Không evidence surface nào sticky; evidence nằm inline tại claim.
  overflowOwner: Page flow sở hữu reading; không tạo nested scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
