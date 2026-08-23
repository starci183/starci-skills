# Exposure contact followup workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `exposure-contact-followup-workbench` |
| Family | Flow |
| Dominant task | Theo dõi người qua từng exposure episode so với infectious window, risk theo episode, outreach có privacy boundary, monitoring, escalation/release và chain coverage. |
| Search aliases | exposure-contact-followup-workbench, contact-followup, chain-coverage-audit |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `contact-followup` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-ECF-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-ECF-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-ECF-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-ECF-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-ECF-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-ECF-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-ECF-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `exposure-contact-followup-workbench` khi và chỉ khi có evidence cho `AR-ECF-01` đến `AR-ECF-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-ECF-90` đến `AR-ECF-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ contact-followup
├─ index-case-and-infectious-window
├─ exposure-episode-ledger
├─ contact-person-network
├─ episode-specific-risk-classification
├─ identity-privacy-and-reachability
├─ outreach-and-instruction-state
├─ monitoring-test-and-symptom-timeline
├─ escalation-or-release
└─ chain-coverage-audit
```

Quan hệ bắt buộc: `contact-followup → index-case-and-infectious-window → exposure-episode-ledger ↔ contact-person-network → episode-specific-risk-classification → identity-privacy-and-reachability → outreach-and-instruction-state → monitoring-test-and-symptom-timeline → escalation-or-release → chain-coverage-audit`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `contact-followup` | Sở hữu trạng thái và quyết định của `contact-followup`; giữ quan hệ với hạ nguồn `index-case-and-infectious-window` mà không hấp thụ owner của vùng khác. |
| `index-case-and-infectious-window` | Sở hữu trạng thái và quyết định của `index-case-and-infectious-window`; giữ quan hệ với thượng nguồn `contact-followup` và hạ nguồn `exposure-episode-ledger` mà không hấp thụ owner của vùng khác. |
| `exposure-episode-ledger` | Sở hữu trạng thái và quyết định của `exposure-episode-ledger`; giữ quan hệ với thượng nguồn `index-case-and-infectious-window` và hạ nguồn `contact-person-network` mà không hấp thụ owner của vùng khác. |
| `contact-person-network` | Sở hữu trạng thái và quyết định của `contact-person-network`; giữ quan hệ với thượng nguồn `exposure-episode-ledger` và hạ nguồn `episode-specific-risk-classification` mà không hấp thụ owner của vùng khác. |
| `episode-specific-risk-classification` | Sở hữu trạng thái và quyết định của `episode-specific-risk-classification`; giữ quan hệ với thượng nguồn `contact-person-network` và hạ nguồn `identity-privacy-and-reachability` mà không hấp thụ owner của vùng khác. |
| `identity-privacy-and-reachability` | Sở hữu trạng thái và quyết định của `identity-privacy-and-reachability`; giữ quan hệ với thượng nguồn `episode-specific-risk-classification` và hạ nguồn `outreach-and-instruction-state` mà không hấp thụ owner của vùng khác. |
| `outreach-and-instruction-state` | Sở hữu trạng thái và quyết định của `outreach-and-instruction-state`; giữ quan hệ với thượng nguồn `identity-privacy-and-reachability` và hạ nguồn `monitoring-test-and-symptom-timeline` mà không hấp thụ owner của vùng khác. |
| `monitoring-test-and-symptom-timeline` | Sở hữu trạng thái và quyết định của `monitoring-test-and-symptom-timeline`; giữ quan hệ với thượng nguồn `outreach-and-instruction-state` và hạ nguồn `escalation-or-release` mà không hấp thụ owner của vùng khác. |
| `escalation-or-release` | Sở hữu trạng thái và quyết định của `escalation-or-release`; giữ quan hệ với thượng nguồn `monitoring-test-and-symptom-timeline` và hạ nguồn `chain-coverage-audit` mà không hấp thụ owner của vùng khác. |
| `chain-coverage-audit` | Sở hữu trạng thái và quyết định của `chain-coverage-audit`; giữ quan hệ với thượng nguồn `escalation-or-release` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Infectious window, episode ledger, contact network, selected risk evidence, outreach state and monitoring timeline remain linked; repeated contacts may have distinct episode states
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `exposure-episode-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Exposure episodes and active follow-up remain primary; network becomes a synchronized chain drawer and monitoring history moves behind the selected episode
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `exposure-episode-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify infectious window → select an exposure episode → confirm contact and episode-specific risk → apply privacy/reachability rules → outreach/instructions → monitor tests/symptoms → escalate or release → coverage audit; the network becomes an accessible chain/path list
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `exposure-episode-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `contact-followup → index-case-and-infectious-window → exposure-episode-ledger → contact-person-network → episode-specific-risk-classification → identity-privacy-and-reachability → outreach-and-instruction-state → monitoring-test-and-symptom-timeline → escalation-or-release → chain-coverage-audit`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm infectious window estimated/confirmed/changed, episode candidate/confirmed/duplicate/outside window, identity resolved/uncertain/redacted, risk unclassified/low/high/changed, contact reachable/unreachable/declined, outreach queued/sent/delivered/failed, monitoring active/missed/complete, symptom absent/present, test pending/negative/positive/inconclusive, escalation accepted/failed, release eligible/completed/revoked and chain gap open/closed.

## Nghĩa vụ trạng thái

Task-specific states: infectious window estimated/confirmed/changed, episode candidate/confirmed/duplicate/outside window, identity resolved/uncertain/redacted, risk unclassified/low/high/changed, contact reachable/unreachable/declined, outreach queued/sent/delivered/failed, monitoring active/missed/complete, symptom absent/present, test pending/negative/positive/inconclusive, escalation accepted/failed, release eligible/completed/revoked and chain gap open/closed.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-ECF-90`, `AR-ECF-91` hoặc `AR-ECF-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [WHO guideline on contact tracing](https://www.who.int/publications/i/item/9789240102965) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [CDC contact investigations for contagious diseases on flights](https://www.cdc.gov/port-health/contact-investigation/index.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [NIST — Privacy Framework](https://www.nist.gov/privacy-framework) | Hỗ trợ privacy risk framing. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "exposure-contact-followup-workbench",
  "matchedSituationCodes": [
    "AR-ECF-01",
    "AR-ECF-02",
    "AR-ECF-03",
    "AR-ECF-04"
  ],
  "aliases": [
    "exposure-contact-followup-workbench",
    "contact-followup",
    "chain-coverage-audit"
  ],
  "dominantTask": "Identify and follow people through discrete exposure episodes by relating each episode to an index case's infectious window, classifying episode-specific risk, conducting privacy-bounded outreach, monitoring symptoms/tests, and escalating or releasing the contact with chain-coverage proof",
  "regions": [
    "contact-followup",
    "index-case-and-infectious-window",
    "exposure-episode-ledger",
    "contact-person-network",
    "episode-specific-risk-classification",
    "identity-privacy-and-reachability",
    "outreach-and-instruction-state",
    "monitoring-test-and-symptom-timeline",
    "escalation-or-release",
    "chain-coverage-audit"
  ],
  "relationships": [
    "contact-followup → index-case-and-infectious-window → exposure-episode-ledger ↔ contact-person-network → episode-specific-risk-classification → identity-privacy-and-reachability → outreach-and-instruction-state → monitoring-test-and-symptom-timeline → escalation-or-release → chain-coverage-audit"
  ],
  "responsive": {
    "wide": "Infectious window, episode ledger, contact network, selected risk evidence, outreach state and monitoring timeline remain linked; repeated contacts may have distinct episode states",
    "intermediate": "Exposure episodes and active follow-up remain primary; network becomes a synchronized chain drawer and monitoring history moves behind the selected episode",
    "compact": "Verify infectious window → select an exposure episode → confirm contact and episode-specific risk → apply privacy/reachability rules → outreach/instructions → monitor tests/symptoms → escalate or release → coverage audit; the network becomes an accessible chain/path list",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "contact-followup → index-case-and-infectious-window → exposure-episode-ledger → contact-person-network → episode-specific-risk-classification → identity-privacy-and-reachability → outreach-and-instruction-state → monitoring-test-and-symptom-timeline → escalation-or-release → chain-coverage-audit",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "exposure-episode-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "infectious window estimated/confirmed/changed",
    "episode candidate/confirmed/duplicate/outside window",
    "identity resolved/uncertain/redacted",
    "risk unclassified/low/high/changed",
    "contact reachable/unreachable/declined",
    "outreach queued/sent/delivered/failed",
    "monitoring active/missed/complete",
    "symptom absent/present",
    "test pending/negative/positive/inconclusive",
    "escalation accepted/failed",
    "release eligible/completed/revoked and chain gap open/closed"
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
