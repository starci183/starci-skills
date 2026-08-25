# Bàn làm việc phân tích hiển vi đa kênh

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `multichannel-microscopy-analysis-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Xác thực phân đoạn và phép đo định lượng bằng cách so sánh các kênh thô đồng đăng ký, ảnh tổng hợp, đối tượng dẫn xuất và bằng chứng chất lượng. |
| Bí danh tìm kiếm | `microscopy channels`, `segmentation QC`, `object measurements`, `co-registered images` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Kênh thô, ảnh tổng hợp, overlay dẫn xuất và bảng đo giữ thẩm quyền riêng nhưng dùng chung lựa chọn đối tượng, mặt phẳng và tọa độ.
- Region graph bắt buộc giữ nguyên `microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Multiple co-registered raw views and traceable raw-to-derived measurement lineage are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MM-01` | Dominant task là: Xác thực phân đoạn và phép đo định lượng bằng cách so sánh các kênh thô đồng đăng ký, ảnh tổng hợp, đối tượng dẫn xuất và bằng chứng chất lượng. | Bằng chứng ứng viên. |
| `AR-MM-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-MM-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-MM-04` | Kênh thô, ảnh tổng hợp, overlay dẫn xuất và bảng đo giữ thẩm quyền riêng nhưng dùng chung lựa chọn đối tượng, mặt phẳng và tọa độ. | Bằng chứng quan hệ bắt buộc. |
| `AR-MM-90` | Dominant task là one-canvas property editor. | Từ chối. |
| `AR-MM-91` | Dominant task là image gallery. | Từ chối. |
| `AR-MM-92` | Dominant task là media annotation. | Từ chối. |
| `AR-MM-93` | Dominant task là generic data table. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `multichannel-microscopy-analysis-workbench` khi `AR-MM-01`, `AR-MM-02`, `AR-MM-03` và `AR-MM-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-MM-90` đến `AR-MM-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
microscopy-workbench
└─ image-dataset-context
   └─ channel-and-plane-controls
      └─ synchronized-raw-channel-views
         └─ composite-stage
            └─ segmentation-and-object-overlay
               └─ object-measurement-table
                  └─ selected-object-profile
                     └─ qc-and-acceptance
```

- Quan hệ bắt buộc: Kênh thô, ảnh tổng hợp, overlay dẫn xuất và bảng đo giữ thẩm quyền riêng nhưng dùng chung lựa chọn đối tượng, mặt phẳng và tọa độ.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `microscopy-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `image-dataset-context` | Sở hữu bằng chứng, trạng thái và action của image-dataset-context mà không vay product semantics. | Theo sau `microscopy-workbench` trong semantic order và giữ cùng selection context. |
| `channel-and-plane-controls` | Sở hữu bằng chứng, trạng thái và action của channel-and-plane-controls mà không vay product semantics. | Theo sau `image-dataset-context` trong semantic order và giữ cùng selection context. |
| `synchronized-raw-channel-views` | Sở hữu bằng chứng, trạng thái và action của synchronized-raw-channel-views mà không vay product semantics. | Theo sau `channel-and-plane-controls` trong semantic order và giữ cùng selection context. |
| `composite-stage` | Sở hữu bằng chứng, trạng thái và action của composite-stage mà không vay product semantics. | Theo sau `synchronized-raw-channel-views` trong semantic order và giữ cùng selection context. |
| `segmentation-and-object-overlay` | Sở hữu bằng chứng, trạng thái và action của segmentation-and-object-overlay mà không vay product semantics. | Theo sau `composite-stage` trong semantic order và giữ cùng selection context. |
| `object-measurement-table` | Sở hữu bằng chứng, trạng thái và action của object-measurement-table mà không vay product semantics. | Theo sau `segmentation-and-object-overlay` trong semantic order và giữ cùng selection context. |
| `selected-object-profile` | Sở hữu bằng chứng, trạng thái và action của selected-object-profile mà không vay product semantics. | Theo sau `object-measurement-table` trong semantic order và giữ cùng selection context. |
| `qc-and-acceptance` | Sở hữu bằng chứng, trạng thái và action của qc-and-acceptance mà không vay product semantics. | Theo sau `selected-object-profile` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep raw channels or composite, object measurements, and the selected-object inspector simultaneously available.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `synchronized-raw-channel-views` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make the composite primary; alternate the channel strip and measurement table while retaining the shared object and coordinate.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `synchronized-raw-channel-views` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use field summary → channel switch → overlay → selected-object measurements → QC, with an object list as the default non-visual parity route.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `synchronized-raw-channel-views` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance`.
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
- The fictional dataset cannot pass QC while one object boundary conflict remains.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `image-dataset-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `channel-and-plane-controls` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `synchronized-raw-channel-views` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `composite-stage` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `segmentation-and-object-overlay` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `qc-and-acceptance` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `qc-and-acceptance` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `image-dataset-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `qc-and-acceptance` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `microscopy-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: dataset loading, channel loading, plane unavailable, segmentation running, segmentation stale, segmentation failure, object selected, object rejected, object merged, object split, measurement incomplete, measurement outlier, QC pass, QC fail, QC needs review, acceptance conflict.

## Ranh giới

### Chấp nhận

- Chấp nhận khi xác thực phân đoạn và phép đo định lượng bằng cách so sánh các kênh thô đồng đăng ký, ảnh tổng hợp, đối tượng dẫn xuất và bằng chứng chất lượng.
- Chấp nhận khi kênh thô, ảnh tổng hợp, overlay dẫn xuất và bảng đo giữ thẩm quyền riêng nhưng dùng chung lựa chọn đối tượng, mặt phẳng và tọa độ.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối one-canvas property editor; đây là bằng chứng `AR-MM-90` và phải route tới archetype lân cận.
- Từ chối image gallery; đây là bằng chứng `AR-MM-91` và phải route tới archetype lân cận.
- Từ chối media annotation; đây là bằng chứng `AR-MM-92` và phải route tới archetype lân cận.
- Từ chối generic data table; đây là bằng chứng `AR-MM-93` và phải route tới archetype lân cận.
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
| [OME — Data Model overview](https://docs.openmicroscopy.org/ome-model/6.2.2/developers/model-overview.html) | Hỗ trợ multidimensional microscopy metadata and relationships. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NCBI — PubChem Structures](https://pubchem.ncbi.nlm.nih.gov/docs/structures) | Hỗ trợ independent official evidence for structured scientific representation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [DICOM — Current volumetric presentation state IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Hỗ trợ registered volumetric inputs and presentation context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Hỗ trợ text alternatives for complex visual evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "multichannel-microscopy-analysis-workbench",
  "situationCodes": ["<matched AR-MM-* codes>"],
  "searchAliases": ["microscopy channels","segmentation QC","object measurements","co-registered images"],
  "dominantTask": "Validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects, and quality evidence.",
  "regions": ["microscopy-workbench","image-dataset-context","channel-and-plane-controls","synchronized-raw-channel-views","composite-stage","segmentation-and-object-overlay","object-measurement-table","selected-object-profile","qc-and-acceptance"],
  "regionRelationships": ["Raw channels, composite, derived overlay, and measurement table retain distinct authority while sharing one object, plane, and coordinate selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "synchronized-raw-channel-views",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["dataset loading","channel loading","plane unavailable","segmentation running","segmentation stale","segmentation failure","object selected","object rejected","object merged","object split","measurement incomplete","measurement outlier","QC pass","QC fail","QC needs review","acceptance conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

