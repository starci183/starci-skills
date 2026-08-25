# Dialysis prescription delivery reconciliation

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `dialysis-prescription-delivery-reconciliation` |
| Family | Work |
| Dominant task | Đối chiếu một phiên lọc máu giữa prescription và delivery của máy, can thiệp access, cân bằng dịch, adequacy, biến cố và kế hoạch tiếp theo. |
| Search aliases | dialysis-prescription-delivery-reconciliation, dialysis-reconciliation, session-signoff-and-next-plan |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `dialysis-reconciliation` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-DPR-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-DPR-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-DPR-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-DPR-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-DPR-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-DPR-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-DPR-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `dialysis-prescription-delivery-reconciliation` khi và chỉ khi có evidence cho `AR-DPR-01` đến `AR-DPR-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-DPR-90` đến `AR-DPR-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ dialysis-reconciliation
├─ session-and-prescription-version
├─ prescribed-parameter-and-target-ledger
├─ device-event-and-delivery-time-series
├─ access-anticoagulation-and-intervention-log
├─ fluid-and-ultrafiltration-balance
├─ delivered-adequacy-and-target-comparison
├─ deviation-and-complication-review
└─ session-signoff-and-next-plan
```

Quan hệ bắt buộc: `dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series ↔ access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `dialysis-reconciliation` | Sở hữu trạng thái và quyết định của `dialysis-reconciliation`; giữ quan hệ với hạ nguồn `session-and-prescription-version` mà không hấp thụ owner của vùng khác. |
| `session-and-prescription-version` | Sở hữu trạng thái và quyết định của `session-and-prescription-version`; giữ quan hệ với thượng nguồn `dialysis-reconciliation` và hạ nguồn `prescribed-parameter-and-target-ledger` mà không hấp thụ owner của vùng khác. |
| `prescribed-parameter-and-target-ledger` | Sở hữu trạng thái và quyết định của `prescribed-parameter-and-target-ledger`; giữ quan hệ với thượng nguồn `session-and-prescription-version` và hạ nguồn `device-event-and-delivery-time-series` mà không hấp thụ owner của vùng khác. |
| `device-event-and-delivery-time-series` | Sở hữu trạng thái và quyết định của `device-event-and-delivery-time-series`; giữ quan hệ với thượng nguồn `prescribed-parameter-and-target-ledger` và hạ nguồn `access-anticoagulation-and-intervention-log` mà không hấp thụ owner của vùng khác. |
| `access-anticoagulation-and-intervention-log` | Sở hữu trạng thái và quyết định của `access-anticoagulation-and-intervention-log`; giữ quan hệ với thượng nguồn `device-event-and-delivery-time-series` và hạ nguồn `fluid-and-ultrafiltration-balance` mà không hấp thụ owner của vùng khác. |
| `fluid-and-ultrafiltration-balance` | Sở hữu trạng thái và quyết định của `fluid-and-ultrafiltration-balance`; giữ quan hệ với thượng nguồn `access-anticoagulation-and-intervention-log` và hạ nguồn `delivered-adequacy-and-target-comparison` mà không hấp thụ owner của vùng khác. |
| `delivered-adequacy-and-target-comparison` | Sở hữu trạng thái và quyết định của `delivered-adequacy-and-target-comparison`; giữ quan hệ với thượng nguồn `fluid-and-ultrafiltration-balance` và hạ nguồn `deviation-and-complication-review` mà không hấp thụ owner của vùng khác. |
| `deviation-and-complication-review` | Sở hữu trạng thái và quyết định của `deviation-and-complication-review`; giữ quan hệ với thượng nguồn `delivered-adequacy-and-target-comparison` và hạ nguồn `session-signoff-and-next-plan` mà không hấp thụ owner của vùng khác. |
| `session-signoff-and-next-plan` | Sở hữu trạng thái và quyết định của `session-signoff-and-next-plan`; giữ quan hệ với thượng nguồn `deviation-and-complication-review` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Prescription targets, delivery time series, intervention log, fluid balance and adequacy/deviation review remain simultaneous around one session identity
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `prescribed-parameter-and-target-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Live delivery and prescribed-versus-delivered comparison remain primary; access/intervention history and adequacy evidence move to synchronized drawers, while fluid balance stays persistent
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `prescribed-parameter-and-target-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify prescription version → monitor current delivery and safety event → review intervention log → reconcile fluid inputs/outputs and ultrafiltration → compare adequacy → resolve deviations → sign off/next plan; charts have a time-keyed table alternative and only the current phase is primary
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `prescribed-parameter-and-target-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series → access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm prescription missing/stale/amended, device feed connecting/live/interrupted/recovered, access adequate/problematic, anticoagulation planned/held/changed, target and delivered value matching/deviating, fluid balance incomplete/imbalanced/reconciled, adequacy unavailable/pending/met/missed, complication active/resolved, signoff blocked/completed/amended and handoff pending/received.

