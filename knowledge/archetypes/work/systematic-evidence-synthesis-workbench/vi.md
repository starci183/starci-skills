# Bàn làm việc tổng hợp bằng chứng có hệ thống

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `systematic-evidence-synthesis-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Tổng hợp ước lượng từ nhiều nghiên cứu, cân nhắc nguy cơ sai lệch và tính không đồng nhất, rồi tạo kết luận độ chắc chắn có thể review. |
| Bí danh tìm kiếm | `meta-analysis`, `evidence synthesis`, `forest plot`, `risk of bias` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Trọng số nghiên cứu, phán đoán nguy cơ sai lệch và mô hình hiệu ứng tổng hợp là các owner riêng biệt, mọi thay đổi được reconcile trong một kết luận độ chắc chắn.
- Region graph bắt buộc giữ nguyên `synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Weighted cross-study synthesis, risk of bias, and heterogeneity are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SE-01` | Dominant task là: Tổng hợp ước lượng từ nhiều nghiên cứu, cân nhắc nguy cơ sai lệch và tính không đồng nhất, rồi tạo kết luận độ chắc chắn có thể review. | Bằng chứng ứng viên. |
| `AR-SE-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-SE-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-SE-04` | Trọng số nghiên cứu, phán đoán nguy cơ sai lệch và mô hình hiệu ứng tổng hợp là các owner riêng biệt, mọi thay đổi được reconcile trong một kết luận độ chắc chắn. | Bằng chứng quan hệ bắt buộc. |
| `AR-SE-90` | Dominant task là one-case evidence dossier. | Từ chối. |
| `AR-SE-91` | Dominant task là literature screening queue. | Từ chối. |
| `AR-SE-92` | Dominant task là generic pivot analytics. | Từ chối. |
| `AR-SE-93` | Dominant task là authored briefing. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `systematic-evidence-synthesis-workbench` khi `AR-SE-01`, `AR-SE-02`, `AR-SE-03` và `AR-SE-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-SE-90` đến `AR-SE-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
synthesis-workbench
└─ review-question-and-inclusion
   └─ study-register
      └─ structured-extraction-table
         └─ risk-of-bias-assessment
            └─ effect-model-and-forest-plot
               └─ heterogeneity-and-sensitivity
                  └─ certainty-summary
                     └─ synthesis-record
```

- Quan hệ bắt buộc: Trọng số nghiên cứu, phán đoán nguy cơ sai lệch và mô hình hiệu ứng tổng hợp là các owner riêng biệt, mọi thay đổi được reconcile trong một kết luận độ chắc chắn.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `synthesis-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `review-question-and-inclusion` | Sở hữu bằng chứng, trạng thái và action của review-question-and-inclusion mà không vay product semantics. | Theo sau `synthesis-workbench` trong semantic order và giữ cùng selection context. |
| `study-register` | Sở hữu bằng chứng, trạng thái và action của study-register mà không vay product semantics. | Theo sau `review-question-and-inclusion` trong semantic order và giữ cùng selection context. |
| `structured-extraction-table` | Sở hữu bằng chứng, trạng thái và action của structured-extraction-table mà không vay product semantics. | Theo sau `study-register` trong semantic order và giữ cùng selection context. |
| `risk-of-bias-assessment` | Sở hữu bằng chứng, trạng thái và action của risk-of-bias-assessment mà không vay product semantics. | Theo sau `structured-extraction-table` trong semantic order và giữ cùng selection context. |
| `effect-model-and-forest-plot` | Sở hữu bằng chứng, trạng thái và action của effect-model-and-forest-plot mà không vay product semantics. | Theo sau `risk-of-bias-assessment` trong semantic order và giữ cùng selection context. |
| `heterogeneity-and-sensitivity` | Sở hữu bằng chứng, trạng thái và action của heterogeneity-and-sensitivity mà không vay product semantics. | Theo sau `effect-model-and-forest-plot` trong semantic order và giữ cùng selection context. |
| `certainty-summary` | Sở hữu bằng chứng, trạng thái và action của certainty-summary mà không vay product semantics. | Theo sau `heterogeneity-and-sensitivity` trong semantic order và giữ cùng selection context. |
| `synthesis-record` | Sở hữu bằng chứng, trạng thái và action của synthesis-record mà không vay product semantics. | Theo sau `certainty-summary` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the study table, forest-plot evidence, and bias or sensitivity evidence visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `structured-extraction-table` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make the study register primary; expose plot and bias as named panes while preserving the selected study.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `structured-extraction-table` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use study list → selected extraction or bias → numeric effect table → forest-plot alternative → synthesis or certainty summary.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `structured-extraction-table` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change theo quan hệ.
- CSS không reorder visual sequence lệch khỏi keyboard hoặc assistive-technology order.
- Label dài được wrap và mọi region ẩn đều có đường reveal accessible có tên.
- Nội dung thông thường không tạo horizontal scroll cấp trang.

