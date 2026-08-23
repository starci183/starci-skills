# Spirometry maneuver quality repeatability workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `spirometry-maneuver-quality-repeatability-workbench` |
| Family | Work |
| Dominant task | Đánh giá từng maneuver hô hấp ký, loại effort không đạt, chứng minh repeatability trên tập hợp hợp lệ, truy nguồn best values và ghép pre/post bronchodilator. |
| Search aliases | spirometry-maneuver-quality-repeatability-workbench, spirometry-quality, interpretation-and-signed-report |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `spirometry-quality` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-SMQ-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-SMQ-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-SMQ-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-SMQ-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-SMQ-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-SMQ-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-SMQ-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `spirometry-maneuver-quality-repeatability-workbench` khi và chỉ khi có evidence cho `AR-SMQ-01` đến `AR-SMQ-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-SMQ-90` đến `AR-SMQ-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ spirometry-quality
├─ session-patient-calibration-and-reference-context
├─ maneuver-queue
├─ selected-volume-time-and-flow-volume-pair
├─ maneuver-acceptability-error-ledger
├─ acceptable-maneuver-set
├─ repeatability-proof
├─ best-value-selection
├─ pre-post-bronchodilator-pairing
└─ interpretation-and-signed-report
```

Quan hệ bắt buộc: `spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair ↔ maneuver-acceptability-error-ledger → acceptable-maneuver-set → FEV1-FVC-repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `spirometry-quality` | Sở hữu trạng thái và quyết định của `spirometry-quality`; giữ quan hệ với hạ nguồn `session-patient-calibration-and-reference-context` mà không hấp thụ owner của vùng khác. |
| `session-patient-calibration-and-reference-context` | Sở hữu trạng thái và quyết định của `session-patient-calibration-and-reference-context`; giữ quan hệ với thượng nguồn `spirometry-quality` và hạ nguồn `maneuver-queue` mà không hấp thụ owner của vùng khác. |
| `maneuver-queue` | Sở hữu trạng thái và quyết định của `maneuver-queue`; giữ quan hệ với thượng nguồn `session-patient-calibration-and-reference-context` và hạ nguồn `selected-volume-time-and-flow-volume-pair` mà không hấp thụ owner của vùng khác. |
| `selected-volume-time-and-flow-volume-pair` | Sở hữu trạng thái và quyết định của `selected-volume-time-and-flow-volume-pair`; giữ quan hệ với thượng nguồn `maneuver-queue` và hạ nguồn `maneuver-acceptability-error-ledger` mà không hấp thụ owner của vùng khác. |
| `maneuver-acceptability-error-ledger` | Sở hữu trạng thái và quyết định của `maneuver-acceptability-error-ledger`; giữ quan hệ với thượng nguồn `selected-volume-time-and-flow-volume-pair` và hạ nguồn `acceptable-maneuver-set` mà không hấp thụ owner của vùng khác. |
| `acceptable-maneuver-set` | Sở hữu trạng thái và quyết định của `acceptable-maneuver-set`; giữ quan hệ với thượng nguồn `maneuver-acceptability-error-ledger` và hạ nguồn `repeatability-proof` mà không hấp thụ owner của vùng khác. |
| `repeatability-proof` | Sở hữu trạng thái và quyết định của `repeatability-proof`; giữ quan hệ với thượng nguồn `acceptable-maneuver-set` và hạ nguồn `best-value-selection` mà không hấp thụ owner của vùng khác. |
| `best-value-selection` | Sở hữu trạng thái và quyết định của `best-value-selection`; giữ quan hệ với thượng nguồn `repeatability-proof` và hạ nguồn `pre-post-bronchodilator-pairing` mà không hấp thụ owner của vùng khác. |
| `pre-post-bronchodilator-pairing` | Sở hữu trạng thái và quyết định của `pre-post-bronchodilator-pairing`; giữ quan hệ với thượng nguồn `best-value-selection` và hạ nguồn `interpretation-and-signed-report` mà không hấp thụ owner của vùng khác. |
| `interpretation-and-signed-report` | Sở hữu trạng thái và quyết định của `interpretation-and-signed-report`; giữ quan hệ với thượng nguồn `pre-post-bronchodilator-pairing` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Maneuver queue, selected volume–time and flow–volume views, acceptability findings, acceptable-set repeatability, best values and pre/post comparison remain simultaneously visible; changing a maneuver verdict invalidates every dependent proof and interpretation visibly
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `maneuver-acceptability-error-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: The selected maneuver, its paired curve views and acceptability verdict remain primary; the complete maneuver set and repeatability proof move to a synchronized rail, while best-value provenance and pre/post pairing status remain persistent
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `maneuver-acceptability-error-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify session, patient, calibration and reference context → perform or select one maneuver → inspect volume–time and flow–volume evidence with a time/volume/flow table alternative → resolve each acceptability error → admit or reject the maneuver → review acceptable-set repeatability → trace FEV1 and FVC best values to their source maneuvers → pair pre/post bronchodilator if present → interpret and sign; curves yield to one selected evidence stage plus a semantic numeric route rather than stacked miniature plots
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `maneuver-acceptability-error-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair → maneuver-acceptability-error-ledger → acceptable-maneuver-set → repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm session new/resumed/signed, patient identity matched/mismatch, calibration current/expired/failed, reference context complete/stale, maneuver queued/recording/completed/aborted, curve loading/ready/error, acceptability pending/pass/fail with cough/early-termination/start/effort reason, maneuver admitted/rejected/reinstated, acceptable set insufficient/sufficient, repeatability pending/pass/fail/stale, best value unselected/derived/invalidated, pre/post unmatched/paired/conflicting, interpretation draft/blocked/signed/amended and permission-limited prior session.

