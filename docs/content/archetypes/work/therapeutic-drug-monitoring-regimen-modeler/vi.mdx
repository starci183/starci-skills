# Therapeutic drug monitoring regimen modeler

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `therapeutic-drug-monitoring-regimen-modeler` |
| Family | Work |
| Dominant task | Dựng lại dose event và timed concentration, ước lượng exposure có bất định, so candidate regimen trong therapeutic window và chọn regimen cùng lần lấy mẫu tiếp theo. |
| Search aliases | therapeutic-drug-monitoring-regimen-modeler, tdm-modeler, follow-up-receipt |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `tdm-modeler` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-TDM-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-TDM-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-TDM-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-TDM-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-TDM-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-TDM-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-TDM-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `therapeutic-drug-monitoring-regimen-modeler` khi và chỉ khi có evidence cho `AR-TDM-01` đến `AR-TDM-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-TDM-90` đến `AR-TDM-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ tdm-modeler
├─ patient-drug-and-target-context
├─ administered-dose-event-timeline
├─ timed-concentration-samples
├─ fitted-pk-state-and-uncertainty
├─ therapeutic-exposure-window
├─ candidate-regimen-projections
├─ efficacy-toxicity-tradeoff
├─ recommended-regimen-and-next-sample-plan
└─ follow-up-receipt
```

