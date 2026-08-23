# Clinical trial safety signal triage

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `clinical-trial-safety-signal-triage` |
| Family | Work |
| Dominant task | Phân loại tín hiệu an toàn thử nghiệm lâm sàng bằng denominator theo arm, population imbalance, case series, causality gap, validation và risk action. |
| Search aliases | clinical-trial-safety-signal-triage, signal-triage, signal-history |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `signal-triage` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CTS-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-CTS-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-CTS-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-CTS-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-CTS-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-CTS-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-CTS-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `clinical-trial-safety-signal-triage` khi và chỉ khi có evidence cho `AR-CTS-01` đến `AR-CTS-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-CTS-90` đến `AR-CTS-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ signal-triage
├─ product-program-exposure-and-period-context
├─ candidate-signal-queue
├─ adverse-event-case-series
├─ treatment-arm-denominator-and-background-rate
├─ imbalance-time-to-onset-and-subgroup-analyses
├─ selected-case-causality-and-data-gaps
├─ validation-and-prioritization
├─ assessment-or-risk-action-plan
└─ signal-history
```

Quan hệ bắt buộc: `signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series ↔ treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `signal-triage` | Sở hữu trạng thái và quyết định của `signal-triage`; giữ quan hệ với hạ nguồn `product-program-exposure-and-period-context` mà không hấp thụ owner của vùng khác. |
| `product-program-exposure-and-period-context` | Sở hữu trạng thái và quyết định của `product-program-exposure-and-period-context`; giữ quan hệ với thượng nguồn `signal-triage` và hạ nguồn `candidate-signal-queue` mà không hấp thụ owner của vùng khác. |
| `candidate-signal-queue` | Sở hữu trạng thái và quyết định của `candidate-signal-queue`; giữ quan hệ với thượng nguồn `product-program-exposure-and-period-context` và hạ nguồn `adverse-event-case-series` mà không hấp thụ owner của vùng khác. |
| `adverse-event-case-series` | Sở hữu trạng thái và quyết định của `adverse-event-case-series`; giữ quan hệ với thượng nguồn `candidate-signal-queue` và hạ nguồn `treatment-arm-denominator-and-background-rate` mà không hấp thụ owner của vùng khác. |
| `treatment-arm-denominator-and-background-rate` | Sở hữu trạng thái và quyết định của `treatment-arm-denominator-and-background-rate`; giữ quan hệ với thượng nguồn `adverse-event-case-series` và hạ nguồn `imbalance-time-to-onset-and-subgroup-analyses` mà không hấp thụ owner của vùng khác. |
| `imbalance-time-to-onset-and-subgroup-analyses` | Sở hữu trạng thái và quyết định của `imbalance-time-to-onset-and-subgroup-analyses`; giữ quan hệ với thượng nguồn `treatment-arm-denominator-and-background-rate` và hạ nguồn `selected-case-causality-and-data-gaps` mà không hấp thụ owner của vùng khác. |
| `selected-case-causality-and-data-gaps` | Sở hữu trạng thái và quyết định của `selected-case-causality-and-data-gaps`; giữ quan hệ với thượng nguồn `imbalance-time-to-onset-and-subgroup-analyses` và hạ nguồn `validation-and-prioritization` mà không hấp thụ owner của vùng khác. |
| `validation-and-prioritization` | Sở hữu trạng thái và quyết định của `validation-and-prioritization`; giữ quan hệ với thượng nguồn `selected-case-causality-and-data-gaps` và hạ nguồn `assessment-or-risk-action-plan` mà không hấp thụ owner của vùng khác. |
| `assessment-or-risk-action-plan` | Sở hữu trạng thái và quyết định của `assessment-or-risk-action-plan`; giữ quan hệ với thượng nguồn `validation-and-prioritization` và hạ nguồn `signal-history` mà không hấp thụ owner của vùng khác. |
| `signal-history` | Sở hữu trạng thái và quyết định của `signal-history`; giữ quan hệ với thượng nguồn `assessment-or-risk-action-plan` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Signal queue, arm/exposure context, population analyses, linked case series, causality gaps and action plan remain visible; a selected case never replaces the denominator view
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `signal-triage` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Population imbalance and selected signal status remain primary; case series and subgroup/time-to-onset analyses alternate in synchronized panes, while action priority persists
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `signal-triage` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Select signal → verify trial arms/exposure period → inspect observed-versus-expected and subgroup/time-to-onset → review linked serious cases → resolve causality/data gaps → validate and prioritize → assign action → history; population evidence precedes case detail and the surface is not a dossier stack
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `signal-triage` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series → treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm signal new/under review/validated/refuted/closed, exposure denominator pending/stale/ready, case serious/non-serious/duplicate/unavailable, arm imbalance absent/present/uncertain, time-to-onset or subgroup analysis insufficient/ready, causality related/unrelated/indeterminate, data request pending/received/failed, priority recalculating, action drafted/approved/overdue and history amended.

## Nghĩa vụ trạng thái

Task-specific states: signal new/under review/validated/refuted/closed, exposure denominator pending/stale/ready, case serious/non-serious/duplicate/unavailable, arm imbalance absent/present/uncertain, time-to-onset or subgroup analysis insufficient/ready, causality related/unrelated/indeterminate, data request pending/received/failed, priority recalculating, action drafted/approved/overdue and history amended.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CTS-90`, `AR-CTS-91` hoặc `AR-CTS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [FDA safety reporting requirements for INDs and BA/BE studies](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/safety-reporting-requirements-inds-and-babe-studies) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [ICH E2A clinical safety data management](https://database.ich.org/sites/default/files/E2A_Guideline.pdf) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [EMA signal management](https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/pharmacovigilance-post-authorisation/signal-management) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "clinical-trial-safety-signal-triage",
  "matchedSituationCodes": [
    "AR-CTS-01",
    "AR-CTS-02",
    "AR-CTS-03",
    "AR-CTS-04"
  ],
  "aliases": [
    "clinical-trial-safety-signal-triage",
    "signal-triage",
    "signal-history"
  ],
  "dominantTask": "Triage a potential safety signal across a clinical-trial program by comparing exposed populations and background/arm rates, reviewing the linked adverse-event case series and causality gaps, validating the signal, and assigning a documented risk action",
  "regions": [
    "signal-triage",
    "product-program-exposure-and-period-context",
    "candidate-signal-queue",
    "adverse-event-case-series",
    "treatment-arm-denominator-and-background-rate",
    "imbalance-time-to-onset-and-subgroup-analyses",
    "selected-case-causality-and-data-gaps",
    "validation-and-prioritization",
    "assessment-or-risk-action-plan",
    "signal-history"
  ],
  "relationships": [
    "signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series ↔ treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history"
  ],
  "responsive": {
    "wide": "Signal queue, arm/exposure context, population analyses, linked case series, causality gaps and action plan remain visible; a selected case never replaces the denominator view",
    "intermediate": "Population imbalance and selected signal status remain primary; case series and subgroup/time-to-onset analyses alternate in synchronized panes, while action priority persists",
    "compact": "Select signal → verify trial arms/exposure period → inspect observed-versus-expected and subgroup/time-to-onset → review linked serious cases → resolve causality/data gaps → validate and prioritize → assign action → history; population evidence precedes case detail and the surface is not a dossier stack",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series → treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "signal-triage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "signal new/under review/validated/refuted/closed",
    "exposure denominator pending/stale/ready",
    "case serious/non-serious/duplicate/unavailable",
    "arm imbalance absent/present/uncertain",
    "time-to-onset or subgroup analysis insufficient/ready",
    "causality related/unrelated/indeterminate",
    "data request pending/received/failed",
    "priority recalculating",
    "action drafted/approved/overdue and history amended"
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
