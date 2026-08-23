# Bàn làm việc post bút toán kép

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `double-entry-journal-posting-workbench` |
| Family | Work |
| Dominant task | Chuyển một sự kiện kế toán có bằng chứng thành batch journal được ủy quyền và cân bằng, post đúng một lần vào đúng book và kỳ, đồng thời giữ correction dưới lineage reversal hoặc adjustment mới. |
| Search aliases | `double-entry posting`, `journal composer`, `ledger posting`, `balanced journal` |
| Authority | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Dominant task giữ nguyên: Chuyển một sự kiện kế toán có bằng chứng thành batch journal được ủy quyền và cân bằng, post đúng một lần vào đúng book và kỳ, đồng thời giữ correction dưới lineage reversal hoặc adjustment mới.
- Region graph giữ nguyên toàn bộ stable English region IDs được khai báo bên dưới.
- Quan hệ bắt buộc: Debit and credit totals are independent global owners by book and currency; equality, counter-entry navigation, period control, approval, immutable posting identity, and correction-by-new-lineage are all required.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu exact geometry chưa resolve; Direction sở hữu visual character.
- Mọi state family phải giữ task, selection, action và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-DJ-01` | Dominant task khớp chính xác Identity. | Bằng chứng ứng viên. |
| `AR-DJ-02` | Toàn bộ required region graph cùng hiện diện. | Bằng chứng bắt buộc. |
| `AR-DJ-03` | Compact giữ action, state, recovery và association của wide. | Bằng chứng bắt buộc. |
| `AR-DJ-04` | Debit and credit totals are independent global owners by book and currency; equality, counter-entry navigation, period control, approval, immutable posting identity, and correction-by-new-lineage are all required. | Giữ như bất biến. |
| `AR-DJ-90` | Dominant task thuộc ranh giới loại trừ:  review-submit-ledger. | Từ chối. |
| `AR-DJ-91` | Dominant task thuộc ranh giới loại trừ:  reconciliation-diff-workbench. | Từ chối. |
| `AR-DJ-92` | Dominant task thuộc ranh giới loại trừ:  spreadsheet-grid-editor. | Từ chối. |
| `AR-DJ-93` | Dominant task thuộc ranh giới loại trừ:  generic form approval or any allocator that distributes one source total. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `double-entry-journal-posting-workbench` khi `AR-DJ-01`, `AR-DJ-02` và `AR-DJ-03` có bằng chứng, đồng thời không mã rejection nào đúng. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc; trả `reject` khi có rejection evidence; khác biệt chỉ ở noun, count, density, color, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
journal-posting
└─ book-entity-period-and-policy-version
   └─ source-event-and-document-lineage
      └─ journal-header
         └─ debit-credit-line-composer
            ├─ account-dimension-eligibility-and-tax-rules
            ├─ debit-total-by-book-and-currency
            ├─ credit-total-by-book-and-currency
            └─ counter-entry-navigation-and-batch-balance-receipt
               └─ segregation-review-and-approval
                  └─ immutable-posting-to-ledger
                     └─ reversal-correction-and-close-lineage
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `journal-posting` | Sở hữu evidence, action và state của `journal-posting` mà không vay product semantics. | Là gốc của graph. |
| `book-entity-period-and-policy-version` | Sở hữu evidence, action và state của `book-entity-period-and-policy-version` mà không vay product semantics. | Theo semantic order của graph và giữ association với `journal-posting`. |
| `source-event-and-document-lineage` | Sở hữu evidence, action và state của `source-event-and-document-lineage` mà không vay product semantics. | Theo semantic order của graph và giữ association với `book-entity-period-and-policy-version`. |
| `journal-header` | Sở hữu evidence, action và state của `journal-header` mà không vay product semantics. | Theo semantic order của graph và giữ association với `source-event-and-document-lineage`. |
| `debit-credit-line-composer` | Sở hữu evidence, action và state của `debit-credit-line-composer` mà không vay product semantics. | Theo semantic order của graph và giữ association với `journal-header`. |
| `account-dimension-eligibility-and-tax-rules` | Sở hữu evidence, action và state của `account-dimension-eligibility-and-tax-rules` mà không vay product semantics. | Theo semantic order của graph và giữ association với `debit-credit-line-composer`. |
| `debit-total-by-book-and-currency` | Sở hữu debit total được derive độc lập cho mỗi book và currency partition. | Là peer của `credit-total-by-book-and-currency`; exact equality gate balance receipt. |
| `credit-total-by-book-and-currency` | Sở hữu credit total được derive độc lập cho mỗi book và currency partition. | Là peer của `debit-total-by-book-and-currency`; không total nào derive từ total kia. |
| `counter-entry-navigation-and-batch-balance-receipt` | Sở hữu evidence, action và state của `counter-entry-navigation-and-batch-balance-receipt` mà không vay product semantics. | Theo semantic order của graph và giữ association với `credit-total-by-book-and-currency`. |
| `segregation-review-and-approval` | Sở hữu evidence, action và state của `segregation-review-and-approval` mà không vay product semantics. | Theo semantic order của graph và giữ association với `counter-entry-navigation-and-batch-balance-receipt`. |
| `immutable-posting-to-ledger` | Sở hữu evidence, action và state của `immutable-posting-to-ledger` mà không vay product semantics. | Theo semantic order của graph và giữ association với `segregation-review-and-approval`. |
| `reversal-correction-and-close-lineage` | Sở hữu evidence, action và state của `reversal-correction-and-close-lineage` mà không vay product semantics. | Theo semantic order của graph và giữ association với `immutable-posting-to-ledger`. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ label dễ đọc, association chính xác và complete actions.
- **Đáp ứng topology:** Giữ source evidence, journal lines, account eligibility, hai tổng debit và credit độc lập, approval ownership và posting preview cùng inspectable.
- **Thay thế điều hướng:** Không có khi mọi required region còn usable đồng thời.
- **Ranh giới sticky:** Chỉ cross-region action đang active được persist; nó reserve space và yield ở short height.
- **Chủ sở hữu overflow:** `debit-credit-line-composer` là bounded horizontal overflow owner duy nhất khi cần.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm quan hệ chính không usable.
- **Đáp ứng topology:** Giữ journal lines và balance receipt làm primary; chuyển source documents, account guidance và approval history vào synchronized disclosures giữ selected line.
- **Thay thế điều hướng:** Named disclosure mở region bị thay thế và giữ exact selection.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action về normal flow ở short height.
- **Chủ sở hữu overflow:** Bounded owner của wide giữ trục duy nhất và có keyboard alternative.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không giữ được readable evidence và control 44×44 CSS px.
- **Đáp ứng topology:** Tuần tự event, header, một debit hoặc credit line, counter-entry set, các partition totals persistent, failure resolution, approval, post receipt và reversal; không rút task thành single-total allocator.
- **Thay thế điều hướng:** Primary-pane sequence có Back/Next khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Bottom action reserve content space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** Numeric hoặc list equivalent thay bounded grid; không có page-level horizontal scroll.

### Reflow

- Semantic và DOM order là `journal-posting` → `book-entity-period-and-policy-version` → `source-event-and-document-lineage` → `journal-header` → `debit-credit-line-composer` → `account-dimension-eligibility-and-tax-rules` → `debit-total-by-book-and-currency` → `credit-total-by-book-and-currency` → `counter-entry-navigation-and-batch-balance-receipt` → `segregation-review-and-approval` → `immutable-posting-to-ledger` → `reversal-correction-and-close-lineage`.
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
| Khởi tạo / loading | `book-entity-period-and-policy-version` | Nêu scope và region đang chờ; giữ semantic position. |
| Sẵn sàng | `source-event-and-document-lineage` | Expose đầy đủ dominant task và required associations. |
| Rỗng / không áp dụng | `journal-header` | Phân biệt meaningful absence với unavailable evidence. |
| Lỗi / thử lại | `debit-credit-line-composer` | Giữ valid context, nêu failed owner và cung cấp local retry. |
| Quyền / không khả dụng | `immutable-posting-to-ledger` | Không suy diễn hidden evidence là absent; cung cấp safe exit. |
| Đang chờ | `immutable-posting-to-ledger` | Chặn duplicate, giữ exact target và announce progress. |
| Thành công | `reversal-correction-and-close-lineage` | Expose outcome, giữ context và next valid action. |
| Cũ / xung đột | `book-entity-period-and-policy-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Chuyển focus | `reversal-correction-and-close-lineage` | Chỉ move focus tới modal hoặc error summary rồi trả exact trigger. |
| Trình bày responsive | `journal-posting` | Giữ task, state, selection và recovery khi topology đổi. |

