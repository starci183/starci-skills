# Bàn làm việc lịch revenue theo performance obligation

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `performance-obligation-revenue-schedule-workbench` |
| Family | Work |
| Dominant task | Chuyển một customer contract và các modification thành performance obligations riêng biệt, phân bổ constrained transaction price và duy trì recognized so với remaining revenue khi satisfaction evidence xuất hiện. |
| Search aliases | `revenue allocation schedule`, `performance obligation ledger`, `contract revenue recognition`, `IFRS 15 workbench` |
| Authority | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Dominant task giữ nguyên: Chuyển một customer contract và các modification thành performance obligations riêng biệt, phân bổ constrained transaction price và duy trì recognized so với remaining revenue khi satisfaction evidence xuất hiện.
- Region graph giữ nguyên toàn bộ stable English region IDs được khai báo bên dưới.
- Quan hệ bắt buộc: One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu exact geometry chưa resolve; Direction sở hữu visual character.
- Mọi state family phải giữ task, selection, action và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-RS-01` | Dominant task khớp chính xác Identity. | Bằng chứng ứng viên. |
| `AR-RS-02` | Toàn bộ required region graph cùng hiện diện. | Bằng chứng bắt buộc. |
| `AR-RS-03` | Compact giữ action, state, recovery và association của wide. | Bằng chứng bắt buộc. |
| `AR-RS-04` | One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time. | Giữ như bất biến. |
| `AR-RS-90` | Dominant task thuộc ranh giới loại trừ:  stage-gated-process-record. | Từ chối. |
| `AR-RS-91` | Dominant task thuộc ranh giới loại trừ:  review-submit-ledger. | Từ chối. |
| `AR-RS-92` | Dominant task thuộc ranh giới loại trừ:  rule-builder-workbench. | Từ chối. |
| `AR-RS-93` | Dominant task thuộc ranh giới loại trừ:  generic billing schedule. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `performance-obligation-revenue-schedule-workbench` khi `AR-RS-01`, `AR-RS-02` và `AR-RS-03` có bằng chứng, đồng thời không mã rejection nào đúng. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc; trả `reject` khi có rejection evidence; khác biệt chỉ ở noun, count, density, color, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
revenue-schedule
└─ contract-and-modification-lineage
   └─ promise-inventory
      └─ distinct-performance-obligation-decisions
         └─ transaction-price-components-and-constraint
            └─ standalone-selling-price-evidence
               ├─ transaction-price-conservation-across-obligations
               └─ relative-allocation-ledger
                  └─ obligation-satisfaction-pattern-and-progress
                     └─ recognized-versus-remaining-conservation-through-time
                        └─ contract-asset-liability-schedule
                           └─ close-review-and-disclosure-receipt
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `revenue-schedule` | Sở hữu evidence, action và state của `revenue-schedule` mà không vay product semantics. | Là gốc của graph. |
| `contract-and-modification-lineage` | Sở hữu evidence, action và state của `contract-and-modification-lineage` mà không vay product semantics. | Theo semantic order của graph và giữ association với `revenue-schedule`. |
| `promise-inventory` | Sở hữu evidence, action và state của `promise-inventory` mà không vay product semantics. | Theo semantic order của graph và giữ association với `contract-and-modification-lineage`. |
| `distinct-performance-obligation-decisions` | Sở hữu evidence, action và state của `distinct-performance-obligation-decisions` mà không vay product semantics. | Theo semantic order của graph và giữ association với `promise-inventory`. |
| `transaction-price-components-and-constraint` | Sở hữu evidence, action và state của `transaction-price-components-and-constraint` mà không vay product semantics. | Theo semantic order của graph và giữ association với `distinct-performance-obligation-decisions`. |
| `standalone-selling-price-evidence` | Sở hữu evidence, action và state của `standalone-selling-price-evidence` mà không vay product semantics. | Theo semantic order của graph và giữ association với `transaction-price-components-and-constraint`. |
| `transaction-price-conservation-across-obligations` | Sở hữu evidence, action và state của `transaction-price-conservation-across-obligations` mà không vay product semantics. | Theo semantic order của graph và giữ association với `standalone-selling-price-evidence`. |
| `relative-allocation-ledger` | Sở hữu obligation-level relative allocations và allocation adjustments. | Là peer của transaction-price conservation; ledger không close nếu conservation chưa đúng. |
| `obligation-satisfaction-pattern-and-progress` | Sở hữu evidence, action và state của `obligation-satisfaction-pattern-and-progress` mà không vay product semantics. | Theo semantic order của graph và giữ association với `relative-allocation-ledger`. |
| `recognized-versus-remaining-conservation-through-time` | Sở hữu evidence, action và state của `recognized-versus-remaining-conservation-through-time` mà không vay product semantics. | Theo semantic order của graph và giữ association với `obligation-satisfaction-pattern-and-progress`. |
| `contract-asset-liability-schedule` | Sở hữu evidence, action và state của `contract-asset-liability-schedule` mà không vay product semantics. | Theo semantic order của graph và giữ association với `recognized-versus-remaining-conservation-through-time`. |
| `close-review-and-disclosure-receipt` | Sở hữu evidence, action và state của `close-review-and-disclosure-receipt` mà không vay product semantics. | Theo semantic order của graph và giữ association với `contract-asset-liability-schedule`. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ label dễ đọc, association chính xác và complete actions.
- **Đáp ứng topology:** Giữ contract promises, distinctness decisions, price components, allocation ledger và satisfaction schedules cùng inspectable.
- **Thay thế điều hướng:** Không có khi mọi required region còn usable đồng thời.
- **Ranh giới sticky:** Chỉ cross-region action đang active được persist; nó reserve space và yield ở short height.
- **Chủ sở hữu overflow:** `relative-allocation-ledger` là bounded horizontal overflow owner duy nhất khi cần.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm quan hệ chính không usable.
- **Đáp ứng topology:** Giữ selected obligation, allocated amount và satisfaction evidence làm primary; chuyển source clauses, all-obligation comparison và disclosure history vào contextual disclosures.
- **Thay thế điều hướng:** Named disclosure mở region bị thay thế và giữ exact selection.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action về normal flow ở short height.
- **Chủ sở hữu overflow:** Bounded owner của wide giữ trục duy nhất và có keyboard alternative.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không giữ được readable evidence và control 44×44 CSS px.
- **Đáp ứng topology:** Tuần tự contract version, promise, distinctness, price component, relative allocation, point-in-time hoặc over-time satisfaction, recognized/remaining receipt và modification treatment.
- **Thay thế điều hướng:** Primary-pane sequence có Back/Next khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Bottom action reserve content space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** Numeric hoặc list equivalent thay bounded grid; không có page-level horizontal scroll.

### Reflow

- Semantic và DOM order là `revenue-schedule` → `contract-and-modification-lineage` → `promise-inventory` → `distinct-performance-obligation-decisions` → `transaction-price-components-and-constraint` → `standalone-selling-price-evidence` → `transaction-price-conservation-across-obligations` → `relative-allocation-ledger` → `obligation-satisfaction-pattern-and-progress` → `recognized-versus-remaining-conservation-through-time` → `contract-asset-liability-schedule` → `close-review-and-disclosure-receipt`.
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
| Khởi tạo / loading | `contract-and-modification-lineage` | Nêu scope và region đang chờ; giữ semantic position. |
| Sẵn sàng | `promise-inventory` | Expose đầy đủ dominant task và required associations. |
| Rỗng / không áp dụng | `distinct-performance-obligation-decisions` | Phân biệt meaningful absence với unavailable evidence. |
| Lỗi / thử lại | `transaction-price-components-and-constraint` | Giữ valid context, nêu failed owner và cung cấp local retry. |
| Quyền / không khả dụng | `contract-asset-liability-schedule` | Không suy diễn hidden evidence là absent; cung cấp safe exit. |
| Đang chờ | `contract-asset-liability-schedule` | Chặn duplicate, giữ exact target và announce progress. |
| Thành công | `close-review-and-disclosure-receipt` | Expose outcome, giữ context và next valid action. |
| Cũ / xung đột | `contract-and-modification-lineage` | Giữ last safe value và yêu cầu explicit recovery. |
| Chuyển focus | `close-review-and-disclosure-receipt` | Chỉ move focus tới modal hoặc error summary rồi trả exact trigger. |
| Trình bày responsive | `revenue-schedule` | Giữ task, state, selection và recovery khi topology đổi. |

Applicable state family: contract pending/enforceable/terminated; promise unassessed/distinct/combined; variable consideration unconstrained/constrained/revised; standalone price observed/estimated/missing; allocation unbalanced/balanced; obligation unsatisfied/partially/satisfied; progress disputed; revenue scheduled/recognized/reversed; contract asset/liability current; modification prospective/cumulative.

## Ranh giới

### Chấp nhận

- Chấp nhận khi promises nhận explicit distinctness decisions.
- Chấp nhận khi constrained transaction price được conserved qua relative allocations.
- Chấp nhận khi recognized cộng remaining revenue được conserved theo thời gian và modifications tạo lineage.

### Từ chối

- Từ chối `stage-gated-process-record`; đây là `AR-RS-90` evidence và phải route tới adjacent archetype.
- Từ chối `review-submit-ledger`; đây là `AR-RS-91` evidence và phải route tới adjacent archetype.
- Từ chối `rule-builder-workbench`; đây là `AR-RS-92` evidence và phải route tới adjacent archetype.
- Từ chối `generic billing schedule`; đây là `AR-RS-93` evidence và phải route tới adjacent archetype.

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
| [IFRS Foundation — IFRS 15](https://www.ifrs.org/issued-runtime/standards/list-of-runtime/standards/ifrs-15-revenue-from-contracts-with-customers/) | Contract, performance obligation, transaction price, allocation, and recognition principles. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [FASB — Revenue Recognition Implementation Q&As](https://storage.fasb.org/Rev_Rec_Implementation_QAs.pdf) | Implementation questions for distinct promises, variable consideration, allocation, and modifications. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Visible focus around persistent close-review actions. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcements for allocation, progress, modification, and close state. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Obligation-ledger scanning and row-level evidence actions. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful focus order across promise, allocation, and satisfaction routes. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "performance-obligation-revenue-schedule-workbench",
  "situationCodes": [
    "<matched AR-RS-* codes>"
  ],
  "searchAliases": [
    "revenue allocation schedule",
    "performance obligation ledger",
    "contract revenue recognition",
    "IFRS 15 workbench"
  ],
  "dominantTask": "Chuyển một customer contract và các modification thành performance obligations riêng biệt, phân bổ constrained transaction price và duy trì recognized so với remaining revenue khi satisfaction evidence xuất hiện.",
  "regions": [
    "revenue-schedule",
    "contract-and-modification-lineage",
    "promise-inventory",
    "distinct-performance-obligation-decisions",
    "transaction-price-components-and-constraint",
    "standalone-selling-price-evidence",
    "transaction-price-conservation-across-obligations",
    "relative-allocation-ledger",
    "obligation-satisfaction-pattern-and-progress",
    "recognized-versus-remaining-conservation-through-time",
    "contract-asset-liability-schedule",
    "close-review-and-disclosure-receipt"
  ],
  "regionRelationships": [
    "One conservation graph proves obligation allocations equal the constrained transaction price; a second proves recognized plus remaining revenue equals each allocation through time."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "revenue-schedule → contract-and-modification-lineage → promise-inventory → distinct-performance-obligation-decisions → transaction-price-components-and-constraint → standalone-selling-price-evidence → transaction-price-conservation-across-obligations → relative-allocation-ledger → obligation-satisfaction-pattern-and-progress → recognized-versus-remaining-conservation-through-time → contract-asset-liability-schedule → close-review-and-disclosure-receipt",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "contract pending/enforceable/terminated",
    "promise unassessed/distinct/combined",
    "variable consideration unconstrained/constrained/revised",
    "standalone price observed/estimated/missing",
    "allocation unbalanced/balanced",
    "obligation unsatisfied/partially/satisfied",
    "progress disputed",
    "revenue scheduled/recognized/reversed",
    "contract asset/liability current",
    "modification prospective/cumulative"
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
