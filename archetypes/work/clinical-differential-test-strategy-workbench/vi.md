# Clinical differential test strategy workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `clinical-differential-test-strategy-workbench` |
| Family | Work |
| Dominant task | Xây dựng và cập nhật chiến lược xét nghiệm chẩn đoán bằng cách so sánh nhiều chẩn đoán cạnh tranh, cân nhắc khả năng phân biệt với tác hại, cập nhật xác suất sau kết quả và kết thúc qua cổng không-bỏ-sót. |
| Search aliases | clinical-differential-test-strategy-workbench, diagnostic-strategy, disposition-rationale |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `diagnostic-strategy` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CDT-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-CDT-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-CDT-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-CDT-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-CDT-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-CDT-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-CDT-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `clinical-differential-test-strategy-workbench` khi và chỉ khi có evidence cho `AR-CDT-01` đến `AR-CDT-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-CDT-90` đến `AR-CDT-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ diagnostic-strategy
├─ problem-representation-and-urgency
├─ competing-diagnosis-prior-set
├─ discriminating-finding-ledger
├─ next-test-expected-discrimination-and-harm
├─ ordered-test-sequence-and-stopping-rules
├─ result-driven-prior-to-posterior-update-ledger
├─ posterior-rank-and-no-miss-gate
└─ disposition-rationale
```

