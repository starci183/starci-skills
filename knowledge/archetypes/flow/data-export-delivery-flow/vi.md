# Luồng tạo và nhận data export

## LOADS

Không có.

## Bản ghi

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `data-export-delivery-flow` |
| Family | `flow` |
| Nhiệm vụ trội | Chọn scope dữ liệu, fields, format, privacy boundary và delivery trước khi tạo và nhận một export có thể chạy lâu. |
| Bí danh tìm kiếm | `export configuration flow`, `archive delivery`, `privacy-aware data export` |
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
| `EDF-01` | Chọn scope dữ liệu, fields, format, privacy boundary và delivery trước khi tạo và nhận một export có thể chạy lâu. | tín hiệu dương bắt buộc |
| `EDF-02` | Tất cả required regions cùng ownership relationship được nêu rõ đều cần cho task. | tín hiệu dương bắt buộc |
| `EDF-03` | Wide adjacency thất bại nhưng intermediate và compact transformations vẫn giữ task, state và recovery. | tín hiệu dương có điều kiện |
| `EDF-90` | Từ chối import mapping hoặc simple file download. | từ chối |
| `EDF-91` | Từ chối report table, upload manager hoặc background job detail sau handoff. | từ chối |

### Quy tắc chọn

- Trả `accept` chỉ khi `EDF-01` và `EDF-02` đều có evidence và không có code 90–99.
- Trả `reject` khi `EDF-90` hoặc `EDF-91` có evidence, hoặc adjacent archetype sở hữu dominant task.
- Trả `needs-evidence` khi task, required region, relationship hoặc responsive failure trigger còn unresolved.

## Đồ thị vùng

```text
export-flow
├─ source-and-scope-context
├─ field-and-format-options
├─ record-count-and-size-preview
├─ privacy-redaction-warning
├─ delivery-destination
├─ generate-action
└─ export-progress-and-delivery
```

- **Quan hệ dùng chung:** Count, size và privacy consequences được suy ra từ scope, fields cùng format; delivery theo sau review đó; generation progress tiếp tục tồn tại sau khi configuration stage kết thúc.
- `export-flow -> source-and-scope-context`: `source-and-scope-context` dùng named context hoặc revision từ `export-flow` và cung cấp explicit return hoặc reconciliation path.
- `source-and-scope-context -> field-and-format-options`: `field-and-format-options` dùng named context hoặc revision từ `source-and-scope-context` và cung cấp explicit return hoặc reconciliation path.
- `field-and-format-options -> record-count-and-size-preview`: `record-count-and-size-preview` dùng named context hoặc revision từ `field-and-format-options` và cung cấp explicit return hoặc reconciliation path.
- `record-count-and-size-preview -> privacy-redaction-warning`: `privacy-redaction-warning` dùng named context hoặc revision từ `record-count-and-size-preview` và cung cấp explicit return hoặc reconciliation path.
- `privacy-redaction-warning -> delivery-destination`: `delivery-destination` dùng named context hoặc revision từ `privacy-redaction-warning` và cung cấp explicit return hoặc reconciliation path.
- `delivery-destination -> generate-action`: `generate-action` dùng named context hoặc revision từ `delivery-destination` và cung cấp explicit return hoặc reconciliation path.
- `generate-action -> export-progress-and-delivery`: `export-progress-and-delivery` dùng named context hoặc revision từ `generate-action` và cung cấp explicit return hoặc reconciliation path.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `export-flow` | Sở hữu toàn bộ transaction boundary, shared revision và recovery context của export flow; child regions không được commit bên ngoài boundary này. |
| `source-and-scope-context` | Sở hữu orientation và immutable basis của source and scope context để qualify mọi downstream decision. |
| `field-and-format-options` | Sở hữu input hoặc decision của field and format options và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `record-count-and-size-preview` | Sở hữu derived state của record count and size preview; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |
| `privacy-redaction-warning` | Sở hữu input hoặc decision của privacy redaction warning và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `delivery-destination` | Sở hữu input hoặc decision của delivery destination và cập nhật shared transaction revision trong khi giữ label, status cùng contextual actions. |
| `generate-action` | Sở hữu commitment boundary của generate action và ngăn duplicate hoặc stale commitment; vùng này dùng reviewed shared revision. |
| `export-progress-and-delivery` | Sở hữu derived state của export progress and delivery; vùng này nêu source revision và không được mâu thuẫn với input hoặc evidence owners. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Một required region không còn đồng hiện mà không squeeze, truncate hoặc tách context khỏi action.
- **Topology response:** Configuration cùng live count, size và privacy consequences đồng hiện trước khi chọn delivery.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Intermediate

- **Failure trigger:** Vùng support bậc thấp nhất không còn persistent mà vẫn giữ readable measure và action order.
- **Topology response:** Consequence summary chuyển vào giữa configuration và Generate trong khi fields vẫn được nhóm theo nghĩa.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Compact

- **Failure trigger:** Adjacency hoặc nhiều primary panes không còn hoạt động với zoom, localization, text growth hoặc short height.
- **Topology response:** Task trở thành configure, review privacy và size, choose delivery, rồi theo dõi generation ở stage riêng.
- **Navigation replacement:** Mọi vùng mất adjacency nhận một route có tên tới cùng content và state.
- **Sticky boundary:** Persistence tự yield trước khi che content, focus, validation hoặc action trong short-height.
- **Overflow owner:** Page sở hữu vertical overflow; chỉ region task hai chiều được nêu rõ mới sở hữu bounded overflow.