## Nghĩa vụ trạng thái

Task-specific states: prescription missing/stale/amended, device feed connecting/live/interrupted/recovered, access adequate/problematic, anticoagulation planned/held/changed, target and delivered value matching/deviating, fluid balance incomplete/imbalanced/reconciled, adequacy unavailable/pending/met/missed, complication active/resolved, signoff blocked/completed/amended and handoff pending/received.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-DPR-90`, `AR-DPR-91` hoặc `AR-DPR-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [CMS End-Stage Renal Disease facilities requirements](https://www.cms.gov/medicare/health-safety-runtime/standards/conditions-coverage-participation/end-stage-renal-disease-facilities) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [National Kidney Foundation KDOQI guidelines and commentaries](https://www.kidney.org/professionals/kdoqi/guidelines-and-commentaries) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "dialysis-prescription-delivery-reconciliation",
  "matchedSituationCodes": [
    "AR-DPR-01",
    "AR-DPR-02",
    "AR-DPR-03",
    "AR-DPR-04"
  ],
  "aliases": [
    "dialysis-prescription-delivery-reconciliation",
    "dialysis-reconciliation",
    "session-signoff-and-next-plan"
  ],
  "dominantTask": "Reconcile one dialysis prescription with machine-delivered parameters, access and anticoagulation interventions, fluid balance, adequacy targets and complications before session signoff and the next plan",
  "regions": [
    "dialysis-reconciliation",
    "session-and-prescription-version",
    "prescribed-parameter-and-target-ledger",
    "device-event-and-delivery-time-series",
    "access-anticoagulation-and-intervention-log",
    "fluid-and-ultrafiltration-balance",
    "delivered-adequacy-and-target-comparison",
    "deviation-and-complication-review",
    "session-signoff-and-next-plan"
  ],
  "relationships": [
    "dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series ↔ access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan"
  ],
  "responsive": {
    "wide": "Prescription targets, delivery time series, intervention log, fluid balance and adequacy/deviation review remain simultaneous around one session identity",
    "intermediate": "Live delivery and prescribed-versus-delivered comparison remain primary; access/intervention history and adequacy evidence move to synchronized drawers, while fluid balance stays persistent",
    "compact": "Verify prescription version → monitor current delivery and safety event → review intervention log → reconcile fluid inputs/outputs and ultrafiltration → compare adequacy → resolve deviations → sign off/next plan; charts have a time-keyed table alternative and only the current phase is primary",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series → access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "prescribed-parameter-and-target-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "prescription missing/stale/amended",
    "device feed connecting/live/interrupted/recovered",
    "access adequate/problematic",
    "anticoagulation planned/held/changed",
    "target and delivered value matching/deviating",
    "fluid balance incomplete/imbalanced/reconciled",
    "adequacy unavailable/pending/met/missed",
    "complication active/resolved",
    "signoff blocked/completed/amended and handoff pending/received"
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
