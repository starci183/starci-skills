# Bàn làm việc phân tích lớp raster địa không gian

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `geospatial-raster-layer-analysis-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Phân tích các band hoặc lớp raster đồng đăng ký qua giá trị cell, đại số, phân phối và profile transect. |
| Bí danh tìm kiếm | `raster analysis`, `band algebra`, `cell query`, `transect profile` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Cell raster, ngăn xếp công thức và phân phối hoặc profile số là các owner ngang hàng dưới một coverage và selection đã đăng ký.
- Region graph bắt buộc giữ nguyên `raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Cell or band algebra and numeric spatial profiles must dominate the task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-GR-01` | Dominant task là: Phân tích các band hoặc lớp raster đồng đăng ký qua giá trị cell, đại số, phân phối và profile transect. | Bằng chứng ứng viên. |
| `AR-GR-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-GR-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-GR-04` | Cell raster, ngăn xếp công thức và phân phối hoặc profile số là các owner ngang hàng dưới một coverage và selection đã đăng ký. | Bằng chứng quan hệ bắt buộc. |
| `AR-GR-90` | Dominant task là place discovery map. | Từ chối. |
| `AR-GR-91` | Dominant task là live situation map. | Từ chối. |
| `AR-GR-92` | Dominant task là generic canvas. | Từ chối. |
| `AR-GR-93` | Dominant task là dashboard. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `geospatial-raster-layer-analysis-workbench` khi `AR-GR-01`, `AR-GR-02`, `AR-GR-03` và `AR-GR-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-GR-90` đến `AR-GR-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
raster-workbench
└─ coverage-and-time-context
   └─ layer-and-band-algebra-stack
      └─ raster-map-stage
         └─ legend-and-histogram
            └─ point-or-area-query
               └─ transect-profile
                  └─ derived-result-and-export
```

- Quan hệ bắt buộc: Cell raster, ngăn xếp công thức và phân phối hoặc profile số là các owner ngang hàng dưới một coverage và selection đã đăng ký.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `raster-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `coverage-and-time-context` | Sở hữu bằng chứng, trạng thái và action của coverage-and-time-context mà không vay product semantics. | Theo sau `raster-workbench` trong semantic order và giữ cùng selection context. |
| `layer-and-band-algebra-stack` | Sở hữu bằng chứng, trạng thái và action của layer-and-band-algebra-stack mà không vay product semantics. | Theo sau `coverage-and-time-context` trong semantic order và giữ cùng selection context. |
| `raster-map-stage` | Sở hữu bằng chứng, trạng thái và action của raster-map-stage mà không vay product semantics. | Theo sau `layer-and-band-algebra-stack` trong semantic order và giữ cùng selection context. |
| `legend-and-histogram` | Sở hữu bằng chứng, trạng thái và action của legend-and-histogram mà không vay product semantics. | Theo sau `raster-map-stage` trong semantic order và giữ cùng selection context. |
| `point-or-area-query` | Sở hữu bằng chứng, trạng thái và action của point-or-area-query mà không vay product semantics. | Theo sau `legend-and-histogram` trong semantic order và giữ cùng selection context. |
| `transect-profile` | Sở hữu bằng chứng, trạng thái và action của transect-profile mà không vay product semantics. | Theo sau `point-or-area-query` trong semantic order và giữ cùng selection context. |
| `derived-result-and-export` | Sở hữu bằng chứng, trạng thái và action của derived-result-and-export mà không vay product semantics. | Theo sau `transect-profile` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the layer stack, raster stage, and histogram or profile visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `raster-map-stage` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Move the layer stack to a drawer while the selected formula and queried value persist.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `raster-map-stage` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use layer list → full-screen map → selected-cell numeric table → transect or profile → result; the map is never the only data route.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `raster-map-stage` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export`.
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
- The fictional result retains numeric alternatives for every map-derived value.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `coverage-and-time-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `layer-and-band-algebra-stack` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `raster-map-stage` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `legend-and-histogram` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `point-or-area-query` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `derived-result-and-export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `derived-result-and-export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `coverage-and-time-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `derived-result-and-export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `raster-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: coverage loading, coverage no data, layer hidden, layer error, formula valid, formula invalid, formula calculating, cell selected, cell masked, transect draft, transect ready, histogram stale, result pending, result failure, export ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi phân tích các band hoặc lớp raster đồng đăng ký qua giá trị cell, đại số, phân phối và profile transect.
- Chấp nhận khi cell raster, ngăn xếp công thức và phân phối hoặc profile số là các owner ngang hàng dưới một coverage và selection đã đăng ký.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối place discovery map; đây là bằng chứng `AR-GR-90` và phải route tới archetype lân cận.
- Từ chối live situation map; đây là bằng chứng `AR-GR-91` và phải route tới archetype lân cận.
- Từ chối generic canvas; đây là bằng chứng `AR-GR-92` và phải route tới archetype lân cận.
- Từ chối dashboard; đây là bằng chứng `AR-GR-93` và phải route tới archetype lân cận.
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
| [OGC — Web Coverage Service](https://www.ogc.org/standards/wcs/) | Hỗ trợ coverage, subset, and raster-value concepts. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [USGS — LCMAP science products](https://www.usgs.gov/data/land-change-monitoring-assessment-and-projection-science-products) | Hỗ trợ official raster-derived land-change products. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [ESA — SNAP toolbox](https://step.esa.int/main/toolboxes/snap/) | Hỗ trợ independent raster and Earth-observation analysis context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ bounded map overflow and reflowing controls. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "geospatial-raster-layer-analysis-workbench",
  "situationCodes": ["<matched AR-GR-* codes>"],
  "searchAliases": ["raster analysis","band algebra","cell query","transect profile"],
  "dominantTask": "Analyze co-registered raster bands or layers through cell values, algebra, distributions, and transect profiles.",
  "regions": ["raster-workbench","coverage-and-time-context","layer-and-band-algebra-stack","raster-map-stage","legend-and-histogram","point-or-area-query","transect-profile","derived-result-and-export"],
  "regionRelationships": ["Raster cells, the formula stack, and numeric distributions or profiles are peer owners under one registered coverage and selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "raster-map-stage",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["coverage loading","coverage no data","layer hidden","layer error","formula valid","formula invalid","formula calculating","cell selected","cell masked","transect draft","transect ready","histogram stale","result pending","result failure","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

