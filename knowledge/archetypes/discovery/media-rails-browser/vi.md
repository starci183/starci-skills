# Media rails browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-rails-browser` |
| Family | Discovery |
| Dominant task | Khám phá media library qua lựa chọn nổi bật và các nhóm semantic được biên tập theo thứ bậc. |
| Search aliases | `media rails, featured media, editorial shelves, streaming browse` |
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
| `AR-MRB-01` | Khám phá media library qua lựa chọn nổi bật và các nhóm semantic được biên tập theo thứ bậc. | Candidate khi được chứng minh. |
| `AR-MRB-02` | Mọi region trong `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-MRB-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-MRB-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-MRB-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-MRB-90` | Collection tìm kiếm đồng nhất cần catalog. | Reject. |
| `AR-MRB-91` | Snippet query xếp hạng cần faceted results. | Reject. |
| `AR-MRB-92` | Đọc biên tập theo thời gian cần feed. | Reject. |

### Selection rule

Chọn `media-rails-browser` chỉ khi AR-MRB-01, AR-MRB-02, AR-MRB-03 được chứng minh và không có AR-MRB-90, AR-MRB-91, AR-MRB-92. Áp dụng responsive contract khi AR-MRB-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-MRB-05.

## Region graph

```text
media-browser
├─ featured-stage
├─ category-rail
├─ bounded-rail-navigation
└─ item-preview
```

Quan hệ chuẩn: `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `media-browser` | Sở hữu media discovery từ featured choice qua các group biên tập riêng; thiết lập featured item, rail identity, rail position, preview item và resume progress cho mọi child mà không hấp thụ trách nhiệm của child. |
| `featured-stage` | sở hữu featured choice và thiết lập library priority; nhận featured item, rail identity, rail position, preview item và resume progress từ `media-browser` và publish cùng identity tới `category-rail`. |
| `category-rail` | sở hữu một semantic editorial group và ordered media item; nhận featured item, rail identity, rail position, preview item và resume progress từ `featured-stage` và publish cùng identity tới `bounded-rail-navigation`. |
| `bounded-rail-navigation` | sở hữu previous/next rõ ràng trong active rail; nhận featured item, rail identity, rail position, preview item và resume progress từ `category-rail` và publish cùng identity tới `item-preview`. |
| `item-preview` | sở hữu preview/resume context nhẹ mà không thành playback theater; nhận featured item, rail identity, rail position, preview item và resume progress từ `bounded-rail-navigation` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ featured stage và nhiều rail có tên; mỗi rail chỉ sở hữu horizontal overflow có giới hạn của nó.
- **Navigation replacement:** Không thay thế; featured stage và category rail có tên giữ editorial order.
- **Sticky boundary:** Không rail nào page-sticky; preview chỉ modal khi mở.
- **Overflow owner:** Mỗi category rail own bounded horizontal axis; page flow own vertical group order.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giảm dominance của featured và số item rail nhìn thấy trong khi giữ group heading và continuation route.
- **Navigation replacement:** Giảm featured dominance và số item thấy trong rail nhưng giữ heading/continue path.
- **Sticky boundary:** Preview trả focus về đúng rail item.
- **Overflow owner:** Mỗi rail giữ bounded horizontal overflow với control rõ.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Biến featured media thành vertical lead và dùng control rail có giới hạn hoặc nhóm dọc ngắn với View all.
- **Navigation replacement:** Dùng bounded rail control hoặc short vertical group có View all; featured item thành vertical lead.
- **Sticky boundary:** Không rail/featured surface nào sticky ở short-height.
- **Overflow owner:** Chỉ từng rail own horizontal overflow; page không bao giờ own.

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
| Initial/loading | `featured-stage` | Tải featured stage và từng rail loading độc lập mà không thay featured item, rail identity, rail position, preview item và resume progress đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `bounded-rail-navigation` | Expose featured item, rail position và preview selection dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `category-rail` | Biểu diễn một rail rỗng mà không collapse editorial group khác; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `bounded-rail-navigation` | Khi một rail lỗi với retry cô lập trong group đó, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `bounded-rail-navigation` | Biểu diễn media unavailable nhưng group/continue path vẫn giữ; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `item-preview` | Trong khi rail retry hoặc preview open đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `item-preview` | Sau khi preview/resume action hoàn tất mà không reset rail position, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `bounded-rail-navigation` | Khi recommendation mới đến mà không replace focused item, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `featured-stage` | đóng preview trả focus về item mở nó; rail control luôn keyboard reachable. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `media-browser` | Resize giữ featured item, rail identity, rail position, preview item và resume progress, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Khám phá media library qua lựa chọn nổi bật và các nhóm semantic được biên tập theo thứ bậc.
- Mọi required region và quan hệ `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Collection tìm kiếm đồng nhất cần catalog.
- Snippet query xếp hạng cần faceted results.
- Đọc biên tập theo thời gian cần feed.
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
| [Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Evidence cho editorial grouping and prioritized discovery. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Evidence cho reflow without two-dimensional page scrolling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) | Evidence cho explicit sequential controls and announced position. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: media-rails-browser
situationCodes: AR-MRB-01, AR-MRB-02, AR-MRB-03, AR-MRB-04, AR-MRB-05
searchAliases: media rails, featured media, editorial shelves, streaming browse
dominantTask: Khám phá media library qua lựa chọn nổi bật và các nhóm semantic được biên tập theo thứ bậc.
regions: media-browser, featured-stage, category-rail, bounded-rail-navigation, item-preview
regionRelationships: media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview
responsive:
  wide: Giữ featured stage và nhiều rail có tên; mỗi rail chỉ sở hữu horizontal overflow có giới hạn của nó.
  intermediate: Giảm dominance của featured và số item rail nhìn thấy trong khi giữ group heading và continuation route.
  compact: Biến featured media thành vertical lead và dùng control rail có giới hạn hoặc nhóm dọc ngắn với View all.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: media-browser → featured-stage → category-rail → bounded-rail-navigation → item-preview
  navigationReplacement: Dùng bounded rail control hoặc short vertical group có View all; featured item thành vertical lead.
  stickyBehavior: Không rail/featured surface nào sticky ở short-height.
  overflowOwner: Chỉ từng rail own horizontal overflow; page không bao giờ own.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
