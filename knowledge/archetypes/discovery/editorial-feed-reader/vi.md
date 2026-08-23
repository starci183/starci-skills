# Editorial feed reader

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `editorial-feed-reader` |
| Family | Discovery |
| Dominant task | Scan story mới hoặc curated theo thứ tự biên tập hay thời gian rồi mở story đáng đọc. |
| Search aliases | `editorial feed, news stream, story feed, curated articles` |
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
| `AR-EFR-01` | Scan story mới hoặc curated theo thứ tự biên tập hay thời gian rồi mở story đáng đọc. | Candidate khi được chứng minh. |
| `AR-EFR-02` | Mọi region trong `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-EFR-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-EFR-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-EFR-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-EFR-90` | Operational activity stream không phải đọc biên tập. | Reject. |
| `AR-EFR-91` | Facet và sort của catalog biểu thị peer discovery. | Reject. |
| `AR-EFR-92` | Media rail ưu tiên lựa chọn playback. | Reject. |

### Selection rule

Chọn `editorial-feed-reader` chỉ khi AR-EFR-01, AR-EFR-02, AR-EFR-03 được chứng minh và không có AR-EFR-90, AR-EFR-91, AR-EFR-92. Áp dụng responsive contract khi AR-EFR-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-EFR-05.

## Region graph

```text
editorial-feed
├─ category-context
├─ featured-story
├─ story-stream
├─ load-more-or-pagination
└─ reading-position-feedback
```

Quan hệ chuẩn: `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `editorial-feed` | Sở hữu scan story theo editorial/chronological order và giữ reading position; thiết lập edition, category, story order, loaded range, read state và return position cho mọi child mà không hấp thụ trách nhiệm của child. |
| `category-context` | sở hữu edition và feed orientation; nhận edition, category, story order, loaded range, read state và return position từ `editorial-feed` và publish cùng identity tới `featured-story`. |
| `featured-story` | sở hữu category/edition context mà không thành facet catalog; nhận edition, category, story order, loaded range, read state và return position từ `category-context` và publish cùng identity tới `story-stream`. |
| `story-stream` | sở hữu story ưu tiên cao nhất và direct reading route; nhận edition, category, story order, loaded range, read state và return position từ `featured-story` và publish cùng identity tới `load-more-or-pagination`. |
| `load-more-or-pagination` | sở hữu supporting story theo semantic priority order; nhận edition, category, story order, loaded range, read state và return position từ `story-stream` và publish cùng identity tới `reading-position-feedback`. |
| `reading-position-feedback` | sở hữu range extension rõ ràng mà không mất footer/orientation; nhận edition, category, story order, loaded range, read state và return position từ `load-more-or-pagination` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Để featured story dẫn đầu trong khi story hỗ trợ theo semantic priority trong grid hoặc list, không theo masonry.
- **Navigation replacement:** Không thay thế; featured story và supporting stream giữ editorial hierarchy rõ.
- **Sticky boundary:** Không feed region nào sticky mặc định; category context chỉ persist khi reserve space.
- **Overflow owner:** Page flow own toàn bộ story stream.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Reflow featured story và giảm track hỗ trợ theo độ dài title.
- **Navigation replacement:** Reflow featured story và giảm supporting column khi title measure thất bại.
- **Sticky boundary:** Reading-position feedback không overlay story link.
- **Overflow owner:** Page flow vẫn là scroll owner duy nhất.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Trình bày một story mỗi row theo semantic priority; loading do user yêu cầu giữ orientation và chỉ focus story mới đầu tiên khi được yêu cầu.
- **Navigation replacement:** Dùng một story mỗi row theo semantic priority; load-more giữ footer/orientation ổn định.
- **Sticky boundary:** Không story card/feedback surface nào sticky ở short-height.
- **Overflow owner:** Page flow own reading và range extension.

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
| Initial/loading | `category-context` | Tải edition và story stream đang tải mà không thay edition, category, story order, loaded range, read state và return position đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `load-more-or-pagination` | Expose featured story, supporting order và read state dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `featured-story` | Biểu diễn edition rỗng nhưng category/return route vẫn giữ; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `load-more-or-pagination` | Khi partial image hoặc load-more lỗi mà không mất story đã tải, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `load-more-or-pagination` | Biểu diễn story unavailable được nêu mà không collapse editorial order; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `reading-position-feedback` | Trong khi load more, save hoặc restore return position đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `reading-position-feedback` | Sau khi story mới append và được announce mà không auto-scroll, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `load-more-or-pagination` | Khi updated/new-item notice trong khi reading position ổn định, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `category-context` | load-more do user yêu cầu có thể focus story mới đầu tiên; passive update không steal focus. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `editorial-feed` | Resize giữ edition, category, story order, loaded range, read state và return position, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Scan story mới hoặc curated theo thứ tự biên tập hay thời gian rồi mở story đáng đọc.
- Mọi required region và quan hệ `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Operational activity stream không phải đọc biên tập.
- Facet và sort của catalog biểu thị peer discovery.
- Media rail ưu tiên lựa chọn playback.
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
| [Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns) | Evidence cho editorial grouping and prioritized discovery. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | Evidence cho article-stream loading and reading continuity. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: editorial-feed-reader
situationCodes: AR-EFR-01, AR-EFR-02, AR-EFR-03, AR-EFR-04, AR-EFR-05
searchAliases: editorial feed, news stream, story feed, curated articles
dominantTask: Scan story mới hoặc curated theo thứ tự biên tập hay thời gian rồi mở story đáng đọc.
regions: editorial-feed, category-context, featured-story, story-stream, load-more-or-pagination, reading-position-feedback
regionRelationships: editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback
responsive:
  wide: Để featured story dẫn đầu trong khi story hỗ trợ theo semantic priority trong grid hoặc list, không theo masonry.
  intermediate: Reflow featured story và giảm track hỗ trợ theo độ dài title.
  compact: Trình bày một story mỗi row theo semantic priority; loading do user yêu cầu giữ orientation và chỉ focus story mới đầu tiên khi được yêu cầu.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback
  navigationReplacement: Dùng một story mỗi row theo semantic priority; load-more giữ footer/orientation ổn định.
  stickyBehavior: Không story card/feedback surface nào sticky ở short-height.
  overflowOwner: Page flow own reading và range extension.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
