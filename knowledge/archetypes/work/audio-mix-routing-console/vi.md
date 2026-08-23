# Console routing audio mix

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `audio-mix-routing-console` |
| Family | Work |
| Dominant task | Route source audio qua bus và processor, cân bằng channel parameters cùng automation, rồi xác thực master output trước mixdown. |
| Search aliases | `audio signal routing`, `bus mix console`, `channel automation`, `master validation` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Route source audio qua bus và processor, cân bằng channel parameters cùng automation, rồi xác thực master output trước mixdown.
- Required region graph luôn là `mix-console → source-track-bank → signal-flow-routing-map ↔ channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-AM-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-AM-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-AM-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-AM-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-AM-05` | Template must reroute a source, adjust a channel through keyboard/numeric controls, expose a feedback or clipping risk, edit one automation point and block bounce until master validation passes. | Required evidence. |
| `AR-AM-90` | multi-track timeline editor | Từ chối. |
| `AR-AM-91` | media player | Từ chối. |
| `AR-AM-92` | generic node graph | Từ chối. |
| `AR-AM-93` | monitoring mixer | Từ chối. |

### Quy tắc chọn

Chỉ chọn `audio-mix-routing-console` khi `AR-AM-01` đến `AR-AM-05` đều có evidence và không có mã `AR-AM-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
mix-console
   `-- source-track-bank
      `-- signal-flow-routing-map
         `-- channel-strip-bank
            `-- selected-channel-processing
               `-- automation-time-lanes
                  `-- master-output-metering
                     `-- delivery-validation-and-bounce
```

Biểu thức relationship đã khai báo: `mix-console → source-track-bank → signal-flow-routing-map ↔ channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `mix-console` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `source-track-bank` | Sở hữu evidence, action, state và recovery của source track bank. | Theo sau `mix-console` trong semantic order và dùng đúng selected context của vùng đó. |
| `signal-flow-routing-map` | Sở hữu evidence, action, state và recovery của signal flow routing map. | Đồng bộ hai chiều với `source-track-bank` trong cùng selected context. |
| `channel-strip-bank` | Sở hữu evidence, action, state và recovery của channel strip bank. | Đồng bộ hai chiều với `signal-flow-routing-map` trong cùng selected context. |
| `selected-channel-processing` | Sở hữu evidence, action, state và recovery của selected channel processing. | Theo sau `channel-strip-bank` trong semantic order và dùng đúng selected context của vùng đó. |
| `automation-time-lanes` | Sở hữu evidence, action, state và recovery của automation time lanes. | Theo sau `selected-channel-processing` trong semantic order và dùng đúng selected context của vùng đó. |
| `master-output-metering` | Sở hữu evidence, action, state và recovery của master output metering. | Theo sau `automation-time-lanes` trong semantic order và dùng đúng selected context của vùng đó. |
| `delivery-validation-and-bounce` | Sở hữu evidence, action, state và recovery của delivery validation and bounce. | Theo sau `master-output-metering` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Routing map, channel bank, selected processing, bounded automation timeline and master output remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `signal-flow-routing-map` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Selected channel or bus group becomes primary; routing/processing use synchronized drawers and automation becomes an alternate mode.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `signal-flow-routing-map` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Channel or bus → explicit signal path → numeric/fader controls → processing/automation → master validation; every fader has keyboard and numeric parity.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `signal-flow-routing-map` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `mix-console → source-track-bank → signal-flow-routing-map → channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce`.
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
| Khởi đầu / loading | `source-track-bank` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `signal-flow-routing-map` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `channel-strip-bank` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `selected-channel-processing` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `master-output-metering` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `delivery-validation-and-bounce` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `delivery-validation-and-bounce` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `source-track-bank` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `delivery-validation-and-bounce` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `mix-console` | Giữ selected entity, query, state và recovery khi topology đổi. |
| session loading | `source-track-bank` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| route connected/broken/feedback-risk | `signal-flow-routing-map` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| channel muted/soloed/clipping | `channel-strip-bank` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| processor bypass/error | `selected-channel-processing` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| automation read/write/conflict | `automation-time-lanes` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| master safe/clipping | `master-output-metering` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| validation warning and bounce pending/failure. | `delivery-validation-and-bounce` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must reroute a source, adjust a channel through keyboard/numeric controls, expose a feedback or clipping risk, edit one automation point and block bounce until master validation passes.

### Từ chối

- Từ chối multi-track timeline editor; đây là evidence `AR-AM-90` và phải route sang archetype khác.
- Từ chối media player; đây là evidence `AR-AM-91` và phải route sang archetype khác.
- Từ chối generic node graph; đây là evidence `AR-AM-92` và phải route sang archetype khác.
- Từ chối monitoring mixer; đây là evidence `AR-AM-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-AM-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [Apple — Logic Pro Mixing Overview](https://support.apple.com/guide/logicpro/mixing-overview-lgcpbc219818/mac) | Hỗ trợ channel strips, routing, processing, automation, and output. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Avid — Pro Tools Signal Routing](https://kb.avid.com/pkb/articles/en_US/How_To/en367979) | Hỗ trợ source, bus, and master signal paths. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) | Hỗ trợ keyboard and numeric control parity. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "audio-mix-routing-console",
  "situationCodes": [
    "<matched AR-AM-* codes>"
  ],
  "searchAliases": [
    "audio signal routing",
    "bus mix console",
    "channel automation",
    "master validation"
  ],
  "dominantTask": "Route audio sources through buses and processors, balance channel parameters and automation, and validate the master output before mixdown.",
  "regions": [
    "mix-console",
    "source-track-bank",
    "signal-flow-routing-map",
    "channel-strip-bank",
    "selected-channel-processing",
    "automation-time-lanes",
    "master-output-metering",
    "delivery-validation-and-bounce"
  ],
  "regionRelationships": [
    "mix-console → source-track-bank → signal-flow-routing-map ↔ channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mix-console → source-track-bank → signal-flow-routing-map → channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "signal-flow-routing-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "session loading",
    "route connected/broken/feedback-risk",
    "channel muted/soloed/clipping",
    "processor bypass/error",
    "automation read/write/conflict",
    "master safe/clipping",
    "validation warning and bounce pending/failure."
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

