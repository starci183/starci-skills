# Checklist setup có hướng dẫn

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `guided-setup-checklist` |
| Family | `flow` |
| Nhiệm vụ trội | Hoàn thành và verify một cấu hình qua các bước biết prerequisite, instructions, verification và unblock paths. |
| Bí danh tìm kiếm | `verified setup guide`, `configuration checklist`, `setup step verifier` |
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
| `GSC-01` | Hoàn thành và verify một cấu hình qua các bước biết prerequisite, instructions, verification và unblock paths. | tín hiệu dương bắt buộc |
| `GSC-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `GSC-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `GSC-90` | Từ chối application task list hoặc linear form wizard. | từ chối |
| `GSC-91` | Từ chối formal gated record, static instructions hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `GSC-01` và `GSC-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `GSC-90` hoặc `GSC-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
setup-guide
├─ setup-goal-and-prerequisites
├─ setup-step-list
├─ current-step-instructions
├─ verification-result
├─ unblock-help
└─ completion
```

- **Quan hệ dùng chung:** Prerequisites gate các bước có thể truy cập; current instructions sở hữu setup action đang thử; verification, không phải tự đánh dấu, sở hữu completed status.
- `setup-guide -> setup-goal-and-prerequisites`: `setup-goal-and-prerequisites` dùng named context hoặc revision từ `setup-guide` và cung cấp explicit return hoặc reconciliation path.
- `setup-goal-and-prerequisites -> setup-step-list`: `setup-step-list` dùng named context hoặc revision từ `setup-goal-and-prerequisites` và cung cấp explicit return hoặc reconciliation path.
- `setup-step-list -> current-step-instructions`: `current-step-instructions` dùng named context hoặc revision từ `setup-step-list` và cung cấp explicit return hoặc reconciliation path.
- `current-step-instructions -> verification-result`: `verification-result` dùng named context hoặc revision từ `current-step-instructions` và cung cấp explicit return hoặc reconciliation path.
- `verification-result -> unblock-help`: `unblock-help` dùng named context hoặc revision từ `verification-result` và cung cấp explicit return hoặc reconciliation path.
- `unblock-help -> completion`: `completion` dùng named context hoặc revision từ `unblock-help` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `setup-guide` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của setup guide; child regions không được commit bên ngoài boundary này. |
| `setup-goal-and-prerequisites` | Sở hữu orientation và immutable basis của setup goal and prerequisites để qualify mọi downstream decision. |
| `setup-step-list` | Sở hữu input hoặc decision của setup step list và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `current-step-instructions` | Sở hữu input hoặc decision của current step instructions và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `verification-result` | Sở hữu derived state của verification result; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `unblock-help` | Sở hữu recovery route của unblock help và giữ exact state, trigger cùng return position. |
| `completion` | Sở hữu commitment boundary của completion và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Step list và current instructions đồng hiện trong khi verification sở hữu completion.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Step list thành compact summary trong khi current instructions, Verify và failure help vẫn ở cùng nhau.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Step list là overview screen còn current step là task screen có đường quay lại đúng status.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `setup-guide` → `setup-goal-and-prerequisites` → `setup-step-list` → `current-step-instructions` → `verification-result` → `unblock-help` → `completion`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `prerequisite missing` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `not started` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `current` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `completed` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `skipped` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `not applicable` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `verification pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `verification pass` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `verification fail` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `external dependency unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `stale verification` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `retry` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `permission unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `completion` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi completion được chứng minh bằng verification thay vì self-declared checkbox.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối application task list hoặc linear form wizard.
- Từ chối formal gated record, static instructions hoặc centered task.
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
| [U.S. Web Design System — Process list](https://designsystem.digital.gov/components/process-list/) | Sequence có thể hiện ordered stages và explanatory state. | Không chứng minh process do user control. |
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context có thể orient mà không trở thành arbitrary navigation. | Không định nghĩa process authority hoặc responsive geometry. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Task status và progress controls cần visible, operable state. | Không định nghĩa setup prerequisites hoặc verification. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "guided-setup-checklist",
  "situationCodes": [
    "GSC-01",
    "GSC-02",
    "GSC-03"
  ],
  "searchAliases": [
    "verified setup guide",
    "configuration checklist",
    "setup step verifier"
  ],
  "dominantTask": "Hoàn thành và verify một cấu hình qua các bước biết prerequisite, instructions, verification và unblock paths.",
  "regions": [
    "setup-guide",
    "setup-goal-and-prerequisites",
    "setup-step-list",
    "current-step-instructions",
    "verification-result",
    "unblock-help",
    "completion"
  ],
  "regionRelationships": [
    "setup-guide -> setup-goal-and-prerequisites",
    "setup-goal-and-prerequisites -> setup-step-list",
    "setup-step-list -> current-step-instructions",
    "current-step-instructions -> verification-result",
    "verification-result -> unblock-help",
    "unblock-help -> completion"
  ],
  "responsive": {
    "wide": "Step list và current instructions đồng hiện trong khi verification sở hữu completion.",
    "intermediate": "Step list thành compact summary trong khi current instructions, Verify và failure help vẫn ở cùng nhau.",
    "compact": "Step list là overview screen còn current step là task screen có đường quay lại đúng status.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "setup-guide -> setup-goal-and-prerequisites -> setup-step-list -> current-step-instructions -> verification-result -> unblock-help -> completion",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "prerequisite missing",
    "not started",
    "current",
    "completed",
    "skipped",
    "not applicable",
    "verification pending",
    "verification pass",
    "verification fail",
    "external dependency unavailable",
    "stale verification",
    "retry",
    "permission unavailable",
    "completion"
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
