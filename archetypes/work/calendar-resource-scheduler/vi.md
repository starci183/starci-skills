# Calendar resource scheduler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `calendar-resource-scheduler` |
| Family | Work |
| Dominant task | Phân bổ resource vào time slot, phát hiện collision và điều chỉnh assignment đến khi schedule khả thi. |
| Search aliases | calendar resource, timeline phân bổ, scheduler collision, queue chưa xếp |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `scheduler` owns the complete dominant task and its recovery boundary.
- Phân bổ resource vào time slot, phát hiện collision và điều chỉnh assignment đến khi schedule khả thi.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CRS-01` | Phân bổ resource vào time slot, phát hiện collision và điều chỉnh assignment đến khi schedule khả thi. | Bằng chứng positive bắt buộc. |
| `AR-CRS-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-CRS-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-CRS-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CRS-90` | Task thực tế do calendar browsing hoặc kanban board sở hữu. | Reject. |
| `AR-CRS-91` | Reject calendar read-only, chuyển state kanban, audit timeline và event form không có phân bổ resource/collision. | Reject. |
| `AR-CRS-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `calendar-resource-scheduler` khi và chỉ khi `AR-CRS-01` đến `AR-CRS-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-CRS-90` đến `AR-CRS-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
scheduler
├─ date-range-and-view-controls
├─ resource-axis
├─ time-axis-grid
├─ unscheduled-work-queue
├─ selected-assignment-editor
└─ conflict-feedback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `scheduler` | Sở hữu một bài toán phân bổ khả thi, date/resource đã chọn và lịch sử phục hồi. |
| `date-range-and-view-controls` | Đặt horizon, timezone và view trong khi giữ selected assignment. |
| `resource-axis` | Nêu resource có thể phân bổ và availability theo time axis chung. |
| `time-axis-grid` | Sở hữu giao điểm resource-time, placement, điều hướng hai trục giới hạn và vị trí collision. |
| `unscheduled-work-queue` | Sở hữu work chờ placement và link từng item tới schedule control rõ ràng. |
| `selected-assignment-editor` | Chỉnh resource, time, duration, recurrence và confirmation cho một assignment. |
| `conflict-feedback` | Nêu assignment collision, chặn commit không an toàn và cung cấp resolve/undo. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ resource-time grid đồng hiện với unscheduled queue và contextual editor khi mỗi vùng còn usable; scheduler sở hữu overflow hai trục và header.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Chỉ `time-axis-grid` sở hữu overflow hai trục có giới hạn; agenda compact loại bỏ page overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Giảm time horizon hoặc resource set; làm queue/editor collapsible; giữ conflict summary và time/resource đã chọn visible.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Chỉ `time-axis-grid` sở hữu overflow hai trục có giới hạn; agenda compact loại bỏ page overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng agenda-first hoặc stage one-resource/one-day; mở unscheduled work và assignment editing thành sheet; cung cấp add/move control thay drag-only.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Chỉ `time-axis-grid` sở hữu overflow hai trục có giới hạn; agenda compact loại bỏ page overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `scheduler → date-range-and-view-controls → resource-axis → time-axis-grid → unscheduled-work-queue → selected-assignment-editor → conflict-feedback`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm đang tải range/resource, không có availability, assignment tentative/confirmed, collision, recurrence, timezone, move pending, external conflict, permission, undo và recovery.

## State obligations

Task-specific states: đang tải range/resource, không có availability, assignment tentative/confirmed, collision, recurrence, timezone, move pending, external conflict, permission, undo và recovery.

| State family | Required behavior |
|---|---|
| Initial / loading | Nêu loading scope, reserve primary region và chỉ block region lỗi. |
| Ready | Hiện current object, selection/cursor, owner relationship và valid action bằng text+semantics. |
| Empty / not-applicable | Phân biệt true empty, filter no-match và non-applicable, kèm next action phù hợp. |
| Error / retry | Nêu failed scope, giữ input/work state và cung cấp retry/correction target có focus. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và giữ context để hiểu. |
| Pending | Ngăn duplicate, giữ context, expose Cancel khi an toàn và announce progress không steal focus. |
| Success | Xác nhận exact changed scope, cập nhật summary liên quan và giữ Undo/next step khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite âm thầm và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus heading mới; status-only update không move focus; modal return trigger. |
| Responsive presentation | Wide giữ simultaneity cần thiết; intermediate tạm hóa support thấp nhất; compact dùng primary stage nhưng giữ action/state/recovery. |

## Boundaries

### Accept

- Giao điểm resource-time, unscheduled work và collision resolution quyết định phân bổ có khả thi hay không.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject calendar read-only, chuyển state kanban, audit timeline và event form không có phân bổ resource/collision.
- Reject khi calendar browsing hoặc kanban board sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CRS-90`, `AR-CRS-91` hoặc `AR-CRS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner cho region/state mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction thể hiện visual character trong các owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Nguồn hỗ trợ | Nguồn không chứng minh |
|---|---|---|
| [FullCalendar event dragging and constraints](https://fullcalendar.io/docs/event-dragging-resizing) | Resource and time movement, overlap constraints, and rejected placement expose scheduling consequences. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `calendar-resource-scheduler`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "calendar-resource-scheduler",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
