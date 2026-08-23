# Bàn làm việc phân tích dạng sóng đa kênh

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `multichannel-waveform-analysis-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Định vị và đo hình thái, khoảng thời gian và event candidate trên nhiều kênh tín hiệu liên tục được đồng bộ. |
| Bí danh tìm kiếm | `waveform analysis`, `synchronized signals`, `interval measurement`, `multichannel traces` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Một con trỏ thời gian và khoảng dùng chung đồng bộ các kênh liên tục; phép đo số chi phối mọi trace trực quan và event candidate.
- Region graph bắt buộc giữ nguyên `waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Continuous sampled channels and a shared interval measurement are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MW-01` | Dominant task là: Định vị và đo hình thái, khoảng thời gian và event candidate trên nhiều kênh tín hiệu liên tục được đồng bộ. | Bằng chứng ứng viên. |
| `AR-MW-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-MW-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-MW-04` | Một con trỏ thời gian và khoảng dùng chung đồng bộ các kênh liên tục; phép đo số chi phối mọi trace trực quan và event candidate. | Bằng chứng quan hệ bắt buộc. |
| `AR-MW-90` | Dominant task là timeline status monitor. | Từ chối. |
| `AR-MW-91` | Dominant task là media annotation. | Từ chối. |
| `AR-MW-92` | Dominant task là streaming logs. | Từ chối. |
| `AR-MW-93` | Dominant task là generic chart overview. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `multichannel-waveform-analysis-workbench` khi `AR-MW-01`, `AR-MW-02`, `AR-MW-03` và `AR-MW-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-MW-90` đến `AR-MW-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
waveform-workbench
└─ recording-and-calibration-context
   └─ channel-set-and-scale
      └─ synchronized-waveform-traces
         └─ shared-cursor-and-interval
            └─ derived-measurements
               └─ event-candidate-list
                  └─ selected-interval-detail
                     └─ finding-export
```

- Quan hệ bắt buộc: Một con trỏ thời gian và khoảng dùng chung đồng bộ các kênh liên tục; phép đo số chi phối mọi trace trực quan và event candidate.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `waveform-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `recording-and-calibration-context` | Sở hữu bằng chứng, trạng thái và action của recording-and-calibration-context mà không vay product semantics. | Theo sau `waveform-workbench` trong semantic order và giữ cùng selection context. |
| `channel-set-and-scale` | Sở hữu bằng chứng, trạng thái và action của channel-set-and-scale mà không vay product semantics. | Theo sau `recording-and-calibration-context` trong semantic order và giữ cùng selection context. |
| `synchronized-waveform-traces` | Sở hữu bằng chứng, trạng thái và action của synchronized-waveform-traces mà không vay product semantics. | Theo sau `channel-set-and-scale` trong semantic order và giữ cùng selection context. |
| `shared-cursor-and-interval` | Sở hữu bằng chứng, trạng thái và action của shared-cursor-and-interval mà không vay product semantics. | Theo sau `synchronized-waveform-traces` trong semantic order và giữ cùng selection context. |
| `derived-measurements` | Sở hữu bằng chứng, trạng thái và action của derived-measurements mà không vay product semantics. | Theo sau `shared-cursor-and-interval` trong semantic order và giữ cùng selection context. |
| `event-candidate-list` | Sở hữu bằng chứng, trạng thái và action của event-candidate-list mà không vay product semantics. | Theo sau `derived-measurements` trong semantic order và giữ cùng selection context. |
| `selected-interval-detail` | Sở hữu bằng chứng, trạng thái và action của selected-interval-detail mà không vay product semantics. | Theo sau `event-candidate-list` trong semantic order và giữ cùng selection context. |
| `finding-export` | Sở hữu bằng chứng, trạng thái và action của finding-export mà không vay product semantics. | Theo sau `selected-interval-detail` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep stacked traces, measurements, and event candidates visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `synchronized-waveform-traces` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Show fewer channels while preserving the channel selector, shared cursor, and measurement summary.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `synchronized-waveform-traces` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use event-first list or one channel group → selected trace window → numeric measurements → adjacent channels → finding without page-level horizontal overflow.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `synchronized-waveform-traces` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export`.
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
- The fictional event records numeric evidence and the same interval on all channels.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `recording-and-calibration-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `channel-set-and-scale` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `synchronized-waveform-traces` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `shared-cursor-and-interval` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `derived-measurements` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `finding-export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `finding-export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `recording-and-calibration-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `finding-export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `waveform-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: recording loading, recording gap, recording clipped, channel hidden, channel noisy, cursor selected, interval selected, event accepted, event rejected, measurement recalculating, measurement out of range, calibration warning, export ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi định vị và đo hình thái, khoảng thời gian và event candidate trên nhiều kênh tín hiệu liên tục được đồng bộ.
- Chấp nhận khi một con trỏ thời gian và khoảng dùng chung đồng bộ các kênh liên tục; phép đo số chi phối mọi trace trực quan và event candidate.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối timeline status monitor; đây là bằng chứng `AR-MW-90` và phải route tới archetype lân cận.
- Từ chối media annotation; đây là bằng chứng `AR-MW-91` và phải route tới archetype lân cận.
- Từ chối streaming logs; đây là bằng chứng `AR-MW-92` và phải route tới archetype lân cận.
- Từ chối generic chart overview; đây là bằng chứng `AR-MW-93` và phải route tới archetype lân cận.
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
| [PhysioNet — Waveform databases](https://physionet.org/about/database/) | Hỗ trợ synchronized physiological waveform resources. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [FDA — Randomized trial design guidance](https://www.fda.gov/media/191123/download) | Hỗ trợ independent evidence-quality and measurement context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [DICOM — Current Volumetric Presentation State IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Hỗ trợ independent synchronized measurement context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Hỗ trợ numeric and textual alternatives for complex traces. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "multichannel-waveform-analysis-workbench",
  "situationCodes": ["<matched AR-MW-* codes>"],
  "searchAliases": ["waveform analysis","synchronized signals","interval measurement","multichannel traces"],
  "dominantTask": "Locate and measure morphology, intervals, and event candidates across multiple synchronized continuous signal channels.",
  "regions": ["waveform-workbench","recording-and-calibration-context","channel-set-and-scale","synchronized-waveform-traces","shared-cursor-and-interval","derived-measurements","event-candidate-list","selected-interval-detail","finding-export"],
  "regionRelationships": ["A shared time cursor and interval synchronize continuous channels; numeric measurements govern every visual trace and event candidate."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "synchronized-waveform-traces",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["recording loading","recording gap","recording clipped","channel hidden","channel noisy","cursor selected","interval selected","event accepted","event rejected","measurement recalculating","measurement out of range","calibration warning","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

