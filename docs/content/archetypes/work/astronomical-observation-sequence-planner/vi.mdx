# Trình lập chuỗi quan sát thiên văn

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `astronomical-observation-sequence-planner` |
| Nhóm | Work |
| Tác vụ chi phối | Soạn một chuỗi quan sát có thể thực thi dưới các ràng buộc về khả kiến mục tiêu, khí quyển, thiết bị và phơi sáng. |
| Bí danh tìm kiếm | `observation sequence`, `telescope planning`, `visibility window`, `exposure plan` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Cửa sổ khả kiến và các exposure có thứ tự cùng sở hữu tính khả thi; ngữ cảnh mục tiêu và thiết bị ràng buộc mọi bước chuỗi.
- Region graph bắt buộc giữ nguyên `observation-planner → proposal-and-target-context → target-catalog → sky-and-visibility-windows → ephemeris-and-constraints → instrument-configuration → ordered-exposure-sequence → feasibility-and-time-budget → validate-and-export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Celestial visibility and ordered instrument exposures must jointly determine validity.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-AO-01` | Dominant task là: Soạn một chuỗi quan sát có thể thực thi dưới các ràng buộc về khả kiến mục tiêu, khí quyển, thiết bị và phơi sáng. | Bằng chứng ứng viên. |
| `AR-AO-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-AO-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-AO-04` | Cửa sổ khả kiến và các exposure có thứ tự cùng sở hữu tính khả thi; ngữ cảnh mục tiêu và thiết bị ràng buộc mọi bước chuỗi. | Bằng chứng quan hệ bắt buộc. |
| `AR-AO-90` | Dominant task là calendar resource scheduler. | Từ chối. |
| `AR-AO-91` | Dominant task là route itinerary. | Từ chối. |
| `AR-AO-92` | Dominant task là generic workflow. | Từ chối. |
| `AR-AO-93` | Dominant task là media timeline. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `astronomical-observation-sequence-planner` khi `AR-AO-01`, `AR-AO-02`, `AR-AO-03` và `AR-AO-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-AO-90` đến `AR-AO-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
observation-planner
└─ proposal-and-target-context
   └─ target-catalog
      └─ sky-and-visibility-windows
         └─ ephemeris-and-constraints
            └─ instrument-configuration
               └─ ordered-exposure-sequence
                  └─ feasibility-and-time-budget
                     └─ validate-and-export
```

