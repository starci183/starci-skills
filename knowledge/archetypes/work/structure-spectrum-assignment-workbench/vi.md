# Bàn làm việc gán cấu trúc–phổ

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `structure-spectrum-assignment-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Gán các peak từ một hoặc nhiều phổ vào nguyên tử hoặc nhóm trong cấu trúc phân tử đồng thời giải quyết xung đột và khoảng trống hoàn thiện. |
| Bí danh tìm kiếm | `spectral assignment`, `peak atom mapping`, `structure spectrum`, `assignment completeness` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Đồ thị nguyên tử và tọa độ phổ là các owner ngang hàng được nối bằng quan hệ gán nhiều-nhiều để lộ xung đột và khoảng trống.
- Region graph bắt buộc giữ nguyên `assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- A many-to-many assignment between an atom graph and spectral coordinates is mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SS-01` | Dominant task là: Gán các peak từ một hoặc nhiều phổ vào nguyên tử hoặc nhóm trong cấu trúc phân tử đồng thời giải quyết xung đột và khoảng trống hoàn thiện. | Bằng chứng ứng viên. |
| `AR-SS-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-SS-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-SS-04` | Đồ thị nguyên tử và tọa độ phổ là các owner ngang hàng được nối bằng quan hệ gán nhiều-nhiều để lộ xung đột và khoảng trống. | Bằng chứng quan hệ bắt buộc. |
| `AR-SS-90` | Dominant task là media annotation. | Từ chối. |
| `AR-SS-91` | Dominant task là generic graph exploration. | Từ chối. |
| `AR-SS-92` | Dominant task là data mapping. | Từ chối. |
| `AR-SS-93` | Dominant task là one-canvas inspection. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `structure-spectrum-assignment-workbench` khi `AR-SS-01`, `AR-SS-02`, `AR-SS-03` và `AR-SS-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-SS-90` đến `AR-SS-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
assignment-workbench
└─ sample-and-structure-context
   └─ atom-indexed-molecular-structure
      └─ spectral-axes
         └─ peak-list
            └─ atom-to-peak-assignment-matrix
               └─ selected-assignment-evidence
                  └─ conflict-and-completeness-summary
                     └─ finalize
```

- Quan hệ bắt buộc: Đồ thị nguyên tử và tọa độ phổ là các owner ngang hàng được nối bằng quan hệ gán nhiều-nhiều để lộ xung đột và khoảng trống.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `assignment-workbench` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `sample-and-structure-context` | Sở hữu bằng chứng, trạng thái và action của sample-and-structure-context mà không vay product semantics. | Theo sau `assignment-workbench` trong semantic order và giữ cùng selection context. |
| `atom-indexed-molecular-structure` | Sở hữu bằng chứng, trạng thái và action của atom-indexed-molecular-structure mà không vay product semantics. | Theo sau `sample-and-structure-context` trong semantic order và giữ cùng selection context. |
| `spectral-axes` | Sở hữu bằng chứng, trạng thái và action của spectral-axes mà không vay product semantics. | Theo sau `atom-indexed-molecular-structure` trong semantic order và giữ cùng selection context. |
| `peak-list` | Sở hữu bằng chứng, trạng thái và action của peak-list mà không vay product semantics. | Theo sau `spectral-axes` trong semantic order và giữ cùng selection context. |
| `atom-to-peak-assignment-matrix` | Sở hữu bằng chứng, trạng thái và action của atom-to-peak-assignment-matrix mà không vay product semantics. | Theo sau `peak-list` trong semantic order và giữ cùng selection context. |
| `selected-assignment-evidence` | Sở hữu bằng chứng, trạng thái và action của selected-assignment-evidence mà không vay product semantics. | Theo sau `atom-to-peak-assignment-matrix` trong semantic order và giữ cùng selection context. |
| `conflict-and-completeness-summary` | Sở hữu bằng chứng, trạng thái và action của conflict-and-completeness-summary mà không vay product semantics. | Theo sau `selected-assignment-evidence` trong semantic order và giữ cùng selection context. |
| `finalize` | Sở hữu bằng chứng, trạng thái và action của finalize mà không vay product semantics. | Theo sau `conflict-and-completeness-summary` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep structure, spectrum, and assignment matrix visible together.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `spectral-axes` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make structure or spectrum primary while the active atom/peak pair and completeness summary persist.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `spectral-axes` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use a peak-by-peak sequence: peak → candidate atoms → evidence → assign → next; structure and spectrum become named alternate views.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `spectral-axes` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize`.
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
- The fictional assignment cannot finalize while one peak has conflicting atoms.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `sample-and-structure-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `atom-indexed-molecular-structure` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `spectral-axes` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `peak-list` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `atom-to-peak-assignment-matrix` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `finalize` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `finalize` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `sample-and-structure-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `finalize` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `assignment-workbench` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: spectrum loading, spectrum noisy, peak unpicked, peak selected, peak overlapping, atom assigned, atom unassigned, atom multiply assigned, assignment conflict, low confidence, completeness gap, finalize blocked, finalize success, recalculation stale.

## Ranh giới

### Chấp nhận

- Chấp nhận khi gán các peak từ một hoặc nhiều phổ vào nguyên tử hoặc nhóm trong cấu trúc phân tử đồng thời giải quyết xung đột và khoảng trống hoàn thiện.
- Chấp nhận khi đồ thị nguyên tử và tọa độ phổ là các owner ngang hàng được nối bằng quan hệ gán nhiều-nhiều để lộ xung đột và khoảng trống.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối media annotation; đây là bằng chứng `AR-SS-90` và phải route tới archetype lân cận.
- Từ chối generic graph exploration; đây là bằng chứng `AR-SS-91` và phải route tới archetype lân cận.
- Từ chối data mapping; đây là bằng chứng `AR-SS-92` và phải route tới archetype lân cận.
- Từ chối one-canvas inspection; đây là bằng chứng `AR-SS-93` và phải route tới archetype lân cận.
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
| [NIST — Chemistry WebBook](https://webbook.nist.gov/) | Hỗ trợ official spectral reference data. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NCBI — PubChem Structures](https://pubchem.ncbi.nlm.nih.gov/docs/structures) | Hỗ trợ atom-indexed chemical structures. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [IETF — RFC Editor](https://www.rfc-editor.org/) | Hỗ trợ independent structured-data documentation practice. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ meaningful keyboard order across alternate representations. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "structure-spectrum-assignment-workbench",
  "situationCodes": ["<matched AR-SS-* codes>"],
  "searchAliases": ["spectral assignment","peak atom mapping","structure spectrum","assignment completeness"],
  "dominantTask": "Assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps.",
  "regions": ["assignment-workbench","sample-and-structure-context","atom-indexed-molecular-structure","spectral-axes","peak-list","atom-to-peak-assignment-matrix","selected-assignment-evidence","conflict-and-completeness-summary","finalize"],
  "regionRelationships": ["The atom graph and spectral coordinates are peer owners joined by a many-to-many assignment relation that exposes conflicts and gaps."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "spectral-axes",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["spectrum loading","spectrum noisy","peak unpicked","peak selected","peak overlapping","atom assigned","atom unassigned","atom multiply assigned","assignment conflict","low confidence","completeness gap","finalize blocked","finalize success","recalculation stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

