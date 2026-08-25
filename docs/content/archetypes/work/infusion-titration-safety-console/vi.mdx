# Infusion titration safety console

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `infusion-titration-safety-console` |
| Family | Work |
| Dominant task | Titrate truyền liên tục bằng ordered/programmed/delivered triad, patient response, cumulative exposure và independent verification trước mỗi thay đổi hệ trọng. |
| Search aliases | infusion-titration-safety-console, infusion-safety, handoff |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `infusion-safety` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-ITS-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-ITS-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-ITS-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-ITS-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-ITS-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-ITS-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-ITS-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `infusion-titration-safety-console` khi và chỉ khi có evidence cho `AR-ITS-01` đến `AR-ITS-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-ITS-90` đến `AR-ITS-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ infusion-safety
├─ patient-order-drug-concentration-and-line
├─ protocol-stage-and-titration-rule
├─ ordered-rate-and-dose-envelope
├─ ordered-versus-programmed-versus-delivered-triad
├─ patient-response-and-alarm-window
├─ cumulative-dose-fluid-and-exposure-ledger
├─ titrate-hold-or-rescue-decision
├─ independent-verification
├─ executed-change-and-observed-outcome
└─ handoff
```

Quan hệ bắt buộc: `infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad ↔ patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `infusion-safety` | Sở hữu trạng thái và quyết định của `infusion-safety`; giữ quan hệ với hạ nguồn `patient-order-drug-concentration-and-line` mà không hấp thụ owner của vùng khác. |
| `patient-order-drug-concentration-and-line` | Sở hữu trạng thái và quyết định của `patient-order-drug-concentration-and-line`; giữ quan hệ với thượng nguồn `infusion-safety` và hạ nguồn `protocol-stage-and-titration-rule` mà không hấp thụ owner của vùng khác. |
| `protocol-stage-and-titration-rule` | Sở hữu trạng thái và quyết định của `protocol-stage-and-titration-rule`; giữ quan hệ với thượng nguồn `patient-order-drug-concentration-and-line` và hạ nguồn `ordered-rate-and-dose-envelope` mà không hấp thụ owner của vùng khác. |
| `ordered-rate-and-dose-envelope` | Sở hữu trạng thái và quyết định của `ordered-rate-and-dose-envelope`; giữ quan hệ với thượng nguồn `protocol-stage-and-titration-rule` và hạ nguồn `ordered-versus-programmed-versus-delivered-triad` mà không hấp thụ owner của vùng khác. |
| `ordered-versus-programmed-versus-delivered-triad` | Sở hữu trạng thái và quyết định của `ordered-versus-programmed-versus-delivered-triad`; giữ quan hệ với thượng nguồn `ordered-rate-and-dose-envelope` và hạ nguồn `patient-response-and-alarm-window` mà không hấp thụ owner của vùng khác. |
| `patient-response-and-alarm-window` | Sở hữu trạng thái và quyết định của `patient-response-and-alarm-window`; giữ quan hệ với thượng nguồn `ordered-versus-programmed-versus-delivered-triad` và hạ nguồn `cumulative-dose-fluid-and-exposure-ledger` mà không hấp thụ owner của vùng khác. |
| `cumulative-dose-fluid-and-exposure-ledger` | Sở hữu trạng thái và quyết định của `cumulative-dose-fluid-and-exposure-ledger`; giữ quan hệ với thượng nguồn `patient-response-and-alarm-window` và hạ nguồn `titrate-hold-or-rescue-decision` mà không hấp thụ owner của vùng khác. |
| `titrate-hold-or-rescue-decision` | Sở hữu trạng thái và quyết định của `titrate-hold-or-rescue-decision`; giữ quan hệ với thượng nguồn `cumulative-dose-fluid-and-exposure-ledger` và hạ nguồn `independent-verification` mà không hấp thụ owner của vùng khác. |
| `independent-verification` | Sở hữu trạng thái và quyết định của `independent-verification`; giữ quan hệ với thượng nguồn `titrate-hold-or-rescue-decision` và hạ nguồn `executed-change-and-observed-outcome` mà không hấp thụ owner của vùng khác. |
| `executed-change-and-observed-outcome` | Sở hữu trạng thái và quyết định của `executed-change-and-observed-outcome`; giữ quan hệ với thượng nguồn `independent-verification` và hạ nguồn `handoff` mà không hấp thụ owner của vùng khác. |
| `handoff` | Sở hữu trạng thái và quyết định của `handoff`; giữ quan hệ với thượng nguồn `executed-change-and-observed-outcome` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Order/envelope, pump program and delivery, response/alarm trends, cumulative ledger, active decision and verifier state remain simultaneously visible around one line and drug identity
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `protocol-stage-and-titration-rule` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Active rate/dose, response and next permitted action remain primary; order/rule provenance and cumulative history become synchronized drawers, while line/drug identity stays fixed
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `protocol-stage-and-titration-rule` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify patient/drug/concentration/line → confirm protocol stage and ordered envelope → reconcile ordered, programmed and delivered values in one triad → review the bounded response window plus cumulative dose/fluid exposure → choose titrate, hold or rescue → obtain independent verification → execute once → observe outcome → hand off; the active action and rescue remain reachable, while history yields to an exposure ledger route rather than stacked trend panels
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `protocol-stage-and-titration-rule` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad → patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm identity mismatch/matched, order pending/active/amended/stale, concentration or line confirmed/conflicting, protocol stage active/criteria unmet, rate within/outside envelope, pump connecting/running/paused/occluded/disconnected, delivery event delayed/conflicting, response stable/worsening/threshold crossed, cumulative ledger incomplete/reconciled, decision draft/verified/executing/reverted, rescue active, handoff sent/acknowledged and permission denied.

## Nghĩa vụ trạng thái

Task-specific states: identity mismatch/matched, order pending/active/amended/stale, concentration or line confirmed/conflicting, protocol stage active/criteria unmet, rate within/outside envelope, pump connecting/running/paused/occluded/disconnected, delivery event delayed/conflicting, response stable/worsening/threshold crossed, cumulative ledger incomplete/reconciled, decision draft/verified/executing/reverted, rescue active, handoff sent/acknowledged and permission denied.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-ITS-90`, `AR-ITS-91` hoặc `AR-ITS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [FDA infusion pumps](https://www.fda.gov/medical-devices/general-hospital-devices-and-supplies/infusion-pumps) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [FDA infusion-pump risk-reduction strategies for clinicians](https://www.fda.gov/medical-devices/infusion-pumps/infusion-pump-risk-reduction-strategies-clinicians) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [IHE Patient Care Device profiles](https://profiles.ihe.net/DEV/index.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ focus visibility around persistent surfaces. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "infusion-titration-safety-console",
  "matchedSituationCodes": [
    "AR-ITS-01",
    "AR-ITS-02",
    "AR-ITS-03",
    "AR-ITS-04"
  ],
  "aliases": [
    "infusion-titration-safety-console",
    "infusion-safety",
    "handoff"
  ],
  "dominantTask": "Titrate a continuous infusion by reconciling the medication order and protocol stage with pump programming and delivered events, observing patient response and cumulative dose/fluid, and requiring safety checks plus independent verification before each consequential change",
  "regions": [
    "infusion-safety",
    "patient-order-drug-concentration-and-line",
    "protocol-stage-and-titration-rule",
    "ordered-rate-and-dose-envelope",
    "ordered-versus-programmed-versus-delivered-triad",
    "patient-response-and-alarm-window",
    "cumulative-dose-fluid-and-exposure-ledger",
    "titrate-hold-or-rescue-decision",
    "independent-verification",
    "executed-change-and-observed-outcome",
    "handoff"
  ],
  "relationships": [
    "infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad ↔ patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff"
  ],
  "responsive": {
    "wide": "Order/envelope, pump program and delivery, response/alarm trends, cumulative ledger, active decision and verifier state remain simultaneously visible around one line and drug identity",
    "intermediate": "Active rate/dose, response and next permitted action remain primary; order/rule provenance and cumulative history become synchronized drawers, while line/drug identity stays fixed",
    "compact": "Verify patient/drug/concentration/line → confirm protocol stage and ordered envelope → reconcile ordered, programmed and delivered values in one triad → review the bounded response window plus cumulative dose/fluid exposure → choose titrate, hold or rescue → obtain independent verification → execute once → observe outcome → hand off; the active action and rescue remain reachable, while history yields to an exposure ledger route rather than stacked trend panels",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad → patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "protocol-stage-and-titration-rule",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "identity mismatch/matched",
    "order pending/active/amended/stale",
    "concentration or line confirmed/conflicting",
    "protocol stage active/criteria unmet",
    "rate within/outside envelope",
    "pump connecting/running/paused/occluded/disconnected",
    "delivery event delayed/conflicting",
    "response stable/worsening/threshold crossed",
    "cumulative ledger incomplete/reconciled",
    "decision draft/verified/executing/reverted",
    "rescue active",
    "handoff sent/acknowledged and permission denied"
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
