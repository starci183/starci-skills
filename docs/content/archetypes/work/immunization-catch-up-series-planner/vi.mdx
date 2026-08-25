# Immunization catch up series planner

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `immunization-catch-up-series-planner` |
| Family | Work |
| Dominant task | Xác thực lịch sử vaccine, credit component của combination product vào nhiều antigen series và lập bundle sớm nhất mà không restart series hợp lệ. |
| Search aliases | immunization-catch-up-series-planner, catch-up-plan, scheduled-plan-and-registry-receipt |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `catch-up-plan` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-ICS-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-ICS-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-ICS-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-ICS-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-ICS-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-ICS-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-ICS-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `immunization-catch-up-series-planner` khi và chỉ khi có evidence cho `AR-ICS-01` đến `AR-ICS-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-ICS-90` đến `AR-ICS-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ catch-up-plan
├─ person-age-risk-and-policy-version
├─ administered-dose-event-ledger
├─ product-to-antigen-component-map
├─ per-antigen-series-state
├─ historical-dose-validity-and-minimum-interval-rules
├─ contraindication-and-special-situation-checks
├─ candidate-visit-dose-bundles
├─ earliest-valid-date-and-series-completion-proof
└─ scheduled-plan-and-registry-receipt
```

Quan hệ bắt buộc: `catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state ↔ historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `catch-up-plan` | Sở hữu trạng thái và quyết định của `catch-up-plan`; giữ quan hệ với hạ nguồn `person-age-risk-and-policy-version` mà không hấp thụ owner của vùng khác. |
| `person-age-risk-and-policy-version` | Sở hữu trạng thái và quyết định của `person-age-risk-and-policy-version`; giữ quan hệ với thượng nguồn `catch-up-plan` và hạ nguồn `administered-dose-event-ledger` mà không hấp thụ owner của vùng khác. |
| `administered-dose-event-ledger` | Sở hữu trạng thái và quyết định của `administered-dose-event-ledger`; giữ quan hệ với thượng nguồn `person-age-risk-and-policy-version` và hạ nguồn `product-to-antigen-component-map` mà không hấp thụ owner của vùng khác. |
| `product-to-antigen-component-map` | Sở hữu trạng thái và quyết định của `product-to-antigen-component-map`; giữ quan hệ với thượng nguồn `administered-dose-event-ledger` và hạ nguồn `per-antigen-series-state` mà không hấp thụ owner của vùng khác. |
| `per-antigen-series-state` | Sở hữu trạng thái và quyết định của `per-antigen-series-state`; giữ quan hệ với thượng nguồn `product-to-antigen-component-map` và hạ nguồn `historical-dose-validity-and-minimum-interval-rules` mà không hấp thụ owner của vùng khác. |
| `historical-dose-validity-and-minimum-interval-rules` | Sở hữu trạng thái và quyết định của `historical-dose-validity-and-minimum-interval-rules`; giữ quan hệ với thượng nguồn `per-antigen-series-state` và hạ nguồn `contraindication-and-special-situation-checks` mà không hấp thụ owner của vùng khác. |
| `contraindication-and-special-situation-checks` | Sở hữu trạng thái và quyết định của `contraindication-and-special-situation-checks`; giữ quan hệ với thượng nguồn `historical-dose-validity-and-minimum-interval-rules` và hạ nguồn `candidate-visit-dose-bundles` mà không hấp thụ owner của vùng khác. |
| `candidate-visit-dose-bundles` | Sở hữu trạng thái và quyết định của `candidate-visit-dose-bundles`; giữ quan hệ với thượng nguồn `contraindication-and-special-situation-checks` và hạ nguồn `earliest-valid-date-and-series-completion-proof` mà không hấp thụ owner của vùng khác. |
| `earliest-valid-date-and-series-completion-proof` | Sở hữu trạng thái và quyết định của `earliest-valid-date-and-series-completion-proof`; giữ quan hệ với thượng nguồn `candidate-visit-dose-bundles` và hạ nguồn `scheduled-plan-and-registry-receipt` mà không hấp thụ owner của vùng khác. |
| `scheduled-plan-and-registry-receipt` | Sở hữu trạng thái và quyết định của `scheduled-plan-and-registry-receipt`; giữ quan hệ với thượng nguồn `earliest-valid-date-and-series-completion-proof` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Dose history, product-to-antigen component map, per-antigen series matrix, validity/rule evidence and candidate visit bundles remain simultaneously visible; selecting one administered product highlights every series it credits
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `administered-dose-event-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: The active antigen series and candidate visit bundle remain primary; complete history, rule provenance and other series move to synchronized drawers, while contraindications and the earliest-valid date remain persistent
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `administered-dose-event-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify person, age/risk and policy version → choose one antigen series → validate each prior dose and product component → identify the missing step and earliest valid date → add coadministerable doses to one visit bundle → resolve contraindications → schedule and record registry receipt; the full multi-series matrix yields to a bounded accessible table route instead of stacked desktop panes
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `administered-dose-event-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state → historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm history loading/duplicate/uncertain, product component known/unknown, dose valid/too-early/not-counted, series complete/incomplete/conditional, minimum interval satisfied/pending, contraindication active/cleared/unknown, visit bundle feasible/conflicted, earliest date recalculating/stale, plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded.

