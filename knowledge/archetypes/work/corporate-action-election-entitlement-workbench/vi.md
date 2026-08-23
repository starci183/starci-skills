# Bàn làm việc election và entitlement của corporate action

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `corporate-action-election-entitlement-workbench` |
| Family | Work |
| Dominant task | Xác định entitlement riêng cho từng holder của một corporate action đã công bố, thu election hợp lệ trước deadline và reconcile allocation hoặc proceeds đã xác nhận về từng position đủ điều kiện. |
| Search aliases | `corporate action election`, `holder entitlement`, `voluntary event instruction`, `allocation reconciliation` |
| Authority | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Dominant task giữ nguyên: Xác định entitlement riêng cho từng holder của một corporate action đã công bố, thu election hợp lệ trước deadline và reconcile allocation hoặc proceeds đã xác nhận về từng position đủ điều kiện.
- Region graph giữ nguyên toàn bộ stable English region IDs được khai báo bên dưới.
- Quan hệ bắt buộc: The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu exact geometry chưa resolve; Direction sở hữu visual character.
- Mọi state family phải giữ task, selection, action và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-CA-01` | Dominant task khớp chính xác Identity. | Bằng chứng ứng viên. |
| `AR-CA-02` | Toàn bộ required region graph cùng hiện diện. | Bằng chứng bắt buộc. |
| `AR-CA-03` | Compact giữ action, state, recovery và association của wide. | Bằng chứng bắt buộc. |
| `AR-CA-04` | The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close. | Giữ như bất biến. |
| `AR-CA-90` | Dominant task thuộc ranh giới loại trừ:  waitlist-offer-allocation-board. | Từ chối. |
| `AR-CA-91` | Dominant task thuộc ranh giới loại trừ:  constrained-quota-allocation-editor. | Từ chối. |
| `AR-CA-92` | Dominant task thuộc ranh giới loại trừ:  multi-program-eligibility-screening. | Từ chối. |
| `AR-CA-93` | Dominant task thuộc ranh giới loại trừ:  dual-list-transfer. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `corporate-action-election-entitlement-workbench` khi `AR-CA-01`, `AR-CA-02` và `AR-CA-03` có bằng chứng, đồng thời không mã rejection nào đúng. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc; trả `reject` khi có rejection evidence; khác biệt chỉ ở noun, count, density, color, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
corporate-action-election
└─ event-announcement-and-version
   └─ terms-options-and-key-dates
      └─ frozen-record-date-position-snapshot
         └─ holder-account-entitlement-derivation
            ├─ holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle
            └─ deadline-channel-and-agent-status
               └─ default-option
                  └─ confirmed-allocation-cash-or-security-movement
                     └─ exception-tax-and-final-entitlement-receipt
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `corporate-action-election` | Sở hữu evidence, action và state của `corporate-action-election` mà không vay product semantics. | Là gốc của graph. |
| `event-announcement-and-version` | Sở hữu evidence, action và state của `event-announcement-and-version` mà không vay product semantics. | Theo semantic order của graph và giữ association với `corporate-action-election`. |
| `terms-options-and-key-dates` | Sở hữu evidence, action và state của `terms-options-and-key-dates` mà không vay product semantics. | Theo semantic order của graph và giữ association với `event-announcement-and-version`. |
| `frozen-record-date-position-snapshot` | Sở hữu evidence, action và state của `frozen-record-date-position-snapshot` mà không vay product semantics. | Theo semantic order của graph và giữ association với `terms-options-and-key-dates`. |
| `holder-account-entitlement-derivation` | Sở hữu evidence, action và state của `holder-account-entitlement-derivation` mà không vay product semantics. | Theo semantic order của graph và giữ association với `frozen-record-date-position-snapshot`. |
| `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` | Sở hữu evidence, action và state của `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` mà không vay product semantics. | Theo semantic order của graph và giữ association với `holder-account-entitlement-derivation`. |
| `deadline-channel-and-agent-status` | Sở hữu deadline, transmission channel và agent acknowledgement state. | Là synchronized peer của holder-instruction lifecycle và gate từng lifecycle transition. |
| `default-option` | Sở hữu evidence, action và state của `default-option` mà không vay product semantics. | Theo semantic order của graph và giữ association với `deadline-channel-and-agent-status`. |
| `confirmed-allocation-cash-or-security-movement` | Sở hữu evidence, action và state của `confirmed-allocation-cash-or-security-movement` mà không vay product semantics. | Theo semantic order của graph và giữ association với `default-option`. |
| `exception-tax-and-final-entitlement-receipt` | Sở hữu evidence, action và state của `exception-tax-and-final-entitlement-receipt` mà không vay product semantics. | Theo semantic order của graph và giữ association với `confirmed-allocation-cash-or-security-movement`. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ label dễ đọc, association chính xác và complete actions.
- **Đáp ứng topology:** Giữ event terms, position-derived entitlements, election book, deadline status và projected so với confirmed allocations cùng inspectable.
- **Thay thế điều hướng:** Không có khi mọi required region còn usable đồng thời.
- **Ranh giới sticky:** Chỉ cross-region action đang active được persist; nó reserve space và yield ở short height.
- **Chủ sở hữu overflow:** `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` là bounded horizontal overflow owner duy nhất khi cần.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm quan hệ chính không usable.
- **Đáp ứng topology:** Giữ selected holder entitlement và instruction làm primary; chuyển announcement lineage, full account roster và movement history vào synchronized disclosures.
- **Thay thế điều hướng:** Named disclosure mở region bị thay thế và giữ exact selection.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action về normal flow ở short height.
- **Chủ sở hữu overflow:** Bounded owner của wide giữ trục duy nhất và có keyboard alternative.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không giữ được readable evidence và control 44×44 CSS px.
- **Đáp ứng topology:** Tuần tự event option và deadline, holder, eligible position, entitlement, elect/amend/cancel, agent status, default và final movement receipt; thay aggregate matrices bằng account route.
- **Thay thế điều hướng:** Primary-pane sequence có Back/Next khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Bottom action reserve content space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** Numeric hoặc list equivalent thay bounded grid; không có page-level horizontal scroll.

### Reflow

- Semantic và DOM order là `corporate-action-election` → `event-announcement-and-version` → `terms-options-and-key-dates` → `frozen-record-date-position-snapshot` → `holder-account-entitlement-derivation` → `holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle` → `deadline-channel-and-agent-status` → `default-option` → `confirmed-allocation-cash-or-security-movement` → `exception-tax-and-final-entitlement-receipt`.
- Zoom, long translation, enlarged controls và text pressure kích hoạt cùng topology transformations.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Ordinary content không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, action, explanation, retry và recovery của wide đều reachable ở intermediate và compact.
- Topology change giữ exact entity, filters, data state và pending hoặc completed result.
- Dynamic update announce contextual status mà không steal focus.
- Modal nếu có phải trap focus, hỗ trợ Escape/Cancel và trả focus về exact trigger.
- Color, position và geometry có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi tạo / loading | `event-announcement-and-version` | Nêu scope và region đang chờ; giữ semantic position. |
| Sẵn sàng | `terms-options-and-key-dates` | Expose đầy đủ dominant task và required associations. |
| Rỗng / không áp dụng | `frozen-record-date-position-snapshot` | Phân biệt meaningful absence với unavailable evidence. |
| Lỗi / thử lại | `holder-account-entitlement-derivation` | Giữ valid context, nêu failed owner và cung cấp local retry. |
| Quyền / không khả dụng | `confirmed-allocation-cash-or-security-movement` | Không suy diễn hidden evidence là absent; cung cấp safe exit. |
| Đang chờ | `confirmed-allocation-cash-or-security-movement` | Chặn duplicate, giữ exact target và announce progress. |
| Thành công | `exception-tax-and-final-entitlement-receipt` | Expose outcome, giữ context và next valid action. |
| Cũ / xung đột | `event-announcement-and-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Chuyển focus | `exception-tax-and-final-entitlement-receipt` | Chỉ move focus tới modal hoặc error summary rồi trả exact trigger. |
| Trình bày responsive | `corporate-action-election` | Giữ task, state, selection và recovery khi topology đổi. |

