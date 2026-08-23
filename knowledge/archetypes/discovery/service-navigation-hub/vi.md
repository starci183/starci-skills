# Service navigation hub

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `service-navigation-hub` |
| Family | Discovery |
| Dominant task | Chọn đúng branch service hoặc task từ information architecture có nhóm kể cả khi search không khả dụng. |
| Search aliases | `service hub, task directory, grouped services, citizen navigation` |
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
| `AR-SNH-01` | Chọn đúng branch service hoặc task từ information architecture có nhóm kể cả khi search không khả dụng. | Candidate khi được chứng minh. |
| `AR-SNH-02` | Mọi region trong `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-SNH-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-SNH-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-SNH-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-SNH-90` | Product có filter và sort cần catalog. | Reject. |
| `AR-SNH-91` | Global application navigation là concern của shell. | Reject. |
| `AR-SNH-92` | Marketing landing page thuyết phục thay vì route. | Reject. |

### Selection rule

Chọn `service-navigation-hub` chỉ khi AR-SNH-01, AR-SNH-02, AR-SNH-03 được chứng minh và không có AR-SNH-90, AR-SNH-91, AR-SNH-92. Áp dụng responsive contract khi AR-SNH-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-SNH-05.

## Region graph

```text
service-hub
├─ context-and-search
├─ top-tasks
├─ grouped-navigation-sections
└─ status-or-contact-escalation
```

Quan hệ chuẩn: `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `service-hub` | Sở hữu routing theo intent qua grouped service kể cả khi search unavailable; thiết lập service context, query, group order, route availability và escalation status cho mọi child mà không hấp thụ trách nhiệm của child. |
| `context-and-search` | sở hữu optional search context và nêu grouped navigation vẫn authoritative; nhận service context, query, group order, route availability và escalation status từ `service-hub` và publish cùng identity tới `top-tasks`. |
| `top-tasks` | sở hữu short top-task set ưu tiên cao nhất; nhận service context, query, group order, route availability và escalation status từ `context-and-search` và publish cùng identity tới `grouped-navigation-sections`. |
| `grouped-navigation-sections` | sở hữu đầy đủ route group theo intent và một primary link mỗi item; nhận service context, query, group order, route availability và escalation status từ `top-tasks` và publish cùng identity tới `status-or-contact-escalation`. |
| `status-or-contact-escalation` | sở hữu degraded-service notice, contact và escalation route; nhận service context, query, group order, route availability và escalation status từ `grouped-navigation-sections` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Dùng một row top-task ngắn rồi hai hoặc ba cột nhóm theo semantic priority.
- **Navigation replacement:** Không thay thế; short top-task row đứng trước hai/ba semantic navigation group.
- **Sticky boundary:** Không service group nào sticky; status chỉ persist khi reserve space và có dismiss route.
- **Overflow owner:** Page flow own mọi service group và escalation route.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Dùng hai cột trong khi giữ thứ tự group và route identity.
- **Navigation replacement:** Dùng hai column nhưng giữ semantic group order và top-task priority.
- **Sticky boundary:** Search result không overlay hoặc replace grouped route authority.
- **Overflow owner:** Page flow vẫn là scroll owner duy nhất.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Dùng một cột theo priority gồm group heading và link mà không biến mọi route thành card khổng lồ hoặc accordion lồng nhau.
- **Navigation replacement:** Dùng một column theo priority gồm group heading/link; không biến mọi route thành card/accordion lồng.
- **Sticky boundary:** Không navigation group nào sticky ở short-height.
- **Overflow owner:** Page flow own toàn bộ information architecture.

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
| Initial/loading | `context-and-search` | Tải service context và optional search đang tải mà không thay service context, query, group order, route availability và escalation status đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `grouped-navigation-sections` | Expose top task, grouped route và escalation availability dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `top-tasks` | Biểu diễn group rỗng hoặc personalized recent task absent nhưng không xóa core route; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `grouped-navigation-sections` | Khi search unavailable trong khi grouped navigation vẫn usable đầy đủ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `grouped-navigation-sections` | Biểu diễn service degraded hoặc route unavailable kèm contact alternative; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `status-or-contact-escalation` | Trong khi search update hoặc contact escalation đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `status-or-contact-escalation` | Sau khi search result/escalation status được announce không di chuyển focus, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `grouped-navigation-sections` | Khi service status đổi trong khi route group ổn định, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `context-and-search` | search update giữ focus có chủ đích; fallback navigation không cần search. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `service-hub` | Resize giữ service context, query, group order, route availability và escalation status, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Chọn đúng branch service hoặc task từ information architecture có nhóm kể cả khi search không khả dụng.
- Mọi required region và quan hệ `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Product có filter và sort cần catalog.
- Global application navigation là concern của shell.
- Marketing landing page thuyết phục thay vì route.
- One-service start page sở hữu một path giới hạn.
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
| [NHS Service Manual — Patterns](https://service-manual.nhs.uk/design-system/patterns) | Evidence cho service routing and escalation patterns. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [U.S. Web Design System — Patterns](https://designsystem.digital.gov/patterns/) | Evidence cho public-service task and recovery patterns. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [GOV.UK Design System — Patterns](https://design-system.service.gov.uk/patterns/) | Evidence cho task-oriented service navigation and form recovery. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: service-navigation-hub
situationCodes: AR-SNH-01, AR-SNH-02, AR-SNH-03, AR-SNH-04, AR-SNH-05
searchAliases: service hub, task directory, grouped services, citizen navigation
dominantTask: Chọn đúng branch service hoặc task từ information architecture có nhóm kể cả khi search không khả dụng.
regions: service-hub, context-and-search, top-tasks, grouped-navigation-sections, status-or-contact-escalation
regionRelationships: service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation
responsive:
  wide: Dùng một row top-task ngắn rồi hai hoặc ba cột nhóm theo semantic priority.
  intermediate: Dùng hai cột trong khi giữ thứ tự group và route identity.
  compact: Dùng một cột theo priority gồm group heading và link mà không biến mọi route thành card khổng lồ hoặc accordion lồng nhau.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation
  navigationReplacement: Dùng một column theo priority gồm group heading/link; không biến mọi route thành card/accordion lồng.
  stickyBehavior: Không navigation group nào sticky ở short-height.
  overflowOwner: Page flow own toàn bộ information architecture.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
