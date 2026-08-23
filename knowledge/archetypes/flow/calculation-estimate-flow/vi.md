# Luồng tính toán và ước tính

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `calculation-estimate-flow` |
| Family | `flow` |
| Nhiệm vụ trội | Cung cấp dữ liệu và giả định, hiểu breakdown được suy ra, rồi rà soát hoặc chấp nhận một estimate có uncertainty và limitations rõ ràng. |
| Bí danh tìm kiếm | `estimate calculator`, `assumption-driven estimate`, `calculation review flow` |
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
| `CEF-01` | Cung cấp dữ liệu và giả định, hiểu breakdown được suy ra, rồi rà soát hoặc chấp nhận một estimate có uncertainty và limitations rõ ràng. | tín hiệu dương bắt buộc |
| `CEF-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `CEF-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `CEF-90` | Từ chối full scenario modeler hoặc generic sectioned form. | từ chối |
| `CEF-91` | Từ chối plan purchase, static price card hoặc one-number calculator nằm trong centered task. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `CEF-01` và `CEF-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `CEF-90` hoặc `CEF-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
estimate-flow
├─ estimate-purpose-and-basis
├─ input-and-assumption-groups
├─ live-calculation-summary
├─ itemized-breakdown
├─ uncertainty-and-limitations
└─ review-adjust-or-accept
```

- **Quan hệ dùng chung:** Inputs và assumptions là basis của phép tính; live summary và itemized breakdown cùng được suy ra từ một revision; limitations qualify các values đó; acceptance chỉ commit revision đã review.
- `estimate-flow -> estimate-purpose-and-basis`: `estimate-purpose-and-basis` dùng named context hoặc revision từ `estimate-flow` và cung cấp explicit return hoặc reconciliation path.
- `estimate-purpose-and-basis -> input-and-assumption-groups`: `input-and-assumption-groups` dùng named context hoặc revision từ `estimate-purpose-and-basis` và cung cấp explicit return hoặc reconciliation path.
- `input-and-assumption-groups -> live-calculation-summary`: `live-calculation-summary` dùng named context hoặc revision từ `input-and-assumption-groups` và cung cấp explicit return hoặc reconciliation path.
- `live-calculation-summary -> itemized-breakdown`: `itemized-breakdown` dùng named context hoặc revision từ `live-calculation-summary` và cung cấp explicit return hoặc reconciliation path.
- `itemized-breakdown -> uncertainty-and-limitations`: `uncertainty-and-limitations` dùng named context hoặc revision từ `itemized-breakdown` và cung cấp explicit return hoặc reconciliation path.
- `uncertainty-and-limitations -> review-adjust-or-accept`: `review-adjust-or-accept` dùng named context hoặc revision từ `uncertainty-and-limitations` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `estimate-flow` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của estimate flow; child regions không được commit bên ngoài boundary này. |
| `estimate-purpose-and-basis` | Sở hữu orientation và immutable basis của estimate purpose and basis để qualify mọi downstream decision. |
| `input-and-assumption-groups` | Sở hữu input hoặc decision của input and assumption groups và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `live-calculation-summary` | Sở hữu derived state của live calculation summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `itemized-breakdown` | Sở hữu derived state của itemized breakdown; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `uncertainty-and-limitations` | Sở hữu input hoặc decision của uncertainty and limitations và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `review-adjust-or-accept` | Sở hữu commitment boundary của review adjust or accept và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Các nhóm input cùng live result và breakdown đồng hiện; assumptions và limitations luôn đứng cạnh values mà chúng qualify.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Result summary vẫn gần inputs trong khi breakdown chi tiết chuyển xuống dưới hoặc vào disclosure; result không tách khỏi basis.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Task tuần tự input → calculate → result → breakdown → assumptions → accept; Edit quay lại đúng field và phép tính lại được announce.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `estimate-flow` → `estimate-purpose-and-basis` → `input-and-assumption-groups` → `live-calculation-summary` → `itemized-breakdown` → `uncertainty-and-limitations` → `review-adjust-or-accept`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `initial/no estimate` | Phân biệt valid absence với missing required input và cung cấp next available start path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `calculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `ready` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `invalid/incomplete input` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `source rate stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `uncertainty unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `assumption edited` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `estimate expired` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `accept pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `accept conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi một derivation nhiều input cùng basis của nó phải được rà soát trước khi chấp nhận.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối full scenario modeler hoặc generic sectioned form.
- Từ chối plan purchase, static price card hoặc one-number calculator nằm trong centered task.
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
| [Internal Revenue Service — Tax Withholding Estimator FAQs](https://www.irs.gov/individuals/tax-withholding-estimator-faqs) | Estimate hiện input sensitivity, calculation basis và limitations. | Không định nghĩa reusable visual layout hoặc phép tính ngoài tax. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transaction giữ progress, review và recovery. | Không định nghĩa product workflow hoặc fixed step count. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "calculation-estimate-flow",
  "situationCodes": [
    "CEF-01",
    "CEF-02",
    "CEF-03"
  ],
  "searchAliases": [
    "estimate calculator",
    "assumption-driven estimate",
    "calculation review flow"
  ],
  "dominantTask": "Cung cấp dữ liệu và giả định, hiểu breakdown được suy ra, rồi rà soát hoặc chấp nhận một estimate có uncertainty và limitations rõ ràng.",
  "regions": [
    "estimate-flow",
    "estimate-purpose-and-basis",
    "input-and-assumption-groups",
    "live-calculation-summary",
    "itemized-breakdown",
    "uncertainty-and-limitations",
    "review-adjust-or-accept"
  ],
  "regionRelationships": [
    "estimate-flow -> estimate-purpose-and-basis",
    "estimate-purpose-and-basis -> input-and-assumption-groups",
    "input-and-assumption-groups -> live-calculation-summary",
    "live-calculation-summary -> itemized-breakdown",
    "itemized-breakdown -> uncertainty-and-limitations",
    "uncertainty-and-limitations -> review-adjust-or-accept"
  ],
  "responsive": {
    "wide": "Các nhóm input cùng live result và breakdown đồng hiện; assumptions và limitations luôn đứng cạnh values mà chúng qualify.",
    "intermediate": "Result summary vẫn gần inputs trong khi breakdown chi tiết chuyển xuống dưới hoặc vào disclosure; result không tách khỏi basis.",
    "compact": "Task tuần tự input → calculate → result → breakdown → assumptions → accept; Edit quay lại đúng field và phép tính lại được announce.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "estimate-flow -> estimate-purpose-and-basis -> input-and-assumption-groups -> live-calculation-summary -> itemized-breakdown -> uncertainty-and-limitations -> review-adjust-or-accept",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "initial/no estimate",
    "calculating",
    "ready",
    "invalid/incomplete input",
    "source rate stale",
    "uncertainty unavailable",
    "assumption edited",
    "estimate expired",
    "accept pending",
    "accept conflict"
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
