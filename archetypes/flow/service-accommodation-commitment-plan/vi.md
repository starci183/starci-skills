# Kế hoạch cam kết accommodation dịch vụ

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `service-accommodation-commitment-plan` |
| Family | Flow |
| Dominant task | Tạo kế hoạch accommodation có thể hành động bằng cách map access need với journey barrier, chọn accommodation và ghi nhận cam kết qua lại của provider và user. |
| Search aliases | `access accommodation plan`, `journey barrier mapping`, `provider user commitments`, `accessible service exception` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Tạo kế hoạch accommodation có thể hành động bằng cách map access need với journey barrier, chọn accommodation và ghi nhận cam kết qua lại của provider và user.
- Required region graph luôn là `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-AC-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-AC-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-AC-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-AC-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-AC-05` | Template must map multiple needs to journey barriers, compare feasible accommodations, assign provider ownership, record user preference/consent and escalate one unavailable commitment. | Required evidence. |
| `AR-AC-90` | profile settings | Từ chối. |
| `AR-AC-91` | accessibility checklist | Từ chối. |
| `AR-AC-92` | care plan | Từ chối. |
| `AR-AC-93` | generic task list | Từ chối. |

### Quy tắc chọn

Chỉ chọn `service-accommodation-commitment-plan` khi `AR-AC-01` đến `AR-AC-05` đều có evidence và không có mã `AR-AC-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
accommodation-plan
   `-- person-preferences-and-consent
      `-- service-journey-step-map
         `-- access-need-by-barrier-matrix
            `-- accommodation-options-and-feasibility
               `-- provider-commitments
                  `-- user-commitments
                     `-- exception-escalation
                        `-- confirmed-plan-and-review
```

Biểu thức relationship đã khai báo: `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `accommodation-plan` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `person-preferences-and-consent` | Sở hữu evidence, action, state và recovery của person preferences and consent. | Theo sau `accommodation-plan` trong semantic order và dùng đúng selected context của vùng đó. |
| `service-journey-step-map` | Sở hữu evidence, action, state và recovery của service journey step map. | Theo sau `person-preferences-and-consent` trong semantic order và dùng đúng selected context của vùng đó. |
| `access-need-by-barrier-matrix` | Sở hữu evidence, action, state và recovery của access need by barrier matrix. | Theo sau `service-journey-step-map` trong semantic order và dùng đúng selected context của vùng đó. |
| `accommodation-options-and-feasibility` | Sở hữu evidence, action, state và recovery của accommodation options and feasibility. | Theo sau `access-need-by-barrier-matrix` trong semantic order và dùng đúng selected context của vùng đó. |
| `provider-commitments` | Sở hữu evidence, action, state và recovery của provider commitments. | Đồng bộ hai chiều với `accommodation-options-and-feasibility` trong cùng selected context. |
| `user-commitments` | Sở hữu evidence, action, state và recovery của user commitments. | Đồng bộ hai chiều với `provider-commitments` trong cùng selected context. |
| `exception-escalation` | Sở hữu evidence, action, state và recovery của exception escalation. | Theo sau `user-commitments` trong semantic order và dùng đúng selected context của vùng đó. |
| `confirmed-plan-and-review` | Sở hữu evidence, action, state và recovery của confirmed plan and review. | Theo sau `exception-escalation` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Journey steps, need/barrier matrix, selected accommodation and commitment rail remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `service-journey-step-map` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Journey/barrier map remains primary; preferences and commitment details move to drawers.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `service-journey-step-map` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Journey step → barrier → preferred accommodation → provider/user commitment → exception → plan review; matrix becomes grouped accessible lists.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `service-journey-step-map` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments → user-commitments → exception-escalation → confirmed-plan-and-review`.
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
| Khởi đầu / loading | `person-preferences-and-consent` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `service-journey-step-map` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `access-need-by-barrier-matrix` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `accommodation-options-and-feasibility` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `exception-escalation` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `confirmed-plan-and-review` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `confirmed-plan-and-review` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `person-preferences-and-consent` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `confirmed-plan-and-review` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `accommodation-plan` | Giữ selected entity, query, state và recovery khi topology đổi. |
| preference unknown/restricted | `person-preferences-and-consent` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| barrier identified/unverified | `service-journey-step-map` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| accommodation available/unavailable | `access-need-by-barrier-matrix` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| feasibility pending | `accommodation-options-and-feasibility` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| provider owner missing | `provider-commitments` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| user commitment declined | `user-commitments` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| exception escalated | `exception-escalation` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| plan confirmed/stale and review due. | `confirmed-plan-and-review` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must map multiple needs to journey barriers, compare feasible accommodations, assign provider ownership, record user preference/consent and escalate one unavailable commitment.

### Từ chối

- Từ chối profile settings; đây là evidence `AR-AC-90` và phải route sang archetype khác.
- Từ chối accessibility checklist; đây là evidence `AR-AC-91` và phải route sang archetype khác.
- Từ chối care plan; đây là evidence `AR-AC-92` và phải route sang archetype khác.
- Từ chối generic task list; đây là evidence `AR-AC-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-AC-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [NHS England — Accessible Information Standard](https://www.england.nhs.uk/accessible-information-standard/) | Hỗ trợ identifying, recording, sharing, and meeting communication needs. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [ADA.gov — Effective Communication](https://www.ada.gov/resources/effective-communication/) | Hỗ trợ effective auxiliary aids and service obligations. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ accessible matrix-to-grouped-list transformation. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "service-accommodation-commitment-plan",
  "situationCodes": [
    "<matched AR-AC-* codes>"
  ],
  "searchAliases": [
    "access accommodation plan",
    "journey barrier mapping",
    "provider user commitments",
    "accessible service exception"
  ],
  "dominantTask": "Create an actionable service accommodation plan by mapping a person's access needs to journey-specific barriers, selecting accommodations, and recording reciprocal provider and user commitments.",
  "regions": [
    "accommodation-plan",
    "person-preferences-and-consent",
    "service-journey-step-map",
    "access-need-by-barrier-matrix",
    "accommodation-options-and-feasibility",
    "provider-commitments",
    "user-commitments",
    "exception-escalation",
    "confirmed-plan-and-review"
  ],
  "regionRelationships": [
    "accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments → user-commitments → exception-escalation → confirmed-plan-and-review",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "service-journey-step-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "preference unknown/restricted",
    "barrier identified/unverified",
    "accommodation available/unavailable",
    "feasibility pending",
    "provider owner missing",
    "user commitment declined",
    "exception escalated",
    "plan confirmed/stale and review due."
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

