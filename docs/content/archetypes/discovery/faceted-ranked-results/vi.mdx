# Faceted ranked results

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `faceted-ranked-results` |
| Family | Discovery |
| Dominant task | Diễn đạt nhu cầu đã biết, thu hẹp một dataset và đánh giá relevance qua snippet có xếp hạng. |
| Search aliases | `faceted search, ranked results, relevance snippets, filter results` |
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
| `AR-FRR-01` | Diễn đạt nhu cầu đã biết, thu hẹp một dataset và đánh giá relevance qua snippet có xếp hạng. | Candidate khi được chứng minh. |
| `AR-FRR-02` | Mọi region trong `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-FRR-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-FRR-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-FRR-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-FRR-90` | Peer card browse-first cần catalog. | Reject. |
| `AR-FRR-91` | Known list đơn giản không cần xếp hạng relevance. | Reject. |
| `AR-FRR-92` | Global search không đồng nhất cần federated scope. | Reject. |

### Selection rule

Chọn `faceted-ranked-results` chỉ khi AR-FRR-01, AR-FRR-02, AR-FRR-03 được chứng minh và không có AR-FRR-90, AR-FRR-91, AR-FRR-92. Áp dụng responsive contract khi AR-FRR-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-FRR-05.

## Region graph

```text
search-results
├─ query-and-scope
├─ facet-controls
├─ applied-filter-summary
├─ count-sort
├─ ranked-result-list
└─ pagination
```

Quan hệ chuẩn: `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `search-results` | Sở hữu known-need query, narrowing có thể đảo ngược và đánh giá relevance; thiết lập query, scope, applied facet, sort, result count và page cho mọi child mà không hấp thụ trách nhiệm của child. |
| `query-and-scope` | sở hữu search session và committed result context; nhận query, scope, applied facet, sort, result count và page từ `search-results` và publish cùng identity tới `facet-controls`. |
| `facet-controls` | sở hữu query submission và homogeneous search scope; nhận query, scope, applied facet, sort, result count và page từ `query-and-scope` và publish cùng identity tới `applied-filter-summary`. |
| `applied-filter-summary` | sở hữu draft facet choice cùng apply/reset behavior; nhận query, scope, applied facet, sort, result count và page từ `facet-controls` và publish cùng identity tới `count-sort`. |
| `count-sort` | nêu committed constraint bên ngoài temporary filter surface; nhận query, scope, applied facet, sort, result count và page từ `applied-filter-summary` và publish cùng identity tới `ranked-result-list`. |
| `ranked-result-list` | sở hữu result total và ordering mà không đổi relevance evidence; nhận query, scope, applied facet, sort, result count và page từ `count-sort` và publish cùng identity tới `pagination`. |
| `pagination` | sở hữu ranked snippet làm primary evidence cho result choice; nhận query, scope, applied facet, sort, result count và page từ `ranked-result-list` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ facet rail cạnh các snippet xếp hạng trong khi query, count và quyền sở hữu result vẫn gắn rõ ràng.
- **Navigation replacement:** Không thay thế; facet control và ranked result đồng hiện.
- **Sticky boundary:** Query và result context chỉ persist khi reserved space giữ focused result visible.
- **Overflow owner:** Page flow sở hữu result reading; facet rail không own competing page scroll.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Chuyển facets vào surface có thể thu gọn hoặc tạm thời trong khi tiêu chí đã áp dụng và result count vẫn ở ngoài.
- **Navigation replacement:** Thay facet rail bằng collapsible hoặc temporary filter surface; giữ applied filter và count ở ngoài.
- **Sticky boundary:** Temporary surface chỉ trap focus khi modal và trả về filter trigger.
- **Overflow owner:** Filter surface được scroll nội bộ; result reading vẫn ở page flow.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Dùng một chuỗi đọc cho query, applied summary, filter trigger, sort, snippet xếp hạng và pagination; filter sheet khôi phục focus cùng query state.
- **Navigation replacement:** Dùng filter sheet có apply/reset rõ ràng và giữ query, sort, page, trigger focus.
- **Sticky boundary:** Query context chỉ sticky khi reserve space và yield ở short-height.
- **Overflow owner:** Page flow sở hữu result; sheet đang mở chỉ own bounded internal scroll.

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
| Initial/loading | `query-and-scope` | Tải query submit nhưng giữ prior result mà không thay query, scope, applied facet, sort, result count và page đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `ranked-result-list` | Expose ranked snippet, applied facet, count và sort dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `facet-controls` | Biểu diễn zero result kèm spelling, facet và query recovery; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `ranked-result-list` | Khi query hoặc page lỗi nhưng committed criteria được giữ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `ranked-result-list` | Biểu diễn result stale hoặc unavailable mà không ẩn phần ranking còn lại; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `pagination` | Trong khi facet apply/reset, query submit hoặc pagination đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `pagination` | Sau khi result count được announce sau committed criteria change, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `ranked-result-list` | Khi result set đổi sau khi ranking đã hiển thị, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `query-and-scope` | đóng filter sheet trả focus về trigger và giữ query/page. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `search-results` | Resize giữ query, scope, applied facet, sort, result count và page, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Diễn đạt nhu cầu đã biết, thu hẹp một dataset và đánh giá relevance qua snippet có xếp hạng.
- Mọi required region và quan hệ `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Peer card browse-first cần catalog.
- Known list đơn giản không cần xếp hạng relevance.
- Global search không đồng nhất cần federated scope.
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
| [IBM Carbon — Filtering](https://carbondesignsystem.com/patterns/filtering/) | Evidence cho reversible filters and applied criteria. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Evidence cho keyboard and widget interaction models. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | Evidence cho search, navigation, and result-state patterns. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: faceted-ranked-results
situationCodes: AR-FRR-01, AR-FRR-02, AR-FRR-03, AR-FRR-04, AR-FRR-05
searchAliases: faceted search, ranked results, relevance snippets, filter results
dominantTask: Diễn đạt nhu cầu đã biết, thu hẹp một dataset và đánh giá relevance qua snippet có xếp hạng.
regions: search-results, query-and-scope, facet-controls, applied-filter-summary, count-sort, ranked-result-list, pagination
regionRelationships: search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination
responsive:
  wide: Giữ facet rail cạnh các snippet xếp hạng trong khi query, count và quyền sở hữu result vẫn gắn rõ ràng.
  intermediate: Chuyển facets vào surface có thể thu gọn hoặc tạm thời trong khi tiêu chí đã áp dụng và result count vẫn ở ngoài.
  compact: Dùng một chuỗi đọc cho query, applied summary, filter trigger, sort, snippet xếp hạng và pagination; filter sheet khôi phục focus cùng query state.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination
  navigationReplacement: Dùng filter sheet có apply/reset rõ ràng và giữ query, sort, page, trigger focus.
  stickyBehavior: Query context chỉ sticky khi reserve space và yield ở short-height.
  overflowOwner: Page flow sở hữu result; sheet đang mở chỉ own bounded internal scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