Applicable state family: source pending/verified/rejected; book open/soft-closed/closed; journal draft/unbalanced/balanced; account eligible/blocked; dimension missing; currency imbalance; review pending/approved/rejected; posting queued/posted/duplicate-blocked; reversal scheduled/completed; ledger version superseded.

## Ranh giới

### Chấp nhận

- Chấp nhận khi debit và credit có tổng độc lập cho mọi book và currency partition.
- Chấp nhận khi mỗi line điều hướng được tới balancing counter-entry set.
- Chấp nhận khi posting bất biến và correction tạo linked lineage.

### Từ chối

- Từ chối `review-submit-ledger`; đây là `AR-DJ-90` evidence và phải route tới adjacent archetype.
- Từ chối `reconciliation-diff-workbench`; đây là `AR-DJ-91` evidence và phải route tới adjacent archetype.
- Từ chối `spreadsheet-grid-editor`; đây là `AR-DJ-92` evidence và phải route tới adjacent archetype.
- Từ chối `generic form approval or any allocator that distributes one source total`; đây là `AR-DJ-93` evidence và phải route tới adjacent archetype.

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
| [XBRL International — Global Ledger](https://www.xbrl.org/the-standard/what/global-ledger/) | Transactional ledger detail, journal lineage, and drill-back to supporting records. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [U.S. Treasury — U.S. Standard General Ledger](https://fiscal.treasury.gov/accounting/us-standard-general-ledger-ussgl) | Versioned ledger guidance and approved accounting scenarios. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful focus order through paired-entry navigation and reflow. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Non-disruptive announcements for balance, posting, and reversal state. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Bounded data-table scanning, row association, and action placement. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard semantics when a composite journal grid is chosen. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "double-entry-journal-posting-workbench",
  "situationCodes": [
    "<matched AR-DJ-* codes>"
  ],
  "searchAliases": [
    "double-entry posting",
    "journal composer",
    "ledger posting",
    "balanced journal"
  ],
  "dominantTask": "Chuyển một sự kiện kế toán có bằng chứng thành batch journal được ủy quyền và cân bằng, post đúng một lần vào đúng book và kỳ, đồng thời giữ correction dưới lineage reversal hoặc adjustment mới.",
  "regions": [
    "journal-posting",
    "book-entity-period-and-policy-version",
    "source-event-and-document-lineage",
    "journal-header",
    "debit-credit-line-composer",
    "account-dimension-eligibility-and-tax-rules",
    "debit-total-by-book-and-currency",
    "credit-total-by-book-and-currency",
    "counter-entry-navigation-and-batch-balance-receipt",
    "segregation-review-and-approval",
    "immutable-posting-to-ledger",
    "reversal-correction-and-close-lineage"
  ],
  "regionRelationships": [
    "Debit and credit totals are independent global owners by book and currency; equality, counter-entry navigation, period control, approval, immutable posting identity, and correction-by-new-lineage are all required."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "journal-posting → book-entity-period-and-policy-version → source-event-and-document-lineage → journal-header → debit-credit-line-composer → account-dimension-eligibility-and-tax-rules → debit-total-by-book-and-currency → credit-total-by-book-and-currency → counter-entry-navigation-and-batch-balance-receipt → segregation-review-and-approval → immutable-posting-to-ledger → reversal-correction-and-close-lineage",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "source pending/verified/rejected",
    "book open/soft-closed/closed",
    "journal draft/unbalanced/balanced",
    "account eligible/blocked",
    "dimension missing",
    "currency imbalance",
    "review pending/approved/rejected",
    "posting queued/posted/duplicate-blocked",
    "reversal scheduled/completed",
    "ledger version superseded"
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
