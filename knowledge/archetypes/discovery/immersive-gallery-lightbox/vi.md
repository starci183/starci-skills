# Immersive gallery lightbox

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `immersive-gallery-lightbox` |
| Family | Discovery |
| Dominant task | Duyệt visual asset và inspect một asset ở kích thước lớn hơn cùng metadata và action thiết yếu. |
| Search aliases | `gallery, lightbox, asset viewer, visual collection` |
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
| `AR-IGL-01` | Duyệt visual asset và inspect một asset ở kích thước lớn hơn cùng metadata và action thiết yếu. | Candidate khi được chứng minh. |
| `AR-IGL-02` | Mọi region trong `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-IGL-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-IGL-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-IGL-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-IGL-90` | Entity card có ảnh chỉ là preview cần catalog. | Reject. |
| `AR-IGL-91` | So sánh attribute có cấu trúc cần comparison matrix. | Reject. |
| `AR-IGL-92` | Hero trang trí không phải collection có thể inspect. | Reject. |

### Selection rule

Chọn `immersive-gallery-lightbox` chỉ khi AR-IGL-01, AR-IGL-02, AR-IGL-03 được chứng minh và không có AR-IGL-90, AR-IGL-91, AR-IGL-92. Áp dụng responsive contract khi AR-IGL-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-IGL-05.

## Region graph

```text
gallery
├─ collection-controls
├─ adaptive-visual-grid
├─ selected-stage
├─ next-previous-filmstrip
└─ metadata-actions
```

Quan hệ chuẩn: `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `gallery` | Sở hữu duyệt visual asset và inspect ở kích thước lớn; thiết lập collection order, selected asset index, zoom và focus-return target cho mọi child mà không hấp thụ trách nhiệm của child. |
| `collection-controls` | sở hữu collection scope, ordering và view control; nhận collection order, selected asset index, zoom và focus-return target từ `gallery` và publish cùng identity tới `adaptive-visual-grid`. |
| `adaptive-visual-grid` | sở hữu visual browsing order và thumbnail selection; nhận collection order, selected asset index, zoom và focus-return target từ `collection-controls` và publish cùng identity tới `selected-stage`. |
| `selected-stage` | sở hữu large-format inspection của selected asset; nhận collection order, selected asset index, zoom và focus-return target từ `adaptive-visual-grid` và publish cùng identity tới `next-previous-filmstrip`. |
| `next-previous-filmstrip` | sở hữu previous/next rõ ràng và selected position; nhận collection order, selected asset index, zoom và focus-return target từ `selected-stage` và publish cùng identity tới `metadata-actions`. |
| `metadata-actions` | sở hữu metadata/action thiết yếu mà không trở thành entity detail; nhận collection order, selected asset index, zoom và focus-return target từ `next-previous-filmstrip` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Dùng grid nhiều track và selected stage lớn với metadata hỗ trợ cùng control previous/next truy cập bằng keyboard.
- **Navigation replacement:** Không thay thế; collection grid và large stage đồng hiện khi cả hai usable.
- **Sticky boundary:** Viewer chỉ modal khi mở dạng lightbox; control không che media action đang focus.
- **Overflow owner:** Page flow own grid; lightbox stage chỉ own bounded zoom/filmstrip overflow.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giảm track theo kích thước intrinsic của asset và chuyển metadata xuống dưới stage hoặc vào disclosure.
- **Navigation replacement:** Giảm grid column và đưa metadata xuống dưới hoặc vào disclosure có tên.
- **Sticky boundary:** Stage bỏ persistence trước khi intrinsic asset size mất usable.
- **Overflow owner:** Page flow own grid; viewer đang mở chỉ own internal stage.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Dùng grid một hoặc hai track và viewer full-screen có close, previous, next không bao giờ phụ thuộc gesture.
- **Navigation replacement:** Dùng grid một/hai cột và full-screen viewer có Close/Previous/Next rõ.
- **Sticky boundary:** Viewer control reserve space và yield ở short-height.
- **Overflow owner:** Viewer own một bounded media axis; page không horizontal scroll.

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
| Initial/loading | `collection-controls` | Tải thumbnail và full asset loading độc lập mà không thay collection order, selected asset index, zoom và focus-return target đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `next-previous-filmstrip` | Expose selected asset, index, zoom và metadata dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `adaptive-visual-grid` | Biểu diễn missing metadata hoặc unsupported asset kèm description tương đương; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `next-previous-filmstrip` | Khi full asset lỗi nhưng thumbnail/collection context vẫn giữ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `next-previous-filmstrip` | Biểu diễn asset action unavailable mà không ẩn asset; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `metadata-actions` | Trong khi full asset retry hoặc metadata action đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `metadata-actions` | Sau khi asset action hoàn tất tại cùng selected index, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `next-previous-filmstrip` | Khi collection đổi khi selected asset đang mở, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `collection-controls` | đóng viewer trả focus về thumbnail mở nó; next/previous không phụ thuộc gesture. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `gallery` | Resize giữ collection order, selected asset index, zoom và focus-return target, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Duyệt visual asset và inspect một asset ở kích thước lớn hơn cùng metadata và action thiết yếu.
- Mọi required region và quan hệ `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Entity card có ảnh chỉ là preview cần catalog.
- So sánh attribute có cấu trúc cần comparison matrix.
- Hero trang trí không phải collection có thể inspect.
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
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Evidence cho adaptive layout and content priority. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Evidence cho keyboard and widget interaction models. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: immersive-gallery-lightbox
situationCodes: AR-IGL-01, AR-IGL-02, AR-IGL-03, AR-IGL-04, AR-IGL-05
searchAliases: gallery, lightbox, asset viewer, visual collection
dominantTask: Duyệt visual asset và inspect một asset ở kích thước lớn hơn cùng metadata và action thiết yếu.
regions: gallery, collection-controls, adaptive-visual-grid, selected-stage, next-previous-filmstrip, metadata-actions
regionRelationships: gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions
responsive:
  wide: Dùng grid nhiều track và selected stage lớn với metadata hỗ trợ cùng control previous/next truy cập bằng keyboard.
  intermediate: Giảm track theo kích thước intrinsic của asset và chuyển metadata xuống dưới stage hoặc vào disclosure.
  compact: Dùng grid một hoặc hai track và viewer full-screen có close, previous, next không bao giờ phụ thuộc gesture.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions
  navigationReplacement: Dùng grid một/hai cột và full-screen viewer có Close/Previous/Next rõ.
  stickyBehavior: Viewer control reserve space và yield ở short-height.
  overflowOwner: Viewer own một bounded media axis; page không horizontal scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
