# Bước một câu hỏi

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `single-question-step` |
| Family | `flow` |
| Nhiệm vụ trội | Trả lời đúng một câu hỏi trong transaction và tiếp tục trong khi vẫn giữ đường quay lại đáng tin cậy. |
| Bí danh tìm kiếm | `one question per page`, `transaction question step`, `single answer step` |
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
| `SQS-01` | Trả lời đúng một câu hỏi trong transaction và tiếp tục trong khi vẫn giữ đường quay lại đáng tin cậy. | tín hiệu dương bắt buộc |
| `SQS-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `SQS-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `SQS-90` | Từ chối standalone centered single task hoặc nhiều câu hỏi độc lập. | từ chối |
| `SQS-91` | Từ chối application overview, assessment navigator hoặc settings editor. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `SQS-01` và `SQS-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `SQS-90` hoặc `SQS-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
question-step
├─ return-navigation
├─ section-and-progress-context
├─ question-label-and-instructions
├─ answer-control
├─ progression-actions
└─ contextual-help
```

- **Quan hệ dùng chung:** Label hoặc legend sở hữu answer về semantic; progress chỉ định hướng transaction; Back và Continue giữ cùng answer revision và browser-history path.
- `question-step -> return-navigation`: `return-navigation` dùng named context hoặc revision từ `question-step` và cung cấp explicit return hoặc reconciliation path.
- `return-navigation -> section-and-progress-context`: `section-and-progress-context` dùng named context hoặc revision từ `return-navigation` và cung cấp explicit return hoặc reconciliation path.
- `section-and-progress-context -> question-label-and-instructions`: `question-label-and-instructions` dùng named context hoặc revision từ `section-and-progress-context` và cung cấp explicit return hoặc reconciliation path.
- `question-label-and-instructions -> answer-control`: `answer-control` dùng named context hoặc revision từ `question-label-and-instructions` và cung cấp explicit return hoặc reconciliation path.
- `answer-control -> progression-actions`: `progression-actions` dùng named context hoặc revision từ `answer-control` và cung cấp explicit return hoặc reconciliation path.
- `progression-actions -> contextual-help`: `contextual-help` dùng named context hoặc revision từ `progression-actions` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `question-step` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của question step; child regions không được commit bên ngoài boundary này. |
| `return-navigation` | Sở hữu input hoặc decision của return navigation và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `section-and-progress-context` | Sở hữu derived state của section and progress context; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `question-label-and-instructions` | Sở hữu input hoặc decision của question label and instructions và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `answer-control` | Sở hữu input hoặc decision của answer control và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `progression-actions` | Sở hữu derived state của progression actions; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `contextual-help` | Sở hữu recovery route của contextual help và giữ exact state, trigger cùng return position. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Form nằm trong một readable column; progress hỗ trợ orientation nhưng không cạnh tranh với question, và help chỉ đồng hiện khi vẫn gắn với input liên quan.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Supporting help chuyển xuống sau answer control hoặc thành disclosure kế cận mà không tạo second form pane.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Question, hint, answer và Continue tạo một sequence không gián đoạn; Back giữ answer đã chọn.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `question-step` → `return-navigation` → `section-and-progress-context` → `question-label-and-instructions` → `answer-control` → `progression-actions` → `contextual-help`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `unanswered` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `prefilled` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `conditional reveal` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `validation pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `validation error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `saved draft` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `stale carried-forward answer` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `permission unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `continue pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `continued` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi đúng một semantic question sở hữu bước transaction hiện tại.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối standalone centered single task hoặc nhiều câu hỏi độc lập.
- Từ chối application overview, assessment navigator hoặc settings editor.
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
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | Question giữ label, answer, Back path và Continue action thành một quan hệ coherent. | Không cấp quyền copy visual treatment của GOV.UK. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transaction giữ progress, review và recovery. | Không định nghĩa product workflow hoặc fixed step count. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "single-question-step",
  "situationCodes": [
    "SQS-01",
    "SQS-02",
    "SQS-03"
  ],
  "searchAliases": [
    "one question per page",
    "transaction question step",
    "single answer step"
  ],
  "dominantTask": "Trả lời đúng một câu hỏi trong transaction và tiếp tục trong khi vẫn giữ đường quay lại đáng tin cậy.",
  "regions": [
    "question-step",
    "return-navigation",
    "section-and-progress-context",
    "question-label-and-instructions",
    "answer-control",
    "progression-actions",
    "contextual-help"
  ],
  "regionRelationships": [
    "question-step -> return-navigation",
    "return-navigation -> section-and-progress-context",
    "section-and-progress-context -> question-label-and-instructions",
    "question-label-and-instructions -> answer-control",
    "answer-control -> progression-actions",
    "progression-actions -> contextual-help"
  ],
  "responsive": {
    "wide": "Form nằm trong một readable column; progress hỗ trợ orientation nhưng không cạnh tranh với question, và help chỉ đồng hiện khi vẫn gắn với input liên quan.",
    "intermediate": "Supporting help chuyển xuống sau answer control hoặc thành disclosure kế cận mà không tạo second form pane.",
    "compact": "Question, hint, answer và Continue tạo một sequence không gián đoạn; Back giữ answer đã chọn.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "question-step -> return-navigation -> section-and-progress-context -> question-label-and-instructions -> answer-control -> progression-actions -> contextual-help",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "unanswered",
    "prefilled",
    "conditional reveal",
    "validation pending",
    "validation error",
    "saved draft",
    "stale carried-forward answer",
    "permission unavailable",
    "continue pending",
    "continued"
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
