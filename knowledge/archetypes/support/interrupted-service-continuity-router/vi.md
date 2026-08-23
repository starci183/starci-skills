# Bộ route continuity cho dịch vụ bị gián đoạn

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `interrupted-service-continuity-router` |
| Family | Support |
| Dominant task | Bảo toàn task chưa xong khi primary channel unavailable, chọn alternate channel hỗ trợ remaining operations và access needs, rồi transfer reusable state bằng continuity handoff. |
| Search aliases | `interrupted task continuity`, `warm channel transfer`, `state compatibility routing`, `restoration reconciliation` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Bảo toàn task chưa xong khi primary channel unavailable, chọn alternate channel hỗ trợ remaining operations và access needs, rồi transfer reusable state bằng continuity handoff.
- Required region graph luôn là `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-IC-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-IC-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-IC-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-IC-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-IC-05` | Template must preserve a saved task position, filter alternate channels by operation and access needs, disclose non-transferable evidence, issue an accessible handoff and reconcile later completion/restoration. | Required evidence. |
| `AR-IC-90` | communication-delivery-recovery-center | Từ chối. |
| `AR-IC-91` | stable service hub | Từ chối. |
| `AR-IC-92` | outage dashboard | Từ chối. |
| `AR-IC-93` | completed handoff | Từ chối. |

### Quy tắc chọn

Chỉ chọn `interrupted-service-continuity-router` khi `AR-IC-01` đến `AR-IC-05` đều có evidence và không có mã `AR-IC-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
continuity-router
   `-- disruption-scope-and-authority
      `-- interrupted-task-state
         `-- remaining-operation-and-access-constraints
            `-- alternative-channel-capability-register
               `-- state-transfer-compatibility
                  `-- selected-continuity-route
                     `-- handoff-token-and-commitments
                        `-- restoration-reconciliation
```

Biểu thức relationship đã khai báo: `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `continuity-router` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `disruption-scope-and-authority` | Sở hữu evidence, action, state và recovery của disruption scope and authority. | Theo sau `continuity-router` trong semantic order và dùng đúng selected context của vùng đó. |
| `interrupted-task-state` | Sở hữu evidence, action, state và recovery của interrupted task state. | Theo sau `disruption-scope-and-authority` trong semantic order và dùng đúng selected context của vùng đó. |
| `remaining-operation-and-access-constraints` | Sở hữu evidence, action, state và recovery của remaining operation and access constraints. | Theo sau `interrupted-task-state` trong semantic order và dùng đúng selected context của vùng đó. |
| `alternative-channel-capability-register` | Sở hữu evidence, action, state và recovery của alternative channel capability register. | Theo sau `remaining-operation-and-access-constraints` trong semantic order và dùng đúng selected context của vùng đó. |
| `state-transfer-compatibility` | Sở hữu evidence, action, state và recovery của state transfer compatibility. | Theo sau `alternative-channel-capability-register` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-continuity-route` | Sở hữu evidence, action, state và recovery của selected continuity route. | Theo sau `state-transfer-compatibility` trong semantic order và dùng đúng selected context của vùng đó. |
| `handoff-token-and-commitments` | Sở hữu evidence, action, state và recovery của handoff token and commitments. | Theo sau `selected-continuity-route` trong semantic order và dùng đúng selected context của vùng đó. |
| `restoration-reconciliation` | Sở hữu evidence, action, state và recovery của restoration reconciliation. | Theo sau `handoff-token-and-commitments` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Interrupted-task state, alternate-channel capability comparison and transfer/handoff detail remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `none` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Current task and viable channels own the workspace; disruption scope becomes a drawer while transfer limitations stay adjacent.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `none` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Saved task position → viable alternate routes → what transfers versus repeats → handoff token/instructions → completion or restoration reconciliation.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `none` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`.
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
| Khởi đầu / loading | `disruption-scope-and-authority` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `interrupted-task-state` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `remaining-operation-and-access-constraints` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `alternative-channel-capability-register` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `handoff-token-and-commitments` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `restoration-reconciliation` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `restoration-reconciliation` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `disruption-scope-and-authority` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `restoration-reconciliation` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `continuity-router` | Giữ selected entity, query, state và recovery khi topology đổi. |
| channel healthy/degraded/unavailable | `disruption-scope-and-authority` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| task state saved/partial/lost | `interrupted-task-state` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| alternate available/inaccessible/full | `remaining-operation-and-access-constraints` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| transfer compatible/partial/impossible | `alternative-channel-capability-register` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| handoff pending/accepted/expired | `state-transfer-compatibility` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| restoration detected and reconciliation conflict/complete. | `selected-continuity-route` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must preserve a saved task position, filter alternate channels by operation and access needs, disclose non-transferable evidence, issue an accessible handoff and reconcile later completion/restoration.

### Từ chối

- Từ chối communication-delivery-recovery-center; đây là evidence `AR-IC-90` và phải route sang archetype khác.
- Từ chối stable service hub; đây là evidence `AR-IC-91` và phải route sang archetype khác.
- Từ chối outage dashboard; đây là evidence `AR-IC-92` và phải route sang archetype khác.
- Từ chối completed handoff; đây là evidence `AR-IC-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-IC-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [GOV.UK — Joined-up Channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels) | Hỗ trợ continuity across online, phone, paper, and face-to-face channels. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [FEMA — Continuity Guidance Circular](https://www.fema.gov/sites/default/files/documents/fema_continuity-guidance-circular_082024.pdf) | Hỗ trợ continuity capabilities, essential functions, and restoration. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ handoff and restoration announcements. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "interrupted-service-continuity-router",
  "situationCodes": [
    "<matched AR-IC-* codes>"
  ],
  "searchAliases": [
    "interrupted task continuity",
    "warm channel transfer",
    "state compatibility routing",
    "restoration reconciliation"
  ],
  "dominantTask": "Preserve an unfinished user task when its primary service channel becomes unavailable, select an alternate channel that supports the remaining operations and access needs, and transfer reusable state with a continuity handoff.",
  "regions": [
    "continuity-router",
    "disruption-scope-and-authority",
    "interrupted-task-state",
    "remaining-operation-and-access-constraints",
    "alternative-channel-capability-register",
    "state-transfer-compatibility",
    "selected-continuity-route",
    "handoff-token-and-commitments",
    "restoration-reconciliation"
  ],
  "regionRelationships": [
    "continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "channel healthy/degraded/unavailable",
    "task state saved/partial/lost",
    "alternate available/inaccessible/full",
    "transfer compatible/partial/impossible",
    "handoff pending/accepted/expired",
    "restoration detected and reconciliation conflict/complete."
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