### Tương đương tương tác

- Mọi selection, measurement, action, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ đúng selected item, coordinate hoặc path dùng chung, data state và receipt pending hoặc completed.
- Dynamic update announce một contextual status mà không giật focus.
- Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus về đúng trigger.
- Color, position, geometry và visual mark đều có equivalent bằng text hoặc table.
- The fictional certainty remains draft while heterogeneity is high.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `review-question-and-inclusion` | Xác định owner đang pending và giữ semantic position. |
| Ready | `study-register` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `structured-extraction-table` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `risk-of-bias-assessment` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `effect-model-and-forest-plot` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `synthesis-record` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `synthesis-record` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `review-question-and-inclusion` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `synthesis-record` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `synthesis-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: study loading, study excluded, extraction incomplete, effect unavailable, bias low, bias some concerns, bias high, model calculating, model failure, heterogeneity high, sensitivity exclusion, certainty draft, certainty reviewed, source stale.

## Ranh giới

### Chấp nhận

- Chấp nhận khi tổng hợp ước lượng từ nhiều nghiên cứu, cân nhắc nguy cơ sai lệch và tính không đồng nhất, rồi tạo kết luận độ chắc chắn có thể review.
- Chấp nhận khi trọng số nghiên cứu, phán đoán nguy cơ sai lệch và mô hình hiệu ứng tổng hợp là các owner riêng biệt, mọi thay đổi được reconcile trong một kết luận độ chắc chắn.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối one-case evidence dossier; đây là bằng chứng `AR-SE-90` và phải route tới archetype lân cận.
- Từ chối literature screening queue; đây là bằng chứng `AR-SE-91` và phải route tới archetype lân cận.
- Từ chối generic pivot analytics; đây là bằng chứng `AR-SE-92` và phải route tới archetype lân cận.
- Từ chối authored briefing; đây là bằng chứng `AR-SE-93` và phải route tới archetype lân cận.
- Từ chối candidate chỉ khác product noun, count, density, color, component hoặc state dưới dạng `duplicate-or-variation`.

### Phán quyết ranh giới

Chỉ trả `accept` khi dominant task, region graph đầy đủ, quan hệ owner bắt buộc và compact interaction parity đều đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi owner hoặc quan hệ bắt buộc chưa resolve.

## Bàn giao

- **Bàn giao Grammar:** Gắn owner, label, permission, action và ý nghĩa state trung thực của sản phẩm vào các region đã khai báo.
- **Bàn giao Principles:** Resolve exact grid, measure, gap, alignment, sticky offset, realization overflow bounded và transition point theo quan hệ.
- Không bàn giao nào được xóa region bắt buộc, đổi dominant task hoặc làm yếu interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là bằng chứng tư vấn, không phải product truth. Nó hỗ trợ quan hệ tác vụ, adaptive behavior và nghĩa vụ accessibility; nó không đặt tên StarCi owner, không chọn geometry chính xác và không cấp quyền sao chép interface nguồn. Các nguồn đã được mở và kiểm chứng là trang official hiện hành trong batch này.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [Cochrane — Handbook current](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current) | Hỗ trợ meta-analysis, bias, heterogeneity, and certainty methods. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [PRISMA — 2020 statement](https://www.prisma-statement.org/prisma-2020) | Hỗ trợ systematic review reporting. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [CONSORT-SPIRIT — Published statements](https://www.consort-spirit.org/published-statements) | Hỗ trợ independent trial-reporting context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive calculation and review feedback. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "systematic-evidence-synthesis-workbench",
  "situationCodes": ["<matched AR-SE-* codes>"],
  "searchAliases": ["meta-analysis","evidence synthesis","forest plot","risk of bias"],
  "dominantTask": "Synthesize estimates from multiple studies, weigh risk of bias and heterogeneity, and produce a reviewable certainty conclusion.",
  "regions": ["synthesis-workbench","review-question-and-inclusion","study-register","structured-extraction-table","risk-of-bias-assessment","effect-model-and-forest-plot","heterogeneity-and-sensitivity","certainty-summary","synthesis-record"],
  "regionRelationships": ["Study weights, risk-of-bias judgments, and the aggregate effect model are distinct owners whose changes reconcile in one certainty conclusion."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table → risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "structured-extraction-table",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["study loading","study excluded","extraction incomplete","effect unavailable","bias low","bias some concerns","bias high","model calculating","model failure","heterogeneity high","sensitivity exclusion","certainty draft","certainty reviewed","source stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

