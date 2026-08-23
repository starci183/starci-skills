# Tracker outcome bất đồng bộ

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `asynchronous-outcome-tracker` |
| Family | `flow` |
| Nhiệm vụ trội | Theo dõi một case đã submit qua milestones kéo dài, expected updates, information requests và recovery khi tiến độ bị kẹt. |
| Bí danh tìm kiếm | `case outcome tracker`, `long-running submission status`, `milestone request tracker` |
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
| `AOT-01` | Theo dõi một case đã submit qua milestones kéo dài, expected updates, information requests và recovery khi tiến độ bị kẹt. | tín hiệu dương bắt buộc |
| `AOT-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `AOT-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `AOT-90` | Từ chối terminal receipt hoặc user-controlled gated record. | từ chối |
| `AOT-91` | Từ chối parallel-shipment order, support conversation hoặc dashboard nhiều case. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `AOT-01` và `AOT-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `AOT-90` hoặc `AOT-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
outcome-tracker
├─ submission-identity-and-owner
├─ current-milestone-and-expectation
├─ ordered-milestone-history
├─ outstanding-information-requests
├─ submitted-record-and-messages
└─ escalation-or-recovery
```

- **Quan hệ dùng chung:** External process sở hữu milestone advancement; outstanding requests đứng trước routine chronology; expectations, messages và escalation gắn cùng submission identity.
- `outcome-tracker -> submission-identity-and-owner`: `submission-identity-and-owner` dùng named context hoặc revision từ `outcome-tracker` và cung cấp explicit return hoặc reconciliation path.
- `submission-identity-and-owner -> current-milestone-and-expectation`: `current-milestone-and-expectation` dùng named context hoặc revision từ `submission-identity-and-owner` và cung cấp explicit return hoặc reconciliation path.
- `current-milestone-and-expectation -> ordered-milestone-history`: `ordered-milestone-history` dùng named context hoặc revision từ `current-milestone-and-expectation` và cung cấp explicit return hoặc reconciliation path.
- `ordered-milestone-history -> outstanding-information-requests`: `outstanding-information-requests` dùng named context hoặc revision từ `ordered-milestone-history` và cung cấp explicit return hoặc reconciliation path.
- `outstanding-information-requests -> submitted-record-and-messages`: `submitted-record-and-messages` dùng named context hoặc revision từ `outstanding-information-requests` và cung cấp explicit return hoặc reconciliation path.
- `submitted-record-and-messages -> escalation-or-recovery`: `escalation-or-recovery` dùng named context hoặc revision từ `submitted-record-and-messages` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `outcome-tracker` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của outcome tracker; child regions không được commit bên ngoài boundary này. |
| `submission-identity-and-owner` | Sở hữu orientation và immutable basis của submission identity and owner để qualify mọi downstream decision. |
| `current-milestone-and-expectation` | Sở hữu derived state của current milestone and expectation; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `ordered-milestone-history` | Sở hữu durable evidence cùng provenance của ordered milestone history; vùng này không âm thầm mutate current input owner. |
| `outstanding-information-requests` | Sở hữu input hoặc decision của outstanding information requests và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `submitted-record-and-messages` | Sở hữu durable evidence cùng provenance của submitted record and messages; vùng này không âm thầm mutate current input owner. |
| `escalation-or-recovery` | Sở hữu recovery route của escalation or recovery và giữ exact state, trigger cùng return position. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Current milestone và expectation là primary; unresolved requests đứng trước routine history cùng supporting record detail.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Supporting regions reflow trong khi current milestone, expected date và outstanding request vẫn cùng hiện.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Current expectation, outstanding action, milestone history, submitted record và escalation theo priority order.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `outcome-tracker` → `submission-identity-and-owner` → `current-milestone-and-expectation` → `ordered-milestone-history` → `outstanding-information-requests` → `submitted-record-and-messages` → `escalation-or-recovery`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `submitted` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `received` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `reviewing` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `waiting` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `external decision` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `completed` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `delayed` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `no update` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `information requested` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `responding` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `response accepted` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `response rejected` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `owner changed` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `timeline partial` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `escalation pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `stale status` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi external progression tiến một submitted record và người dùng có thể respond nhưng không tự advance milestone.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối terminal receipt hoặc user-controlled gated record.
- Từ chối parallel-shipment order, support conversation hoặc dashboard nhiều case.
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
| [USCIS Developer Portal — Case Status API](https://developer.uscis.gov/api/case-status) | Submitted case có thể hiện status updates do bên ngoài advance. | Không định nghĩa milestones, guarantees hoặc escalation rights cho product khác. |
| [USCIS — Case Status Online](https://egov.uscis.gov/?localeLang=en) | Submitted case hiển thị external status, processing expectations và inquiry path riêng khi progress stalls. | Nguồn này không guarantee dates hoặc định nghĩa milestones của sản phẩm khác. |
| [U.S. Web Design System — Process list](https://designsystem.digital.gov/components/process-list/) | Sequence có thể hiện ordered stages và explanatory state. | Không chứng minh process do user control. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "asynchronous-outcome-tracker",
  "situationCodes": [
    "AOT-01",
    "AOT-02",
    "AOT-03"
  ],
  "searchAliases": [
    "case outcome tracker",
    "long-running submission status",
    "milestone request tracker"
  ],
  "dominantTask": "Theo dõi một case đã submit qua milestones kéo dài, expected updates, information requests và recovery khi tiến độ bị kẹt.",
  "regions": [
    "outcome-tracker",
    "submission-identity-and-owner",
    "current-milestone-and-expectation",
    "ordered-milestone-history",
    "outstanding-information-requests",
    "submitted-record-and-messages",
    "escalation-or-recovery"
  ],
  "regionRelationships": [
    "outcome-tracker -> submission-identity-and-owner",
    "submission-identity-and-owner -> current-milestone-and-expectation",
    "current-milestone-and-expectation -> ordered-milestone-history",
    "ordered-milestone-history -> outstanding-information-requests",
    "outstanding-information-requests -> submitted-record-and-messages",
    "submitted-record-and-messages -> escalation-or-recovery"
  ],
  "responsive": {
    "wide": "Current milestone và expectation là primary; unresolved requests đứng trước routine history cùng supporting record detail.",
    "intermediate": "Supporting regions reflow trong khi current milestone, expected date và outstanding request vẫn cùng hiện.",
    "compact": "Current expectation, outstanding action, milestone history, submitted record và escalation theo priority order.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "outcome-tracker -> submission-identity-and-owner -> current-milestone-and-expectation -> ordered-milestone-history -> outstanding-information-requests -> submitted-record-and-messages -> escalation-or-recovery",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "submitted",
    "received",
    "reviewing",
    "waiting",
    "external decision",
    "completed",
    "delayed",
    "no update",
    "information requested",
    "responding",
    "response accepted",
    "response rejected",
    "owner changed",
    "timeline partial",
    "escalation pending",
    "stale status"
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
