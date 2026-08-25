# Spatial route itinerary explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spatial-route-itinerary-explorer` |
| Family | Discovery |
| Dominant task | Hiểu và chọn route alternative qua leg có thứ tự, constraint, duration và spatial context trước khi bắt đầu. |
| Search aliases | `route explorer, itinerary map, directions alternatives, trip legs` |
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
| `AR-SRI-01` | Hiểu và chọn route alternative qua leg có thứ tự, constraint, duration và spatial context trước khi bắt đầu. | Candidate khi được chứng minh. |
| `AR-SRI-02` | Mọi region trong `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-SRI-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-SRI-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-SRI-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-SRI-90` | Place discovery không thứ tự cần map results. | Reject. |
| `AR-SRI-91` | Live dispatch editing là operational workbench. | Reject. |
| `AR-SRI-92` | Calendar scheduling sở hữu phân bổ thời gian. | Reject. |

### Selection rule

Chọn `spatial-route-itinerary-explorer` chỉ khi AR-SRI-01, AR-SRI-02, AR-SRI-03 được chứng minh và không có AR-SRI-90, AR-SRI-91, AR-SRI-92. Áp dụng responsive contract khi AR-SRI-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-SRI-05.

## Region graph

```text
route-explorer
├─ origin-destination-and-constraints
├─ route-alternative-summary
├─ geographic-route-stage
├─ ordered-itinerary
├─ selected-leg-detail
└─ start-or-share-route
```

Quan hệ chuẩn: `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `route-explorer` | Sở hữu chọn route alternative có thứ tự và spatial context trước hành trình; thiết lập origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor cho mọi child mà không hấp thụ trách nhiệm của child. |
| `origin-destination-and-constraints` | sở hữu origin, destination, mode, accessibility và route constraint; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `route-explorer` và publish cùng identity tới `route-alternative-summary`. |
| `route-alternative-summary` | sở hữu summary duration/warning/route identity có thể compare; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `origin-destination-and-constraints` và publish cùng identity tới `geographic-route-stage`. |
| `geographic-route-stage` | sở hữu bounded route geometry và publish selected leg identity; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `route-alternative-summary` và publish cùng identity tới `ordered-itinerary`. |
| `ordered-itinerary` | sở hữu ordered stop/leg và consume cùng selected leg; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `geographic-route-stage` và publish cùng identity tới `selected-leg-detail`. |
| `selected-leg-detail` | sở hữu fact/warning cho shared selected leg; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `ordered-itinerary` và publish cùng identity tới `start-or-share-route`. |
| `start-or-share-route` | sở hữu start/share handoff mà không thành live dispatch editing; nhận origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor từ `selected-leg-detail` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ map và itinerary đồng hiện trong khi route alternative cùng leg selection được đồng bộ và pan/zoom của map có giới hạn.
- **Navigation replacement:** Không thay thế; map và ordered itinerary đồng hiện, alternative/selected leg đồng bộ.
- **Sticky boundary:** Map chỉ persist trong allocated region và không che itinerary focus.
- **Overflow owner:** Map own bounded pan/zoom; itinerary own một semantic vertical reading axis.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giữ itinerary hoặc map theo evidence làm primary trong khi selected-leg summary và route chooser vẫn nhìn thấy khi vùng kia thu gọn.
- **Navigation replacement:** Giữ evidenced primary map/itinerary visible; route chooser và selected-leg summary vẫn visible khi region kia collapse.
- **Sticky boundary:** Map/detail collapse trả focus về đúng route/leg trigger.
- **Overflow owner:** Chỉ active map/itinerary own interaction overflow.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Dùng sequence itinerary-first có thứ tự; map là alternate full-screen view và đóng leg detail khôi phục stop, scroll cùng viewport state.
- **Navigation replacement:** Dùng itinerary-first ordered leg; map là alternate full-screen view và leg detail là returning sheet.
- **Sticky boundary:** Map/leg sheet chỉ modal khi mở và yield ở short-height.
- **Overflow owner:** Itinerary own page flow; optional map chỉ own bounded pan/zoom khi active.

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
| Initial/loading | `origin-destination-and-constraints` | Tải route calculation và map rendering độc lập mà không thay origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `selected-leg-detail` | Expose selected alternative/leg đồng bộ giữa map và itinerary dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `route-alternative-summary` | Biểu diễn no route hoặc partial route kèm constraint recovery; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `selected-leg-detail` | Khi map lỗi nhưng itinerary còn parity hoặc route calculation lỗi, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `selected-leg-detail` | Biểu diễn map unavailable mà không chặn ordered itinerary; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `start-or-share-route` | Trong khi route calculation, share hoặc start handoff đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `start-or-share-route` | Sau khi share/start handoff hoàn tất tại cùng selected route/leg, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `selected-leg-detail` | Khi closure hoặc reroute làm calculated route stale, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `origin-destination-and-constraints` | focus map↔leg và đóng detail trả exact stop/scroll/viewport state. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `route-explorer` | Resize giữ origin, destination, constraint, selected route, selected leg, map viewport và itinerary anchor, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Hiểu và chọn route alternative qua leg có thứ tự, constraint, duration và spatial context trước khi bắt đầu.
- Mọi required region và quan hệ `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Place discovery không thứ tự cần map results.
- Live dispatch editing là operational workbench.
- Calendar scheduling sở hữu phân bổ thời gian.
- Dependency graph không phải geographic route.
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
| [Google Maps Platform — Routes API](https://developers.google.com/maps/documentation/routes) | Evidence cho route alternatives, legs, steps, and route constraints. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: spatial-route-itinerary-explorer
situationCodes: AR-SRI-01, AR-SRI-02, AR-SRI-03, AR-SRI-04, AR-SRI-05
searchAliases: route explorer, itinerary map, directions alternatives, trip legs
dominantTask: Hiểu và chọn route alternative qua leg có thứ tự, constraint, duration và spatial context trước khi bắt đầu.
regions: route-explorer, origin-destination-and-constraints, route-alternative-summary, geographic-route-stage, ordered-itinerary, selected-leg-detail, start-or-share-route
regionRelationships: route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route
responsive:
  wide: Giữ map và itinerary đồng hiện trong khi route alternative cùng leg selection được đồng bộ và pan/zoom của map có giới hạn.
  intermediate: Giữ itinerary hoặc map theo evidence làm primary trong khi selected-leg summary và route chooser vẫn nhìn thấy khi vùng kia thu gọn.
  compact: Dùng sequence itinerary-first có thứ tự; map là alternate full-screen view và đóng leg detail khôi phục stop, scroll cùng viewport state.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage → ordered-itinerary → selected-leg-detail → start-or-share-route
  navigationReplacement: Dùng itinerary-first ordered leg; map là alternate full-screen view và leg detail là returning sheet.
  stickyBehavior: Map/leg sheet chỉ modal khi mở và yield ở short-height.
  overflowOwner: Itinerary own page flow; optional map chỉ own bounded pan/zoom khi active.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