## Nghĩa vụ trạng thái

Task-specific states: session new/resumed/signed, patient identity matched/mismatch, calibration current/expired/failed, reference context complete/stale, maneuver queued/recording/completed/aborted, curve loading/ready/error, acceptability pending/pass/fail with cough/early-termination/start/effort reason, maneuver admitted/rejected/reinstated, acceptable set insufficient/sufficient, repeatability pending/pass/fail/stale, best value unselected/derived/invalidated, pre/post unmatched/paired/conflicting, interpretation draft/blocked/signed/amended and permission-limited prior session.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SMQ-90`, `AR-SMQ-91` hoặc `AR-SMQ-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [CDC/NIOSH current coal-worker spirometry requirements and resources](https://www.cdc.gov/niosh/cwhsp/spirometry/index.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [ATS/ERS Standardization of Spirometry 2019 technical statement](https://academic.oup.com/ajrccm/article/200/8/e70/8497012) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "spirometry-maneuver-quality-repeatability-workbench",
  "matchedSituationCodes": [
    "AR-SMQ-01",
    "AR-SMQ-02",
    "AR-SMQ-03",
    "AR-SMQ-04"
  ],
  "aliases": [
    "spirometry-maneuver-quality-repeatability-workbench",
    "spirometry-quality",
    "interpretation-and-signed-report"
  ],
  "dominantTask": "Acquire and adjudicate a spirometry session maneuver by maneuver, reject technically unacceptable efforts with explicit reasons, prove repeatability across the acceptable set, derive best values from their source maneuvers, pair pre/post-bronchodilator results when present, and issue a quality-bounded interpretation",
  "regions": [
    "spirometry-quality",
    "session-patient-calibration-and-reference-context",
    "maneuver-queue",
    "selected-volume-time-and-flow-volume-pair",
    "maneuver-acceptability-error-ledger",
    "acceptable-maneuver-set",
    "repeatability-proof",
    "best-value-selection",
    "pre-post-bronchodilator-pairing",
    "interpretation-and-signed-report"
  ],
  "relationships": [
    "spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair ↔ maneuver-acceptability-error-ledger → acceptable-maneuver-set → FEV1-FVC-repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report"
  ],
  "responsive": {
    "wide": "Maneuver queue, selected volume–time and flow–volume views, acceptability findings, acceptable-set repeatability, best values and pre/post comparison remain simultaneously visible; changing a maneuver verdict invalidates every dependent proof and interpretation visibly",
    "intermediate": "The selected maneuver, its paired curve views and acceptability verdict remain primary; the complete maneuver set and repeatability proof move to a synchronized rail, while best-value provenance and pre/post pairing status remain persistent",
    "compact": "Verify session, patient, calibration and reference context → perform or select one maneuver → inspect volume–time and flow–volume evidence with a time/volume/flow table alternative → resolve each acceptability error → admit or reject the maneuver → review acceptable-set repeatability → trace FEV1 and FVC best values to their source maneuvers → pair pre/post bronchodilator if present → interpret and sign; curves yield to one selected evidence stage plus a semantic numeric route rather than stacked miniature plots",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair → maneuver-acceptability-error-ledger → acceptable-maneuver-set → repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "maneuver-acceptability-error-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "session new/resumed/signed",
    "patient identity matched/mismatch",
    "calibration current/expired/failed",
    "reference context complete/stale",
    "maneuver queued/recording/completed/aborted",
    "curve loading/ready/error",
    "acceptability pending/pass/fail with cough/early-termination/start/effort reason",
    "maneuver admitted/rejected/reinstated",
    "acceptable set insufficient/sufficient",
    "repeatability pending/pass/fail/stale",
    "best value unselected/derived/invalidated",
    "pre/post unmatched/paired/conflicting",
    "interpretation draft/blocked/signed/amended and permission-limited prior session"
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
