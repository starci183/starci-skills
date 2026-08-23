# Trình lập kế hoạch thiết kế ngẫu nhiên hóa thí nghiệm

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `experiment-randomization-design-planner` |
| Nhóm | Work |
| Tác vụ chi phối | Tạo thiết kế phân bổ thí nghiệm cân bằng, đủ power và ngẫu nhiên hóa có thể tái tạo trước khi phân bổ đối tượng hoặc mẫu. |
| Bí danh tìm kiếm | `randomization planner`, `design matrix`, `experimental assignment`, `power balance` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Ma trận phân bổ, bằng chứng cân bằng, bằng chứng power và seed ngẫu nhiên hóa cùng sở hữu tính hợp lệ và nguồn gốc che giấu.
- Region graph bắt buộc giữ nguyên `design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- The output must be a randomized assignment matrix with seed and concealment provenance.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-ER-01` | Dominant task là: Tạo thiết kế phân bổ thí nghiệm cân bằng, đủ power và ngẫu nhiên hóa có thể tái tạo trước khi phân bổ đối tượng hoặc mẫu. | Bằng chứng ứng viên. |
| `AR-ER-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-ER-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-ER-04` | Ma trận phân bổ, bằng chứng cân bằng, bằng chứng power và seed ngẫu nhiên hóa cùng sở hữu tính hợp lệ và nguồn gốc che giấu. | Bằng chứng quan hệ bắt buộc. |
| `AR-ER-90` | Dominant task là scenario sensitivity. | Từ chối. |
| `AR-ER-91` | Dominant task là calendar scheduling. | Từ chối. |
| `AR-ER-92` | Dominant task là spreadsheet editing. | Từ chối. |
| `AR-ER-93` | Dominant task là quota allocation. | Từ chối. |
| `AR-ER-94` | Dominant task là direct waitlist matching. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `experiment-randomization-design-planner` khi `AR-ER-01`, `AR-ER-02`, `AR-ER-03` và `AR-ER-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-ER-90` đến `AR-ER-94` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
design-planner
└─ study-question-and-population
   └─ factors-treatments-and-strata
      └─ candidate-design-matrix
         └─ balance-and-power-evidence
            └─ block-and-randomization-plan
               └─ seed-and-concealment-record
                  └─ assignment-export
```

- Quan hệ bắt buộc: Ma trận phân bổ, bằng chứng cân bằng, bằng chứng power và seed ngẫu nhiên hóa cùng sở hữu tính hợp lệ và nguồn gốc che giấu.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `design-planner` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `study-question-and-population` | Sở hữu bằng chứng, trạng thái và action của study-question-and-population mà không vay product semantics. | Theo sau `design-planner` trong semantic order và giữ cùng selection context. |
| `factors-treatments-and-strata` | Sở hữu bằng chứng, trạng thái và action của factors-treatments-and-strata mà không vay product semantics. | Theo sau `study-question-and-population` trong semantic order và giữ cùng selection context. |
| `candidate-design-matrix` | Sở hữu bằng chứng, trạng thái và action của candidate-design-matrix mà không vay product semantics. | Theo sau `factors-treatments-and-strata` trong semantic order và giữ cùng selection context. |
| `balance-and-power-evidence` | Sở hữu bằng chứng, trạng thái và action của balance-and-power-evidence mà không vay product semantics. | Theo sau `candidate-design-matrix` trong semantic order và giữ cùng selection context. |
| `block-and-randomization-plan` | Sở hữu bằng chứng, trạng thái và action của block-and-randomization-plan mà không vay product semantics. | Theo sau `balance-and-power-evidence` trong semantic order và giữ cùng selection context. |
| `seed-and-concealment-record` | Sở hữu bằng chứng, trạng thái và action của seed-and-concealment-record mà không vay product semantics. | Theo sau `block-and-randomization-plan` trong semantic order và giữ cùng selection context. |
| `assignment-export` | Sở hữu bằng chứng, trạng thái và action của assignment-export mà không vay product semantics. | Theo sau `seed-and-concealment-record` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep design inputs, assignment matrix, and balance or power evidence visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `candidate-design-matrix` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Collapse inputs while the matrix remains primary and the imbalance summary persists.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `candidate-design-matrix` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use define factors → generate design → inspect balance or power → lock seed → review or export; provide a labeled row-group alternative for the matrix.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `candidate-design-matrix` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export`.
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
- The fictional design blocks export until the seed is locked and power is adequate.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `study-question-and-population` | Xác định owner đang pending và giữ semantic position. |
| Ready | `factors-treatments-and-strata` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `candidate-design-matrix` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `balance-and-power-evidence` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `block-and-randomization-plan` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `assignment-export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `assignment-export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `study-question-and-population` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `assignment-export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `design-planner` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: population incomplete, factor invalid, level invalid, design generating, balance pass, balance fail, power insufficient, seed unlocked, seed locked, concealment restricted, export pending, version conflict.

## Ranh giới

### Chấp nhận

- Chấp nhận khi tạo thiết kế phân bổ thí nghiệm cân bằng, đủ power và ngẫu nhiên hóa có thể tái tạo trước khi phân bổ đối tượng hoặc mẫu.
- Chấp nhận khi ma trận phân bổ, bằng chứng cân bằng, bằng chứng power và seed ngẫu nhiên hóa cùng sở hữu tính hợp lệ và nguồn gốc che giấu.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối scenario sensitivity; đây là bằng chứng `AR-ER-90` và phải route tới archetype lân cận.
- Từ chối calendar scheduling; đây là bằng chứng `AR-ER-91` và phải route tới archetype lân cận.
- Từ chối spreadsheet editing; đây là bằng chứng `AR-ER-92` và phải route tới archetype lân cận.
- Từ chối quota allocation; đây là bằng chứng `AR-ER-93` và phải route tới archetype lân cận.
- Từ chối direct waitlist matching; đây là bằng chứng `AR-ER-94` và phải route tới archetype lân cận.
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
| [FDA — Randomized trial design guidance](https://www.fda.gov/media/191123/download) | Hỗ trợ randomized design and statistical considerations. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [CONSORT-SPIRIT — Published statements](https://www.consort-spirit.org/published-statements) | Hỗ trợ allocation and reporting provenance. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Hỗ trợ reproducible data records. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard access for assignment matrices. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "experiment-randomization-design-planner",
  "situationCodes": ["<matched AR-ER-* codes>"],
  "searchAliases": ["randomization planner","design matrix","experimental assignment","power balance"],
  "dominantTask": "Create a balanced, sufficiently powered, and reproducibly randomized experimental assignment design before subjects or samples are allocated.",
  "regions": ["design-planner","study-question-and-population","factors-treatments-and-strata","candidate-design-matrix","balance-and-power-evidence","block-and-randomization-plan","seed-and-concealment-record","assignment-export"],
  "regionRelationships": ["The assignment matrix, balance evidence, power evidence, and randomization seed jointly own validity and concealment provenance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-design-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["population incomplete","factor invalid","level invalid","design generating","balance pass","balance fail","power insufficient","seed unlocked","seed locked","concealment restricted","export pending","version conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

