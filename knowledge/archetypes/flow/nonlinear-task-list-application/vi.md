# Hồ sơ dạng danh sách task phi tuyến

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `nonlinear-task-list-application` |
| Family | `flow` |
| Nhiệm vụ trội | Lập kế hoạch, hoàn thành và tiếp tục nhiều task theo thứ tự linh hoạt qua nhiều phiên trong khi tôn trọng dependencies rõ ràng. |
| Bí danh tìm kiếm | `application task list`, `flexible section completion`, `multi-session task application` |
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
| `NTA-01` | Lập kế hoạch, hoàn thành và tiếp tục nhiều task theo thứ tự linh hoạt qua nhiều phiên trong khi tôn trọng dependencies rõ ràng. | tín hiệu dương bắt buộc |
| `NTA-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `NTA-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `NTA-90` | Từ chối fixed linear sequence hoặc operations dashboard. | từ chối |
| `NTA-91` | Từ chối guided technical setup, settings hub hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `NTA-01` và `NTA-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `NTA-90` hoặc `NTA-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
task-application
├─ transaction-context
├─ overall-progress
├─ grouped-task-lists
├─ task-status-and-dependencies
├─ final-submit-readiness
└─ help
```

- **Quan hệ dùng chung:** Mỗi task name, status và dependency là một semantic unit; overall progress được suy ra từ các unit đó; final readiness chỉ được suy ra từ required task outcomes.
- `task-application -> transaction-context`: `transaction-context` dùng named context hoặc revision từ `task-application` và cung cấp explicit return hoặc reconciliation path.
- `transaction-context -> overall-progress`: `overall-progress` dùng named context hoặc revision từ `transaction-context` và cung cấp explicit return hoặc reconciliation path.
- `overall-progress -> grouped-task-lists`: `grouped-task-lists` dùng named context hoặc revision từ `overall-progress` và cung cấp explicit return hoặc reconciliation path.
- `grouped-task-lists -> task-status-and-dependencies`: `task-status-and-dependencies` dùng named context hoặc revision từ `grouped-task-lists` và cung cấp explicit return hoặc reconciliation path.
- `task-status-and-dependencies -> final-submit-readiness`: `final-submit-readiness` dùng named context hoặc revision từ `task-status-and-dependencies` và cung cấp explicit return hoặc reconciliation path.
- `final-submit-readiness -> help`: `help` dùng named context hoặc revision từ `final-submit-readiness` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `task-application` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của task application; child regions không được commit bên ngoài boundary này. |
| `transaction-context` | Sở hữu orientation và immutable basis của transaction context để qualify mọi downstream decision. |
| `overall-progress` | Sở hữu derived state của overall progress; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `grouped-task-lists` | Sở hữu input hoặc decision của grouped task lists và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `task-status-and-dependencies` | Sở hữu derived state của task status and dependencies; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `final-submit-readiness` | Sở hữu derived state của final submit readiness; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `help` | Sở hữu recovery route của help và giữ exact state, trigger cùng return position. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Grouped task lists giữ task name, hint và status trong cùng primary content column.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Status có thể wrap dưới task name nhưng vẫn thuộc cùng semantic task unit.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Một cột giữ group, task, status, locked reason và next available task trước readiness.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `task-application` → `transaction-context` → `overall-progress` → `grouped-task-lists` → `task-status-and-dependencies` → `final-submit-readiness` → `help`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `not started` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `in progress` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `completed` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `cannot start` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `not applicable` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `dependency locked` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `section stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `returning session` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `readiness blocked` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `submit pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `submit conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi các section bắt buộc có thể hoàn thành theo nhiều thứ tự hợp lệ qua nhiều phiên.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối fixed linear sequence hoặc operations dashboard.
- Từ chối guided technical setup, settings hub hoặc centered task.
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
| [GOV.UK Design System — Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) | Flexible task completion hiện status và readiness qua nhiều phiên. | Không định nghĩa product dependencies. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transaction giữ progress, review và recovery. | Không định nghĩa product workflow hoặc fixed step count. |
| [NHS service manual — Check answers](https://service-manual.nhs.uk/design-system/patterns/check-answers) | Review giữ answer-to-change association trước submission. | Không định nghĩa product truth ngoài domain của nguồn. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "nonlinear-task-list-application",
  "situationCodes": [
    "NTA-01",
    "NTA-02",
    "NTA-03"
  ],
  "searchAliases": [
    "application task list",
    "flexible section completion",
    "multi-session task application"
  ],
  "dominantTask": "Lập kế hoạch, hoàn thành và tiếp tục nhiều task theo thứ tự linh hoạt qua nhiều phiên trong khi tôn trọng dependencies rõ ràng.",
  "regions": [
    "task-application",
    "transaction-context",
    "overall-progress",
    "grouped-task-lists",
    "task-status-and-dependencies",
    "final-submit-readiness",
    "help"
  ],
  "regionRelationships": [
    "task-application -> transaction-context",
    "transaction-context -> overall-progress",
    "overall-progress -> grouped-task-lists",
    "grouped-task-lists -> task-status-and-dependencies",
    "task-status-and-dependencies -> final-submit-readiness",
    "final-submit-readiness -> help"
  ],
  "responsive": {
    "wide": "Grouped task lists giữ task name, hint và status trong cùng primary content column.",
    "intermediate": "Status có thể wrap dưới task name nhưng vẫn thuộc cùng semantic task unit.",
    "compact": "Một cột giữ group, task, status, locked reason và next available task trước readiness.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "task-application -> transaction-context -> overall-progress -> grouped-task-lists -> task-status-and-dependencies -> final-submit-readiness -> help",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "not started",
    "in progress",
    "completed",
    "cannot start",
    "not applicable",
    "dependency locked",
    "section stale",
    "returning session",
    "readiness blocked",
    "submit pending",
    "submit conflict"
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
