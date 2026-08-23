# Public health outbreak hypothesis workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `public-health-outbreak-hypothesis-workbench` |
| Family | Work |
| Dominant task | Điều tra outbreak bằng case definition có phiên bản, line list tái tính, projection time/place/network, giả thuyết cạnh tranh, control và reporting lag. |
| Search aliases | public-health-outbreak-hypothesis-workbench, outbreak-investigation, hypothesis-status-and-investigation-log |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `outbreak-investigation` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-PHO-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-PHO-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-PHO-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-PHO-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-PHO-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-PHO-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-PHO-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `public-health-outbreak-hypothesis-workbench` khi và chỉ khi có evidence cho `AR-PHO-01` đến `AR-PHO-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-PHO-90` đến `AR-PHO-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ outbreak-investigation
├─ case-definition-version
├─ case-membership-recomputation-ledger
├─ recomputed-line-list
├─ synchronized-epidemic-curve
├─ place-map
├─ exposure-and-contact-network
├─ hypothesis-register
├─ analytic-comparison-results
├─ control-measures-and-reporting-lag
└─ hypothesis-status-and-investigation-log
```

Quan hệ bắt buộc: `outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve ↔ place-map ↔ exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `outbreak-investigation` | Sở hữu trạng thái và quyết định của `outbreak-investigation`; giữ quan hệ với hạ nguồn `case-definition-version` mà không hấp thụ owner của vùng khác. |
| `case-definition-version` | Sở hữu trạng thái và quyết định của `case-definition-version`; giữ quan hệ với thượng nguồn `outbreak-investigation` và hạ nguồn `case-membership-recomputation-ledger` mà không hấp thụ owner của vùng khác. |
| `case-membership-recomputation-ledger` | Sở hữu trạng thái và quyết định của `case-membership-recomputation-ledger`; giữ quan hệ với thượng nguồn `case-definition-version` và hạ nguồn `recomputed-line-list` mà không hấp thụ owner của vùng khác. |
| `recomputed-line-list` | Sở hữu trạng thái và quyết định của `recomputed-line-list`; giữ quan hệ với thượng nguồn `case-membership-recomputation-ledger` và hạ nguồn `synchronized-epidemic-curve` mà không hấp thụ owner của vùng khác. |
| `synchronized-epidemic-curve` | Sở hữu trạng thái và quyết định của `synchronized-epidemic-curve`; giữ quan hệ với thượng nguồn `recomputed-line-list` và hạ nguồn `place-map` mà không hấp thụ owner của vùng khác. |
| `place-map` | Sở hữu trạng thái và quyết định của `place-map`; giữ quan hệ với thượng nguồn `synchronized-epidemic-curve` và hạ nguồn `exposure-and-contact-network` mà không hấp thụ owner của vùng khác. |
| `exposure-and-contact-network` | Sở hữu trạng thái và quyết định của `exposure-and-contact-network`; giữ quan hệ với thượng nguồn `place-map` và hạ nguồn `hypothesis-register` mà không hấp thụ owner của vùng khác. |
| `hypothesis-register` | Sở hữu trạng thái và quyết định của `hypothesis-register`; giữ quan hệ với thượng nguồn `exposure-and-contact-network` và hạ nguồn `analytic-comparison-results` mà không hấp thụ owner của vùng khác. |
| `analytic-comparison-results` | Sở hữu trạng thái và quyết định của `analytic-comparison-results`; giữ quan hệ với thượng nguồn `hypothesis-register` và hạ nguồn `control-measures-and-reporting-lag` mà không hấp thụ owner của vùng khác. |
| `control-measures-and-reporting-lag` | Sở hữu trạng thái và quyết định của `control-measures-and-reporting-lag`; giữ quan hệ với thượng nguồn `analytic-comparison-results` và hạ nguồn `hypothesis-status-and-investigation-log` mà không hấp thụ owner của vùng khác. |
| `hypothesis-status-and-investigation-log` | Sở hữu trạng thái và quyết định của `hypothesis-status-and-investigation-log`; giữ quan hệ với thượng nguồn `control-measures-and-reporting-lag` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Case-definition version, line-list summary, epidemic curve, place map, exposure network, hypothesis register and control/lag context remain linked; selecting a case or interval propagates across every projection
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `case-membership-recomputation-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: One selected time/place/network projection remains primary with the hypothesis register; the other projections become explicit switches, while case-definition and reporting-lag banners remain persistent
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `case-membership-recomputation-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Confirm or revise the case-definition version → review membership changes and exclusions → wait for recomputed line-list counts → step through accessible time, place and network projections from the same recomputation receipt → open one hypothesis → compare supporting/opposing results → account for control timing/reporting lag → update status/log; maps and networks yield to table/path alternatives, and hypothesis actions stay blocked while any projection is stale
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `case-membership-recomputation-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve → place-map → exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm case definition draft/active/superseded, case suspected/probable/confirmed/excluded/reclassified, line list loading/incomplete/stale, location redacted/unavailable, exposure link known/uncertain, hypothesis proposed/under test/supported/weakened/refuted, analysis pending/failed/ready, control planned/active/lifted, reporting lag estimated/changed and investigation log appended/conflicted.