## Nghĩa vụ trạng thái

Task-specific states: history loading/duplicate/uncertain, product component known/unknown, dose valid/too-early/not-counted, series complete/incomplete/conditional, minimum interval satisfied/pending, contraindication active/cleared/unknown, visit bundle feasible/conflicted, earliest date recalculating/stale, plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-ICS-90`, `AR-ICS-91` hoặc `AR-ICS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [CDC catch-up immunization schedule](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WHO recommendations for interrupted or delayed routine immunization](https://www.who.int/publications/m/item/table-3-recommendations-for-interrupted-or-delayed-routine-immunization-summary-of-who-position-papers) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard grid semantics. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "immunization-catch-up-series-planner",
  "matchedSituationCodes": [
    "AR-ICS-01",
    "AR-ICS-02",
    "AR-ICS-03",
    "AR-ICS-04"
  ],
  "aliases": [
    "immunization-catch-up-series-planner",
    "catch-up-plan",
    "scheduled-plan-and-registry-receipt"
  ],
  "dominantTask": "Validate administered doses across single-antigen and combination products, credit their antigen components to concurrent series, and build the earliest valid catch-up visit bundles without restarting any valid series",
  "regions": [
    "catch-up-plan",
    "person-age-risk-and-policy-version",
    "administered-dose-event-ledger",
    "product-to-antigen-component-map",
    "per-antigen-series-state",
    "historical-dose-validity-and-minimum-interval-rules",
    "contraindication-and-special-situation-checks",
    "candidate-visit-dose-bundles",
    "earliest-valid-date-and-series-completion-proof",
    "scheduled-plan-and-registry-receipt"
  ],
  "relationships": [
    "catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state ↔ historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt"
  ],
  "responsive": {
    "wide": "Dose history, product-to-antigen component map, per-antigen series matrix, validity/rule evidence and candidate visit bundles remain simultaneously visible; selecting one administered product highlights every series it credits",
    "intermediate": "The active antigen series and candidate visit bundle remain primary; complete history, rule provenance and other series move to synchronized drawers, while contraindications and the earliest-valid date remain persistent",
    "compact": "Verify person, age/risk and policy version → choose one antigen series → validate each prior dose and product component → identify the missing step and earliest valid date → add coadministerable doses to one visit bundle → resolve contraindications → schedule and record registry receipt; the full multi-series matrix yields to a bounded accessible table route instead of stacked desktop panes",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state → historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "administered-dose-event-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "history loading/duplicate/uncertain",
    "product component known/unknown",
    "dose valid/too-early/not-counted",
    "series complete/incomplete/conditional",
    "minimum interval satisfied/pending",
    "contraindication active/cleared/unknown",
    "visit bundle feasible/conflicted",
    "earliest date recalculating/stale",
    "plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded"
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
