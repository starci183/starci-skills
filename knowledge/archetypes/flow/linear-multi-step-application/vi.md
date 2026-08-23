# Hồ sơ nhiều bước tuyến tính

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `linear-multi-step-application` |
| Family | `flow` |
| Nhiệm vụ trội | Hoàn thành một hồ sơ dài có thứ tự section ổn định trong khi giữ progress, draft và đường quay lại. |
| Bí danh tìm kiếm | `linear application`, `fixed-step form`, `chaptered application` |
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
| `LMA-01` | Hoàn thành một hồ sơ dài có thứ tự section ổn định trong khi giữ progress, draft và đường quay lại. | tín hiệu dương bắt buộc |
| `LMA-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `LMA-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `LMA-90` | Từ chối task completion theo thứ tự linh hoạt và flow ngắn hơn ba section. | từ chối |
| `LMA-91` | Từ chối quiz, centered task hoặc multi-session task list. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `LMA-01` và `LMA-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `LMA-90` hoặc `LMA-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
linear-application
├─ application-context
├─ step-progress
├─ current-section
├─ question-sequence
├─ back-save-continue-actions
└─ persistent-help
```

- **Quan hệ dùng chung:** Step indicator báo các chapter cố định thay vì navigation tùy ý; current question sequence sở hữu edits; Back, save và Continue giữ một ordered draft.
- `linear-application -> application-context`: `application-context` dùng named context hoặc revision từ `linear-application` và cung cấp explicit return hoặc reconciliation path.
- `application-context -> step-progress`: `step-progress` dùng named context hoặc revision từ `application-context` và cung cấp explicit return hoặc reconciliation path.
- `step-progress -> current-section`: `current-section` dùng named context hoặc revision từ `step-progress` và cung cấp explicit return hoặc reconciliation path.
- `current-section -> question-sequence`: `question-sequence` dùng named context hoặc revision từ `current-section` và cung cấp explicit return hoặc reconciliation path.
- `question-sequence -> back-save-continue-actions`: `back-save-continue-actions` dùng named context hoặc revision từ `question-sequence` và cung cấp explicit return hoặc reconciliation path.
- `back-save-continue-actions -> persistent-help`: `persistent-help` dùng named context hoặc revision từ `back-save-continue-actions` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `linear-application` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của linear application; child regions không được commit bên ngoài boundary này. |
| `application-context` | Sở hữu orientation và immutable basis của application context để qualify mọi downstream decision. |
| `step-progress` | Sở hữu derived state của step progress; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `current-section` | Sở hữu input hoặc decision của current section và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `question-sequence` | Sở hữu input hoặc decision của question sequence và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `back-save-continue-actions` | Sở hữu input hoặc decision của back save continue actions và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `persistent-help` | Sở hữu recovery route của persistent help và giữ exact state, trigger cùng return position. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Labeled step indicator đứng trước narrow form column; các section không trở thành form song song.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Step labels rút còn chapter names vẫn phân biệt được trong khi form giữ readable measure và action order.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Progress chuyển thành Step n of m và một coherent question group giữ vai trò chính mà không cần horizontal step scroller.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `linear-application` → `application-context` → `step-progress` → `current-section` → `question-sequence` → `back-save-continue-actions` → `persistent-help`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `initial` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `resumed` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `chapter complete` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `chapter current` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `chapter upcoming` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `conditional branch` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `draft saving` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `draft saved/error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `timeout warning` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `stale answer dependency` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `submit handoff` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng cho ba section fixed-order trở lên cần save và return.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối task completion theo thứ tự linh hoạt và flow ngắn hơn ba section.
- Từ chối quiz, centered task hoặc multi-session task list.
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
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transaction giữ progress, review và recovery. | Không định nghĩa product workflow hoặc fixed step count. |
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | Question giữ label, answer, Back path và Continue action thành một quan hệ coherent. | Không cấp quyền copy visual treatment của GOV.UK. |
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context có thể orient mà không trở thành arbitrary navigation. | Không định nghĩa process authority hoặc responsive geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "linear-multi-step-application",
  "situationCodes": [
    "LMA-01",
    "LMA-02",
    "LMA-03"
  ],
  "searchAliases": [
    "linear application",
    "fixed-step form",
    "chaptered application"
  ],
  "dominantTask": "Hoàn thành một hồ sơ dài có thứ tự section ổn định trong khi giữ progress, draft và đường quay lại.",
  "regions": [
    "linear-application",
    "application-context",
    "step-progress",
    "current-section",
    "question-sequence",
    "back-save-continue-actions",
    "persistent-help"
  ],
  "regionRelationships": [
    "linear-application -> application-context",
    "application-context -> step-progress",
    "step-progress -> current-section",
    "current-section -> question-sequence",
    "question-sequence -> back-save-continue-actions",
    "back-save-continue-actions -> persistent-help"
  ],
  "responsive": {
    "wide": "Labeled step indicator đứng trước narrow form column; các section không trở thành form song song.",
    "intermediate": "Step labels rút còn chapter names vẫn phân biệt được trong khi form giữ readable measure và action order.",
    "compact": "Progress chuyển thành Step n of m và một coherent question group giữ vai trò chính mà không cần horizontal step scroller.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "linear-application -> application-context -> step-progress -> current-section -> question-sequence -> back-save-continue-actions -> persistent-help",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "initial",
    "resumed",
    "chapter complete",
    "chapter current",
    "chapter upcoming",
    "conditional branch",
    "draft saving",
    "draft saved/error",
    "timeout warning",
    "stale answer dependency",
    "submit handoff"
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
