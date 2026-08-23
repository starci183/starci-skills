# Antimicrobial susceptibility interpretation workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `antimicrobial-susceptibility-interpretation-workbench` |
| Family | Work |
| Dominant task | Diễn giải đo độ nhạy kháng sinh của một isolate bằng QC, breakpoint đúng organism và edition, expert rule, ngoại lệ và selective report có lineage. |
| Search aliases | antimicrobial-susceptibility-interpretation-workbench, ast-interpretation, release-and-amendment |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `ast-interpretation` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-AST-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-AST-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-AST-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-AST-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-AST-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-AST-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-AST-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `antimicrobial-susceptibility-interpretation-workbench` khi và chỉ khi có evidence cho `AR-AST-01` đến `AR-AST-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-AST-90` đến `AR-AST-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ ast-interpretation
├─ isolate-organism-and-method-context
├─ test-qc-and-validity
├─ organism-by-antimicrobial-measurement-matrix
├─ breakpoint-standard-and-edition-applicability
├─ measurement-to-category-derivation-cells
├─ expert-rule-and-phenotype-overrides
├─ uncertainty-and-exception-queue
├─ selective-report-preview
└─ release-and-amendment
```

Quan hệ bắt buộc: `ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells ↔ expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `ast-interpretation` | Sở hữu trạng thái và quyết định của `ast-interpretation`; giữ quan hệ với hạ nguồn `isolate-organism-and-method-context` mà không hấp thụ owner của vùng khác. |
| `isolate-organism-and-method-context` | Sở hữu trạng thái và quyết định của `isolate-organism-and-method-context`; giữ quan hệ với thượng nguồn `ast-interpretation` và hạ nguồn `test-qc-and-validity` mà không hấp thụ owner của vùng khác. |
| `test-qc-and-validity` | Sở hữu trạng thái và quyết định của `test-qc-and-validity`; giữ quan hệ với thượng nguồn `isolate-organism-and-method-context` và hạ nguồn `organism-by-antimicrobial-measurement-matrix` mà không hấp thụ owner của vùng khác. |
| `organism-by-antimicrobial-measurement-matrix` | Sở hữu trạng thái và quyết định của `organism-by-antimicrobial-measurement-matrix`; giữ quan hệ với thượng nguồn `test-qc-and-validity` và hạ nguồn `breakpoint-standard-and-edition-applicability` mà không hấp thụ owner của vùng khác. |
| `breakpoint-standard-and-edition-applicability` | Sở hữu trạng thái và quyết định của `breakpoint-standard-and-edition-applicability`; giữ quan hệ với thượng nguồn `organism-by-antimicrobial-measurement-matrix` và hạ nguồn `measurement-to-category-derivation-cells` mà không hấp thụ owner của vùng khác. |
| `measurement-to-category-derivation-cells` | Sở hữu trạng thái và quyết định của `measurement-to-category-derivation-cells`; giữ quan hệ với thượng nguồn `breakpoint-standard-and-edition-applicability` và hạ nguồn `expert-rule-and-phenotype-overrides` mà không hấp thụ owner của vùng khác. |
| `expert-rule-and-phenotype-overrides` | Sở hữu trạng thái và quyết định của `expert-rule-and-phenotype-overrides`; giữ quan hệ với thượng nguồn `measurement-to-category-derivation-cells` và hạ nguồn `uncertainty-and-exception-queue` mà không hấp thụ owner của vùng khác. |
| `uncertainty-and-exception-queue` | Sở hữu trạng thái và quyết định của `uncertainty-and-exception-queue`; giữ quan hệ với thượng nguồn `expert-rule-and-phenotype-overrides` và hạ nguồn `selective-report-preview` mà không hấp thụ owner của vùng khác. |
| `selective-report-preview` | Sở hữu trạng thái và quyết định của `selective-report-preview`; giữ quan hệ với thượng nguồn `uncertainty-and-exception-queue` và hạ nguồn `release-and-amendment` mà không hấp thụ owner của vùng khác. |
| `release-and-amendment` | Sở hữu trạng thái và quyết định của `release-and-amendment`; giữ quan hệ với thượng nguồn `selective-report-preview` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Isolate/method context, bounded antimicrobial matrix, breakpoint/rule evidence, exception queue and report preview remain visible; each derived category can be traced to measurement plus applicable rule
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `organism-by-antimicrobial-measurement-matrix` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: The matrix and selected drug interpretation remain primary; breakpoint edition and rule provenance become synchronized detail, while exceptions and preview alternate in a secondary pane
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `organism-by-antimicrobial-measurement-matrix` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Validate isolate/organism/method/QC → select one organism×drug matrix cell → review MIC/zone measurement → confirm exact breakpoint standard and edition → inspect derived category plus expert-rule override → resolve exception → decide include/suppress → release/amend; the complete matrix remains one bounded table route and the selected cell keeps measurement→edition→category lineage
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `organism-by-antimicrobial-measurement-matrix` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells → expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm organism identified/uncertain/changed, method supported/unsupported, QC pending/pass/fail, MIC or zone missing/off-scale/valid, breakpoint applicable/not applicable/version stale, category susceptible/increased-exposure/resistant/indeterminate, expert rule applied/conflicting, report included/suppressed, release pending/signed/amended and permission-limited rule detail.

## Nghĩa vụ trạng thái

Task-specific states: organism identified/uncertain/changed, method supported/unsupported, QC pending/pass/fail, MIC or zone missing/off-scale/valid, breakpoint applicable/not applicable/version stale, category susceptible/increased-exposure/resistant/indeterminate, expert rule applied/conflicting, report included/suppressed, release pending/signed/amended and permission-limited rule detail.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-AST-90`, `AR-AST-91` hoặc `AR-AST-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [EUCAST current clinical breakpoint tables](https://www.eucast.org/bacteria/clinical-breakpoints-and-interpretation/clinical-breakpoint-tables/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [FDA antibacterial susceptibility test interpretive criteria](https://www.fda.gov/drugs/development-resources/antibacterial-susceptibility-test-interpretive-criteria) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [CLSI M100](https://clsi.org/shop/standards/m100/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard grid semantics. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "antimicrobial-susceptibility-interpretation-workbench",
  "matchedSituationCodes": [
    "AR-AST-01",
    "AR-AST-02",
    "AR-AST-03",
    "AR-AST-04"
  ],
  "aliases": [
    "antimicrobial-susceptibility-interpretation-workbench",
    "ast-interpretation",
    "release-and-amendment"
  ],
  "dominantTask": "Interpret antimicrobial susceptibility measurements for one isolate by validating method QC, applying the correct organism-specific breakpoint edition and expert rules, resolving exceptions, and releasing a selective report with amendment lineage",
  "regions": [
    "ast-interpretation",
    "isolate-organism-and-method-context",
    "test-qc-and-validity",
    "organism-by-antimicrobial-measurement-matrix",
    "breakpoint-standard-and-edition-applicability",
    "measurement-to-category-derivation-cells",
    "expert-rule-and-phenotype-overrides",
    "uncertainty-and-exception-queue",
    "selective-report-preview",
    "release-and-amendment"
  ],
  "relationships": [
    "ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells ↔ expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment"
  ],
  "responsive": {
    "wide": "Isolate/method context, bounded antimicrobial matrix, breakpoint/rule evidence, exception queue and report preview remain visible; each derived category can be traced to measurement plus applicable rule",
    "intermediate": "The matrix and selected drug interpretation remain primary; breakpoint edition and rule provenance become synchronized detail, while exceptions and preview alternate in a secondary pane",
    "compact": "Validate isolate/organism/method/QC → select one organism×drug matrix cell → review MIC/zone measurement → confirm exact breakpoint standard and edition → inspect derived category plus expert-rule override → resolve exception → decide include/suppress → release/amend; the complete matrix remains one bounded table route and the selected cell keeps measurement→edition→category lineage",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells → expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "organism-by-antimicrobial-measurement-matrix",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "organism identified/uncertain/changed",
    "method supported/unsupported",
    "QC pending/pass/fail",
    "MIC or zone missing/off-scale/valid",
    "breakpoint applicable/not applicable/version stale",
    "category susceptible/increased-exposure/resistant/indeterminate",
    "expert rule applied/conflicting",
    "report included/suppressed",
    "release pending/signed/amended and permission-limited rule detail"
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