Applicable state family: announcement preliminary/confirmed/amended/cancelled; position pending/frozen/disputed; holder eligible/ineligible; entitlement projected/revised/final; instruction draft/sent/acknowledged/rejected/cancelled/late; deadline open/near/closed; default applied; proration pending/final; proceeds pending/paid; tax exception unresolved/resolved.

## Ranh giới

### Chấp nhận

- Chấp nhận khi versioned security event và frozen record-date snapshot cùng derive entitlement.
- Chấp nhận khi holder instruction giữ draft-to-agent lifecycle và deadline behavior.
- Chấp nhận khi confirmed cash hoặc securities reconcile về instruction và eligible position.

### Từ chối

- Từ chối `waitlist-offer-allocation-board`; đây là `AR-CA-90` evidence và phải route tới adjacent archetype.
- Từ chối `constrained-quota-allocation-editor`; đây là `AR-CA-91` evidence và phải route tới adjacent archetype.
- Từ chối `multi-program-eligibility-screening`; đây là `AR-CA-92` evidence và phải route tới adjacent archetype.
- Từ chối `dual-list-transfer`; đây là `AR-CA-93` evidence và phải route tới adjacent archetype.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete region graph và compact interaction parity cùng đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi required owner hoặc relationship chưa resolve. `duplicate-or-variation` áp dụng khi khác biệt chỉ là noun, count, density, color, component hoặc state.