- Quan hệ bắt buộc: Cửa sổ khả kiến và các exposure có thứ tự cùng sở hữu tính khả thi; ngữ cảnh mục tiêu và thiết bị ràng buộc mọi bước chuỗi.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `observation-planner` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `proposal-and-target-context` | Sở hữu bằng chứng, trạng thái và action của proposal-and-target-context mà không vay product semantics. | Theo sau `observation-planner` trong semantic order và giữ cùng selection context. |
| `target-catalog` | Sở hữu bằng chứng, trạng thái và action của target-catalog mà không vay product semantics. | Theo sau `proposal-and-target-context` trong semantic order và giữ cùng selection context. |
| `sky-and-visibility-windows` | Sở hữu bằng chứng, trạng thái và action của sky-and-visibility-windows mà không vay product semantics. | Theo sau `target-catalog` trong semantic order và giữ cùng selection context. |
| `ephemeris-and-constraints` | Sở hữu bằng chứng, trạng thái và action của ephemeris-and-constraints mà không vay product semantics. | Theo sau `sky-and-visibility-windows` trong semantic order và giữ cùng selection context. |
| `instrument-configuration` | Sở hữu bằng chứng, trạng thái và action của instrument-configuration mà không vay product semantics. | Theo sau `ephemeris-and-constraints` trong semantic order và giữ cùng selection context. |
| `ordered-exposure-sequence` | Sở hữu bằng chứng, trạng thái và action của ordered-exposure-sequence mà không vay product semantics. | Theo sau `instrument-configuration` trong semantic order và giữ cùng selection context. |
| `feasibility-and-time-budget` | Sở hữu bằng chứng, trạng thái và action của feasibility-and-time-budget mà không vay product semantics. | Theo sau `ordered-exposure-sequence` trong semantic order và giữ cùng selection context. |
| `validate-and-export` | Sở hữu bằng chứng, trạng thái và action của validate-and-export mà không vay product semantics. | Theo sau `feasibility-and-time-budget` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep visibility evidence, target or configuration inspection, and the exposure sequence visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `sky-and-visibility-windows` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Collapse the target catalog while visibility summary and ordered sequence remain primary.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `sky-and-visibility-windows` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use target → visibility window → instrument setup → exposures → feasibility review; move controls replace drag and preserve the selected target.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `sky-and-visibility-windows` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `observation-planner → proposal-and-target-context → target-catalog → sky-and-visibility-windows → ephemeris-and-constraints → instrument-configuration → ordered-exposure-sequence → feasibility-and-time-budget → validate-and-export`.
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
- The fictional sequence fails until exposure time fits the visibility window.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `proposal-and-target-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `target-catalog` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `sky-and-visibility-windows` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `ephemeris-and-constraints` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `instrument-configuration` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `validate-and-export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `validate-and-export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `proposal-and-target-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `validate-and-export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `observation-planner` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: target unavailable, window open, window closed, window partial, weather unknown, instrument invalid, exposure over budget, sequence conflict, validation pending, validation pass, validation fail, export version conflict.

## Ranh giới

### Chấp nhận

- Chấp nhận khi soạn một chuỗi quan sát có thể thực thi dưới các ràng buộc về khả kiến mục tiêu, khí quyển, thiết bị và phơi sáng.
- Chấp nhận khi cửa sổ khả kiến và các exposure có thứ tự cùng sở hữu tính khả thi; ngữ cảnh mục tiêu và thiết bị ràng buộc mọi bước chuỗi.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối calendar resource scheduler; đây là bằng chứng `AR-AO-90` và phải route tới archetype lân cận.
- Từ chối route itinerary; đây là bằng chứng `AR-AO-91` và phải route tới archetype lân cận.
- Từ chối generic workflow; đây là bằng chứng `AR-AO-92` và phải route tới archetype lân cận.
- Từ chối media timeline; đây là bằng chứng `AR-AO-93` và phải route tới archetype lân cận.
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
| [ESO — Observing tools and services](https://www.eso.org/sci/observing/tools.html) | Hỗ trợ visibility, exposure-time, weather, and preparation constraints. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NRAO — Observation Preparation Tool](https://science.nrao.edu/facilities/vla/docs/manuals/opt2010/basics/webapp) | Hỗ trợ ordered scans, instrument resources, and validation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NASA — Models and simulations standard](https://standards.nasa.gov/standard/nasa/nasa-std-7009) | Hỗ trợ independent evidence and constraint records. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ keyboard sequence and responsive focus order. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "astronomical-observation-sequence-planner",
  "situationCodes": ["<matched AR-AO-* codes>"],
  "searchAliases": ["observation sequence","telescope planning","visibility window","exposure plan"],
  "dominantTask": "Compose an executable observation sequence under target visibility, atmospheric, instrument, and exposure constraints.",
  "regions": ["observation-planner","proposal-and-target-context","target-catalog","sky-and-visibility-windows","ephemeris-and-constraints","instrument-configuration","ordered-exposure-sequence","feasibility-and-time-budget","validate-and-export"],
  "regionRelationships": ["Visibility windows and ordered exposures jointly own feasibility; target and instrument context constrain every sequence step."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "observation-planner → proposal-and-target-context → target-catalog → sky-and-visibility-windows → ephemeris-and-constraints → instrument-configuration → ordered-exposure-sequence → feasibility-and-time-budget → validate-and-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "sky-and-visibility-windows",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["target unavailable","window open","window closed","window partial","weather unknown","instrument invalid","exposure over budget","sequence conflict","validation pending","validation pass","validation fail","export version conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

