# Record quy trình có stage gate

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `stage-gated-process-record` |
| Family | `flow` |
| Nhiệm vụ trội | Hiểu và tiến một record qua các stage chính thức có gate, evidence, approver và transition rules. |
| Bí danh tìm kiếm | `formal gated record`, `approval stage process`, `evidence-gated workflow` |
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
| `SGP-01` | Hiểu và tiến một record qua các stage chính thức có gate, evidence, approver và transition rules. | tín hiệu dương bắt buộc |
| `SGP-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `SGP-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `SGP-90` | Từ chối simple form progress hoặc guided setup. | từ chối |
| `SGP-91` | Từ chối retrospective timeline, pre-submit composition hoặc centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `SGP-01` và `SGP-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `SGP-90` hoặc `SGP-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
gated-record
├─ process-identity-and-status
├─ stage-sequence
├─ current-gate-requirements
├─ evidence-and-approvals
├─ transition-actions
└─ history-and-exceptions
```

- **Quan hệ dùng chung:** Current gate sở hữu transition authority; evidence và approvals thỏa các named requirements; transitions append immutable history và không viết lại prior evidence.
- `gated-record -> process-identity-and-status`: `process-identity-and-status` dùng named context hoặc revision từ `gated-record` và cung cấp explicit return hoặc reconciliation path.
- `process-identity-and-status -> stage-sequence`: `stage-sequence` dùng named context hoặc revision từ `process-identity-and-status` và cung cấp explicit return hoặc reconciliation path.
- `stage-sequence -> current-gate-requirements`: `current-gate-requirements` dùng named context hoặc revision từ `stage-sequence` và cung cấp explicit return hoặc reconciliation path.
- `current-gate-requirements -> evidence-and-approvals`: `evidence-and-approvals` dùng named context hoặc revision từ `current-gate-requirements` và cung cấp explicit return hoặc reconciliation path.
- `evidence-and-approvals -> transition-actions`: `transition-actions` dùng named context hoặc revision từ `evidence-and-approvals` và cung cấp explicit return hoặc reconciliation path.
- `transition-actions -> history-and-exceptions`: `history-and-exceptions` dùng named context hoặc revision từ `transition-actions` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `gated-record` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của gated record; child regions không được commit bên ngoài boundary này. |
| `process-identity-and-status` | Sở hữu derived state của process identity and status; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `stage-sequence` | Sở hữu input hoặc decision của stage sequence và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `current-gate-requirements` | Sở hữu input hoặc decision của current gate requirements và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `evidence-and-approvals` | Sở hữu durable evidence cùng provenance của evidence and approvals; vùng này không âm thầm mutate current input owner. |
| `transition-actions` | Sở hữu input hoặc decision của transition actions và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `history-and-exceptions` | Sở hữu durable evidence cùng provenance của history and exceptions; vùng này không âm thầm mutate current input owner. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Stage sequence và current gate detail đồng hiện trong khi history phụ thuộc current authority.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Stage sequence thành summary không cần horizontal scroll trong khi current gate requirements giữ primary width.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Current stage và gate sở hữu page; all stages cùng history thành secondary screens có tên sau evidence.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `gated-record` → `process-identity-and-status` → `stage-sequence` → `current-gate-requirements` → `evidence-and-approvals` → `transition-actions` → `history-and-exceptions`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `future locked` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `current` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `complete` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `failed` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `waived` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `evidence missing` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `evidence stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `approval pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `approved` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `rejected` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `transition pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `transition conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `permission unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `exception request` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `history updated` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi current gate chính thức sở hữu transition authority cho một record.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối simple form progress hoặc guided setup.
- Từ chối retrospective timeline, pre-submit composition hoặc centered task.
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
| [U.S. Web Design System — Step indicator](https://designsystem.digital.gov/components/step-indicator/) | Step context có thể orient mà không trở thành arbitrary navigation. | Không định nghĩa process authority hoặc responsive geometry. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Record statuses, approvals và activity có thể giữ identity riêng. | Không định nghĩa process gate hoặc handoff contract. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submission hỗ trợ review, correction và confirmation. | Không định nghĩa domain consequence hoặc approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "stage-gated-process-record",
  "situationCodes": [
    "SGP-01",
    "SGP-02",
    "SGP-03"
  ],
  "searchAliases": [
    "formal gated record",
    "approval stage process",
    "evidence-gated workflow"
  ],
  "dominantTask": "Hiểu và tiến một record qua các stage chính thức có gate, evidence, approver và transition rules.",
  "regions": [
    "gated-record",
    "process-identity-and-status",
    "stage-sequence",
    "current-gate-requirements",
    "evidence-and-approvals",
    "transition-actions",
    "history-and-exceptions"
  ],
  "regionRelationships": [
    "gated-record -> process-identity-and-status",
    "process-identity-and-status -> stage-sequence",
    "stage-sequence -> current-gate-requirements",
    "current-gate-requirements -> evidence-and-approvals",
    "evidence-and-approvals -> transition-actions",
    "transition-actions -> history-and-exceptions"
  ],
  "responsive": {
    "wide": "Stage sequence và current gate detail đồng hiện trong khi history phụ thuộc current authority.",
    "intermediate": "Stage sequence thành summary không cần horizontal scroll trong khi current gate requirements giữ primary width.",
    "compact": "Current stage và gate sở hữu page; all stages cùng history thành secondary screens có tên sau evidence.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "gated-record -> process-identity-and-status -> stage-sequence -> current-gate-requirements -> evidence-and-approvals -> transition-actions -> history-and-exceptions",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "future locked",
    "current",
    "complete",
    "failed",
    "waived",
    "evidence missing",
    "evidence stale",
    "approval pending",
    "approved",
    "rejected",
    "transition pending",
    "transition conflict",
    "permission unavailable",
    "exception request",
    "history updated"
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
