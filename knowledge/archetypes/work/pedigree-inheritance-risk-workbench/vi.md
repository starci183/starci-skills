# Pedigree inheritance risk workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `pedigree-inheritance-risk-workbench` |
| Family | Work |
| Dominant task | Xây dựng pedigree, ghi quan hệ không chắc chắn và phenotype/genotype, kiểm mô hình di truyền bằng segregation rồi lập kịch bản recurrence risk và kế hoạch tư vấn. |
| Search aliases | pedigree-inheritance-risk-workbench, inheritance-risk, family-testing-and-counseling-plan |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `inheritance-risk` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-PIR-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-PIR-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-PIR-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-PIR-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-PIR-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-PIR-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-PIR-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `pedigree-inheritance-risk-workbench` khi và chỉ khi có evidence cho `AR-PIR-01` đến `AR-PIR-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-PIR-90` đến `AR-PIR-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ inheritance-risk
├─ proband-indication-and-consent
├─ pedigree-kinship-graph
├─ phenotype-onset-and-genotype-overlay
├─ relationship-certainty-and-consanguinity
├─ candidate-inheritance-models
├─ segregation-consistency
├─ recurrence-risk-scenarios
└─ family-testing-and-counseling-plan
```

Quan hệ bắt buộc: `inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph ↔ phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `inheritance-risk` | Sở hữu trạng thái và quyết định của `inheritance-risk`; giữ quan hệ với hạ nguồn `proband-indication-and-consent` mà không hấp thụ owner của vùng khác. |
| `proband-indication-and-consent` | Sở hữu trạng thái và quyết định của `proband-indication-and-consent`; giữ quan hệ với thượng nguồn `inheritance-risk` và hạ nguồn `pedigree-kinship-graph` mà không hấp thụ owner của vùng khác. |
| `pedigree-kinship-graph` | Sở hữu trạng thái và quyết định của `pedigree-kinship-graph`; giữ quan hệ với thượng nguồn `proband-indication-and-consent` và hạ nguồn `phenotype-onset-and-genotype-overlay` mà không hấp thụ owner của vùng khác. |
| `phenotype-onset-and-genotype-overlay` | Sở hữu trạng thái và quyết định của `phenotype-onset-and-genotype-overlay`; giữ quan hệ với thượng nguồn `pedigree-kinship-graph` và hạ nguồn `relationship-certainty-and-consanguinity` mà không hấp thụ owner của vùng khác. |
| `relationship-certainty-and-consanguinity` | Sở hữu trạng thái và quyết định của `relationship-certainty-and-consanguinity`; giữ quan hệ với thượng nguồn `phenotype-onset-and-genotype-overlay` và hạ nguồn `candidate-inheritance-models` mà không hấp thụ owner của vùng khác. |
| `candidate-inheritance-models` | Sở hữu trạng thái và quyết định của `candidate-inheritance-models`; giữ quan hệ với thượng nguồn `relationship-certainty-and-consanguinity` và hạ nguồn `segregation-consistency` mà không hấp thụ owner của vùng khác. |
| `segregation-consistency` | Sở hữu trạng thái và quyết định của `segregation-consistency`; giữ quan hệ với thượng nguồn `candidate-inheritance-models` và hạ nguồn `recurrence-risk-scenarios` mà không hấp thụ owner của vùng khác. |
| `recurrence-risk-scenarios` | Sở hữu trạng thái và quyết định của `recurrence-risk-scenarios`; giữ quan hệ với thượng nguồn `segregation-consistency` và hạ nguồn `family-testing-and-counseling-plan` mà không hấp thụ owner của vùng khác. |
| `family-testing-and-counseling-plan` | Sở hữu trạng thái và quyết định của `family-testing-and-counseling-plan`; giữ quan hệ với thượng nguồn `recurrence-risk-scenarios` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Pedigree graph, selected-relative evidence, inheritance-model comparison, segregation exceptions and recurrence scenarios remain linked; privacy and consent scope stay visible
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `inheritance-risk` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Pedigree and active inheritance model remain primary; relative detail becomes a synchronized drawer and risk scenarios move to a resumable review pane
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `inheritance-risk` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Proband/consent → generation and relationship list → selected-relative phenotype/genotype editor → choose inheritance model → inspect segregation-consistent and inconsistent relatives → review recurrence scenario → plan testing/counseling; a relationship path/list replaces a miniature graph
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `inheritance-risk` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph → phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm consent in/out/limited, relationship confirmed/uncertain/conflicting, relative alive/deceased/unknown, phenotype absent/present/onset unknown, genotype positive/negative/not tested/unavailable, model candidate/rejected/indeterminate, segregation consistent/exception, risk computable/range/unknown, privacy-redacted branch, plan draft/shared and stale after family evidence changes.

## Nghĩa vụ trạng thái

Task-specific states: consent in/out/limited, relationship confirmed/uncertain/conflicting, relative alive/deceased/unknown, phenotype absent/present/onset unknown, genotype positive/negative/not tested/unavailable, model candidate/rejected/indeterminate, segregation consistent/exception, risk computable/range/unknown, privacy-redacted branch, plan draft/shared and stale after family evidence changes.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PIR-90`, `AR-PIR-91` hoặc `AR-PIR-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [CDC genetic counseling and testing](https://www.cdc.gov/genomics-and-health/counseling-testing/genetic-counseling.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [HL7 FHIR FamilyMemberHistory](https://hl7.org/fhir/familymemberhistory.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "pedigree-inheritance-risk-workbench",
  "matchedSituationCodes": [
    "AR-PIR-01",
    "AR-PIR-02",
    "AR-PIR-03",
    "AR-PIR-04"
  ],
  "aliases": [
    "pedigree-inheritance-risk-workbench",
    "inheritance-risk",
    "family-testing-and-counseling-plan"
  ],
  "dominantTask": "Build and evaluate a family pedigree by recording uncertain relationships, phenotype onset and genotype evidence, testing candidate inheritance models through segregation, and producing recurrence-risk scenarios plus a family testing/counseling plan",
  "regions": [
    "inheritance-risk",
    "proband-indication-and-consent",
    "pedigree-kinship-graph",
    "phenotype-onset-and-genotype-overlay",
    "relationship-certainty-and-consanguinity",
    "candidate-inheritance-models",
    "segregation-consistency",
    "recurrence-risk-scenarios",
    "family-testing-and-counseling-plan"
  ],
  "relationships": [
    "inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph ↔ phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan"
  ],
  "responsive": {
    "wide": "Pedigree graph, selected-relative evidence, inheritance-model comparison, segregation exceptions and recurrence scenarios remain linked; privacy and consent scope stay visible",
    "intermediate": "Pedigree and active inheritance model remain primary; relative detail becomes a synchronized drawer and risk scenarios move to a resumable review pane",
    "compact": "Proband/consent → generation and relationship list → selected-relative phenotype/genotype editor → choose inheritance model → inspect segregation-consistent and inconsistent relatives → review recurrence scenario → plan testing/counseling; a relationship path/list replaces a miniature graph",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph → phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "inheritance-risk",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "consent in/out/limited",
    "relationship confirmed/uncertain/conflicting",
    "relative alive/deceased/unknown",
    "phenotype absent/present/onset unknown",
    "genotype positive/negative/not tested/unavailable",
    "model candidate/rejected/indeterminate",
    "segregation consistent/exception",
    "risk computable/range/unknown",
    "privacy-redacted branch",
    "plan draft/shared and stale after family evidence changes"
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
