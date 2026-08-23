# Luồng handoff giữa các bên

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `cross-party-handoff-flow` |
| Family | `flow` |
| Nhiệm vụ trội | Đóng gói work context, chọn recipient đủ điều kiện, đặt access và expiry, rồi chuyển trách nhiệm qua acceptance rõ ràng. |
| Bí danh tìm kiếm | `responsibility handoff`, `recipient acceptance transfer`, `secure work package transfer` |
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
| `CHF-01` | Đóng gói work context, chọn recipient đủ điều kiện, đặt access và expiry, rồi chuyển trách nhiệm qua acceptance rõ ràng. | tín hiệu dương bắt buộc |
| `CHF-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `CHF-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `CHF-90` | Từ chối approval routing, dual-list transfer hoặc simple share dialog. | từ chối |
| `CHF-91` | Từ chối support composer hoặc operational row assignment action. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `CHF-01` và `CHF-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `CHF-90` hoặc `CHF-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
handoff-flow
├─ work-package-summary
├─ recipient-search-and-eligibility
├─ access-and-redaction-scope
├─ expiry-and-return-policy
├─ recipient-preview
├─ send-handoff
└─ acceptance-tracker
```

- **Quan hệ dùng chung:** Sender-owned package và recipient-owned acceptance là hai transaction owner riêng; access cùng expiry qualify preview; tracker thay composer sau send.
- `handoff-flow -> work-package-summary`: `work-package-summary` dùng named context hoặc revision từ `handoff-flow` và cung cấp explicit return hoặc reconciliation path.
- `work-package-summary -> recipient-search-and-eligibility`: `recipient-search-and-eligibility` dùng named context hoặc revision từ `work-package-summary` và cung cấp explicit return hoặc reconciliation path.
- `recipient-search-and-eligibility -> access-and-redaction-scope`: `access-and-redaction-scope` dùng named context hoặc revision từ `recipient-search-and-eligibility` và cung cấp explicit return hoặc reconciliation path.
- `access-and-redaction-scope -> expiry-and-return-policy`: `expiry-and-return-policy` dùng named context hoặc revision từ `access-and-redaction-scope` và cung cấp explicit return hoặc reconciliation path.
- `expiry-and-return-policy -> recipient-preview`: `recipient-preview` dùng named context hoặc revision từ `expiry-and-return-policy` và cung cấp explicit return hoặc reconciliation path.
- `recipient-preview -> send-handoff`: `send-handoff` dùng named context hoặc revision từ `recipient-preview` và cung cấp explicit return hoặc reconciliation path.
- `send-handoff -> acceptance-tracker`: `acceptance-tracker` dùng named context hoặc revision từ `send-handoff` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `handoff-flow` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của handoff flow; child regions không được commit bên ngoài boundary này. |
| `work-package-summary` | Sở hữu derived state của work package summary; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `recipient-search-and-eligibility` | Sở hữu input hoặc decision của recipient search and eligibility và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `access-and-redaction-scope` | Sở hữu input hoặc decision của access and redaction scope và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `expiry-and-return-policy` | Sở hữu input hoặc decision của expiry and return policy và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `recipient-preview` | Sở hữu derived state của recipient preview; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `send-handoff` | Sở hữu input hoặc decision của send handoff và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `acceptance-tracker` | Sở hữu durable evidence cùng provenance của acceptance tracker; vùng này không âm thầm mutate current input owner. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Package configuration là primary và recipient preview hỗ trợ; tracker chỉ thay composer sau send.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Preview chuyển lên trước Send trong khi eligibility và access consequences vẫn cạnh recipient selection.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Package, recipient, access và expiry, preview, send và acceptance tracking tạo sequence giữ nguyên state.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `handoff-flow` → `work-package-summary` → `recipient-search-and-eligibility` → `access-and-redaction-scope` → `expiry-and-return-policy` → `recipient-preview` → `send-handoff` → `acceptance-tracker`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `recipient searching` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `recipient eligible` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `recipient ineligible` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `package incomplete` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `package stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `redaction warning` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `invitation pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `accepted` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `declined` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `expired` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `revoked` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `resend` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `return` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `ownership conflict` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `focus to tracker` | Chỉ di chuyển focus sau explicit action hoặc failed submit, rồi phục hồi exact trigger cùng semantic context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi sender configuration và recipient acceptance là hai transaction owners riêng.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối approval routing, dual-list transfer hoặc simple share dialog.
- Từ chối support composer hoặc operational row assignment action.
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
| [Google Account Help — Share a copy of your data](https://support.google.com/accounts/answer/14452558?hl=en) | Recipient trust, data scope, access duration và responsibility transfer cần explicit review. | Không định nghĩa handoff authority của product khác. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Record statuses, approvals và activity có thể giữ identity riêng. | Không định nghĩa process gate hoặc handoff contract. |
| [GitHub Docs — Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) | Responsibility transfer nêu eligibility, recipient acceptance, transferred scope và invitation expiry. | Nguồn này không định nghĩa package, access policy hoặc acceptance period của sản phẩm khác. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submission hỗ trợ review, correction và confirmation. | Không định nghĩa domain consequence hoặc approval rule. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "cross-party-handoff-flow",
  "situationCodes": [
    "CHF-01",
    "CHF-02",
    "CHF-03"
  ],
  "searchAliases": [
    "responsibility handoff",
    "recipient acceptance transfer",
    "secure work package transfer"
  ],
  "dominantTask": "Đóng gói work context, chọn recipient đủ điều kiện, đặt access và expiry, rồi chuyển trách nhiệm qua acceptance rõ ràng.",
  "regions": [
    "handoff-flow",
    "work-package-summary",
    "recipient-search-and-eligibility",
    "access-and-redaction-scope",
    "expiry-and-return-policy",
    "recipient-preview",
    "send-handoff",
    "acceptance-tracker"
  ],
  "regionRelationships": [
    "handoff-flow -> work-package-summary",
    "work-package-summary -> recipient-search-and-eligibility",
    "recipient-search-and-eligibility -> access-and-redaction-scope",
    "access-and-redaction-scope -> expiry-and-return-policy",
    "expiry-and-return-policy -> recipient-preview",
    "recipient-preview -> send-handoff",
    "send-handoff -> acceptance-tracker"
  ],
  "responsive": {
    "wide": "Package configuration là primary và recipient preview hỗ trợ; tracker chỉ thay composer sau send.",
    "intermediate": "Preview chuyển lên trước Send trong khi eligibility và access consequences vẫn cạnh recipient selection.",
    "compact": "Package, recipient, access và expiry, preview, send và acceptance tracking tạo sequence giữ nguyên state.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "handoff-flow -> work-package-summary -> recipient-search-and-eligibility -> access-and-redaction-scope -> expiry-and-return-policy -> recipient-preview -> send-handoff -> acceptance-tracker",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "recipient searching",
    "recipient eligible",
    "recipient ineligible",
    "package incomplete",
    "package stale",
    "redaction warning",
    "invitation pending",
    "accepted",
    "declined",
    "expired",
    "revoked",
    "resend",
    "return",
    "ownership conflict",
    "focus to tracker"
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
