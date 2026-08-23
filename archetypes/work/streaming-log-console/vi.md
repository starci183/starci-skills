# Streaming log console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `streaming-log-console` |
| Family | Work |
| Dominant task | Theo dõi event stream append-only khối lượng lớn, điều khiển pause/follow position, tìm pattern và inspect một event để cô lập failure. |
| Search aliases | log live, tail console, inspect event stream, follow output |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `log-console` owns the complete dominant task and its recovery boundary.
- Theo dõi event stream append-only khối lượng lớn, điều khiển pause/follow position, tìm pattern và inspect một event để cô lập failure.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SLC-01` | Theo dõi event stream append-only khối lượng lớn, điều khiển pause/follow position, tìm pattern và inspect một event để cô lập failure. | Bằng chứng positive bắt buộc. |
| `AR-SLC-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-SLC-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-SLC-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-SLC-90` | Task thực tế do audit timeline hoặc terminal session sở hữu. | Reject. |
| `AR-SLC-91` | Reject audit timeline được curate, conversational feed, terminal command session và code/file editor tĩnh. | Reject. |
| `AR-SLC-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `streaming-log-console` khi và chỉ khi `AR-SLC-01` đến `AR-SLC-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-SLC-90` đến `AR-SLC-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
log-console
├─ stream-scope-and-query
├─ live-status-and-follow-controls
├─ bounded-log-viewport
├─ selected-event-context
└─ detail-or-export-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `log-console` | Sở hữu một stream scope, live position, query và context cô lập failure. |
| `stream-scope-and-query` | Định nghĩa source, time range và pattern filter mà không âm thầm đổi selected event. |
| `live-status-and-follow-controls` | Sở hữu connection, pause, follow, resume-at-bottom và backpressure state. |
| `bounded-log-viewport` | Sở hữu cuộn dọc khối lượng lớn, line identity, timestamp, wrap policy và selection. |
| `selected-event-context` | Giải thích line đã chọn và structured field mà không đổi live position. |
| `detail-or-export-actions` | Sở hữu payload disclosure, redaction notice, export pending, error và retry. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Dành phần lớn không gian cho stream; giữ query/command band và selected-event detail liền kề; giữ line identity/timestamp thay vì card hóa event.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `bounded-log-viewport` sở hữu overflow dọc; chỉ subregion raw token có thể sở hữu overflow ngang; trang không sở hữu.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Biến query control thành collapsible và detail thành drawer; giữ line dễ đọc, wrap policy rõ, live status, pause và follow control.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `bounded-log-viewport` sở hữu overflow dọc; chỉ subregion raw token có thể sở hữu overflow ngang; trang không sở hữu.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng stream full-width có wrap; giới hạn token không break trong owner line/detail; mở filter và detail thành sheet trong khi pause/follow vẫn reachable.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `bounded-log-viewport` sở hữu overflow dọc; chỉ subregion raw token có thể sở hữu overflow ngang; trang không sở hữu.

### Reflow

- DOM order, reading order, and meaningful focus order are `log-console → stream-scope-and-query → live-status-and-follow-controls → bounded-log-viewport → selected-event-context → detail-or-export-actions`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm connecting, live, paused, disconnected, reconnecting, range rỗng, burst/backpressure, query applied/error, selected event, line truncated, payload redact, export pending/error và resume-at-bottom.

## State obligations

Task-specific states: connecting, live, paused, disconnected, reconnecting, range rỗng, burst/backpressure, query applied/error, selected event, line truncated, payload redact, export pending/error và resume-at-bottom.

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

- Append-only stream, live-position policy, query và selected-event isolation cùng sở hữu work loop.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject audit timeline được curate, conversational feed, terminal command session và code/file editor tĩnh.
- Reject khi audit timeline hoặc terminal session sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SLC-90`, `AR-SLC-91` hoặc `AR-SLC-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Elastic Explore logs](https://www.elastic.co/docs/solutions/observability/logs/explore-logs) | Current log exploration supports search, filtering, tailing, and failure investigation over one stream. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading và focus order giữ task meaning qua topology change. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky và temporary surface không được che hoàn toàn control đang focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `streaming-log-console`. |
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
  "archetypeId": "streaming-log-console",
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
