# Map results explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `map-results-explorer` |
| Family | Discovery |
| Dominant task | Tìm và đánh giá lựa chọn qua quan hệ không gian với map và result list là hai index đồng bộ. |
| Search aliases | `map search, places map, spatial results, map list explorer` |
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
| `AR-MRE-01` | Tìm và đánh giá lựa chọn qua quan hệ không gian với map và result list là hai index đồng bộ. | Candidate khi được chứng minh. |
| `AR-MRE-02` | Mọi region trong `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-MRE-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-MRE-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-MRE-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-MRE-90` | Map bị bỏ mà task không đổi chỉ là trang trí. | Reject. |
| `AR-MRE-91` | Hierarchy không phải spatial discovery. | Reject. |
| `AR-MRE-92` | Báo cáo status trên map cần monitoring archetype. | Reject. |

### Selection rule

Chọn `map-results-explorer` chỉ khi AR-MRE-01, AR-MRE-02, AR-MRE-03 được chứng minh và không có AR-MRE-90, AR-MRE-91, AR-MRE-92. Áp dụng responsive contract khi AR-MRE-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-MRE-05.

## Region graph

```text
spatial-explorer
├─ place-query-filters
├─ map-index
├─ synchronized-result-list
├─ selected-place-detail
└─ map-controls
```

Quan hệ chuẩn: `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `spatial-explorer` | Sở hữu spatial choice set và selection hai chiều map–result; thiết lập query, filter, selected place, map viewport và list position cho mọi child mà không hấp thụ trách nhiệm của child. |
| `place-query-filters` | sở hữu spatial exploration session và selection parity; nhận query, filter, selected place, map viewport và list position từ `spatial-explorer` và publish cùng identity tới `map-index`. |
| `map-index` | sở hữu place intent và committed spatial constraint; nhận query, filter, selected place, map viewport và list position từ `place-query-filters` và publish cùng identity tới `synchronized-result-list`. |
| `synchronized-result-list` | index choice theo geographic position và publish marker selection; nhận query, filter, selected place, map viewport và list position từ `map-index` và publish cùng identity tới `selected-place-detail`. |
| `selected-place-detail` | index cùng choice theo semantic reading order và publish result selection; nhận query, filter, selected place, map viewport và list position từ `synchronized-result-list` và publish cùng identity tới `map-controls`. |
| `map-controls` | sở hữu fact/action cho shared selected place; nhận query, filter, selected place, map viewport và list position từ `selected-place-detail` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ map và list hoặc detail đồng hiện với một scroll owner cho results và pan/zoom bị giới hạn trong map.
- **Navigation replacement:** Không thay thế; map và synchronized list/detail đồng hiện.
- **Sticky boundary:** Map chỉ persist trong allocated region và không che focused result.
- **Overflow owner:** Map own bounded pan/zoom; result list own một bounded vertical axis khi cần đồng hiện.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giữ index chính theo evidence luôn hiện và thu gọn index còn lại trong khi selected-place summary vẫn truy cập được.
- **Navigation replacement:** Giữ evidenced primary index visible và collapse index còn lại sau named control; selected-place summary vẫn reachable.
- **Sticky boundary:** Collapsed index không sticky và trả focus về trigger.
- **Overflow owner:** Chỉ active map/list own interaction overflow; hidden topology không tạo scroll.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Cung cấp switch Map hoặc List rõ ràng; đóng detail trở lại đúng viewport hoặc vị trí list.
- **Navigation replacement:** Dùng Map/List switch rõ ràng; đóng detail trả đúng map viewport hoặc list anchor.
- **Sticky boundary:** Selected-place sheet chỉ modal khi mở và yield ở short-height.
- **Overflow owner:** Active view own overflow; inactive view bị loại khỏi interaction/focus.

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
| Initial/loading | `place-query-filters` | Tải map/list loading và geolocation outcome được tách riêng mà không thay query, filter, selected place, map viewport và list position đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `selected-place-detail` | Expose selected marker/result cùng detail đồng bộ dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `map-index` | Biểu diễn không có place trong viewport kèm recovery mở rộng query; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `selected-place-detail` | Khi map lỗi nhưng list còn parity hoặc list partial failure nhưng map còn context, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `selected-place-detail` | Biểu diễn geolocation denied/unavailable nhưng không chặn manual search; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `map-controls` | Trong khi viewport query update, retry hoặc place action đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `map-controls` | Sau khi map và list xác nhận cùng selected place, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `selected-place-detail` | Khi selected marker ra ngoài màn hình hoặc result set đổi sau viewport update, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `place-query-filters` | focus marker↔result và đóng detail trả đúng viewport/list position. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `spatial-explorer` | Resize giữ query, filter, selected place, map viewport và list position, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Tìm và đánh giá lựa chọn qua quan hệ không gian với map và result list là hai index đồng bộ.
- Mọi required region và quan hệ `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Map bị bỏ mà task không đổi chỉ là trang trí.
- Hierarchy không phải spatial discovery.
- Báo cáo status trên map cần monitoring archetype.
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
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Evidence cho keyboard and widget interaction models. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Google Maps Platform — Accessibility](https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers) | Evidence cho keyboard and non-visual access for spatial interfaces. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: map-results-explorer
situationCodes: AR-MRE-01, AR-MRE-02, AR-MRE-03, AR-MRE-04, AR-MRE-05
searchAliases: map search, places map, spatial results, map list explorer
dominantTask: Tìm và đánh giá lựa chọn qua quan hệ không gian với map và result list là hai index đồng bộ.
regions: spatial-explorer, place-query-filters, map-index, synchronized-result-list, selected-place-detail, map-controls
regionRelationships: spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls
responsive:
  wide: Giữ map và list hoặc detail đồng hiện với một scroll owner cho results và pan/zoom bị giới hạn trong map.
  intermediate: Giữ index chính theo evidence luôn hiện và thu gọn index còn lại trong khi selected-place summary vẫn truy cập được.
  compact: Cung cấp switch Map hoặc List rõ ràng; đóng detail trở lại đúng viewport hoặc vị trí list.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: spatial-explorer → place-query-filters → map-index → synchronized-result-list → selected-place-detail → map-controls
  navigationReplacement: Dùng Map/List switch rõ ràng; đóng detail trả đúng map viewport hoặc list anchor.
  stickyBehavior: Selected-place sheet chỉ modal khi mở và yield ở short-height.
  overflowOwner: Active view own overflow; inactive view bị loại khỏi interaction/focus.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
