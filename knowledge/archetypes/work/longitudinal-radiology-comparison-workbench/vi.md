# Longitudinal radiology comparison workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `longitudinal-radiology-comparison-workbench` |
| Family | Work |
| Dominant task | So sánh nghiên cứu hình ảnh hiện tại với nhiều lần trước, giữ định danh finding theo thời gian, lập comparison impression, giao tiếp kết quả quan trọng và bảo toàn lineage báo cáo. |
| Search aliases | longitudinal-radiology-comparison-workbench, radiology-comparison, report-or-addendum-version |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `radiology-comparison` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-LRC-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-LRC-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-LRC-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-LRC-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-LRC-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-LRC-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-LRC-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `longitudinal-radiology-comparison-workbench` khi và chỉ khi có evidence cho `AR-LRC-01` đến `AR-LRC-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-LRC-90` đến `AR-LRC-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ radiology-comparison
├─ patient-and-study-timeline
├─ current-plus-multiple-prior-series-pairing
├─ synchronized-display-set
├─ named-finding-identity-ledger-across-dates
├─ per-finding-measurement-and-change-trajectory
├─ comparison-impression
├─ critical-result-communication
└─ report-or-addendum-version
```

Quan hệ bắt buộc: `radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set ↔ named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `radiology-comparison` | Sở hữu trạng thái và quyết định của `radiology-comparison`; giữ quan hệ với hạ nguồn `patient-and-study-timeline` mà không hấp thụ owner của vùng khác. |
| `patient-and-study-timeline` | Sở hữu trạng thái và quyết định của `patient-and-study-timeline`; giữ quan hệ với thượng nguồn `radiology-comparison` và hạ nguồn `current-plus-multiple-prior-series-pairing` mà không hấp thụ owner của vùng khác. |
| `current-plus-multiple-prior-series-pairing` | Sở hữu trạng thái và quyết định của `current-plus-multiple-prior-series-pairing`; giữ quan hệ với thượng nguồn `patient-and-study-timeline` và hạ nguồn `synchronized-display-set` mà không hấp thụ owner của vùng khác. |
| `synchronized-display-set` | Sở hữu trạng thái và quyết định của `synchronized-display-set`; giữ quan hệ với thượng nguồn `current-plus-multiple-prior-series-pairing` và hạ nguồn `named-finding-identity-ledger-across-dates` mà không hấp thụ owner của vùng khác. |
| `named-finding-identity-ledger-across-dates` | Sở hữu trạng thái và quyết định của `named-finding-identity-ledger-across-dates`; giữ quan hệ với thượng nguồn `synchronized-display-set` và hạ nguồn `per-finding-measurement-and-change-trajectory` mà không hấp thụ owner của vùng khác. |
| `per-finding-measurement-and-change-trajectory` | Sở hữu trạng thái và quyết định của `per-finding-measurement-and-change-trajectory`; giữ quan hệ với thượng nguồn `named-finding-identity-ledger-across-dates` và hạ nguồn `comparison-impression` mà không hấp thụ owner của vùng khác. |
| `comparison-impression` | Sở hữu trạng thái và quyết định của `comparison-impression`; giữ quan hệ với thượng nguồn `per-finding-measurement-and-change-trajectory` và hạ nguồn `critical-result-communication` mà không hấp thụ owner của vùng khác. |
| `critical-result-communication` | Sở hữu trạng thái và quyết định của `critical-result-communication`; giữ quan hệ với thượng nguồn `comparison-impression` và hạ nguồn `report-or-addendum-version` mà không hấp thụ owner của vùng khác. |
| `report-or-addendum-version` | Sở hữu trạng thái và quyết định của `report-or-addendum-version`; giữ quan hệ với thượng nguồn `critical-result-communication` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Study timeline, synchronized current/prior display, finding ledger, measurement trend and impression remain linked; changing a finding or prior updates every projection without discarding viewport context
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `patient-and-study-timeline` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Current/prior comparison remains primary with the active finding; timeline compresses to an explicit prior selector and measurement history/impression alternate in a synchronized secondary pane
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `patient-and-study-timeline` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Choose one named finding → review current state → step through at least two selected priors with matched location and a date-keyed measurement table → confirm the multi-date trajectory → write the comparison statement → communicate if critical → sign/addendum; simultaneous images yield to controlled alternation, while finding identity and the full prior sequence remain persistent
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `patient-and-study-timeline` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set → named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm current or prior loading/unavailable, series unmatched/matched, registration uncertain, finding new/stable/improved/worsened/resolved, measurement missing/changed/conflicting, comparison stale after prior change, critical communication pending/acknowledged/failed, report draft/signed/addendum, permission-limited study and focus restored after prior selection.

## Nghĩa vụ trạng thái

Task-specific states: current or prior loading/unavailable, series unmatched/matched, registration uncertain, finding new/stable/improved/worsened/resolved, measurement missing/changed/conflicting, comparison stale after prior change, critical communication pending/acknowledged/failed, report draft/signed/addendum, permission-limited study and focus restored after prior selection.

| State family | Hành vi bắt buộc |
|---|---|
| Initial / loading | Nêu scope đang tải, reserve primary region và chỉ block vùng thất bại. |
| Ready | Thể hiện current object, owner relationship và valid actions bằng text cùng semantics. |
| Empty / not-applicable | Phân biệt true empty, no-match và non-applicable, kèm next action hợp lệ. |
| Error / retry | Nêu scope lỗi, giữ input/work state và cung cấp target retry hoặc correction. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và vẫn giữ context. |
| Pending | Ngăn duplicate, giữ context, cho cancel khi an toàn và announce progress. |
| Success | Xác nhận chính xác scope đã đổi, cập nhật dependent summaries và giữ next valid step. |
| Stale / conflict | So local với external state, không silent overwrite và giữ deterministic recovery. |
| Focus transition | Stage change do user kích hoạt focus heading mới; status-only update không chuyển focus. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm support thấp tạm thời; compact dùng một primary stage có parity. |

## Ranh giới

### Chấp nhận

- Template phải chứng minh chuỗi task-specific trong acceptance focus bằng fictional data, keyboard-complete action và recovery không mất state.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Từ chối

- Reject mọi adjacent archetype được nêu trong hard rejection khi nó thiếu graph hoặc completion-owning relationship của leaf này.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Phán quyết ranh giới

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-LRC-90`, `AR-LRC-91` hoặc `AR-LRC-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này giải dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar gắn product-semantic owner vào region và state mà không đổi topology.
4. Principles giải exact grid, measure, gap, size, alignment, overflow và content-fit threshold.
5. Direction thể hiện visual character bên trong owner đã accept.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn đi qua business truth, Grammar và Principles.

### Nguồn

| Source | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [DICOM Hanging Protocol Information Model](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.44.3.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [ACR Practice Parameter for Communication of Diagnostic Imaging Findings](https://gravitas.acr.org/PPTS/GetDocumentView?docId=74) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "longitudinal-radiology-comparison-workbench",
  "matchedSituationCodes": [
    "AR-LRC-01",
    "AR-LRC-02",
    "AR-LRC-03",
    "AR-LRC-04"
  ],
  "aliases": [
    "longitudinal-radiology-comparison-workbench",
    "radiology-comparison",
    "report-or-addendum-version"
  ],
  "dominantTask": "Compare a current imaging study with selected prior studies, track named findings and measurements through time, compose a comparison impression, communicate critical results, and preserve report/addendum lineage",
  "regions": [
    "radiology-comparison",
    "patient-and-study-timeline",
    "current-plus-multiple-prior-series-pairing",
    "synchronized-display-set",
    "named-finding-identity-ledger-across-dates",
    "per-finding-measurement-and-change-trajectory",
    "comparison-impression",
    "critical-result-communication",
    "report-or-addendum-version"
  ],
  "relationships": [
    "radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set ↔ named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version"
  ],
  "responsive": {
    "wide": "Study timeline, synchronized current/prior display, finding ledger, measurement trend and impression remain linked; changing a finding or prior updates every projection without discarding viewport context",
    "intermediate": "Current/prior comparison remains primary with the active finding; timeline compresses to an explicit prior selector and measurement history/impression alternate in a synchronized secondary pane",
    "compact": "Choose one named finding → review current state → step through at least two selected priors with matched location and a date-keyed measurement table → confirm the multi-date trajectory → write the comparison statement → communicate if critical → sign/addendum; simultaneous images yield to controlled alternation, while finding identity and the full prior sequence remain persistent",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set → named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "patient-and-study-timeline",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "current or prior loading/unavailable",
    "series unmatched/matched",
    "registration uncertain",
    "finding new/stable/improved/worsened/resolved",
    "measurement missing/changed/conflicting",
    "comparison stale after prior change",
    "critical communication pending/acknowledged/failed",
    "report draft/signed/addendum",
    "permission-limited study and focus restored after prior selection"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.
