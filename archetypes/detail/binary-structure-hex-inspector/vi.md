# Trình kiểm tra cấu trúc nhị phân và hex

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `binary-structure-hex-inspector` |
| Nhóm | Detail |
| Tác vụ chi phối | Giải mã một artifact nhị phân bằng cách đồng bộ field cấu trúc đã parse, offset byte, byte hex hoặc ASCII thô và kết quả validation. |
| Bí danh tìm kiếm | `hex inspector`, `binary parser`, `byte offsets`, `decoded fields` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Field ngữ nghĩa được chọn sở hữu một dải byte chính xác xuyên qua cấu trúc đã parse, hex, ASCII, giá trị giải mã và bằng chứng validation.
- Region graph bắt buộc giữ nguyên `binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Synchronized semantic fields and exact raw byte ranges are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-BH-01` | Dominant task là: Giải mã một artifact nhị phân bằng cách đồng bộ field cấu trúc đã parse, offset byte, byte hex hoặc ASCII thô và kết quả validation. | Bằng chứng ứng viên. |
| `AR-BH-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-BH-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-BH-04` | Field ngữ nghĩa được chọn sở hữu một dải byte chính xác xuyên qua cấu trúc đã parse, hex, ASCII, giá trị giải mã và bằng chứng validation. | Bằng chứng quan hệ bắt buộc. |
| `AR-BH-90` | Dominant task là generic hierarchical three-pane explorer. | Từ chối. |
| `AR-BH-91` | Dominant task là packet timeline. | Từ chối. |
| `AR-BH-92` | Dominant task là code editor. | Từ chối. |
| `AR-BH-93` | Dominant task là document diff. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `binary-structure-hex-inspector` khi `AR-BH-01`, `AR-BH-02`, `AR-BH-03` và `AR-BH-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-BH-90` đến `AR-BH-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
binary-inspector
└─ artifact-and-offset-context
   └─ parsed-structure-tree
      └─ hex-and-ascii-byte-view
         └─ decoded-field-values
            └─ checksum-and-format-validation
               └─ cross-references
                  └─ export
```

- Quan hệ bắt buộc: Field ngữ nghĩa được chọn sở hữu một dải byte chính xác xuyên qua cấu trúc đã parse, hex, ASCII, giá trị giải mã và bằng chứng validation.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `binary-inspector` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `artifact-and-offset-context` | Sở hữu bằng chứng, trạng thái và action của artifact-and-offset-context mà không vay product semantics. | Theo sau `binary-inspector` trong semantic order và giữ cùng selection context. |
| `parsed-structure-tree` | Sở hữu bằng chứng, trạng thái và action của parsed-structure-tree mà không vay product semantics. | Theo sau `artifact-and-offset-context` trong semantic order và giữ cùng selection context. |
| `hex-and-ascii-byte-view` | Sở hữu bằng chứng, trạng thái và action của hex-and-ascii-byte-view mà không vay product semantics. | Theo sau `parsed-structure-tree` trong semantic order và giữ cùng selection context. |
| `decoded-field-values` | Sở hữu bằng chứng, trạng thái và action của decoded-field-values mà không vay product semantics. | Theo sau `hex-and-ascii-byte-view` trong semantic order và giữ cùng selection context. |
| `checksum-and-format-validation` | Sở hữu bằng chứng, trạng thái và action của checksum-and-format-validation mà không vay product semantics. | Theo sau `decoded-field-values` trong semantic order và giữ cùng selection context. |
| `cross-references` | Sở hữu bằng chứng, trạng thái và action của cross-references mà không vay product semantics. | Theo sau `checksum-and-format-validation` trong semantic order và giữ cùng selection context. |
| `export` | Sở hữu bằng chứng, trạng thái và action của export mà không vay product semantics. | Theo sau `cross-references` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the structure tree, bytes, and decoded values visible with the exact selected range highlighted.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `hex-and-ascii-byte-view` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Collapse the tree while the selected structure path and offsets remain.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `hex-and-ascii-byte-view` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use structure path → decoded field → exact bytes → validation; previous and next field controls preserve offset context.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `hex-and-ascii-byte-view` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export`.
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
- The fictional decode surfaces the checksum failure in both bytes and text.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `artifact-and-offset-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `parsed-structure-tree` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `hex-and-ascii-byte-view` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `decoded-field-values` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `checksum-and-format-validation` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `artifact-and-offset-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `binary-inspector` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: artifact loading, artifact truncated, parser unsupported, parser failure, field selected, field unknown, byte range invalid, checksum pass, checksum fail, cross-reference unresolved, endian changed, display changed, export ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi giải mã một artifact nhị phân bằng cách đồng bộ field cấu trúc đã parse, offset byte, byte hex hoặc ASCII thô và kết quả validation.
- Chấp nhận khi field ngữ nghĩa được chọn sở hữu một dải byte chính xác xuyên qua cấu trúc đã parse, hex, ASCII, giá trị giải mã và bằng chứng validation.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối generic hierarchical three-pane explorer; đây là bằng chứng `AR-BH-90` và phải route tới archetype lân cận.
- Từ chối packet timeline; đây là bằng chứng `AR-BH-91` và phải route tới archetype lân cận.
- Từ chối code editor; đây là bằng chứng `AR-BH-92` và phải route tới archetype lân cận.
- Từ chối document diff; đây là bằng chứng `AR-BH-93` và phải route tới archetype lân cận.
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
| [Wireshark Foundation — User’s Guide](https://www.wireshark.org/docs/wsug_html/) | Hỗ trợ synchronized protocol fields and byte evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [IETF — RFC Editor](https://www.rfc-editor.org/) | Hỗ trợ authoritative binary-format specifications. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Hỗ trợ independent artifact provenance. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ keyboard access to hierarchical decoded fields. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "binary-structure-hex-inspector",
  "situationCodes": ["<matched AR-BH-* codes>"],
  "searchAliases": ["hex inspector","binary parser","byte offsets","decoded fields"],
  "dominantTask": "Decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal or ASCII bytes, and validation results.",
  "regions": ["binary-inspector","artifact-and-offset-context","parsed-structure-tree","hex-and-ascii-byte-view","decoded-field-values","checksum-and-format-validation","cross-references","export"],
  "regionRelationships": ["The selected semantic field owns one exact byte range across parsed structure, hex, ASCII, decoded value, and validation evidence."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "binary-inspector → artifact-and-offset-context → parsed-structure-tree → hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "hex-and-ascii-byte-view",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["artifact loading","artifact truncated","parser unsupported","parser failure","field selected","field unknown","byte range invalid","checksum pass","checksum fail","cross-reference unresolved","endian changed","display changed","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