Quan hệ bắt buộc: `tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline ↔ timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `tdm-modeler` | Sở hữu trạng thái và quyết định của `tdm-modeler`; giữ quan hệ với hạ nguồn `patient-drug-and-target-context` mà không hấp thụ owner của vùng khác. |
| `patient-drug-and-target-context` | Sở hữu trạng thái và quyết định của `patient-drug-and-target-context`; giữ quan hệ với thượng nguồn `tdm-modeler` và hạ nguồn `administered-dose-event-timeline` mà không hấp thụ owner của vùng khác. |
| `administered-dose-event-timeline` | Sở hữu trạng thái và quyết định của `administered-dose-event-timeline`; giữ quan hệ với thượng nguồn `patient-drug-and-target-context` và hạ nguồn `timed-concentration-samples` mà không hấp thụ owner của vùng khác. |
| `timed-concentration-samples` | Sở hữu trạng thái và quyết định của `timed-concentration-samples`; giữ quan hệ với thượng nguồn `administered-dose-event-timeline` và hạ nguồn `fitted-pk-state-and-uncertainty` mà không hấp thụ owner của vùng khác. |
| `fitted-pk-state-and-uncertainty` | Sở hữu trạng thái và quyết định của `fitted-pk-state-and-uncertainty`; giữ quan hệ với thượng nguồn `timed-concentration-samples` và hạ nguồn `therapeutic-exposure-window` mà không hấp thụ owner của vùng khác. |
| `therapeutic-exposure-window` | Sở hữu trạng thái và quyết định của `therapeutic-exposure-window`; giữ quan hệ với thượng nguồn `fitted-pk-state-and-uncertainty` và hạ nguồn `candidate-regimen-projections` mà không hấp thụ owner của vùng khác. |
| `candidate-regimen-projections` | Sở hữu trạng thái và quyết định của `candidate-regimen-projections`; giữ quan hệ với thượng nguồn `therapeutic-exposure-window` và hạ nguồn `efficacy-toxicity-tradeoff` mà không hấp thụ owner của vùng khác. |
| `efficacy-toxicity-tradeoff` | Sở hữu trạng thái và quyết định của `efficacy-toxicity-tradeoff`; giữ quan hệ với thượng nguồn `candidate-regimen-projections` và hạ nguồn `recommended-regimen-and-next-sample-plan` mà không hấp thụ owner của vùng khác. |
| `recommended-regimen-and-next-sample-plan` | Sở hữu trạng thái và quyết định của `recommended-regimen-and-next-sample-plan`; giữ quan hệ với thượng nguồn `efficacy-toxicity-tradeoff` và hạ nguồn `follow-up-receipt` mà không hấp thụ owner của vùng khác. |
| `follow-up-receipt` | Sở hữu trạng thái và quyết định của `follow-up-receipt`; giữ quan hệ với thượng nguồn `recommended-regimen-and-next-sample-plan` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Dose/sample timeline, fitted state, exposure window, candidate projections and trade-off/recommendation remain simultaneously linked; changing a timing fact invalidates dependent estimates visibly
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `administered-dose-event-timeline` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Dose/sample timing and one candidate projection remain primary; model uncertainty and alternative regimens become synchronized drawers, while target-window status persists
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `administered-dose-event-timeline` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify actual doses → place/confirm timed samples → inspect fitted exposure with tabular interval alternative → compare one candidate regimen at a time → review efficacy/toxicity → choose regimen → schedule next sample → follow-up receipt; no stack of miniature curves
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `administered-dose-event-timeline` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline → timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm dose event confirmed/missed/uncertain, sample time valid/ambiguous/missing, assay result pending/available/flagged, fit calculating/converged/poor/unavailable, uncertainty acceptable/wide, exposure below/within/above target, candidate feasible/contraindicated, recommendation draft/signed/superseded, next sample scheduled/missed and follow-up received/overdue.

## Nghĩa vụ trạng thái

Task-specific states: dose event confirmed/missed/uncertain, sample time valid/ambiguous/missing, assay result pending/available/flagged, fit calculating/converged/poor/unavailable, uncertainty acceptable/wide, exposure below/within/above target, candidate feasible/contraindicated, recommendation draft/signed/superseded, next sample scheduled/missed and follow-up received/overdue.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-TDM-90`, `AR-TDM-91` hoặc `AR-TDM-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [FDA analysis of therapeutic drug monitoring in drug labels](https://www.fda.gov/science-research/fda-stem-outreach-education-and-engagement/analysis-therapeutic-drug-monitoring-drug-labels) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [FDA Population Pharmacokinetics guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/population-pharmacokinetics) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [EMA reporting population pharmacokinetic analyses guideline](https://www.ema.europa.eu/en/reporting-results-population-pharmacokinetic-analyses-scientific-guideline) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "therapeutic-drug-monitoring-regimen-modeler",
  "matchedSituationCodes": [
    "AR-TDM-01",
    "AR-TDM-02",
    "AR-TDM-03",
    "AR-TDM-04"
  ],
  "aliases": [
    "therapeutic-drug-monitoring-regimen-modeler",
    "tdm-modeler",
    "follow-up-receipt"
  ],
  "dominantTask": "Reconstruct dose and timed-concentration history, estimate an exposure state with uncertainty, compare candidate regimens against a therapeutic window and toxicity/efficacy trade-off, then recommend a regimen plus the next informative sample",
  "regions": [
    "tdm-modeler",
    "patient-drug-and-target-context",
    "administered-dose-event-timeline",
    "timed-concentration-samples",
    "fitted-pk-state-and-uncertainty",
    "therapeutic-exposure-window",
    "candidate-regimen-projections",
    "efficacy-toxicity-tradeoff",
    "recommended-regimen-and-next-sample-plan",
    "follow-up-receipt"
  ],
  "relationships": [
    "tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline ↔ timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt"
  ],
  "responsive": {
    "wide": "Dose/sample timeline, fitted state, exposure window, candidate projections and trade-off/recommendation remain simultaneously linked; changing a timing fact invalidates dependent estimates visibly",
    "intermediate": "Dose/sample timing and one candidate projection remain primary; model uncertainty and alternative regimens become synchronized drawers, while target-window status persists",
    "compact": "Verify actual doses → place/confirm timed samples → inspect fitted exposure with tabular interval alternative → compare one candidate regimen at a time → review efficacy/toxicity → choose regimen → schedule next sample → follow-up receipt; no stack of miniature curves",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline → timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "administered-dose-event-timeline",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "dose event confirmed/missed/uncertain",
    "sample time valid/ambiguous/missing",
    "assay result pending/available/flagged",
    "fit calculating/converged/poor/unavailable",
    "uncertainty acceptable/wide",
    "exposure below/within/above target",
    "candidate feasible/contraindicated",
    "recommendation draft/signed/superseded",
    "next sample scheduled/missed and follow-up received/overdue"
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
