# Cây troubleshooting có hướng dẫn

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `guided-troubleshooting-tree` |
| Family | `flow` |
| Nhiệm vụ trội | Chẩn đoán một vấn đề qua câu hỏi phân nhánh, tích lũy evidence và đi tới resolution hoặc escalation. |
| Bí danh tìm kiếm | `diagnostic question tree`, `guided issue diagnosis`, `branching troubleshooting flow` |
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
| `GTT-01` | Chẩn đoán một vấn đề qua câu hỏi phân nhánh, tích lũy evidence và đi tới resolution hoặc escalation. | tín hiệu dương bắt buộc |
| `GTT-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `GTT-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `GTT-90` | Từ chối FAQ, survey, scored quiz hoặc linear application. | từ chối |
| `GTT-91` | Từ chối arbitrary tree visualization hoặc standalone centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `GTT-01` và `GTT-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `GTT-90` hoặc `GTT-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
troubleshooter
├─ issue-context
├─ current-diagnostic-question
├─ answer-branches
├─ accumulated-evidence-path
├─ recommended-resolution
└─ escalation-and-reset
```

- **Quan hệ dùng chung:** Mỗi answer mở rộng một accumulated evidence path; đổi upstream answer làm invalid downstream evidence; resolution hoặc escalation dùng reviewed path.
- `troubleshooter -> issue-context`: `issue-context` dùng named context hoặc revision từ `troubleshooter` và cung cấp explicit return hoặc reconciliation path.
- `issue-context -> current-diagnostic-question`: `current-diagnostic-question` dùng named context hoặc revision từ `issue-context` và cung cấp explicit return hoặc reconciliation path.
- `current-diagnostic-question -> answer-branches`: `answer-branches` dùng named context hoặc revision từ `current-diagnostic-question` và cung cấp explicit return hoặc reconciliation path.
- `answer-branches -> accumulated-evidence-path`: `accumulated-evidence-path` dùng named context hoặc revision từ `answer-branches` và cung cấp explicit return hoặc reconciliation path.
- `accumulated-evidence-path -> recommended-resolution`: `recommended-resolution` dùng named context hoặc revision từ `accumulated-evidence-path` và cung cấp explicit return hoặc reconciliation path.
- `recommended-resolution -> escalation-and-reset`: `escalation-and-reset` dùng named context hoặc revision từ `recommended-resolution` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `troubleshooter` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của troubleshooter; child regions không được commit bên ngoài boundary này. |
| `issue-context` | Sở hữu orientation và immutable basis của issue context để qualify mọi downstream decision. |
| `current-diagnostic-question` | Sở hữu input hoặc decision của current diagnostic question và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `answer-branches` | Sở hữu input hoặc decision của answer branches và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `accumulated-evidence-path` | Sở hữu durable evidence cùng provenance của accumulated evidence path; vùng này không âm thầm mutate current input owner. |
| `recommended-resolution` | Sở hữu input hoặc decision của recommended resolution và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `escalation-and-reset` | Sở hữu input hoặc decision của escalation and reset và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Current question là primary; known facts có thể hỗ trợ mà không tiết lộ future branches gây nhiễu.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Evidence path thành summary disclosure trong khi current question giữ toàn readable width.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Một diagnostic step sở hữu screen; Back phục hồi đúng branch answer và resolution vẫn có review cùng reset.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `troubleshooter` → `issue-context` → `current-diagnostic-question` → `answer-branches` → `accumulated-evidence-path` → `recommended-resolution` → `escalation-and-reset`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `no issue selected` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `branch loading` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `invalid answer` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `contradictory answer` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `dead end` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `insufficient evidence` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `resolution available` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `resolution failed` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `escalation unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `escalation pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `knowledge stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `reset confirmation` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi mỗi answer chọn diagnostic question kế tiếp và accumulated path điều khiển resolution.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối FAQ, survey, scored quiz hoặc linear application.
- Từ chối arbitrary tree visualization hoặc standalone centered task.
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
| [W3C WAI-ARIA APG — Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Collapsed evidence path giữ explicit keyboard activation cùng expanded state. | Nguồn này không định nghĩa diagnostic branches hoặc resolution truth. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "guided-troubleshooting-tree",
  "situationCodes": [
    "GTT-01",
    "GTT-02",
    "GTT-03"
  ],
  "searchAliases": [
    "diagnostic question tree",
    "guided issue diagnosis",
    "branching troubleshooting flow"
  ],
  "dominantTask": "Chẩn đoán một vấn đề qua câu hỏi phân nhánh, tích lũy evidence và đi tới resolution hoặc escalation.",
  "regions": [
    "troubleshooter",
    "issue-context",
    "current-diagnostic-question",
    "answer-branches",
    "accumulated-evidence-path",
    "recommended-resolution",
    "escalation-and-reset"
  ],
  "regionRelationships": [
    "troubleshooter -> issue-context",
    "issue-context -> current-diagnostic-question",
    "current-diagnostic-question -> answer-branches",
    "answer-branches -> accumulated-evidence-path",
    "accumulated-evidence-path -> recommended-resolution",
    "recommended-resolution -> escalation-and-reset"
  ],
  "responsive": {
    "wide": "Current question là primary; known facts có thể hỗ trợ mà không tiết lộ future branches gây nhiễu.",
    "intermediate": "Evidence path thành summary disclosure trong khi current question giữ toàn readable width.",
    "compact": "Một diagnostic step sở hữu screen; Back phục hồi đúng branch answer và resolution vẫn có review cùng reset.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "troubleshooter -> issue-context -> current-diagnostic-question -> answer-branches -> accumulated-evidence-path -> recommended-resolution -> escalation-and-reset",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "no issue selected",
    "branch loading",
    "invalid answer",
    "contradictory answer",
    "dead end",
    "insufficient evidence",
    "resolution available",
    "resolution failed",
    "escalation unavailable",
    "escalation pending",
    "knowledge stale",
    "reset confirmation"
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
