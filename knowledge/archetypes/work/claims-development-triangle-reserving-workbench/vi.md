# Bàn làm việc reserve tam giác phát triển claims

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `claims-development-triangle-reserving-workbench` |
| Family | Work |
| Dominant task | Ước tính unpaid claims cho một segment đồng nhất bằng cách chuyển observations origin-by-development thành development factors đã chọn, projected ultimates và reserve vintage có thể review. |
| Search aliases | `claims triangle`, `loss development`, `reserve vintage`, `age-to-age factor` |
| Authority | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Dominant task giữ nguyên: Ước tính unpaid claims cho một segment đồng nhất bằng cách chuyển observations origin-by-development thành development factors đã chọn, projected ultimates và reserve vintage có thể review.
- Region graph giữ nguyên toàn bộ stable English region IDs được khai báo bên dưới.
- Quan hệ bắt buộc: Factor selection operates by development age while every origin row retains its observed-to-ultimate propagation path and the reserve remains bound to one versioned assumption set.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu exact geometry chưa resolve; Direction sở hữu visual character.
- Mọi state family phải giữ task, selection, action và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-CR-01` | Dominant task khớp chính xác Identity. | Bằng chứng ứng viên. |
| `AR-CR-02` | Toàn bộ required region graph cùng hiện diện. | Bằng chứng bắt buộc. |
| `AR-CR-03` | Compact giữ action, state, recovery và association của wide. | Bằng chứng bắt buộc. |
| `AR-CR-04` | Factor selection operates by development age while every origin row retains its observed-to-ultimate propagation path and the reserve remains bound to one versioned assumption set. | Giữ như bất biến. |
| `AR-CR-90` | Dominant task thuộc ranh giới loại trừ:  cohort-retention-grid. | Từ chối. |
| `AR-CR-91` | Dominant task thuộc ranh giới loại trừ:  scenario-sensitivity-modeler. | Từ chối. |
| `AR-CR-92` | Dominant task thuộc ranh giới loại trừ:  statistical-process-control-overview. | Từ chối. |
| `AR-CR-93` | Dominant task thuộc ranh giới loại trừ:  process-mass-balance-analyzer or any read-only cohort matrix. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `claims-development-triangle-reserving-workbench` khi `AR-CR-01`, `AR-CR-02` và `AR-CR-03` có bằng chứng, đồng thời không mã rejection nào đúng. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc; trả `reject` khi có rejection evidence; khác biệt chỉ ở noun, count, density, color, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
reserve-analysis
└─ valuation-date-segment-and-data-version
   ├─ origin-by-development-incremental-triangle
   └─ cumulative-triangle-and-diagonals
      └─ age-to-age-factor-selection
         └─ tail-and-ultimate-projection
            └─ paid-incurred-case-reserve-bridge
               └─ diagnostic-residuals-and-method-comparison
                  └─ selected-unpaid-claim-estimate
                     └─ assumption-review-and-locked-vintage
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `reserve-analysis` | Sở hữu evidence, action và state của `reserve-analysis` mà không vay product semantics. | Là gốc của graph. |
| `valuation-date-segment-and-data-version` | Sở hữu evidence, action và state của `valuation-date-segment-and-data-version` mà không vay product semantics. | Theo semantic order của graph và giữ association với `reserve-analysis`. |
| `origin-by-development-incremental-triangle` | Sở hữu evidence, action và state của `origin-by-development-incremental-triangle` mà không vay product semantics. | Theo semantic order của graph và giữ association với `valuation-date-segment-and-data-version`. |
| `cumulative-triangle-and-diagonals` | Sở hữu cumulative transform và current diagonals mà không replace incremental evidence. | Là peer view của `origin-by-development-incremental-triangle`; cả hai giữ identical cell lineage. |
| `age-to-age-factor-selection` | Sở hữu evidence, action và state của `age-to-age-factor-selection` mà không vay product semantics. | Theo semantic order của graph và giữ association với `cumulative-triangle-and-diagonals`. |
| `tail-and-ultimate-projection` | Sở hữu evidence, action và state của `tail-and-ultimate-projection` mà không vay product semantics. | Theo semantic order của graph và giữ association với `age-to-age-factor-selection`. |
| `paid-incurred-case-reserve-bridge` | Sở hữu evidence, action và state của `paid-incurred-case-reserve-bridge` mà không vay product semantics. | Theo semantic order của graph và giữ association với `tail-and-ultimate-projection`. |
| `diagnostic-residuals-and-method-comparison` | Sở hữu evidence, action và state của `diagnostic-residuals-and-method-comparison` mà không vay product semantics. | Theo semantic order của graph và giữ association với `paid-incurred-case-reserve-bridge`. |
| `selected-unpaid-claim-estimate` | Sở hữu evidence, action và state của `selected-unpaid-claim-estimate` mà không vay product semantics. | Theo semantic order của graph và giữ association với `diagnostic-residuals-and-method-comparison`. |
| `assumption-review-and-locked-vintage` | Sở hữu evidence, action và state của `assumption-review-and-locked-vintage` mà không vay product semantics. | Theo semantic order của graph và giữ association với `selected-unpaid-claim-estimate`. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ label dễ đọc, association chính xác và complete actions.
- **Đáp ứng topology:** Giữ triangle, current diagonal, factor selections, origin-level ultimates và diagnostics cùng inspectable.
- **Thay thế điều hướng:** Không có khi mọi required region còn usable đồng thời.
- **Ranh giới sticky:** Chỉ cross-region action đang active được persist; nó reserve space và yield ở short height.
- **Chủ sở hữu overflow:** `origin-by-development-incremental-triangle` là bounded horizontal overflow owner duy nhất khi cần.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm quan hệ chính không usable.
- **Đáp ứng topology:** Giữ selected development age và affected origin rows làm primary; chuyển full triangle, alternate methods và assumption history vào synchronized disclosures với bounded grid overflow.
- **Thay thế điều hướng:** Named disclosure mở region bị thay thế và giữ exact selection.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action về normal flow ở short height.
- **Chủ sở hữu overflow:** Bounded owner của wide giữ trục duy nhất và có keyboard alternative.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không giữ được readable evidence và control 44×44 CSS px.
- **Đáp ứng topology:** Tuần tự segment và vintage, current diagonal, một factor edit, propagation qua affected origins, changed ultimates và reserve, diagnostics, rồi lock hoặc revise; dùng linked age/origin routes thay cho squeezed matrix.
- **Thay thế điều hướng:** Primary-pane sequence có Back/Next khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Bottom action reserve content space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** Numeric hoặc list equivalent thay bounded grid; không có page-level horizontal scroll.

### Reflow

- Semantic và DOM order là `reserve-analysis` → `valuation-date-segment-and-data-version` → `origin-by-development-incremental-triangle` → `cumulative-triangle-and-diagonals` → `age-to-age-factor-selection` → `tail-and-ultimate-projection` → `paid-incurred-case-reserve-bridge` → `diagnostic-residuals-and-method-comparison` → `selected-unpaid-claim-estimate` → `assumption-review-and-locked-vintage`.
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
| Khởi tạo / loading | `valuation-date-segment-and-data-version` | Nêu scope và region đang chờ; giữ semantic position. |
| Sẵn sàng | `origin-by-development-incremental-triangle` | Expose đầy đủ dominant task và required associations. |
| Rỗng / không áp dụng | `cumulative-triangle-and-diagonals` | Phân biệt meaningful absence với unavailable evidence. |
| Lỗi / thử lại | `age-to-age-factor-selection` | Giữ valid context, nêu failed owner và cung cấp local retry. |
| Quyền / không khả dụng | `selected-unpaid-claim-estimate` | Không suy diễn hidden evidence là absent; cung cấp safe exit. |
| Đang chờ | `selected-unpaid-claim-estimate` | Chặn duplicate, giữ exact target và announce progress. |
| Thành công | `assumption-review-and-locked-vintage` | Expose outcome, giữ context và next valid action. |
| Cũ / xung đột | `valuation-date-segment-and-data-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Chuyển focus | `assumption-review-and-locked-vintage` | Chỉ move focus tới modal hoặc error summary rồi trả exact trigger. |
| Trình bày responsive | `reserve-analysis` | Giữ task, state, selection và recovery khi topology đổi. |

