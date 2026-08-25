# Bàn làm việc phân tích đáp ứng liều trên microplate

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `microplate-dose-response-analysis-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Reconcile bố cục well vật lý, bằng chứng chất lượng không gian và đường cong đáp ứng liều đã fit trước khi chấp nhận plate hoặc batch assay. |
| Bí danh tìm kiếm | `dose response`, `microplate QC`, `well grid`, `curve fitting` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Tọa độ well vật lý và bằng chứng chuỗi liều đã fit là các owner ngang hàng; control không gian và chất lượng đường cong cùng ràng buộc chấp nhận batch.
- Region graph bắt buộc giữ nguyên `dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Physical wells plus fitted dose-series quality control are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MD-01` | Dominant task là: Reconcile bố cục well vật lý, bằng chứng chất lượng không gian và đường cong đáp ứng liều đã fit trước khi chấp nhận plate hoặc batch assay. | Bằng chứng ứng viên. |
| `AR-MD-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-MD-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-MD-04` | Tọa độ well vật lý và bằng chứng chuỗi liều đã fit là các owner ngang hàng; control không gian và chất lượng đường cong cùng ràng buộc chấp nhận batch. | Bằng chứng quan hệ bắt buộc. |
| `AR-MD-90` | Dominant task là spreadsheet grid. | Từ chối. |
| `AR-MD-91` | Dominant task là cohort heatmap. | Từ chối. |
| `AR-MD-92` | Dominant task là generic chart analytics. | Từ chối. |
| `AR-MD-93` | Dominant task là laboratory protocol runner. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `microplate-dose-response-analysis-workbench` khi `AR-MD-01`, `AR-MD-02`, `AR-MD-03` và `AR-MD-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-MD-90` đến `AR-MD-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
dose-response-workbench
└─ plate-and-batch-context
   └─ well-grid-and-controls
      └─ spatial-qc-heatmap
         └─ dose-series-groups
            └─ fitted-response-curves
               └─ outlier-and-edge-effect-queue
                  └─ selected-well-raw-read
                     └─ acceptance-and-report
```

- Quan hệ bắt buộc: Tọa độ well vật lý và bằng chứng chuỗi liều đã fit là các owner ngang hàng; control không gian và chất lượng đường cong cùng ràng buộc chấp nhận batch.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `dose-response-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `plate-and-batch-context` | Sở hữu bằng chứng, trạng thái và action của plate-and-batch-context mà không vay product semantics. | Theo sau `dose-response-workbench` trong semantic order và giữ cùng selection context. |
| `well-grid-and-controls` | Sở hữu bằng chứng, trạng thái và action của well-grid-and-controls mà không vay product semantics. | Theo sau `plate-and-batch-context` trong semantic order và giữ cùng selection context. |
| `spatial-qc-heatmap` | Sở hữu bằng chứng, trạng thái và action của spatial-qc-heatmap mà không vay product semantics. | Theo sau `well-grid-and-controls` trong semantic order và giữ cùng selection context. |
| `dose-series-groups` | Sở hữu bằng chứng, trạng thái và action của dose-series-groups mà không vay product semantics. | Theo sau `spatial-qc-heatmap` trong semantic order và giữ cùng selection context. |
| `fitted-response-curves` | Sở hữu bằng chứng, trạng thái và action của fitted-response-curves mà không vay product semantics. | Theo sau `dose-series-groups` trong semantic order và giữ cùng selection context. |
| `outlier-and-edge-effect-queue` | Sở hữu bằng chứng, trạng thái và action của outlier-and-edge-effect-queue mà không vay product semantics. | Theo sau `fitted-response-curves` trong semantic order và giữ cùng selection context. |
| `selected-well-raw-read` | Sở hữu bằng chứng, trạng thái và action của selected-well-raw-read mà không vay product semantics. | Theo sau `outlier-and-edge-effect-queue` trong semantic order và giữ cùng selection context. |
| `acceptance-and-report` | Sở hữu bằng chứng, trạng thái và action của acceptance-and-report mà không vay product semantics. | Theo sau `selected-well-raw-read` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the plate grid, fitted curves, and QC or outlier evidence visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `well-grid-and-controls` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make plate or curve primary while the selected series and well summary persists.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `well-grid-and-controls` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use QC verdict → dose-series list → fitted curve or numeric table → selected well → accept or reject; make the grid an optional bounded view.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `well-grid-and-controls` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report`.
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
- The fictional batch is blocked while the high control fails.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `plate-and-batch-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `well-grid-and-controls` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `spatial-qc-heatmap` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `dose-series-groups` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `fitted-response-curves` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `acceptance-and-report` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `acceptance-and-report` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `plate-and-batch-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `acceptance-and-report` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `dose-response-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: plate loading, control pass, control fail, well missing, well outlier, edge effect suspected, curve fitting, curve passed, curve failed, parameter confidence low, series accepted, series rejected, batch pending, batch accepted, batch rejected.

## Ranh giới

### Chấp nhận

- Chấp nhận khi reconcile bố cục well vật lý, bằng chứng chất lượng không gian và đường cong đáp ứng liều đã fit trước khi chấp nhận plate hoặc batch assay.
- Chấp nhận khi tọa độ well vật lý và bằng chứng chuỗi liều đã fit là các owner ngang hàng; control không gian và chất lượng đường cong cùng ràng buộc chấp nhận batch.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối spreadsheet grid; đây là bằng chứng `AR-MD-90` và phải route tới archetype lân cận.
- Từ chối cohort heatmap; đây là bằng chứng `AR-MD-91` và phải route tới archetype lân cận.
- Từ chối generic chart analytics; đây là bằng chứng `AR-MD-92` và phải route tới archetype lân cận.
- Từ chối laboratory protocol runner; đây là bằng chứng `AR-MD-93` và phải route tới archetype lân cận.
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
| [NIH — Assay Guidance Manual](https://www.ncbi.nlm.nih.gov/books/NBK83783/?report=reader) | Hỗ trợ assay validation, controls, and dose-response practice. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [FDA — Q2(R2) Validation of Analytical Procedures](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q2r2-validation-analytical-procedures) | Hỗ trợ analytical procedure validation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Hỗ trợ independent data provenance. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard access for bounded well matrices. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "microplate-dose-response-analysis-workbench",
  "situationCodes": ["<matched AR-MD-* codes>"],
  "searchAliases": ["dose response","microplate QC","well grid","curve fitting"],
  "dominantTask": "Reconcile a physical well layout, spatial quality evidence, and fitted dose-response curves before accepting an assay plate or batch.",
  "regions": ["dose-response-workbench","plate-and-batch-context","well-grid-and-controls","spatial-qc-heatmap","dose-series-groups","fitted-response-curves","outlier-and-edge-effect-queue","selected-well-raw-read","acceptance-and-report"],
  "regionRelationships": ["Physical well coordinates and fitted dose-series evidence are peer owners; spatial controls and curve quality jointly constrain batch acceptance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "well-grid-and-controls",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["plate loading","control pass","control fail","well missing","well outlier","edge effect suspected","curve fitting","curve passed","curve failed","parameter confidence low","series accepted","series rejected","batch pending","batch accepted","batch rejected"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

