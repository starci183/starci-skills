# Conversation room

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `conversation-room` |
| Family | Work |
| Dominant task | Đọc và tiếp tục chronological thread live trong khi giữ unread position, composer draft, room context và scroll intent. |
| Search aliases | thread live, chat room, composer persistent, unread position |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `conversation-room` owns the complete dominant task and its recovery boundary.
- Đọc và tiếp tục chronological thread live trong khi giữ unread position, composer draft, room context và scroll intent.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CRM-01` | Đọc và tiếp tục chronological thread live trong khi giữ unread position, composer draft, room context và scroll intent. | Bằng chứng positive bắt buộc. |
| `AR-CRM-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-CRM-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-CRM-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CRM-90` | Task thực tế do inbox triage hoặc live support session sở hữu. | Reject. |
| `AR-CRM-91` | Reject inbox triage, activity feed thụ động, ticket decision queue, media comment gắn time và live-support room cần shared stage/remote-control consent. | Reject. |
| `AR-CRM-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `conversation-room` khi và chỉ khi `AR-CRM-01` đến `AR-CRM-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-CRM-90` đến `AR-CRM-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
conversation-room
├─ room-and-live-status
├─ chronological-thread
│  └─ unread-position
├─ persistent-composer
├─ participants-pins-and-files-context
└─ message-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `conversation-room` | Sở hữu một room identity, chronological history, read position, composer draft và connection state. |
| `room-and-live-status` | Nêu room, participant summary, live/disconnected/reconnecting state và permission. |
| `chronological-thread` | Sở hữu message order, history loading, new arrival, cuộn dọc và message focus. |
| `unread-position` | Đánh dấu boundary ổn định giữa read history và unread arrival ngoài tín hiệu màu. |
| `persistent-composer` | Sở hữu draft, attachment state, send pending/error/retry và chống duplicate. |
| `participants-pins-and-files-context` | Sở hữu room context hỗ trợ và trả focus/scroll về trigger. |
| `message-actions` | Sở hữu edit/delete/retry và conflict cho selected message mà không âm thầm đổi room order. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ thread và contextual rail đồng hiện; reserve composer space trong room; coi optional room navigation ngoài leaf này.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `chronological-thread` sở hữu overflow dọc message; composer và page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Biến context rail thành drawer; giữ thread measure và composer primary; giữ pin/participant summary reachable.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `chronological-thread` sở hữu overflow dọc message; composer và page không sở hữu overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng thread full-width; giữ composer safe-area sticky có reserved space nhưng yield ở short height; mở context thành sheet và chỉ hiện Jump to latest khi rời live edge.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `chronological-thread` sở hữu overflow dọc message; composer và page không sở hữu overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `conversation-room → room-and-live-status → chronological-thread → unread-position → persistent-composer → participants-pins-and-files-context → message-actions`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm initial/history loading, room mới rỗng, live/disconnected/reconnecting, unread/new message, send pending/error/retry, draft, edit/delete conflict, attachment unavailable, permission/muted và focus sau send/arrival.

## State obligations

Task-specific states: initial/history loading, room mới rỗng, live/disconnected/reconnecting, unread/new message, send pending/error/retry, draft, edit/delete conflict, attachment unavailable, permission/muted và focus sau send/arrival.

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

- Chronological reading, unread position, live arrival policy và persistent composer draft cùng sở hữu room loop.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject inbox triage, activity feed thụ động, ticket decision queue, media comment gắn time và live-support room cần shared stage/remote-control consent.
- Reject khi inbox triage hoặc live support session sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CRM-90`, `AR-CRM-91` hoặc `AR-CRM-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Slack keyboard shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts) | Conversation navigation, composer access, message actions, and sidebar access require keyboard paths. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky và temporary surface không được che hoàn toàn control đang focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `conversation-room`. |
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
  "archetypeId": "conversation-room",
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