Applicable state family: data loading/reconciled/unreconciled; triangle incremental/cumulative; cell observed/missing/adjusted; factor candidate/selected/overridden; tail unset/set; origin immature/mature; diagnostic normal/outlier; method feasible/unstable; reserve draft/reviewed/locked; assumption challenged; vintage superseded.

## Ranh giới

### Chấp nhận

- Chấp nhận khi development-age factors editable kèm rationale.
- Chấp nhận khi factor changes propagate rõ qua mọi affected origin row.
- Chấp nhận khi selected unpaid amount và assumptions khóa vào versioned reserve vintage.

### Từ chối

- Từ chối `cohort-retention-grid`; đây là `AR-CR-90` evidence và phải route tới adjacent archetype.
- Từ chối `scenario-sensitivity-modeler`; đây là `AR-CR-91` evidence và phải route tới adjacent archetype.
- Từ chối `statistical-process-control-overview`; đây là `AR-CR-92` evidence và phải route tới adjacent archetype.
- Từ chối `process-mass-balance-analyzer or any read-only cohort matrix`; đây là `AR-CR-93` evidence và phải route tới adjacent archetype.

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
| [Actuarial Standards Board — ASOP 43](https://www.actuarialstandardsboard.org/asops/propertycasualty-unpaid-claim-estimates/) | Unpaid-claim estimate scope, assumptions, methods, uncertainty, and documentation. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [Casualty Actuarial Society — Monographs](https://www.casact.org/publications-research/publications/flagship-publications/cas-monographs) | Official actuarial research context for development methods and diagnostics. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard order across triangle, factor, propagation, and diagnostics. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcements for recalculation, outliers, and vintage locking. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

+| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense triangle scanning and bounded table actions. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard semantics for an editable development-age grid. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "claims-development-triangle-reserving-workbench",
  "situationCodes": [
    "<matched AR-CR-* codes>"
  ],
  "searchAliases": [
    "claims triangle",
    "loss development",
    "reserve vintage",
    "age-to-age factor"
  ],
  "dominantTask": "Ước tính unpaid claims cho một segment đồng nhất bằng cách chuyển observations origin-by-development thành development factors đã chọn, projected ultimates và reserve vintage có thể review.",
  "regions": [
    "reserve-analysis",
    "valuation-date-segment-and-data-version",
    "origin-by-development-incremental-triangle",
    "cumulative-triangle-and-diagonals",
    "age-to-age-factor-selection",
    "tail-and-ultimate-projection",
    "paid-incurred-case-reserve-bridge",
    "diagnostic-residuals-and-method-comparison",
    "selected-unpaid-claim-estimate",
    "assumption-review-and-locked-vintage"
  ],
  "regionRelationships": [
    "Factor selection operates by development age while every origin row retains its observed-to-ultimate propagation path and the reserve remains bound to one versioned assumption set."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "reserve-analysis → valuation-date-segment-and-data-version → origin-by-development-incremental-triangle → cumulative-triangle-and-diagonals → age-to-age-factor-selection → tail-and-ultimate-projection → paid-incurred-case-reserve-bridge → diagnostic-residuals-and-method-comparison → selected-unpaid-claim-estimate → assumption-review-and-locked-vintage",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "data loading/reconciled/unreconciled",
    "triangle incremental/cumulative",
    "cell observed/missing/adjusted",
    "factor candidate/selected/overridden",
    "tail unset/set",
    "origin immature/mature",
    "diagnostic normal/outlier",
    "method feasible/unstable",
    "reserve draft/reviewed/locked",
    "assumption challenged",
    "vintage superseded"
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
