# Bộ điều phối trách nhiệm đa payer

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `multi-payer-responsibility-coordinator` |
| Family | Flow |
| Dominant task | Điều phối trách nhiệm cho một charge qua nhiều payer bằng cách xác lập coverage order, submit evidence, áp dụng từng adjudication và reconcile remaining balance. |
| Search aliases | `coordination of benefits`, `ordered payer adjudication`, `charge conservation`, `payer remainder appeal` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Điều phối trách nhiệm cho một charge qua nhiều payer bằng cách xác lập coverage order, submit evidence, áp dụng từng adjudication và reconcile remaining balance.
- Required region graph luôn là `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MP-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-MP-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-MP-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-MP-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-MP-05` | Template must apply at least two payer responses in order, explain a denial/adjustment, prevent amount imbalance, route remainder correctly and preserve appeal evidence. | Required evidence. |
| `AR-MP-90` | invoice detail | Từ chối. |
| `AR-MP-91` | claim form | Từ chối. |
| `AR-MP-92` | payment split | Từ chối. |
| `AR-MP-93` | line-item dispute | Từ chối. |

### Quy tắc chọn

Chỉ chọn `multi-payer-responsibility-coordinator` khi `AR-MP-01` đến `AR-MP-05` đều có evidence và không có mã `AR-MP-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
payer-coordinator
   `-- charge-and-service-ledger
      `-- coverage-and-coordination-order
         `-- payer-submission-chain
            `-- selected-payer-evidence-and-response
               `-- allowed-paid-denied-adjustment-ledger
                  `-- remainder-and-next-payer
                     `-- final-responsibility-and-appeal
```

Biểu thức relationship đã khai báo: `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `payer-coordinator` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `charge-and-service-ledger` | Sở hữu evidence, action, state và recovery của charge and service ledger. | Theo sau `payer-coordinator` trong semantic order và dùng đúng selected context của vùng đó. |
| `coverage-and-coordination-order` | Sở hữu evidence, action, state và recovery của coverage and coordination order. | Theo sau `charge-and-service-ledger` trong semantic order và dùng đúng selected context của vùng đó. |
| `payer-submission-chain` | Sở hữu evidence, action, state và recovery của payer submission chain. | Theo sau `coverage-and-coordination-order` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-payer-evidence-and-response` | Sở hữu evidence, action, state và recovery của selected payer evidence and response. | Theo sau `payer-submission-chain` trong semantic order và dùng đúng selected context của vùng đó. |
| `allowed-paid-denied-adjustment-ledger` | Sở hữu evidence, action, state và recovery của allowed paid denied adjustment ledger. | Theo sau `selected-payer-evidence-and-response` trong semantic order và dùng đúng selected context của vùng đó. |
| `remainder-and-next-payer` | Sở hữu evidence, action, state và recovery của remainder and next payer. | Theo sau `allowed-paid-denied-adjustment-ledger` trong semantic order và dùng đúng selected context của vùng đó. |
| `final-responsibility-and-appeal` | Sở hữu evidence, action, state và recovery của final responsibility and appeal. | Theo sau `remainder-and-next-payer` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Charge ledger, payer order, selected response and conserved responsibility summary remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `charge-and-service-ledger` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Payer chain and remainder summary remain primary; detailed evidence/response becomes a drawer.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `charge-and-service-ledger` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Charge → coverage order → payer submission/response → adjusted remainder → next payer → final responsibility/appeal; amounts remain explicit at every step.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `charge-and-service-ledger` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`.
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
| Khởi đầu / loading | `charge-and-service-ledger` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `coverage-and-coordination-order` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `payer-submission-chain` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `selected-payer-evidence-and-response` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `remainder-and-next-payer` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `final-responsibility-and-appeal` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `final-responsibility-and-appeal` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `charge-and-service-ledger` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `final-responsibility-and-appeal` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `payer-coordinator` | Giữ selected entity, query, state và recovery khi topology đổi. |
| charge pending/final | `charge-and-service-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| coverage active/unknown/conflicting | `coverage-and-coordination-order` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| order unresolved | `payer-submission-chain` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| submission draft/sent/rejected | `selected-payer-evidence-and-response` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| response partial/denied/paid | `allowed-paid-denied-adjustment-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| duplicate payment | `remainder-and-next-payer` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| adjustment invalid | `final-responsibility-and-appeal` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| remainder mismatch and appeal pending. | `final-responsibility-and-appeal` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must apply at least two payer responses in order, explain a denial/adjustment, prevent amount imbalance, route remainder correctly and preserve appeal evidence.

### Từ chối

- Từ chối invoice detail; đây là evidence `AR-MP-90` và phải route sang archetype khác.
- Từ chối claim form; đây là evidence `AR-MP-91` và phải route sang archetype khác.
- Từ chối payment split; đây là evidence `AR-MP-92` và phải route sang archetype khác.
- Từ chối line-item dispute; đây là evidence `AR-MP-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-MP-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [CMS — Coordination of Benefits](https://www.cms.gov/medicare/coordination-benefits-recovery/overview) | Hỗ trợ payer order and responsibility coordination. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [HL7 — ExplanationOfBenefit](https://hl7.org/fhir/explanationofbenefit.html) | Hỗ trợ adjudication amounts, denials, and benefit responses. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announcing balance and appeal changes. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "multi-payer-responsibility-coordinator",
  "situationCodes": [
    "<matched AR-MP-* codes>"
  ],
  "searchAliases": [
    "coordination of benefits",
    "ordered payer adjudication",
    "charge conservation",
    "payer remainder appeal"
  ],
  "dominantTask": "Coordinate responsibility for a charge across multiple payers by establishing coverage order, submitting evidence, applying each adjudication and reconciling the remaining balance.",
  "regions": [
    "payer-coordinator",
    "charge-and-service-ledger",
    "coverage-and-coordination-order",
    "payer-submission-chain",
    "selected-payer-evidence-and-response",
    "allowed-paid-denied-adjustment-ledger",
    "remainder-and-next-payer",
    "final-responsibility-and-appeal"
  ],
  "regionRelationships": [
    "payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "charge pending/final",
    "coverage active/unknown/conflicting",
    "order unresolved",
    "submission draft/sent/rejected",
    "response partial/denied/paid",
    "duplicate payment",
    "adjustment invalid",
    "remainder mismatch and appeal pending."
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

