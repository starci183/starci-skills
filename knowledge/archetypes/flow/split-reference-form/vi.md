# Form đối chiếu reference dạng split

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `split-reference-form` |
| Family | `flow` |
| Nhiệm vụ trội | Nhập dữ liệu trong khi liên tục đối chiếu một source có cấu trúc và stable anchors. |
| Bí danh tìm kiếm | `reference-assisted form`, `side-by-side source entry`, `anchored reference form` |
| Thẩm quyền | Macro topology và behavior contract trung lập sản phẩm. |

### Bất biến

- Archetype chỉ sở hữu dominant task, required regions, quan hệ vùng, responsive transformations, interaction parity và state families.
- Grammar sở hữu product nouns, semantic owners, domain rules và state transitions.
- Principles sở hữu exact geometry, measure, gap, alignment, overflow values và responsive thresholds.
- Direction sở hữu visual character; template chỉ là một realization trung tính và conforming.
- Reading order, DOM order và focus order giữ cùng semantic sequence ở mọi topology.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `SRF-01` | Nhập dữ liệu trong khi liên tục đối chiếu một source có cấu trúc và stable anchors. | tín hiệu dương bắt buộc |
| `SRF-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `SRF-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `SRF-90` | Từ chối short hint, single-question step hoặc list-detail explorer. | từ chối |
| `SRF-91` | Từ chối document reader, generic two-column form hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `SRF-01` và `SRF-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `SRF-90` hoặc `SRF-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
reference-form
├─ task-and-reference-context
├─ reference-source
├─ form-sections
├─ cross-reference-validation
└─ save-and-continue-actions
```

- **Quan hệ dùng chung:** Reference và form dùng chung stable anchors trong khi form sở hữu submission; validation so current reference version với các draft fields tương ứng.
- `reference-form -> task-and-reference-context`: `task-and-reference-context` dùng named context hoặc revision từ `reference-form` và cung cấp explicit return hoặc reconciliation path.
- `task-and-reference-context -> reference-source`: `reference-source` dùng named context hoặc revision từ `task-and-reference-context` và cung cấp explicit return hoặc reconciliation path.
- `reference-source -> form-sections`: `form-sections` dùng named context hoặc revision từ `reference-source` và cung cấp explicit return hoặc reconciliation path.
- `form-sections -> cross-reference-validation`: `cross-reference-validation` dùng named context hoặc revision từ `form-sections` và cung cấp explicit return hoặc reconciliation path.
- `cross-reference-validation -> save-and-continue-actions`: `save-and-continue-actions` dùng named context hoặc revision từ `cross-reference-validation` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `reference-form` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của reference form; child regions không được commit bên ngoài boundary này. |
| `task-and-reference-context` | Sở hữu orientation và immutable basis của task and reference context để qualify mọi downstream decision. |
| `reference-source` | Sở hữu input hoặc decision của reference source và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `form-sections` | Sở hữu input hoặc decision của form sections và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `cross-reference-validation` | Sở hữu derived state của cross reference validation; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `save-and-continue-actions` | Sở hữu input hoặc decision của save and continue actions và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Reference và form đồng hiện; chỉ reference được sở hữu bounded independent scroll cho anchor sync.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Reference thành collapsible rail có current anchor summary trong khi form giữ readable width.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Reference và form thành two-stage views; đóng reference trả về đúng field, anchor và draft value.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `reference-form` → `task-and-reference-context` → `reference-source` → `form-sections` → `cross-reference-validation` → `save-and-continue-actions`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `reference loading` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `reference missing` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `reference stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `version changed` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `anchor selected` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `anchor unresolved` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `form draft` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `validation error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `cross-field mismatch` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `autosave pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `autosave error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `permission unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `focus reference to field` | Chỉ di chuyển focus sau explicit action hoặc failed submit, rồi phục hồi exact trigger cùng semantic context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi structured reference phải liên tục sẵn có trong lúc data entry.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối short hint, single-question step hoặc list-detail explorer.
- Từ chối document reader, generic two-column form hoặc centered task.
- Từ chối khi khác biệt chỉ là product noun, card count, density, color, component hoặc state variation.

### Phán quyết ranh giới

- Mặc định `needs-evidence`; `accept` chỉ hợp lệ theo executable selection rule ở trên.

## Bàn giao

- **Grammar:** Cung cấp product actors, nouns, semantic owners, domain rules, eligibility, transition và consequence.
- **Principles:** Giải quyết exact grid, measure, gap, size, alignment, overflow, sticky offsets và content-driven thresholds.
- **Direction:** Giải quyết visual character mà không thay topology hoặc ownership.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các nguồn dưới đây là bằng chứng so sánh mang tính tham khảo. Chúng không phải product truth, không chọn Grammar owner, không cấp quyền copy geometry hoặc component tree, và không override authority của Source.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [Apple HIG — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Adjacent panes collapse khi từng pane không còn operable. | Không định nghĩa web controls hoặc product semantics. |
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | Question giữ label, answer, Back path và Continue action thành một quan hệ coherent. | Không cấp quyền copy visual treatment của GOV.UK. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Required content reflow mà không tạo page-level two-dimensional scrolling. | Không quy định breakpoint hoặc region geometry. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "split-reference-form",
  "situationCodes": [
    "SRF-01",
    "SRF-02",
    "SRF-03"
  ],
  "searchAliases": [
    "reference-assisted form",
    "side-by-side source entry",
    "anchored reference form"
  ],
  "dominantTask": "Nhập dữ liệu trong khi liên tục đối chiếu một source có cấu trúc và stable anchors.",
  "regions": [
    "reference-form",
    "task-and-reference-context",
    "reference-source",
    "form-sections",
    "cross-reference-validation",
    "save-and-continue-actions"
  ],
  "regionRelationships": [
    "reference-form -> task-and-reference-context",
    "task-and-reference-context -> reference-source",
    "reference-source -> form-sections",
    "form-sections -> cross-reference-validation",
    "cross-reference-validation -> save-and-continue-actions"
  ],
  "responsive": {
    "wide": "Reference và form đồng hiện; chỉ reference được sở hữu bounded independent scroll cho anchor sync.",
    "intermediate": "Reference thành collapsible rail có current anchor summary trong khi form giữ readable width.",
    "compact": "Reference và form thành two-stage views; đóng reference trả về đúng field, anchor và draft value.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "reference-form -> task-and-reference-context -> reference-source -> form-sections -> cross-reference-validation -> save-and-continue-actions",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "reference loading",
    "reference missing",
    "reference stale",
    "version changed",
    "anchor selected",
    "anchor unresolved",
    "form draft",
    "validation error",
    "cross-field mismatch",
    "autosave pending",
    "autosave error",
    "conflict",
    "permission unavailable",
    "focus reference to field"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product actors và nouns",
    "semantic owners",
    "domain rules và transitions"
  ],
  "principlesHandoff": [
    "exact geometry và thresholds",
    "measure và spacing",
    "sticky offsets và overflow values"
  ],
  "confidence": "high",
  "evidence": [
    "dominant-task",
    "region-relationship",
    "responsive-failure",
    "state-family",
    "official-research"
  ]
}
```

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.
