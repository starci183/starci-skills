# Bàn làm việc phát hiện thay đổi không gian

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `spatial-change-detection-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Phát hiện và xác thực thay đổi địa lý giữa hai quan sát đã đăng ký, rồi review các đại lượng cho từng vùng thay đổi dẫn xuất. |
| Bí danh tìm kiếm | `change detection`, `before after raster`, `change mask`, `region validation` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Mask không gian dẫn xuất và các vùng thay đổi đã định lượng sở hữu tác vụ, trong khi chất lượng đăng ký ràng buộc mọi phán quyết.
- Region graph bắt buộc giữ nguyên `change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- A derived spatial mask plus quantified regions is mandatory; a visual before/after comparison alone is insufficient.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SC-01` | Dominant task là: Phát hiện và xác thực thay đổi địa lý giữa hai quan sát đã đăng ký, rồi review các đại lượng cho từng vùng thay đổi dẫn xuất. | Bằng chứng ứng viên. |
| `AR-SC-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-SC-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-SC-04` | Mask không gian dẫn xuất và các vùng thay đổi đã định lượng sở hữu tác vụ, trong khi chất lượng đăng ký ràng buộc mọi phán quyết. | Bằng chứng quan hệ bắt buộc. |
| `AR-SC-90` | Dominant task là reconciliation diff. | Từ chối. |
| `AR-SC-91` | Dominant task là map explorer. | Từ chối. |
| `AR-SC-92` | Dominant task là media annotation. | Từ chối. |
| `AR-SC-93` | Dominant task là generic image compare. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `spatial-change-detection-workbench` khi `AR-SC-01`, `AR-SC-02`, `AR-SC-03` và `AR-SC-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-SC-90` đến `AR-SC-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
change-workbench
└─ area-and-time-pair
   └─ before-and-after-imagery
      └─ registration-quality
         └─ derived-change-mask
            └─ change-region-queue
               └─ selected-region-statistics
                  └─ threshold-and-validation
                     └─ export
```

- Quan hệ bắt buộc: Mask không gian dẫn xuất và các vùng thay đổi đã định lượng sở hữu tác vụ, trong khi chất lượng đăng ký ràng buộc mọi phán quyết.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `change-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `area-and-time-pair` | Sở hữu bằng chứng, trạng thái và action của area-and-time-pair mà không vay product semantics. | Theo sau `change-workbench` trong semantic order và giữ cùng selection context. |
| `before-and-after-imagery` | Sở hữu bằng chứng, trạng thái và action của before-and-after-imagery mà không vay product semantics. | Theo sau `area-and-time-pair` trong semantic order và giữ cùng selection context. |
| `registration-quality` | Sở hữu bằng chứng, trạng thái và action của registration-quality mà không vay product semantics. | Theo sau `before-and-after-imagery` trong semantic order và giữ cùng selection context. |
| `derived-change-mask` | Sở hữu bằng chứng, trạng thái và action của derived-change-mask mà không vay product semantics. | Theo sau `registration-quality` trong semantic order và giữ cùng selection context. |
| `change-region-queue` | Sở hữu bằng chứng, trạng thái và action của change-region-queue mà không vay product semantics. | Theo sau `derived-change-mask` trong semantic order và giữ cùng selection context. |
| `selected-region-statistics` | Sở hữu bằng chứng, trạng thái và action của selected-region-statistics mà không vay product semantics. | Theo sau `change-region-queue` trong semantic order và giữ cùng selection context. |
| `threshold-and-validation` | Sở hữu bằng chứng, trạng thái và action của threshold-and-validation mà không vay product semantics. | Theo sau `selected-region-statistics` trong semantic order và giữ cùng selection context. |
| `export` | Sở hữu bằng chứng, trạng thái và action của export mà không vay product semantics. | Theo sau `threshold-and-validation` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep before or after imagery, the change mask or queue, and selected statistics visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `before-and-after-imagery` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make imagery primary; alternate region queue and statistics while retaining the selected area summary.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `before-and-after-imagery` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use before or after toggle → change-region list → selected mask or statistics → validate; restore the exact viewport and area of interest.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `before-and-after-imagery` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export`.
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
- The fictional region with cloud overlap remains uncertain until reviewed.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `area-and-time-pair` | Xác định owner đang pending và giữ semantic position. |
| Ready | `before-and-after-imagery` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `registration-quality` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `derived-change-mask` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `change-region-queue` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `area-and-time-pair` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `change-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: imagery loading, imagery clouded, imagery misaligned, registration pass, registration fail, mask calculating, mask stale, region selected, region accepted, region rejected, region uncertain, threshold changed, validation pending, export ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi phát hiện và xác thực thay đổi địa lý giữa hai quan sát đã đăng ký, rồi review các đại lượng cho từng vùng thay đổi dẫn xuất.
- Chấp nhận khi mask không gian dẫn xuất và các vùng thay đổi đã định lượng sở hữu tác vụ, trong khi chất lượng đăng ký ràng buộc mọi phán quyết.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối reconciliation diff; đây là bằng chứng `AR-SC-90` và phải route tới archetype lân cận.
- Từ chối map explorer; đây là bằng chứng `AR-SC-91` và phải route tới archetype lân cận.
- Từ chối media annotation; đây là bằng chứng `AR-SC-92` và phải route tới archetype lân cận.
- Từ chối generic image compare; đây là bằng chứng `AR-SC-93` và phải route tới archetype lân cận.
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
| [USGS — Continuous Change Detection products](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-lcmap-continuous-change-detection-classification-v13-ccdc) | Hỗ trợ continuous geographic change detection products. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [ESA — SNAP toolbox](https://step.esa.int/main/toolboxes/snap/) | Hỗ trợ registered Earth-observation processing. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [OGC — Web Coverage Service](https://www.ogc.org/standards/wcs/) | Hỗ trợ independent coverage and subset semantics. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Hỗ trợ text equivalents for spatial masks and comparisons. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "spatial-change-detection-workbench",
  "situationCodes": ["<matched AR-SC-* codes>"],
  "searchAliases": ["change detection","before after raster","change mask","region validation"],
  "dominantTask": "Detect and validate geographic change between two registered observations and review quantities for each derived change region.",
  "regions": ["change-workbench","area-and-time-pair","before-and-after-imagery","registration-quality","derived-change-mask","change-region-queue","selected-region-statistics","threshold-and-validation","export"],
  "regionRelationships": ["The derived spatial mask and quantified change regions own the task while registration quality constrains every verdict."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "before-and-after-imagery",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["imagery loading","imagery clouded","imagery misaligned","registration pass","registration fail","mask calculating","mask stale","region selected","region accepted","region rejected","region uncertain","threshold changed","validation pending","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

