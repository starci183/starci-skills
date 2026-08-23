# Nghi thức consent và signature

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `consent-signature-ceremony` |
| Family | `flow` |
| Nhiệm vụ trội | Rà soát đúng version của instrument, acknowledge clauses bắt buộc, verify signer capacity và commit signature có audit evidence. |
| Bí danh tìm kiếm | `binding signature flow`, `consent instrument ceremony`, `audited e-signature` |
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
| `CSC-01` | Rà soát đúng version của instrument, acknowledge clauses bắt buộc, verify signer capacity và commit signature có audit evidence. | tín hiệu dương bắt buộc |
| `CSC-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `CSC-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `CSC-90` | Từ chối generic irreversible confirmation hoặc split-reference entry. | từ chối |
| `CSC-91` | Từ chối simple terms checkbox, document reader hoặc approval request. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `CSC-01` và `CSC-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `CSC-90` hoặc `CSC-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
signature-ceremony
├─ instrument-identity-and-version
├─ readable-instrument
├─ required-clause-acknowledgements
├─ signer-identity-and-capacity
├─ signature-input
└─ final-commit-and-audit-evidence
```

- **Quan hệ dùng chung:** Instrument identity và clause acknowledgements là các evidence owner độc lập; signer capacity cùng signature gắn với reviewed version; commit tạo audit evidence riêng.
- `signature-ceremony -> instrument-identity-and-version`: `instrument-identity-and-version` dùng named context hoặc revision từ `signature-ceremony` và cung cấp explicit return hoặc reconciliation path.
- `instrument-identity-and-version -> readable-instrument`: `readable-instrument` dùng named context hoặc revision từ `instrument-identity-and-version` và cung cấp explicit return hoặc reconciliation path.
- `readable-instrument -> required-clause-acknowledgements`: `required-clause-acknowledgements` dùng named context hoặc revision từ `readable-instrument` và cung cấp explicit return hoặc reconciliation path.
- `required-clause-acknowledgements -> signer-identity-and-capacity`: `signer-identity-and-capacity` dùng named context hoặc revision từ `required-clause-acknowledgements` và cung cấp explicit return hoặc reconciliation path.
- `signer-identity-and-capacity -> signature-input`: `signature-input` dùng named context hoặc revision từ `signer-identity-and-capacity` và cung cấp explicit return hoặc reconciliation path.
- `signature-input -> final-commit-and-audit-evidence`: `final-commit-and-audit-evidence` dùng named context hoặc revision từ `signature-input` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `signature-ceremony` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của signature ceremony; child regions không được commit bên ngoài boundary này. |
| `instrument-identity-and-version` | Sở hữu durable evidence cùng provenance của instrument identity and version; vùng này không âm thầm mutate current input owner. |
| `readable-instrument` | Sở hữu durable evidence cùng provenance của readable instrument; vùng này không âm thầm mutate current input owner. |
| `required-clause-acknowledgements` | Sở hữu input hoặc decision của required clause acknowledgements và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `signer-identity-and-capacity` | Sở hữu orientation và immutable basis của signer identity and capacity để qualify mọi downstream decision. |
| `signature-input` | Sở hữu input hoặc decision của signature input và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `final-commit-and-audit-evidence` | Sở hữu durable evidence cùng provenance của final commit and audit evidence; vùng này không âm thầm mutate current input owner. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Readable instrument là primary; acknowledgement rail chỉ được phép khi toàn bộ clause context vẫn reachable.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Signature theo sau instrument và required clauses; disclosures hỗ trợ navigation mà không ẩn unread requirements.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Instrument sections, acknowledgements, signer verification, signature và final review tạo một sequence được bảo toàn.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `signature-ceremony` → `instrument-identity-and-version` → `readable-instrument` → `required-clause-acknowledgements` → `signer-identity-and-capacity` → `signature-input` → `final-commit-and-audit-evidence`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `instrument loading` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `version changed` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `clause unread` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `clause acknowledged` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `signer mismatch` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `signature invalid` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `commit pending` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `duplicate prevented` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `commit success` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `commit failure` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `invitation revoked` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `invitation expired` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `audit record` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi instrument version, clause acknowledgement, signer capacity và audit evidence là các nghĩa vụ độc lập.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối generic irreversible confirmation hoặc split-reference entry.
- Từ chối simple terms checkbox, document reader hoặc approval request.
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
| [NIST SP 800-63A-4 — Identity Proofing and Enrollment](https://csrc.nist.gov/pubs/sp/800/63/A/4/final) | Signer identity evidence và assurance level tách khỏi instrument. | Không định nghĩa legal consent hoặc signature UI. |
| [NIST SP 800-89 — Digital Signature Applications](https://csrc.nist.gov/pubs/sp/800/89/final) | Signature assurance gồm signer identity, key possession và verifiable evidence. | Không thiết lập legal effect hoặc clause content. |
| [GOV.UK Design System — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Review rows giữ Change actions gắn với answers. | Không định nghĩa submitted transaction, legal effect hoặc consequence. |
| [W3C WAI — Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | Consequential submission hỗ trợ review, correction và confirmation. | Không định nghĩa domain consequence hoặc approval rule. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical focus đi theo relationships và giữ operability. | Không chọn archetype này hoặc định nghĩa product facts. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "consent-signature-ceremony",
  "situationCodes": [
    "CSC-01",
    "CSC-02",
    "CSC-03"
  ],
  "searchAliases": [
    "binding signature flow",
    "consent instrument ceremony",
    "audited e-signature"
  ],
  "dominantTask": "Rà soát đúng version của instrument, acknowledge clauses bắt buộc, verify signer capacity và commit signature có audit evidence.",
  "regions": [
    "signature-ceremony",
    "instrument-identity-and-version",
    "readable-instrument",
    "required-clause-acknowledgements",
    "signer-identity-and-capacity",
    "signature-input",
    "final-commit-and-audit-evidence"
  ],
  "regionRelationships": [
    "signature-ceremony -> instrument-identity-and-version",
    "instrument-identity-and-version -> readable-instrument",
    "readable-instrument -> required-clause-acknowledgements",
    "required-clause-acknowledgements -> signer-identity-and-capacity",
    "signer-identity-and-capacity -> signature-input",
    "signature-input -> final-commit-and-audit-evidence"
  ],
  "responsive": {
    "wide": "Readable instrument là primary; acknowledgement rail chỉ được phép khi toàn bộ clause context vẫn reachable.",
    "intermediate": "Signature theo sau instrument và required clauses; disclosures hỗ trợ navigation mà không ẩn unread requirements.",
    "compact": "Instrument sections, acknowledgements, signer verification, signature và final review tạo một sequence được bảo toàn.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "signature-ceremony -> instrument-identity-and-version -> readable-instrument -> required-clause-acknowledgements -> signer-identity-and-capacity -> signature-input -> final-commit-and-audit-evidence",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "instrument loading",
    "version changed",
    "clause unread",
    "clause acknowledged",
    "signer mismatch",
    "signature invalid",
    "commit pending",
    "duplicate prevented",
    "commit success",
    "commit failure",
    "invitation revoked",
    "invitation expired",
    "audit record"
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