## Bàn giao

- **Grammar handoff:** Gắn product-specific owners, labels, permitted actions, eligibility và truthful state meaning vào regions đã khai báo.
- **Principles handoff:** Resolve exact grid, measure, gap, size, alignment, sticky offset, bounded overflow và relationship-driven transition points.
- Không handoff nào được xóa region, đổi dominant task hoặc giảm interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nguồn hỗ trợ synthesis task relationships, responsive behavior và accessibility obligations; nguồn không đặt StarCi owner, không chọn exact geometry và không cấp quyền copy interface.

### Nguồn

| Nguồn | Điều nguồn hỗ trợ | Điều nguồn không chứng minh |
|---|---|---|
| [DTCC — Corporate Actions Processing](https://www.dtcc.com/asset-services/corporate-actions-processing) | Announcement, entitlement, instruction, allocation, and payment lifecycle. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [ISO 20022 — MT565 scope](https://www.iso20022.org/15022/uhb/finmt565.htm) | Election, amendment, cancellation, and custodian-instruction semantics. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Visible focus around deadline and compact action surfaces. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcements for acknowledgement, default, proration, and movement status. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Account-row association and bounded election-book scanning. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard semantics when an interactive entitlement grid is used. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "corporate-action-election-entitlement-workbench",
  "situationCodes": [
    "<matched AR-CA-* codes>"
  ],
  "searchAliases": [
    "corporate action election",
    "holder entitlement",
    "voluntary event instruction",
    "allocation reconciliation"
  ],
  "dominantTask": "Xác định entitlement riêng cho từng holder của một corporate action đã công bố, thu election hợp lệ trước deadline và reconcile allocation hoặc proceeds đã xác nhận về từng position đủ điều kiện.",
  "regions": [
    "corporate-action-election",
    "event-announcement-and-version",
    "terms-options-and-key-dates",
    "frozen-record-date-position-snapshot",
    "holder-account-entitlement-derivation",
    "holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle",
    "deadline-channel-and-agent-status",
    "default-option",
    "confirmed-allocation-cash-or-security-movement",
    "exception-tax-and-final-entitlement-receipt"
  ],
  "regionRelationships": [
    "The frozen record-date position sets each option-specific entitlement ceiling; holder instruction lifecycle is dominant, while proration is only a conditional branch after instructions close."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "corporate-action-election → event-announcement-and-version → terms-options-and-key-dates → frozen-record-date-position-snapshot → holder-account-entitlement-derivation → holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle → deadline-channel-and-agent-status → default-option → confirmed-allocation-cash-or-security-movement → exception-tax-and-final-entitlement-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "announcement preliminary/confirmed/amended/cancelled",
    "position pending/frozen/disputed",
    "holder eligible/ineligible",
    "entitlement projected/revised/final",
    "instruction draft/sent/acknowledged/rejected/cancelled/late",
    "deadline open/near/closed",
    "default applied",
    "proration pending/final",
    "proceeds pending/paid",
    "tax exception unresolved/resolved"
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
    "<official task research>",
    "<accessibility research>"
  ]
}
```
