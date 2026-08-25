# Bộ debug join cửa sổ stream

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `stream-window-join-debugger` |
| Family | Detail |
| Dominant task | Giải thích vì sao events từ hai stream match, miss hoặc bị drop dưới join key, event-time window, watermark và lateness rule. |
| Search aliases | `event-time join debugger`, `watermark miss explanation`, `late event drop`, `two-stream witness` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Giải thích vì sao events từ hai stream match, miss hoặc bị drop dưới join key, event-time window, watermark và lateness rule.
- Required region graph luôn là `join-debugger → join-definition-and-key → stream-a-event-time-lane ↔ stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SJ-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-SJ-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-SJ-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-SJ-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-SJ-05` | Template must explain one match, one window miss and one watermark drop, keep clocks explicit in compact mode and update the witness when join rules change. | Required evidence. |
| `AR-SJ-90` | event replay | Từ chối. |
| `AR-SJ-91` | distributed trace | Từ chối. |
| `AR-SJ-92` | generic timeline | Từ chối. |
| `AR-SJ-93` | log search | Từ chối. |

### Quy tắc chọn

Chỉ chọn `stream-window-join-debugger` khi `AR-SJ-01` đến `AR-SJ-05` đều có evidence và không có mã `AR-SJ-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
join-debugger
   `-- join-definition-and-key
      `-- stream-a-event-time-lane
         `-- stream-b-event-time-lane
            `-- window-and-watermark-overlay
               `-- output-and-unmatched-lane
                  `-- selected-result-or-miss
                     `-- causal-explanation-ledger
```

Biểu thức relationship đã khai báo: `join-debugger → join-definition-and-key → stream-a-event-time-lane ↔ stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `join-debugger` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `join-definition-and-key` | Sở hữu evidence, action, state và recovery của join definition and key. | Theo sau `join-debugger` trong semantic order và dùng đúng selected context của vùng đó. |
| `stream-a-event-time-lane` | Sở hữu evidence, action, state và recovery của stream a event time lane. | Đồng bộ hai chiều với `join-definition-and-key` trong cùng selected context. |
| `stream-b-event-time-lane` | Sở hữu evidence, action, state và recovery của stream b event time lane. | Đồng bộ hai chiều với `stream-a-event-time-lane` trong cùng selected context. |
| `window-and-watermark-overlay` | Sở hữu evidence, action, state và recovery của window and watermark overlay. | Theo sau `stream-b-event-time-lane` trong semantic order và dùng đúng selected context của vùng đó. |
| `output-and-unmatched-lane` | Sở hữu evidence, action, state và recovery của output and unmatched lane. | Theo sau `window-and-watermark-overlay` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-result-or-miss` | Sở hữu evidence, action, state và recovery của selected result or miss. | Theo sau `output-and-unmatched-lane` trong semantic order và dùng đúng selected context của vùng đó. |
| `causal-explanation-ledger` | Sở hữu evidence, action, state và recovery của causal explanation ledger. | Theo sau `selected-result-or-miss` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Both input lanes, shared windows/watermarks, output lane and selected explanation remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `stream-a-event-time-lane` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Input/output lanes stack on one event-time axis; explanation becomes a synchronized side drawer.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `stream-a-event-time-lane` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Result or miss → A event → B event → key/window bounds → watermark/lateness → verdict; raw lanes transform to filtered event tables.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `stream-a-event-time-lane` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `join-debugger → join-definition-and-key → stream-a-event-time-lane → stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger`.
- Text zoom, translation dài và control phóng to kích hoạt cùng named topology change.
- CSS không reorder visual content lệch khỏi keyboard hoặc assistive-technology order.
- Label và identifier dài được wrap; detail ẩn có accessible reveal rõ ràng.
- Nội dung thường không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ selected entity, version, filter, pending state, validation result và recovery point.
- Dynamic update dùng một contextual status message mà không di chuyển focus.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel, rồi trả focus về đúng trigger.
- Drag, drawing, fader, spatial hoặc point movement có parity bằng button, numeric hoặc list.
- Color, position, geometry và motion luôn có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi đầu / loading | `join-definition-and-key` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `stream-a-event-time-lane` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `stream-b-event-time-lane` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `window-and-watermark-overlay` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `selected-result-or-miss` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `causal-explanation-ledger` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `causal-explanation-ledger` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `join-definition-and-key` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `causal-explanation-ledger` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `join-debugger` | Giữ selected entity, query, state và recovery khi topology đổi. |
| streams loading/partial | `join-definition-and-key` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| key match/mismatch | `stream-a-event-time-lane` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| inside/outside window | `stream-b-event-time-lane` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| watermark pending/passed | `window-and-watermark-overlay` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| event on-time/late/dropped | `output-and-unmatched-lane` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| output emitted/retracted | `selected-result-or-miss` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| rule changed and explanation stale. | `causal-explanation-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must explain one match, one window miss and one watermark drop, keep clocks explicit in compact mode and update the witness when join rules change.

### Từ chối

- Từ chối event replay; đây là evidence `AR-SJ-90` và phải route sang archetype khác.
- Từ chối distributed trace; đây là evidence `AR-SJ-91` và phải route sang archetype khác.
- Từ chối generic timeline; đây là evidence `AR-SJ-92` và phải route sang archetype khác.
- Từ chối log search; đây là evidence `AR-SJ-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-SJ-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

## Bàn giao

- **Grammar handoff:** Bind product-specific owner, label, permission, truthful state meaning và permitted action vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Hai handoff không được xóa required region, thay dominant task hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis của task relationship, responsive transformation, interaction và accessibility obligation. Nó không đặt tên StarCi owner, chọn exact geometry, tạo product fact hoặc cấp quyền copy source interface.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [Apache Flink — JoinedStreams](https://nightlies.apache.org/flink/flink-docs-stable/api/java/org/apache/flink/streaming/api/datastream/JoinedStreams.html) | Hỗ trợ two-stream join semantics. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Apache Beam — Basics](https://beam.apache.org/documentation/basics/) | Hỗ trợ event time, windows, watermarks, and lateness. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [VS Code — UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Hỗ trợ developer-tool navigation and evidence presentation. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced recalculation outcomes. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "stream-window-join-debugger",
  "situationCodes": [
    "<matched AR-SJ-* codes>"
  ],
  "searchAliases": [
    "event-time join debugger",
    "watermark miss explanation",
    "late event drop",
    "two-stream witness"
  ],
  "dominantTask": "Explain why events from two streams matched, failed to match or were dropped under join keys, event-time windows, watermarks and lateness rules.",
  "regions": [
    "join-debugger",
    "join-definition-and-key",
    "stream-a-event-time-lane",
    "stream-b-event-time-lane",
    "window-and-watermark-overlay",
    "output-and-unmatched-lane",
    "selected-result-or-miss",
    "causal-explanation-ledger"
  ],
  "regionRelationships": [
    "join-debugger → join-definition-and-key → stream-a-event-time-lane ↔ stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "join-debugger → join-definition-and-key → stream-a-event-time-lane → stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "stream-a-event-time-lane",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "streams loading/partial",
    "key match/mismatch",
    "inside/outside window",
    "watermark pending/passed",
    "event on-time/late/dropped",
    "output emitted/retracted",
    "rule changed and explanation stale."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

