# Bảng phân bổ offer từ danh sách chờ

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `waitlist-offer-allocation-board` |
| Family | Flow |
| Dominant task | Phân bổ opening khan hiếm từ danh sách chờ bằng rule đủ điều kiện và ưu tiên, phát offer có thời hạn, ghi nhận phản hồi và tái sử dụng capacity với dấu vết fairness đầy đủ. |
| Search aliases | `scarce-opening allocation`, `ranked waitlist offer`, `capacity recycling`, `fairness audit` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Phân bổ opening khan hiếm từ danh sách chờ bằng rule đủ điều kiện và ưu tiên, phát offer có thời hạn, ghi nhận phản hồi và tái sử dụng capacity với dấu vết fairness đầy đủ.
- Required region graph luôn là `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-WO-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-WO-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-WO-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-WO-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-WO-05` | Template must explain why one candidate is next, issue an expiring offer, recover failed delivery, recycle a declined slot and keep policy version plus allocation audit visible. | Required evidence. |
| `AR-WO-90` | generic queue | Từ chối. |
| `AR-WO-91` | appointment booking | Từ chối. |
| `AR-WO-92` | inventory allocation | Từ chối. |
| `AR-WO-93` | notification center | Từ chối. |

### Quy tắc chọn

Chỉ chọn `waitlist-offer-allocation-board` khi `AR-WO-01` đến `AR-WO-05` đều có evidence và không có mã `AR-WO-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
allocation-board
   `-- capacity-pool-and-policy-version
      `-- eligible-ranked-waitlist
         `-- selected-candidate-rule-evidence
            `-- offer-slot-allocation
               `-- response-window-and-contact-delivery
                  `-- accept-decline-expire
                     `-- recycled-capacity-and-next-candidate
                        `-- fairness-audit
```

Biểu thức relationship đã khai báo: `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `allocation-board` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `capacity-pool-and-policy-version` | Sở hữu evidence, action, state và recovery của capacity pool and policy version. | Theo sau `allocation-board` trong semantic order và dùng đúng selected context của vùng đó. |
| `eligible-ranked-waitlist` | Sở hữu evidence, action, state và recovery của eligible ranked waitlist. | Theo sau `capacity-pool-and-policy-version` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-candidate-rule-evidence` | Sở hữu evidence, action, state và recovery của selected candidate rule evidence. | Theo sau `eligible-ranked-waitlist` trong semantic order và dùng đúng selected context của vùng đó. |
| `offer-slot-allocation` | Sở hữu evidence, action, state và recovery của offer slot allocation. | Theo sau `selected-candidate-rule-evidence` trong semantic order và dùng đúng selected context của vùng đó. |
| `response-window-and-contact-delivery` | Sở hữu evidence, action, state và recovery của response window and contact delivery. | Theo sau `offer-slot-allocation` trong semantic order và dùng đúng selected context của vùng đó. |
| `accept-decline-expire` | Sở hữu evidence, action, state và recovery của accept decline expire. | Theo sau `response-window-and-contact-delivery` trong semantic order và dùng đúng selected context của vùng đó. |
| `recycled-capacity-and-next-candidate` | Sở hữu evidence, action, state và recovery của recycled capacity and next candidate. | Theo sau `accept-decline-expire` trong semantic order và dùng đúng selected context của vùng đó. |
| `fairness-audit` | Sở hữu evidence, action, state và recovery của fairness audit. | Theo sau `recycled-capacity-and-next-candidate` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Capacity pool, ranked waitlist, selected rule evidence and live offer/recycling rail remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `allocation-board` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Ranked candidates and active offers remain primary; policy evidence and audit move to synchronized drawers.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `allocation-board` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Capacity summary → next eligible candidate → rule explanation → issue offer → response/expiry → recycle or confirm; full waitlist is a filtered route.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `allocation-board` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`.
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
| Khởi đầu / loading | `capacity-pool-and-policy-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `eligible-ranked-waitlist` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `selected-candidate-rule-evidence` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `offer-slot-allocation` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `recycled-capacity-and-next-candidate` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `fairness-audit` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `fairness-audit` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `capacity-pool-and-policy-version` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `fairness-audit` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `allocation-board` | Giữ selected entity, query, state và recovery khi topology đổi. |
| capacity unknown/available/held/full | `capacity-pool-and-policy-version` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| candidate eligible/ineligible/pending evidence | `eligible-ranked-waitlist` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| rank recalculating/stale | `selected-candidate-rule-evidence` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| offer draft/sent/delivered/failed | `offer-slot-allocation` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| accepted/declined/expired | `response-window-and-contact-delivery` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| duplicate hold | `accept-decline-expire` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| appeal and allocation audited. | `recycled-capacity-and-next-candidate` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must explain why one candidate is next, issue an expiring offer, recover failed delivery, recycle a declined slot and keep policy version plus allocation audit visible.

### Từ chối

- Từ chối generic queue; đây là evidence `AR-WO-90` và phải route sang archetype khác.
- Từ chối appointment booking; đây là evidence `AR-WO-91` và phải route sang archetype khác.
- Từ chối inventory allocation; đây là evidence `AR-WO-92` và phải route sang archetype khác.
- Từ chối notification center; đây là evidence `AR-WO-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-WO-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [NHS England — Referral to treatment](https://www.england.nhs.uk/rtt/) | Hỗ trợ waiting-time rules, priority, and recording. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [HUD — Housing Choice Voucher Tenants](https://www.hud.gov/helping-americans/housing-choice-vouchers-tenants) | Hỗ trợ eligibility, preferences, finite offers, and expiry. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "waitlist-offer-allocation-board",
  "situationCodes": [
    "<matched AR-WO-* codes>"
  ],
  "searchAliases": [
    "scarce-opening allocation",
    "ranked waitlist offer",
    "capacity recycling",
    "fairness audit"
  ],
  "dominantTask": "Allocate scarce openings from a waitlist by applying eligibility and priority rules, issuing time-bounded offers, recording responses, and recycling declined or expired capacity with a complete fairness trail.",
  "regions": [
    "allocation-board",
    "capacity-pool-and-policy-version",
    "eligible-ranked-waitlist",
    "selected-candidate-rule-evidence",
    "offer-slot-allocation",
    "response-window-and-contact-delivery",
    "accept-decline-expire",
    "recycled-capacity-and-next-candidate",
    "fairness-audit"
  ],
  "regionRelationships": [
    "allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "capacity unknown/available/held/full",
    "candidate eligible/ineligible/pending evidence",
    "rank recalculating/stale",
    "offer draft/sent/delivered/failed",
    "accepted/declined/expired",
    "duplicate hold",
    "appeal and allocation audited."
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

