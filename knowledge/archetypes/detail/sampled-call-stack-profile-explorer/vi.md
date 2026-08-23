# Trình khám phá profile call stack lấy mẫu

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `sampled-call-stack-profile-explorer` |
| Nhóm | Detail |
| Tác vụ chi phối | Định vị chi phí CPU tổng hợp bằng cách nối stack lấy mẫu, hình học flame, caller bottom-up và frame source. |
| Bí danh tìm kiếm | `CPU profile`, `sampled stacks`, `flame graph`, `bottom-up callers` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Mẫu tổng hợp và prefix stack dùng chung sở hữu bằng chứng; frame được chọn tồn tại xuyên qua các biểu diễn flame, call-tree, bottom-up và source.
- Region graph bắt buộc giữ nguyên `profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Aggregate sampled stacks and caller or callee paths are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-CP-01` | Dominant task là: Định vị chi phí CPU tổng hợp bằng cách nối stack lấy mẫu, hình học flame, caller bottom-up và frame source. | Bằng chứng ứng viên. |
| `AR-CP-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-CP-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-CP-04` | Mẫu tổng hợp và prefix stack dùng chung sở hữu bằng chứng; frame được chọn tồn tại xuyên qua các biểu diễn flame, call-tree, bottom-up và source. | Bằng chứng quan hệ bắt buộc. |
| `AR-CP-90` | Dominant task là distributed trace. | Từ chối. |
| `AR-CP-91` | Dominant task là streaming log console. | Từ chối. |
| `AR-CP-92` | Dominant task là query plan. | Từ chối. |
| `AR-CP-93` | Dominant task là generic chart dashboard. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `sampled-call-stack-profile-explorer` khi `AR-CP-01`, `AR-CP-02`, `AR-CP-03` và `AR-CP-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-CP-90` đến `AR-CP-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
profile-explorer
└─ profile-and-workload-context
   └─ flame-graph
      └─ call-tree-and-bottom-up-table
         └─ thread-and-category-navigation
            └─ selected-frame-source
               └─ sample-distribution
                  └─ baseline-comparison
```

- Quan hệ bắt buộc: Mẫu tổng hợp và prefix stack dùng chung sở hữu bằng chứng; frame được chọn tồn tại xuyên qua các biểu diễn flame, call-tree, bottom-up và source.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `profile-explorer` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `profile-and-workload-context` | Sở hữu bằng chứng, trạng thái và action của profile-and-workload-context mà không vay product semantics. | Theo sau `profile-explorer` trong semantic order và giữ cùng selection context. |
| `flame-graph` | Sở hữu bằng chứng, trạng thái và action của flame-graph mà không vay product semantics. | Theo sau `profile-and-workload-context` trong semantic order và giữ cùng selection context. |
| `call-tree-and-bottom-up-table` | Sở hữu bằng chứng, trạng thái và action của call-tree-and-bottom-up-table mà không vay product semantics. | Theo sau `flame-graph` trong semantic order và giữ cùng selection context. |
| `thread-and-category-navigation` | Sở hữu bằng chứng, trạng thái và action của thread-and-category-navigation mà không vay product semantics. | Theo sau `call-tree-and-bottom-up-table` trong semantic order và giữ cùng selection context. |
| `selected-frame-source` | Sở hữu bằng chứng, trạng thái và action của selected-frame-source mà không vay product semantics. | Theo sau `thread-and-category-navigation` trong semantic order và giữ cùng selection context. |
| `sample-distribution` | Sở hữu bằng chứng, trạng thái và action của sample-distribution mà không vay product semantics. | Theo sau `selected-frame-source` trong semantic order và giữ cùng selection context. |
| `baseline-comparison` | Sở hữu bằng chứng, trạng thái và action của baseline-comparison mà không vay product semantics. | Theo sau `sample-distribution` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the flame graph, call table, and source or detail visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `flame-graph` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make the flame graph primary; alternate call and source while the selected stack persists.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `flame-graph` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use hot-functions list → caller or callee path → source frame → distribution or baseline; make flame view optional full-screen.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `flame-graph` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison`.
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
- The fictional hotspot preserves the same frame across flame, call, bottom-up, and source views.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `profile-and-workload-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `flame-graph` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `call-tree-and-bottom-up-table` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `thread-and-category-navigation` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `selected-frame-source` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `baseline-comparison` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `baseline-comparison` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `profile-and-workload-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `baseline-comparison` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `profile-explorer` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: profile loading, profile partial, thread hidden, frame selected, frame inlined, frame unknown, samples aggregating, hotspot filtered, baseline missing, baseline regressed, baseline improved, source unavailable.

## Ranh giới

### Chấp nhận

- Chấp nhận khi định vị chi phí CPU tổng hợp bằng cách nối stack lấy mẫu, hình học flame, caller bottom-up và frame source.
- Chấp nhận khi mẫu tổng hợp và prefix stack dùng chung sở hữu bằng chứng; frame được chọn tồn tại xuyên qua các biểu diễn flame, call-tree, bottom-up và source.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối distributed trace; đây là bằng chứng `AR-CP-90` và phải route tới archetype lân cận.
- Từ chối streaming log console; đây là bằng chứng `AR-CP-91` và phải route tới archetype lân cận.
- Từ chối query plan; đây là bằng chứng `AR-CP-92` và phải route tới archetype lân cận.
- Từ chối generic chart dashboard; đây là bằng chứng `AR-CP-93` và phải route tới archetype lân cận.
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
| [Chrome DevTools — Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) | Hỗ trợ flame charts, call trees, and performance evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Mozilla — Firefox Profiler documentation](https://profiler.firefox.com/docs/) | Hỗ trợ independent sampled-profile and stack analysis. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Eclipse MAT — Dominator Tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html) | Hỗ trợ independent hierarchy and retained-path contrast. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ aggregation and view-change announcements without focus loss. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "sampled-call-stack-profile-explorer",
  "situationCodes": ["<matched AR-CP-* codes>"],
  "searchAliases": ["CPU profile","sampled stacks","flame graph","bottom-up callers"],
  "dominantTask": "Locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers, and source frames.",
  "regions": ["profile-explorer","profile-and-workload-context","flame-graph","call-tree-and-bottom-up-table","thread-and-category-navigation","selected-frame-source","sample-distribution","baseline-comparison"],
  "regionRelationships": ["Aggregated samples and shared stack prefixes own the evidence; the selected frame persists across flame, call-tree, bottom-up, and source representations."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "profile-explorer → profile-and-workload-context → flame-graph → call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "flame-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["profile loading","profile partial","thread hidden","frame selected","frame inlined","frame unknown","samples aggregating","hotspot filtered","baseline missing","baseline regressed","baseline improved","source unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

