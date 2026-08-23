# Console kênh phiên dịch đồng thời

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `simultaneous-interpretation-channel-console` |
| Family | Work |
| Dominant task | Duy trì coverage trực tiếp cho các kênh ngôn ngữ bằng primary/backup interpreter, direction và relay path, đồng thời handoff mà không mất floor feed. |
| Search aliases | `interpretation channel coverage`, `interpreter relay routing`, `live language handoff`, `booth health` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Duy trì coverage trực tiếp cho các kênh ngôn ngữ bằng primary/backup interpreter, direction và relay path, đồng thời handoff mà không mất floor feed.
- Required region graph luôn là `interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SI-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-SI-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-SI-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-SI-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-SI-05` | Template must assign primary/backup interpreters, configure a relay, surface uncovered language, complete a handoff and announce health changes without moving focus. | Required evidence. |
| `AR-SI-90` | facilitated meeting | Từ chối. |
| `AR-SI-91` | localization workbench | Từ chối. |
| `AR-SI-92` | audio mix console | Từ chối. |
| `AR-SI-93` | generic roster | Từ chối. |

### Quy tắc chọn

Chỉ chọn `simultaneous-interpretation-channel-console` khi `AR-SI-01` đến `AR-SI-05` đều có evidence và không có mã `AR-SI-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
interpretation-console
   `-- floor-speaker-feed
      `-- language-channel-matrix
         `-- interpreter-booth-roster
            `-- primary-backup-relay-routes
               `-- active-channel-health
                  `-- handoff-and-incident-controls
                     `-- listener-coverage-and-session-log
```

Biểu thức relationship đã khai báo: `interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `interpretation-console` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `floor-speaker-feed` | Sở hữu evidence, action, state và recovery của floor speaker feed. | Theo sau `interpretation-console` trong semantic order và dùng đúng selected context của vùng đó. |
| `language-channel-matrix` | Sở hữu evidence, action, state và recovery của language channel matrix. | Đồng bộ hai chiều với `floor-speaker-feed` trong cùng selected context. |
| `interpreter-booth-roster` | Sở hữu evidence, action, state và recovery của interpreter booth roster. | Đồng bộ hai chiều với `language-channel-matrix` trong cùng selected context. |
| `primary-backup-relay-routes` | Sở hữu evidence, action, state và recovery của primary backup relay routes. | Theo sau `interpreter-booth-roster` trong semantic order và dùng đúng selected context của vùng đó. |
| `active-channel-health` | Sở hữu evidence, action, state và recovery của active channel health. | Theo sau `primary-backup-relay-routes` trong semantic order và dùng đúng selected context của vùng đó. |
| `handoff-and-incident-controls` | Sở hữu evidence, action, state và recovery của handoff and incident controls. | Theo sau `active-channel-health` trong semantic order và dùng đúng selected context của vùng đó. |
| `listener-coverage-and-session-log` | Sở hữu evidence, action, state và recovery của listener coverage and session log. | Theo sau `handoff-and-incident-controls` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Floor feed, channel matrix, interpreter roster, relay paths and health/incident rail coexist.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `language-channel-matrix` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Active channel becomes primary; full matrix and roster move to synchronized drawers while floor language persists.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `language-channel-matrix` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Channel list → channel direction/feed → interpreter and relay assignment → health → handoff/incident; operator and interpreter views preserve role-specific controls.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `language-channel-matrix` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `interpretation-console → floor-speaker-feed → language-channel-matrix → interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`.
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
| Khởi đầu / loading | `floor-speaker-feed` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `language-channel-matrix` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `interpreter-booth-roster` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `primary-backup-relay-routes` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `handoff-and-incident-controls` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `listener-coverage-and-session-log` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `listener-coverage-and-session-log` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `floor-speaker-feed` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `listener-coverage-and-session-log` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `interpretation-console` | Giữ selected entity, query, state và recovery khi topology đổi. |
| session offline/live/ended | `floor-speaker-feed` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| floor language known/unknown | `language-channel-matrix` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| channel covered/degraded/uncovered | `interpreter-booth-roster` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| interpreter active/break/unavailable | `primary-backup-relay-routes` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| relay valid/broken | `active-channel-health` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| handoff pending/accepted | `handoff-and-incident-controls` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| listener issue and session log failure. | `listener-coverage-and-session-log` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must assign primary/backup interpreters, configure a relay, surface uncovered language, complete a handoff and announce health changes without moving focus.

### Từ chối

- Từ chối facilitated meeting; đây là evidence `AR-SI-90` và phải route sang archetype khác.
- Từ chối localization workbench; đây là evidence `AR-SI-91` và phải route sang archetype khác.
- Từ chối audio mix console; đây là evidence `AR-SI-92` và phải route sang archetype khác.
- Từ chối generic roster; đây là evidence `AR-SI-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-SI-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [Microsoft Teams — Language Interpretation](https://support.microsoft.com/en-us/teams/meetings/use-language-interpretation-in-microsoft-teams-meetings) | Hỗ trợ language-channel assignment and interpreter roles. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Zoom — Language Interpretation](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064768) | Hỗ trợ live language channels and handoff context. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ health announcements without focus movement. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "simultaneous-interpretation-channel-console",
  "situationCodes": [
    "<matched AR-SI-* codes>"
  ],
  "searchAliases": [
    "interpretation channel coverage",
    "interpreter relay routing",
    "live language handoff",
    "booth health"
  ],
  "dominantTask": "Maintain live language-channel coverage by assigning primary and backup interpreters, managing direction and relay paths, and handing channels over without losing the floor feed.",
  "regions": [
    "interpretation-console",
    "floor-speaker-feed",
    "language-channel-matrix",
    "interpreter-booth-roster",
    "primary-backup-relay-routes",
    "active-channel-health",
    "handoff-and-incident-controls",
    "listener-coverage-and-session-log"
  ],
  "regionRelationships": [
    "interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "interpretation-console → floor-speaker-feed → language-channel-matrix → interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "language-channel-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "session offline/live/ended",
    "floor language known/unknown",
    "channel covered/degraded/uncovered",
    "interpreter active/break/unavailable",
    "relay valid/broken",
    "handoff pending/accepted",
    "listener issue and session log failure."
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

