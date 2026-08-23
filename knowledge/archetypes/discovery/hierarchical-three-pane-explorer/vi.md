# Hierarchical three-pane explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `hierarchical-three-pane-explorer` |
| Family | Discovery |
| Dominant task | Đi qua ba cấp cha–con thật và xem chi tiết leaf mà không mất vị trí ở cấp cha hoặc con. |
| Search aliases | `three pane explorer, hierarchy detail, parent child leaf, column browser` |
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
| `AR-H3P-01` | Đi qua ba cấp cha–con thật và xem chi tiết leaf mà không mất vị trí ở cấp cha hoặc con. | Candidate khi được chứng minh. |
| `AR-H3P-02` | Mọi region trong `explorer → primary-hierarchy → child-collection → leaf-detail` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-H3P-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-H3P-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-H3P-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-H3P-90` | Bề mặt list-detail không có cấp thứ ba độc lập. | Reject. |
| `AR-H3P-91` | Sidebar trang trí không tạo hierarchy. | Reject. |
| `AR-H3P-92` | Quan hệ many-to-many cần graph explorer. | Reject. |

### Selection rule

Chọn `hierarchical-three-pane-explorer` chỉ khi AR-H3P-01, AR-H3P-02, AR-H3P-03 được chứng minh và không có AR-H3P-90, AR-H3P-91, AR-H3P-92. Áp dụng responsive contract khi AR-H3P-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-H3P-05.

## Region graph

```text
explorer
├─ primary-hierarchy
├─ child-collection
└─ leaf-detail
```

Quan hệ chuẩn: `explorer → primary-hierarchy → child-collection → leaf-detail`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `explorer` | Sở hữu path parent–child–leaf ba cấp cùng các selection độc lập; thiết lập primary node đã chọn, child đã chọn, leaf identity và restoration path cho mọi child mà không hấp thụ trách nhiệm của child. |
| `primary-hierarchy` | chọn và expand cấp hierarchy đầu tiên rồi công bố parent path; nhận primary node đã chọn, child đã chọn, leaf identity và restoration path từ `explorer` và publish cùng identity tới `child-collection`. |
| `child-collection` | sở hữu peer selection trong parent đã chọn và giữ vị trí collection; nhận primary node đã chọn, child đã chọn, leaf identity và restoration path từ `primary-hierarchy` và publish cùng identity tới `leaf-detail`. |
| `leaf-detail` | sở hữu việc đọc và action của leaf đồng thời giữ parent/child path; nhận primary node đã chọn, child đã chọn, leaf identity và restoration path từ `child-collection` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Chỉ hiển thị đủ ba pane khi từng pane còn độ rộng khả dụng; pane điều hướng giữ path và detail sở hữu việc đọc cùng hành động.
- **Navigation replacement:** Không thay thế khi cả ba pane còn usable cho selection và reading.
- **Sticky boundary:** Không pane nào sticky mặc định; mỗi pane phải expose path mà không che focus.
- **Overflow owner:** Mỗi pane đang thấy chỉ được own bounded vertical overflow khi cần giữ selection position.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Chuyển hierarchy chính vào drawer trong khi child collection và leaf detail vẫn đồng hiện, còn selected path luôn nhìn thấy.
- **Navigation replacement:** Đưa primary hierarchy vào drawer và giữ selected path visible phía trên child/detail.
- **Sticky boundary:** Drawer chỉ modal khi mở và trả focus về path trigger.
- **Overflow owner:** Child và detail giữ một scroll owner được khai báo; drawer chỉ own internal list.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Tuần tự primary, child rồi detail thành các stage riêng có path, Back và khôi phục state theo từng stage.
- **Navigation replacement:** Tuần tự primary → child → detail bằng Back rõ ràng và path heading.
- **Sticky boundary:** Không stage nào sticky; Back luôn reachable trong normal flow.
- **Overflow owner:** Active stage own page flow; inactive stage không tạo scroll container.

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
| Initial/loading | `primary-hierarchy` | Tải node expansion và child collection đang tải mà không thay primary node đã chọn, child đã chọn, leaf identity và restoration path đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `child-collection` | Expose parent, child và leaf path đã chọn dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `child-collection` | Biểu diễn child collection rỗng hoặc orphaned leaf; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `child-collection` | Khi child load lỗi hoặc leaf bị xóa nhưng path vẫn giữ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `child-collection` | Biểu diễn permission bị từ chối tại đúng cấp bị ảnh hưởng; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `leaf-detail` | Trong khi node expansion hoặc leaf recovery đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `leaf-detail` | Sau khi parent–child–leaf path đã phục hồi, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `child-collection` | Khi path stale sau move, rename hoặc delete, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `primary-hierarchy` | Back giữa stage và đóng drawer trả đúng selection trước đó. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `explorer` | Resize giữ primary node đã chọn, child đã chọn, leaf identity và restoration path, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Đi qua ba cấp cha–con thật và xem chi tiết leaf mà không mất vị trí ở cấp cha hoặc con.
- Mọi required region và quan hệ `explorer → primary-hierarchy → child-collection → leaf-detail` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Bề mặt list-detail không có cấp thứ ba độc lập.
- Sidebar trang trí không tạo hierarchy.
- Quan hệ many-to-many cần graph explorer.
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
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Evidence cho hierarchy semantics, selection, and keyboard movement. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Evidence cho navigation, disclosure, and selection behavior. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: hierarchical-three-pane-explorer
situationCodes: AR-H3P-01, AR-H3P-02, AR-H3P-03, AR-H3P-04, AR-H3P-05
searchAliases: three pane explorer, hierarchy detail, parent child leaf, column browser
dominantTask: Đi qua ba cấp cha–con thật và xem chi tiết leaf mà không mất vị trí ở cấp cha hoặc con.
regions: explorer, primary-hierarchy, child-collection, leaf-detail
regionRelationships: explorer → primary-hierarchy → child-collection → leaf-detail
responsive:
  wide: Chỉ hiển thị đủ ba pane khi từng pane còn độ rộng khả dụng; pane điều hướng giữ path và detail sở hữu việc đọc cùng hành động.
  intermediate: Chuyển hierarchy chính vào drawer trong khi child collection và leaf detail vẫn đồng hiện, còn selected path luôn nhìn thấy.
  compact: Tuần tự primary, child rồi detail thành các stage riêng có path, Back và khôi phục state theo từng stage.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: explorer → primary-hierarchy → child-collection → leaf-detail
  navigationReplacement: Tuần tự primary → child → detail bằng Back rõ ràng và path heading.
  stickyBehavior: Không stage nào sticky; Back luôn reachable trong normal flow.
  overflowOwner: Active stage own page flow; inactive stage không tạo scroll container.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
