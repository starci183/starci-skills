# Scoped federated search

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scoped-federated-search` |
| Family | Discovery |
| Dominant task | Tìm một object xuyên nhiều content type hoặc workspace trong khi giữ rõ scope và quyền sở hữu result. |
| Search aliases | `federated search, global search, type scoped search, workspace search` |
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
| `AR-SFS-01` | Tìm một object xuyên nhiều content type hoặc workspace trong khi giữ rõ scope và quyền sở hữu result. | Candidate khi được chứng minh. |
| `AR-SFS-02` | Mọi region trong `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-SFS-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-SFS-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-SFS-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-SFS-90` | Dataset đồng nhất cần faceted ranked results. | Reject. |
| `AR-SFS-91` | Duyệt taxonomy cần hierarchical content browser. | Reject. |
| `AR-SFS-92` | Search không thể thay toàn bộ information architecture. | Reject. |

### Selection rule

Chọn `scoped-federated-search` chỉ khi AR-SFS-01, AR-SFS-02, AR-SFS-03 được chứng minh và không có AR-SFS-90, AR-SFS-91, AR-SFS-92. Áp dụng responsive contract khi AR-SFS-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-SFS-05.

## Region graph

```text
federated-search
├─ prominent-query
├─ scope-picker
├─ type-summary-navigation
├─ grouped-or-scoped-results
└─ result-pagination
```

Quan hệ chuẩn: `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `federated-search` | Sở hữu search session xuyên type và result ownership rõ theo scope/type; thiết lập query, selected scope, active type, total theo type và page cho mọi child mà không hấp thụ trách nhiệm của child. |
| `prominent-query` | sở hữu federated search session và partial-success contract; nhận query, selected scope, active type, total theo type và page từ `federated-search` và publish cùng identity tới `scope-picker`. |
| `scope-picker` | sở hữu query editing/submission xuyên object type; nhận query, selected scope, active type, total theo type và page từ `prominent-query` và publish cùng identity tới `type-summary-navigation`. |
| `type-summary-navigation` | sở hữu workspace/repository scope và luôn hiển thị cùng result set; nhận query, selected scope, active type, total theo type và page từ `scope-picker` và publish cùng identity tới `grouped-or-scoped-results`. |
| `grouped-or-scoped-results` | sở hữu all-types summary, type count và active-type navigation; nhận query, selected scope, active type, total theo type và page từ `type-summary-navigation` và publish cùng identity tới `result-pagination`. |
| `result-pagination` | sở hữu result được group theo declared type hoặc current scoped type; nhận query, selected scope, active type, total theo type và page từ `grouped-or-scoped-results` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ query và scope ổn định trong khi type summary và active result region cùng đọc được.
- **Navigation replacement:** Không thay thế; query, scope, type summary và active result cùng visible.
- **Sticky boundary:** Query/scope chỉ persist khi reserve space và không che result focus.
- **Overflow owner:** Page flow sở hữu result; type navigation không có page scroll độc lập.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Cho scope xuống hàng và thay type navigation bằng overflow có giới hạn hoặc selector trước khi nhãn trở nên mơ hồ.
- **Navigation replacement:** Cho scope control xuống hàng và dùng bounded type strip hoặc select có label khi label không fit.
- **Sticky boundary:** Type navigation không overlay committed query/scope.
- **Overflow owner:** Chỉ type strip được own bounded horizontal overflow; result vẫn ở page flow.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Chỉ hiển thị một active type tại một thời điểm với đường về all-types summary trong khi query, scope và page không đổi.
- **Navigation replacement:** Hiển thị một active type và mở all-types summary bằng selector/Back giữ query, scope, page.
- **Sticky boundary:** Không federated search surface nào sticky ở short-height.
- **Overflow owner:** Page flow sở hữu active result type; selector chỉ own temporary list.

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
| Initial/loading | `prominent-query` | Tải all-scope query với loading độc lập theo type mà không thay query, selected scope, active type, total theo type và page đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `grouped-or-scoped-results` | Expose active scope, active type, total và owned result dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `scope-picker` | Biểu diễn một type rỗng trong khi type khác vẫn có thể thành công; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `grouped-or-scoped-results` | Khi partial failure được cô lập ở một type hoặc scope, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `grouped-or-scoped-results` | Biểu diễn group bị permission-redact được nêu mà không lộ object ẩn; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `result-pagination` | Trong khi query correction, type retry hoặc pagination đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `result-pagination` | Sau khi total của committed scope/type được announce, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `grouped-or-scoped-results` | Khi type total đổi trong khi query/scope giữ nguyên, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `prominent-query` | compact type selector trả focus và giữ query/scope/page. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `federated-search` | Resize giữ query, selected scope, active type, total theo type và page, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Tìm một object xuyên nhiều content type hoặc workspace trong khi giữ rõ scope và quyền sở hữu result.
- Mọi required region và quan hệ `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Dataset đồng nhất cần faceted ranked results.
- Duyệt taxonomy cần hierarchical content browser.
- Search không thể thay toàn bộ information architecture.
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
| [GitHub Docs — About searching on GitHub](https://docs.github.com/en/search-github/getting-started-with-searching-on-github/about-searching-on-github) | Evidence cho search scopes and heterogeneous object ownership. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Evidence cho reflow without two-dimensional page scrolling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: scoped-federated-search
situationCodes: AR-SFS-01, AR-SFS-02, AR-SFS-03, AR-SFS-04, AR-SFS-05
searchAliases: federated search, global search, type scoped search, workspace search
dominantTask: Tìm một object xuyên nhiều content type hoặc workspace trong khi giữ rõ scope và quyền sở hữu result.
regions: federated-search, prominent-query, scope-picker, type-summary-navigation, grouped-or-scoped-results, result-pagination
regionRelationships: federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination
responsive:
  wide: Giữ query và scope ổn định trong khi type summary và active result region cùng đọc được.
  intermediate: Cho scope xuống hàng và thay type navigation bằng overflow có giới hạn hoặc selector trước khi nhãn trở nên mơ hồ.
  compact: Chỉ hiển thị một active type tại một thời điểm với đường về all-types summary trong khi query, scope và page không đổi.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination
  navigationReplacement: Hiển thị một active type và mở all-types summary bằng selector/Back giữ query, scope, page.
  stickyBehavior: Không federated search surface nào sticky ở short-height.
  overflowOwner: Page flow sở hữu active result type; selector chỉ own temporary list.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
