# Media theater with queue

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-theater-queue` |
| Family | Discovery |
| Dominant task | Duy trì playback liên tục trong khi điều hướng queue, chapter hoặc transcript đồng bộ. |
| Search aliases | `media theater, player queue, transcript player, chapter playback` |
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
| `AR-MTQ-01` | Duy trì playback liên tục trong khi điều hướng queue, chapter hoặc transcript đồng bộ. | Candidate khi được chứng minh. |
| `AR-MTQ-02` | Mọi region trong `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-MTQ-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-MTQ-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-MTQ-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-MTQ-90` | Gallery inspection không sở hữu playback continuity. | Reject. |
| `AR-MTQ-91` | Video minh họa trong narrative detail là supporting content. | Reject. |
| `AR-MTQ-92` | Frame rời cần presentation stage. | Reject. |

### Selection rule

Chọn `media-theater-queue` chỉ khi AR-MTQ-01, AR-MTQ-02, AR-MTQ-03 được chứng minh và không có AR-MTQ-90, AR-MTQ-91, AR-MTQ-92. Áp dụng responsive contract khi AR-MTQ-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-MTQ-05.

## Region graph

```text
media-theater
├─ playback-stage
├─ transport-controls
├─ queue-or-chapters
├─ synchronized-transcript
└─ current-metadata
```

Quan hệ chuẩn: `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `media-theater` | Sở hữu playback local liên tục khi queue/chapter/transcript navigation đổi; thiết lập current item, play state, time, cue, caption, speed và resume position cho mọi child mà không hấp thụ trách nhiệm của child. |
| `playback-stage` | sở hữu playback continuity và rendered media state; nhận current item, play state, time, cue, caption, speed và resume position từ `media-theater` và publish cùng identity tới `transport-controls`. |
| `transport-controls` | sở hữu play/pause/seek/caption/speed action; nhận current item, play state, time, cue, caption, speed và resume position từ `playback-stage` và publish cùng identity tới `queue-or-chapters`. |
| `queue-or-chapters` | sở hữu ordered media/chapter navigation mà không reset playback ngầm; nhận current item, play state, time, cue, caption, speed và resume position từ `transport-controls` và publish cùng identity tới `synchronized-transcript`. |
| `synchronized-transcript` | sở hữu transcript text và cue đồng bộ với playback time; nhận current item, play state, time, cue, caption, speed và resume position từ `queue-or-chapters` và publish cùng identity tới `current-metadata`. |
| `current-metadata` | sở hữu title, duration, availability và current-item context; nhận current item, play state, time, cue, caption, speed và resume position từ `synchronized-transcript` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ stage lớn và một secondary pane trong khi transport luôn truy cập được và playback sở hữu continuity.
- **Navigation replacement:** Không thay thế; large playback stage và một secondary pane đồng hiện, state giữ qua tab.
- **Sticky boundary:** Playback chỉ persist trong reserved space và không che transcript focus.
- **Overflow owner:** Playback own continuity, không own scroll; secondary content own một reading axis được khai báo.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Đặt stage trên secondary content hoặc chuyển secondary content vào drawer mà không restart playback.
- **Navigation replacement:** Đưa secondary content xuống dưới stage hoặc vào drawer trong khi transport reachable.
- **Sticky boundary:** Drawer operation không pause/recreate playback và trả focus về trigger.
- **Overflow owner:** Page flow own secondary reading; playback stage không own nested scroll.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Dùng player full-width hoặc mini-player có chừa chỗ, rồi tuần tự queue, chapter, transcript; playback sticky phải yield khi chiều cao ngắn.
- **Navigation replacement:** Dùng full-width/mini-player rồi đến queue, chapter, transcript theo sequence có tên.
- **Sticky boundary:** Sticky player reserve space, không che focus và yield ở short-height.
- **Overflow owner:** Page flow own secondary content; transcript chỉ có một bounded reading axis khi cần.

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
| Initial/loading | `playback-stage` | Tải media loading/buffering nhưng transport context được giữ mà không thay current item, play state, time, cue, caption, speed và resume position đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `synchronized-transcript` | Expose play/pause state, current item, cue, caption, speed và resume position dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `transport-controls` | Biểu diễn transcript unavailable nhưng playback control vẫn giữ; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `synchronized-transcript` | Khi playback lỗi hoặc media removed kèm queue recovery, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `synchronized-transcript` | Biểu diễn caption/transcript unavailable mà không ẩn playback state; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `current-metadata` | Trong khi buffering, seek, queue change hoặc speed update đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `current-metadata` | Sau khi resume/retry hoàn tất tại cùng media position, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `synchronized-transcript` | Khi queue revision hoặc media removed làm current item invalid, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `playback-stage` | focus queue/transcript không ngắt playback; sheet trả trigger. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `media-theater` | Resize giữ current item, play state, time, cue, caption, speed và resume position, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Duy trì playback liên tục trong khi điều hướng queue, chapter hoặc transcript đồng bộ.
- Mọi required region và quan hệ `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Gallery inspection không sở hữu playback continuity.
- Video minh họa trong narrative detail là supporting content.
- Frame rời cần presentation stage.
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
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Evidence cho keyboard and widget interaction models. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Evidence cho non-disruptive status announcements. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WAI — Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/) | Evidence cho captions, transcripts, and media alternatives. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: media-theater-queue
situationCodes: AR-MTQ-01, AR-MTQ-02, AR-MTQ-03, AR-MTQ-04, AR-MTQ-05
searchAliases: media theater, player queue, transcript player, chapter playback
dominantTask: Duy trì playback liên tục trong khi điều hướng queue, chapter hoặc transcript đồng bộ.
regions: media-theater, playback-stage, transport-controls, queue-or-chapters, synchronized-transcript, current-metadata
regionRelationships: media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata
responsive:
  wide: Giữ stage lớn và một secondary pane trong khi transport luôn truy cập được và playback sở hữu continuity.
  intermediate: Đặt stage trên secondary content hoặc chuyển secondary content vào drawer mà không restart playback.
  compact: Dùng player full-width hoặc mini-player có chừa chỗ, rồi tuần tự queue, chapter, transcript; playback sticky phải yield khi chiều cao ngắn.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata
  navigationReplacement: Dùng full-width/mini-player rồi đến queue, chapter, transcript theo sequence có tên.
  stickyBehavior: Sticky player reserve space, không che focus và yield ở short-height.
  overflowOwner: Page flow own secondary content; transcript chỉ có một bounded reading axis khi cần.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