Quan hệ bắt buộc: `diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set ↔ discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `diagnostic-strategy` | Sở hữu trạng thái và quyết định của `diagnostic-strategy`; giữ quan hệ với hạ nguồn `problem-representation-and-urgency` mà không hấp thụ owner của vùng khác. |
| `problem-representation-and-urgency` | Sở hữu trạng thái và quyết định của `problem-representation-and-urgency`; giữ quan hệ với thượng nguồn `diagnostic-strategy` và hạ nguồn `competing-diagnosis-prior-set` mà không hấp thụ owner của vùng khác. |
| `competing-diagnosis-prior-set` | Sở hữu trạng thái và quyết định của `competing-diagnosis-prior-set`; giữ quan hệ với thượng nguồn `problem-representation-and-urgency` và hạ nguồn `discriminating-finding-ledger` mà không hấp thụ owner của vùng khác. |
| `discriminating-finding-ledger` | Sở hữu trạng thái và quyết định của `discriminating-finding-ledger`; giữ quan hệ với thượng nguồn `competing-diagnosis-prior-set` và hạ nguồn `next-test-expected-discrimination-and-harm` mà không hấp thụ owner của vùng khác. |
| `next-test-expected-discrimination-and-harm` | Sở hữu trạng thái và quyết định của `next-test-expected-discrimination-and-harm`; giữ quan hệ với thượng nguồn `discriminating-finding-ledger` và hạ nguồn `ordered-test-sequence-and-stopping-rules` mà không hấp thụ owner của vùng khác. |
| `ordered-test-sequence-and-stopping-rules` | Sở hữu trạng thái và quyết định của `ordered-test-sequence-and-stopping-rules`; giữ quan hệ với thượng nguồn `next-test-expected-discrimination-and-harm` và hạ nguồn `result-driven-prior-to-posterior-update-ledger` mà không hấp thụ owner của vùng khác. |
| `result-driven-prior-to-posterior-update-ledger` | Sở hữu trạng thái và quyết định của `result-driven-prior-to-posterior-update-ledger`; giữ quan hệ với thượng nguồn `ordered-test-sequence-and-stopping-rules` và hạ nguồn `posterior-rank-and-no-miss-gate` mà không hấp thụ owner của vùng khác. |
| `posterior-rank-and-no-miss-gate` | Sở hữu trạng thái và quyết định của `posterior-rank-and-no-miss-gate`; giữ quan hệ với thượng nguồn `result-driven-prior-to-posterior-update-ledger` và hạ nguồn `disposition-rationale` mà không hấp thụ owner của vùng khác. |
| `disposition-rationale` | Sở hữu trạng thái và quyết định của `disposition-rationale`; giữ quan hệ với thượng nguồn `posterior-rank-and-no-miss-gate` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Competing diagnoses, discriminating findings, candidate-test trade-offs and the ordered test sequence remain simultaneously visible; selecting a test or result highlights every hypothesis it changes
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `discriminating-finding-ledger` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Hypothesis ranks and the active test decision retain a split; finding provenance and completed updates move to synchronized drawers, while the no-miss status remains persistent
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `discriminating-finding-ledger` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Urgency gate → explicit competing priors → one diagnosis with for/against discriminators → next-test discrimination and harm → observed result → named prior-to-posterior delta for every affected diagnosis → stopping/no-miss gate → disposition; the full hypothesis matrix becomes a bounded accessible review route, while the active update and dangerous-alternative status remain in the primary sequence
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `discriminating-finding-ledger` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set → discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm problem representation incomplete/ready, diagnosis prior unknown/estimated, discriminator supporting/opposing/absent, test available/unavailable/contraindicated, result pending/positive/negative/indeterminate/error, posterior recalculating/stale, stop rule met/not met, dangerous alternative unresolved, disposition drafted/signed/amended and permission-limited evidence.

## Nghĩa vụ trạng thái

Task-specific states: problem representation incomplete/ready, diagnosis prior unknown/estimated, discriminator supporting/opposing/absent, test available/unavailable/contraindicated, result pending/positive/negative/indeterminate/error, posterior recalculating/stale, stop rule met/not met, dangerous alternative unresolved, disposition drafted/signed/amended and permission-limited evidence.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CDT-90`, `AR-CDT-91` hoặc `AR-CDT-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [AHRQ Probabilistic Thinking in the Diagnosis Process](https://www.ahrq.gov/diagnostic-safety/resources/issue-briefs/probabilistic-thinking3.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [NICE current guidance for reviewing evidence](https://www.nice.org.uk/process/pmg20/chapter/reviewing-evidence) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "clinical-differential-test-strategy-workbench",
  "matchedSituationCodes": [
    "AR-CDT-01",
    "AR-CDT-02",
    "AR-CDT-03",
    "AR-CDT-04"
  ],
  "aliases": [
    "clinical-differential-test-strategy-workbench",
    "diagnostic-strategy",
    "disposition-rationale"
  ],
  "dominantTask": "Construct and revise a diagnostic test strategy by comparing competing diagnoses, choosing discriminating tests with explicit harms and stopping rules, updating likelihoods from results, and closing with a no-miss disposition rationale",
  "regions": [
    "diagnostic-strategy",
    "problem-representation-and-urgency",
    "competing-diagnosis-prior-set",
    "discriminating-finding-ledger",
    "next-test-expected-discrimination-and-harm",
    "ordered-test-sequence-and-stopping-rules",
    "result-driven-prior-to-posterior-update-ledger",
    "posterior-rank-and-no-miss-gate",
    "disposition-rationale"
  ],
  "relationships": [
    "diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set ↔ discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale"
  ],
  "responsive": {
    "wide": "Competing diagnoses, discriminating findings, candidate-test trade-offs and the ordered test sequence remain simultaneously visible; selecting a test or result highlights every hypothesis it changes",
    "intermediate": "Hypothesis ranks and the active test decision retain a split; finding provenance and completed updates move to synchronized drawers, while the no-miss status remains persistent",
    "compact": "Urgency gate → explicit competing priors → one diagnosis with for/against discriminators → next-test discrimination and harm → observed result → named prior-to-posterior delta for every affected diagnosis → stopping/no-miss gate → disposition; the full hypothesis matrix becomes a bounded accessible review route, while the active update and dangerous-alternative status remain in the primary sequence",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set → discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "discriminating-finding-ledger",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "problem representation incomplete/ready",
    "diagnosis prior unknown/estimated",
    "discriminator supporting/opposing/absent",
    "test available/unavailable/contraindicated",
    "result pending/positive/negative/indeterminate/error",
    "posterior recalculating/stale",
    "stop rule met/not met",
    "dangerous alternative unresolved",
    "disposition drafted/signed/amended and permission-limited evidence"
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
