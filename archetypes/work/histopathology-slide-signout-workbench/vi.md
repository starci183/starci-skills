# Histopathology slide signout workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `histopathology-slide-signout-workbench` |
| Family | Work |
| Dominant task | Đọc một ca giải phẫu bệnh xuyên suốt specimen, block và slide, ghi vùng chẩn đoán, hoàn tất synoptic, hội chẩn khi cần và phát hành signout có phiên bản. |
| Search aliases | histopathology-slide-signout-workbench, histopathology-signout, signed-report-version |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `histopathology-signout` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-HSS-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-HSS-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-HSS-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-HSS-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-HSS-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-HSS-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-HSS-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `histopathology-slide-signout-workbench` khi và chỉ khi có evidence cho `AR-HSS-01` đến `AR-HSS-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-HSS-90` đến `AR-HSS-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ histopathology-signout
├─ case-and-specimen-identity
├─ specimen-part-to-block-to-slide-provenance
├─ tiled-whole-slide-stage
├─ diagnostic-region-and-feature-register
├─ feature-to-synoptic-element-and-report-claim-links
├─ diagnosis-and-comment-composer
├─ peer-review-or-consult
└─ signed-report-version
```

Quan hệ bắt buộc: `histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage ↔ diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `histopathology-signout` | Sở hữu trạng thái và quyết định của `histopathology-signout`; giữ quan hệ với hạ nguồn `case-and-specimen-identity` mà không hấp thụ owner của vùng khác. |
| `case-and-specimen-identity` | Sở hữu trạng thái và quyết định của `case-and-specimen-identity`; giữ quan hệ với thượng nguồn `histopathology-signout` và hạ nguồn `specimen-part-to-block-to-slide-provenance` mà không hấp thụ owner của vùng khác. |
| `specimen-part-to-block-to-slide-provenance` | Sở hữu trạng thái và quyết định của `specimen-part-to-block-to-slide-provenance`; giữ quan hệ với thượng nguồn `case-and-specimen-identity` và hạ nguồn `tiled-whole-slide-stage` mà không hấp thụ owner của vùng khác. |
| `tiled-whole-slide-stage` | Sở hữu trạng thái và quyết định của `tiled-whole-slide-stage`; giữ quan hệ với thượng nguồn `specimen-part-to-block-to-slide-provenance` và hạ nguồn `diagnostic-region-and-feature-register` mà không hấp thụ owner của vùng khác. |
| `diagnostic-region-and-feature-register` | Sở hữu trạng thái và quyết định của `diagnostic-region-and-feature-register`; giữ quan hệ với thượng nguồn `tiled-whole-slide-stage` và hạ nguồn `feature-to-synoptic-element-and-report-claim-links` mà không hấp thụ owner của vùng khác. |
| `feature-to-synoptic-element-and-report-claim-links` | Sở hữu trạng thái và quyết định của `feature-to-synoptic-element-and-report-claim-links`; giữ quan hệ với thượng nguồn `diagnostic-region-and-feature-register` và hạ nguồn `diagnosis-and-comment-composer` mà không hấp thụ owner của vùng khác. |
| `diagnosis-and-comment-composer` | Sở hữu trạng thái và quyết định của `diagnosis-and-comment-composer`; giữ quan hệ với thượng nguồn `feature-to-synoptic-element-and-report-claim-links` và hạ nguồn `peer-review-or-consult` mà không hấp thụ owner của vùng khác. |
| `peer-review-or-consult` | Sở hữu trạng thái và quyết định của `peer-review-or-consult`; giữ quan hệ với thượng nguồn `diagnosis-and-comment-composer` và hạ nguồn `signed-report-version` mà không hấp thụ owner của vùng khác. |
| `signed-report-version` | Sở hữu trạng thái và quyết định của `signed-report-version`; giữ quan hệ với thượng nguồn `peer-review-or-consult` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Part/block/slide hierarchy, selected slide stage, diagnostic feature register and report/synoptic progress remain visible; selection is synchronized without making visual marks the only way to navigate
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `tiled-whole-slide-stage` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: The slide stage and selected diagnostic feature stay primary; hierarchy becomes a specimen breadcrumb plus slide rail, while synoptic/report work moves to a resumable side sheet
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `tiled-whole-slide-stage` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Case identity → specimen part → block → slide → selected tile/region or textual coordinate → diagnostic feature → linked synoptic element and report claim → consultation if required → signout; the provenance path and unlinked required claim remain persistent, while the slide mosaic yields to one image stage plus a coordinate/feature ledger
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `tiled-whole-slide-stage` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage → diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm case loading, specimen mismatch, block/slide missing or unavailable, image tile loading/error, region selected/unselected/unreviewed, feature draft/confirmed/conflicting, synoptic complete/incomplete/not-applicable, consult requested/returned/overdue, report unsigned/signed/amended, stale slide revision, permission-limited image and focus restored after region detail closes.

## Nghĩa vụ trạng thái

Task-specific states: case loading, specimen mismatch, block/slide missing or unavailable, image tile loading/error, region selected/unselected/unreviewed, feature draft/confirmed/conflicting, synoptic complete/incomplete/not-applicable, consult requested/returned/overdue, report unsigned/signed/amended, stale slide revision, permission-limited image and focus restored after region detail closes.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-HSS-90`, `AR-HSS-91` hoặc `AR-HSS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [DICOM current Whole Slide Microscopy Image IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.32.8.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [CAP current cancer protocols](https://www.cap.org/protocols-and-guidelines/cancer-protocols/current-cancer-protocols/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [CAP whole-slide imaging validation guideline](https://www.cap.org/protocols-and-guidelines/cap-guidelines/current-cap-guidelines/validating-whole-slide-imaging-for-diagnostic-purposes-in-pathology) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "histopathology-slide-signout-workbench",
  "matchedSituationCodes": [
    "AR-HSS-01",
    "AR-HSS-02",
    "AR-HSS-03",
    "AR-HSS-04"
  ],
  "aliases": [
    "histopathology-slide-signout-workbench",
    "histopathology-signout",
    "signed-report-version"
  ],
  "dominantTask": "Review a pathology case across specimen parts, blocks and whole-slide images, register diagnostic regions and features, complete synoptic elements, obtain consultation when required, and issue a versioned diagnostic signout",
  "regions": [
    "histopathology-signout",
    "case-and-specimen-identity",
    "specimen-part-to-block-to-slide-provenance",
    "tiled-whole-slide-stage",
    "diagnostic-region-and-feature-register",
    "feature-to-synoptic-element-and-report-claim-links",
    "diagnosis-and-comment-composer",
    "peer-review-or-consult",
    "signed-report-version"
  ],
  "relationships": [
    "histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage ↔ diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version"
  ],
  "responsive": {
    "wide": "Part/block/slide hierarchy, selected slide stage, diagnostic feature register and report/synoptic progress remain visible; selection is synchronized without making visual marks the only way to navigate",
    "intermediate": "The slide stage and selected diagnostic feature stay primary; hierarchy becomes a specimen breadcrumb plus slide rail, while synoptic/report work moves to a resumable side sheet",
    "compact": "Case identity → specimen part → block → slide → selected tile/region or textual coordinate → diagnostic feature → linked synoptic element and report claim → consultation if required → signout; the provenance path and unlinked required claim remain persistent, while the slide mosaic yields to one image stage plus a coordinate/feature ledger",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage → diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "tiled-whole-slide-stage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "case loading",
    "specimen mismatch",
    "block/slide missing or unavailable",
    "image tile loading/error",
    "region selected/unselected/unreviewed",
    "feature draft/confirmed/conflicting",
    "synoptic complete/incomplete/not-applicable",
    "consult requested/returned/overdue",
    "report unsigned/signed/amended",
    "stale slide revision",
    "permission-limited image and focus restored after region detail closes"
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
