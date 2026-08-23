# Cytogenetic karyotype assembly workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `cytogenetic-karyotype-assembly-workbench` |
| Family | Work |
| Dominant task | Lắp karyotype từ metaphase, ghép homolog, ghi band breakpoint, đếm clone/mosaic, validate ISCN và ký kết luận bất thường. |
| Search aliases | cytogenetic-karyotype-assembly-workbench, karyotype-assembly, abnormality-conclusion-and-signout |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `karyotype-assembly` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-CKA-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-CKA-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-CKA-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-CKA-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-CKA-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-CKA-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-CKA-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `cytogenetic-karyotype-assembly-workbench` khi và chỉ khi có evidence cho `AR-CKA-01` đến `AR-CKA-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-CKA-90` đến `AR-CKA-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ karyotype-assembly
├─ specimen-culture-and-metaphase-set
├─ metaphase-cell-gallery
├─ chromosome-object-bin
├─ homolog-pair-karyogram-grid
├─ band-ideogram-and-breakpoint-inspector
├─ clone-and-mosaic-cell-count-ledger
├─ iscn-expression-composer-and-validator
└─ abnormality-conclusion-and-signout
```

Quan hệ bắt buộc: `karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid ↔ band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `karyotype-assembly` | Sở hữu trạng thái và quyết định của `karyotype-assembly`; giữ quan hệ với hạ nguồn `specimen-culture-and-metaphase-set` mà không hấp thụ owner của vùng khác. |
| `specimen-culture-and-metaphase-set` | Sở hữu trạng thái và quyết định của `specimen-culture-and-metaphase-set`; giữ quan hệ với thượng nguồn `karyotype-assembly` và hạ nguồn `metaphase-cell-gallery` mà không hấp thụ owner của vùng khác. |
| `metaphase-cell-gallery` | Sở hữu trạng thái và quyết định của `metaphase-cell-gallery`; giữ quan hệ với thượng nguồn `specimen-culture-and-metaphase-set` và hạ nguồn `chromosome-object-bin` mà không hấp thụ owner của vùng khác. |
| `chromosome-object-bin` | Sở hữu trạng thái và quyết định của `chromosome-object-bin`; giữ quan hệ với thượng nguồn `metaphase-cell-gallery` và hạ nguồn `homolog-pair-karyogram-grid` mà không hấp thụ owner của vùng khác. |
| `homolog-pair-karyogram-grid` | Sở hữu trạng thái và quyết định của `homolog-pair-karyogram-grid`; giữ quan hệ với thượng nguồn `chromosome-object-bin` và hạ nguồn `band-ideogram-and-breakpoint-inspector` mà không hấp thụ owner của vùng khác. |
| `band-ideogram-and-breakpoint-inspector` | Sở hữu trạng thái và quyết định của `band-ideogram-and-breakpoint-inspector`; giữ quan hệ với thượng nguồn `homolog-pair-karyogram-grid` và hạ nguồn `clone-and-mosaic-cell-count-ledger` mà không hấp thụ owner của vùng khác. |
| `clone-and-mosaic-cell-count-ledger` | Sở hữu trạng thái và quyết định của `clone-and-mosaic-cell-count-ledger`; giữ quan hệ với thượng nguồn `band-ideogram-and-breakpoint-inspector` và hạ nguồn `iscn-expression-composer-and-validator` mà không hấp thụ owner của vùng khác. |
| `iscn-expression-composer-and-validator` | Sở hữu trạng thái và quyết định của `iscn-expression-composer-and-validator`; giữ quan hệ với thượng nguồn `clone-and-mosaic-cell-count-ledger` và hạ nguồn `abnormality-conclusion-and-signout` mà không hấp thụ owner của vùng khác. |
| `abnormality-conclusion-and-signout` | Sở hữu trạng thái và quyết định của `abnormality-conclusion-and-signout`; giữ quan hệ với thượng nguồn `iscn-expression-composer-and-validator` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Metaphase gallery, unassigned chromosome bin, homolog-pair grid, band/breakpoint inspector, clone ledger and ISCN validator remain simultaneous; every assembled object retains cell provenance
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `metaphase-cell-gallery` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Homolog grid and selected chromosome/breakpoint remain primary; metaphase gallery collapses to a selector and clone/ISCN evidence alternates in a secondary pane
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `metaphase-cell-gallery` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Select metaphase → review unassigned objects → assign one homolog pair with button/list alternatives to drag → inspect band/breakpoint → update clone counts across cells → compose/validate ISCN → conclusion/signout; no tiny full karyogram is required for editing
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `metaphase-cell-gallery` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid → band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm specimen/culture pending/failed/ready, metaphase accepted/rejected/unavailable, chromosome unassigned/paired/ambiguous, homolog slot empty/complete/conflicting, band coordinate unknown/selected, breakpoint draft/confirmed, clone count incomplete/threshold met/mosaic, ISCN parsing/valid/invalid/stale, conclusion draft/signed/amended and image permission unavailable.

## Nghĩa vụ trạng thái

Task-specific states: specimen/culture pending/failed/ready, metaphase accepted/rejected/unavailable, chromosome unassigned/paired/ambiguous, homolog slot empty/complete/conflicting, band coordinate unknown/selected, breakpoint draft/confirmed, clone count incomplete/threshold met/mosaic, ISCN parsing/valid/invalid/stale, conclusion draft/signed/amended and image permission unavailable.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CKA-90`, `AR-CKA-91` hoặc `AR-CKA-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [HUGO nomenclature standards including ISCN](https://www.hugo-international.org/standards/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [NCBI Bookshelf karyotyping and cytogenetics](https://www.ncbi.nlm.nih.gov/books/NBK563293/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [PubMed record for ISCN 2024](https://pubmed.ncbi.nlm.nih.gov/39571546/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [published 2026 erratum](https://pubmed.ncbi.nlm.nih.gov/41379737/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard grid semantics. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "cytogenetic-karyotype-assembly-workbench",
  "matchedSituationCodes": [
    "AR-CKA-01",
    "AR-CKA-02",
    "AR-CKA-03",
    "AR-CKA-04"
  ],
  "aliases": [
    "cytogenetic-karyotype-assembly-workbench",
    "karyotype-assembly",
    "abnormality-conclusion-and-signout"
  ],
  "dominantTask": "Assemble and interpret a cytogenetic karyotype by selecting metaphase cells, pairing chromosome objects into homolog positions, inspecting bands and breakpoints, counting clone/mosaic patterns across cells, validating an ISCN expression, and signing the abnormality conclusion",
  "regions": [
    "karyotype-assembly",
    "specimen-culture-and-metaphase-set",
    "metaphase-cell-gallery",
    "chromosome-object-bin",
    "homolog-pair-karyogram-grid",
    "band-ideogram-and-breakpoint-inspector",
    "clone-and-mosaic-cell-count-ledger",
    "iscn-expression-composer-and-validator",
    "abnormality-conclusion-and-signout"
  ],
  "relationships": [
    "karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid ↔ band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout"
  ],
  "responsive": {
    "wide": "Metaphase gallery, unassigned chromosome bin, homolog-pair grid, band/breakpoint inspector, clone ledger and ISCN validator remain simultaneous; every assembled object retains cell provenance",
    "intermediate": "Homolog grid and selected chromosome/breakpoint remain primary; metaphase gallery collapses to a selector and clone/ISCN evidence alternates in a secondary pane",
    "compact": "Select metaphase → review unassigned objects → assign one homolog pair with button/list alternatives to drag → inspect band/breakpoint → update clone counts across cells → compose/validate ISCN → conclusion/signout; no tiny full karyogram is required for editing",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid → band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "metaphase-cell-gallery",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "specimen/culture pending/failed/ready",
    "metaphase accepted/rejected/unavailable",
    "chromosome unassigned/paired/ambiguous",
    "homolog slot empty/complete/conflicting",
    "band coordinate unknown/selected",
    "breakpoint draft/confirmed",
    "clone count incomplete/threshold met/mosaic",
    "ISCN parsing/valid/invalid/stale",
    "conclusion draft/signed/amended and image permission unavailable"
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
