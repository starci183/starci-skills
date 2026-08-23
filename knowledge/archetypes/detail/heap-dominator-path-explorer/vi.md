# Trình khám phá dominator heap và đường tới root

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `heap-dominator-path-explorer` |
| Nhóm | Detail |
| Tác vụ chi phối | Tìm nguyên nhân object còn được giữ lại bằng cách theo dominator và đường tham chiếu ngược về garbage-collection root. |
| Bí danh tìm kiếm | `heap dominator`, `retained objects`, `GC root path`, `memory leak` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Quan hệ dominator và khả năng tới root là các owner toán học; bằng chứng retained size luôn gắn với đường object được chọn.
- Region graph bắt buộc giữ nguyên `heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Dominator relation and path-to-root evidence are mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-HD-01` | Dominant task là: Tìm nguyên nhân object còn được giữ lại bằng cách theo dominator và đường tham chiếu ngược về garbage-collection root. | Bằng chứng ứng viên. |
| `AR-HD-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-HD-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-HD-04` | Quan hệ dominator và khả năng tới root là các owner toán học; bằng chứng retained size luôn gắn với đường object được chọn. | Bằng chứng quan hệ bắt buộc. |
| `AR-HD-90` | Dominant task là dependency topology monitor. | Từ chối. |
| `AR-HD-91` | Dominant task là generic hierarchy explorer. | Từ chối. |
| `AR-HD-92` | Dominant task là memory chart. | Từ chối. |
| `AR-HD-93` | Dominant task là record detail. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `heap-dominator-path-explorer` khi `AR-HD-01`, `AR-HD-02`, `AR-HD-03` và `AR-HD-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-HD-90` đến `AR-HD-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
heap-explorer
└─ snapshot-and-runtime-context
   └─ class-and-size-summary
      └─ dominator-tree
         └─ retained-size-view
            └─ reference-paths-to-roots
               └─ selected-object-fields
                  └─ snapshot-comparison-and-leak-suspects
```

- Quan hệ bắt buộc: Quan hệ dominator và khả năng tới root là các owner toán học; bằng chứng retained size luôn gắn với đường object được chọn.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `heap-explorer` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `snapshot-and-runtime-context` | Sở hữu bằng chứng, trạng thái và action của snapshot-and-runtime-context mà không vay product semantics. | Theo sau `heap-explorer` trong semantic order và giữ cùng selection context. |
| `class-and-size-summary` | Sở hữu bằng chứng, trạng thái và action của class-and-size-summary mà không vay product semantics. | Theo sau `snapshot-and-runtime-context` trong semantic order và giữ cùng selection context. |
| `dominator-tree` | Sở hữu bằng chứng, trạng thái và action của dominator-tree mà không vay product semantics. | Theo sau `class-and-size-summary` trong semantic order và giữ cùng selection context. |
| `retained-size-view` | Sở hữu bằng chứng, trạng thái và action của retained-size-view mà không vay product semantics. | Theo sau `dominator-tree` trong semantic order và giữ cùng selection context. |
| `reference-paths-to-roots` | Sở hữu bằng chứng, trạng thái và action của reference-paths-to-roots mà không vay product semantics. | Theo sau `retained-size-view` trong semantic order và giữ cùng selection context. |
| `selected-object-fields` | Sở hữu bằng chứng, trạng thái và action của selected-object-fields mà không vay product semantics. | Theo sau `reference-paths-to-roots` trong semantic order và giữ cùng selection context. |
| `snapshot-comparison-and-leak-suspects` | Sở hữu bằng chứng, trạng thái và action của snapshot-comparison-and-leak-suspects mà không vay product semantics. | Theo sau `selected-object-fields` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the dominator tree, root path, and object detail visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `dominator-tree` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make suspect ranking and root path primary while object detail becomes a drawer.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `dominator-tree` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use leak suspects → selected dominator path → root references → object fields → snapshot delta.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `dominator-tree` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects`.
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
- The fictional suspect remains linked to its dominator and exact GC-root path.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `snapshot-and-runtime-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `class-and-size-summary` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `dominator-tree` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `retained-size-view` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `reference-paths-to-roots` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `snapshot-comparison-and-leak-suspects` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `snapshot-comparison-and-leak-suspects` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `snapshot-and-runtime-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `snapshot-comparison-and-leak-suspects` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `heap-explorer` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: snapshot loading, snapshot corrupt, class grouped, object selected, object collected, root path found, root paths multiple, root path missing, retained size calculating, suspect confirmed, suspect dismissed, comparison unavailable.

## Ranh giới

### Chấp nhận

- Chấp nhận khi tìm nguyên nhân object còn được giữ lại bằng cách theo dominator và đường tham chiếu ngược về garbage-collection root.
- Chấp nhận khi quan hệ dominator và khả năng tới root là các owner toán học; bằng chứng retained size luôn gắn với đường object được chọn.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối dependency topology monitor; đây là bằng chứng `AR-HD-90` và phải route tới archetype lân cận.
- Từ chối generic hierarchy explorer; đây là bằng chứng `AR-HD-91` và phải route tới archetype lân cận.
- Từ chối memory chart; đây là bằng chứng `AR-HD-92` và phải route tới archetype lân cận.
- Từ chối record detail; đây là bằng chứng `AR-HD-93` và phải route tới archetype lân cận.
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
| [Chrome DevTools — Memory terminology](https://developer.chrome.com/docs/devtools/memory-problems/get-started) | Hỗ trợ retained size, dominators, and heap terminology. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Eclipse MAT — Dominator Tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html) | Hỗ trợ independent dominator-tree semantics. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Mozilla — Firefox Profiler documentation](https://profiler.firefox.com/docs/) | Hỗ trợ independent runtime profiling context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ deterministic keyboard access to hierarchy plus tabular evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "heap-dominator-path-explorer",
  "situationCodes": ["<matched AR-HD-* codes>"],
  "searchAliases": ["heap dominator","retained objects","GC root path","memory leak"],
  "dominantTask": "Find why objects remain retained by following dominators and reference paths back to garbage-collection roots.",
  "regions": ["heap-explorer","snapshot-and-runtime-context","class-and-size-summary","dominator-tree","retained-size-view","reference-paths-to-roots","selected-object-fields","snapshot-comparison-and-leak-suspects"],
  "regionRelationships": ["Dominator relations and root reachability are mathematical owners; retained-size evidence remains attached to the selected object path."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "dominator-tree",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["snapshot loading","snapshot corrupt","class grouped","object selected","object collected","root path found","root paths multiple","root path missing","retained size calculating","suspect confirmed","suspect dismissed","comparison unavailable"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