## Nghĩa vụ trạng thái

Task-specific states: case definition draft/active/superseded, case suspected/probable/confirmed/excluded/reclassified, line list loading/incomplete/stale, location redacted/unavailable, exposure link known/uncertain, hypothesis proposed/under test/supported/weakened/refuted, analysis pending/failed/ready, control planned/active/lifted, reporting lag estimated/changed and investigation log appended/conflicted.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PHO-90`, `AR-PHO-91` hoặc `AR-PHO-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [CDC Field Epidemiology Manual: Conducting a Field Investigation](https://www.cdc.gov/field-epi-manual/php/chapters/field-investigation.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [CDC foodborne outbreak investigation steps](https://www.cdc.gov/foodborne-outbreaks/outbreak-basics/investigation-steps.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WHO Outbreak Toolkit](https://www.who.int/emergencies/outbreak-toolkit) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [Esri — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Hỗ trợ map and alternative-view layout considerations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "public-health-outbreak-hypothesis-workbench",
  "matchedSituationCodes": [
    "AR-PHO-01",
    "AR-PHO-02",
    "AR-PHO-03",
    "AR-PHO-04"
  ],
  "aliases": [
    "public-health-outbreak-hypothesis-workbench",
    "outbreak-investigation",
    "hypothesis-status-and-investigation-log"
  ],
  "dominantTask": "Investigate an outbreak by maintaining a versioned case definition and line list, comparing time/place/exposure-network projections, testing source or transmission hypotheses, and tracking control measures plus reporting lag as evidence changes",
  "regions": [
    "outbreak-investigation",
    "case-definition-version",
    "case-membership-recomputation-ledger",
    "recomputed-line-list",
    "synchronized-epidemic-curve",
    "place-map",
    "exposure-and-contact-network",
    "hypothesis-register",
    "analytic-comparison-results",
    "control-measures-and-reporting-lag",
    "hypothesis-status-and-investigation-log"
  ],
  "relationships": [
    "outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve ↔ place-map ↔ exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log"
  ],
  "responsive": {
    "wide": "Case-definition version, line-list summary, epidemic curve, place map, exposure network, hypothesis register and control/lag context remain linked; selecting a case or interval propagates across every projection",
    "intermediate": "One selected time/place/network projection remains primary with the hypothesis register; the other projections become explicit switches, while case-definition and reporting-lag banners remain persistent",
    "compact": "Confirm or revise the case-definition version → review membership changes and exclusions → wait for recomputed line-list counts → step through accessible time, place and network projections from the same recomputation receipt → open one hypothesis → compare supporting/opposing results → account for control timing/reporting lag → update status/log; maps and networks yield to table/path alternatives, and hypothesis actions stay blocked while any projection is stale",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve → place-map → exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "case-membership-recomputation-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "case definition draft/active/superseded",
    "case suspected/probable/confirmed/excluded/reclassified",
    "line list loading/incomplete/stale",
    "location redacted/unavailable",
    "exposure link known/uncertain",
    "hypothesis proposed/under test/supported/weakened/refuted",
    "analysis pending/failed/ready",
    "control planned/active/lifted",
    "reporting lag estimated/changed and investigation log appended/conflicted"
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
