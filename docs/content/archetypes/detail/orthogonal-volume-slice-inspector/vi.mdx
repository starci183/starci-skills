# Trình kiểm tra lát cắt thể tích trực giao

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `orthogonal-volume-slice-inspector` |
| Nhóm | Detail |
| Tác vụ chi phối | Định vị và đo một cấu trúc trong thể tích bằng cách điều hướng ba mặt phẳng trực giao dùng chung một tọa độ crosshair. |
| Bí danh tìm kiếm | `orthogonal slices`, `MPR inspector`, `volume crosshair`, `axial coronal sagittal` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Các view axial, coronal và sagittal render độc lập nhưng dùng chung một tọa độ crosshair ba chiều và định danh finding.
- Region graph bắt buộc giữ nguyên `volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Three orthogonal planes sharing one three-dimensional coordinate are invariant.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-OV-01` | Dominant task là: Định vị và đo một cấu trúc trong thể tích bằng cách điều hướng ba mặt phẳng trực giao dùng chung một tọa độ crosshair. | Bằng chứng ứng viên. |
| `AR-OV-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-OV-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-OV-04` | Các view axial, coronal và sagittal render độc lập nhưng dùng chung một tọa độ crosshair ba chiều và định danh finding. | Bằng chứng quan hệ bắt buộc. |
| `AR-OV-90` | Dominant task là generic canvas inspector. | Từ chối. |
| `AR-OV-91` | Dominant task là gallery lightbox. | Từ chối. |
| `AR-OV-92` | Dominant task là media annotation. | Từ chối. |
| `AR-OV-93` | Dominant task là map. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `orthogonal-volume-slice-inspector` khi `AR-OV-01`, `AR-OV-02`, `AR-OV-03` và `AR-OV-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-OV-90` đến `AR-OV-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
volume-inspector
└─ volume-and-series-context
   └─ axial-view
      └─ coronal-view
         └─ sagittal-view
            └─ shared-crosshair-and-coordinate
               └─ optional-3d-overview
                  └─ window-level-and-segmentation
                     └─ measurement-and-finding-list
```

- Quan hệ bắt buộc: Các view axial, coronal và sagittal render độc lập nhưng dùng chung một tọa độ crosshair ba chiều và định danh finding.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `volume-inspector` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `volume-and-series-context` | Sở hữu bằng chứng, trạng thái và action của volume-and-series-context mà không vay product semantics. | Theo sau `volume-inspector` trong semantic order và giữ cùng selection context. |
| `axial-view` | Sở hữu bằng chứng, trạng thái và action của axial-view mà không vay product semantics. | Theo sau `volume-and-series-context` trong semantic order và giữ cùng selection context. |
| `coronal-view` | Sở hữu bằng chứng, trạng thái và action của coronal-view mà không vay product semantics. | Theo sau `axial-view` trong semantic order và giữ cùng selection context. |
| `sagittal-view` | Sở hữu bằng chứng, trạng thái và action của sagittal-view mà không vay product semantics. | Theo sau `coronal-view` trong semantic order và giữ cùng selection context. |
| `shared-crosshair-and-coordinate` | Sở hữu bằng chứng, trạng thái và action của shared-crosshair-and-coordinate mà không vay product semantics. | Theo sau `sagittal-view` trong semantic order và giữ cùng selection context. |
| `optional-3d-overview` | Sở hữu bằng chứng, trạng thái và action của optional-3d-overview mà không vay product semantics. | Theo sau `shared-crosshair-and-coordinate` trong semantic order và giữ cùng selection context. |
| `window-level-and-segmentation` | Sở hữu bằng chứng, trạng thái và action của window-level-and-segmentation mà không vay product semantics. | Theo sau `optional-3d-overview` trong semantic order và giữ cùng selection context. |
| `measurement-and-finding-list` | Sở hữu bằng chứng, trạng thái và action của measurement-and-finding-list mà không vay product semantics. | Theo sau `window-level-and-segmentation` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Coordinate axial, coronal, sagittal, and optional 3D views while keeping findings available.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `axial-view` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Keep one primary plane with two orientation previews; move findings and controls to a supporting pane.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `axial-view` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Show one plane at a time with explicit orientation switch, coordinate readout, and previous or next slice controls; every gesture has a control equivalent.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `axial-view` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list`.
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
- The fictional finding stores the shared coordinate and remains linked across all orientations.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `volume-and-series-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `axial-view` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `coronal-view` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `sagittal-view` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `shared-crosshair-and-coordinate` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `measurement-and-finding-list` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `measurement-and-finding-list` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `volume-and-series-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `measurement-and-finding-list` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `volume-inspector` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: volume loading, volume partial, plane unavailable, crosshair linked, crosshair unlinked, slice boundary, segmentation hidden, segmentation stale, measurement draft, measurement saved, finding selected, orientation restored.

## Ranh giới

### Chấp nhận

- Chấp nhận khi định vị và đo một cấu trúc trong thể tích bằng cách điều hướng ba mặt phẳng trực giao dùng chung một tọa độ crosshair.
- Chấp nhận khi các view axial, coronal và sagittal render độc lập nhưng dùng chung một tọa độ crosshair ba chiều và định danh finding.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối generic canvas inspector; đây là bằng chứng `AR-OV-90` và phải route tới archetype lân cận.
- Từ chối gallery lightbox; đây là bằng chứng `AR-OV-91` và phải route tới archetype lân cận.
- Từ chối media annotation; đây là bằng chứng `AR-OV-92` và phải route tới archetype lân cận.
- Từ chối map; đây là bằng chứng `AR-OV-93` và phải route tới archetype lân cận.
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
| [DICOM — Current Volumetric Presentation State IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Hỗ trợ registered volume inputs and multi-planar reconstruction context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [OME — Data Model overview](https://docs.openmicroscopy.org/ome-model/6.2.2/developers/model-overview.html) | Hỗ trợ independent multidimensional imaging context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ non-drag control alternatives. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ focus visibility around persistent controls. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "orthogonal-volume-slice-inspector",
  "situationCodes": ["<matched AR-OV-* codes>"],
  "searchAliases": ["orthogonal slices","MPR inspector","volume crosshair","axial coronal sagittal"],
  "dominantTask": "Locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate.",
  "regions": ["volume-inspector","volume-and-series-context","axial-view","coronal-view","sagittal-view","shared-crosshair-and-coordinate","optional-3d-overview","window-level-and-segmentation","measurement-and-finding-list"],
  "regionRelationships": ["Axial, coronal, and sagittal views render independently but share one three-dimensional crosshair coordinate and finding identity."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "axial-view",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["volume loading","volume partial","plane unavailable","crosshair linked","crosshair unlinked","slice boundary","segmentation hidden","segmentation stale","measurement draft","measurement saved","finding selected","orientation restored"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