### Reflow

- Semantic và DOM order là `export-flow` → `source-and-scope-context` → `field-and-format-options` → `record-count-and-size-preview` → `privacy-redaction-warning` → `delivery-destination` → `generate-action` → `export-progress-and-delivery`.
- CSS không reorder region hoặc focus sequence ở topology transition.
- Compact navigation thay adjacency bằng named primary pane và phục hồi exact trigger, state cùng scroll context.

### Tương đương tương tác

- Wide, intermediate và compact giữ cùng actions, state meanings, recovery paths và consequence.
- Dynamic status được announce mà không tự di chuyển focus.
- Error recovery đưa focus tới summary hoặc field có thể sửa rồi trả về continuation phù hợp.

## Nghĩa vụ trạng thái

| Trạng thái | Behavior bắt buộc | Cách trình bày responsive |
|---|---|---|
| `preview calculating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `preview error` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `preview stale` | Chỉ ra conflicting revision, chặn stale commitment và reconcile mà không bỏ unaffected state. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `zero records` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `restricted field` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `large export warning` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `destination invalid` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `queued` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `generating` | Announce tiến độ mà không di chuyển focus, giữ current revision và chỉ ngăn duplicate operation tương ứng. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `ready` | Hiển thị confirming evidence cùng next hoặc handoff action mà không xóa review context. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `expired` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `failed` | Nêu cause tại đúng owner, cung cấp focusable repair path và giữ safe input để retry. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `cancel/retry` | Hiển thị state cùng owner, consequence và deterministic continuation hoặc recovery path. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |
| `permission unavailable` | Giải thích unavailable boundary, giữ context đọc được và cung cấp alternate hoặc recovery path hợp lệ. | Wide giữ state cạnh owner; intermediate bỏ low-priority persistence; compact đặt state cùng recovery trong current primary pane và phục hồi anchor. |

## Ranh giới

### Chấp nhận

- Dùng khi scope và privacy thay đổi đáng kể một export chạy lâu cùng delivery của nó.
- Required regions phải chia sẻ một transaction state model và một recovery path có thể chứng minh.

### Từ chối

- Từ chối import mapping hoặc simple file download.
- Từ chối report table, upload manager hoặc background job detail sau handoff.
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
| [Google Account Help — Download your data](https://support.google.com/accounts/answer/3024190?hl=en) | Export scope, format, delivery, delay và archive expiry là các decisions cùng states khác nhau. | Không định nghĩa export policy của product khác. |
| [U.S. Web Design System — Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) | Long transaction giữ progress, review và recovery. | Không định nghĩa product workflow hoặc fixed step count. |
| [Carbon Design System — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Dense row-column relationships có thể sở hữu bounded horizontal overflow. | Không biến small record collection thành data table. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Dynamic result có thể được announce mà không di chuyển focus. | Không định nghĩa transaction states hoặc timing. |

## Đầu ra

Trả một record đã resolve với đúng runtime fields sau:

```json
{
  "archetypeId": "data-export-delivery-flow",
  "situationCodes": [
    "EDF-01",
    "EDF-02",
    "EDF-03"
  ],
  "searchAliases": [
    "export configuration flow",
    "archive delivery",
    "privacy-aware data export"
  ],
  "dominantTask": "Chọn scope dữ liệu, fields, format, privacy boundary và delivery trước khi tạo và nhận một export có thể chạy lâu.",
  "regions": [
    "export-flow",
    "source-and-scope-context",
    "field-and-format-options",
    "record-count-and-size-preview",
    "privacy-redaction-warning",
    "delivery-destination",
    "generate-action",
    "export-progress-and-delivery"
  ],
  "regionRelationships": [
    "export-flow -> source-and-scope-context",
    "source-and-scope-context -> field-and-format-options",
    "field-and-format-options -> record-count-and-size-preview",
    "record-count-and-size-preview -> privacy-redaction-warning",
    "privacy-redaction-warning -> delivery-destination",
    "delivery-destination -> generate-action",
    "generate-action -> export-progress-and-delivery"
  ],
  "responsive": {
    "wide": "Configuration cùng live count, size và privacy consequences đồng hiện trước khi chọn delivery.",
    "intermediate": "Consequence summary chuyển vào giữa configuration và Generate trong khi fields vẫn được nhóm theo nghĩa.",
    "compact": "Task trở thành configure, review privacy và size, choose delivery, rồi theo dõi generation ở stage riêng.",
    "reflow": "Giữ một semantic DOM order và transform topology khi một relationship được nêu rõ thất bại.",
    "readingOrder": "export-flow -> source-and-scope-context -> field-and-format-options -> record-count-and-size-preview -> privacy-redaction-warning -> delivery-destination -> generate-action -> export-progress-and-delivery",
    "navigationReplacement": "Thay adjacency bị mất bằng named in-flow hoặc pane navigation tới cùng regions.",
    "stickyBehavior": "Persistence tự yield trước khi che content, focus, validation hoặc short-height operation.",
    "overflowOwner": "Page sở hữu vertical overflow trừ khi archetype nêu một bounded two-dimensional task region.",
    "interactionParity": "Giữ mọi action, state, recovery path và focus return xuyên topology changes."
  },
  "stateObligations": [
    "preview calculating",
    "preview error",
    "preview stale",
    "zero records",
    "restricted field",
    "large export warning",
    "destination invalid",
    "queued",
    "generating",
    "ready",
    "expired",
    "failed",
    "cancel/retry",
    "permission unavailable"
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
