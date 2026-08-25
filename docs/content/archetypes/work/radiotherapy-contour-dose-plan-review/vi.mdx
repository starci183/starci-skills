# Radiotherapy contour dose plan review

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `radiotherapy-contour-dose-plan-review` |
| Family | Work |
| Dominant task | Review và phê duyệt kế hoạch xạ trị bằng cách nối contour mục tiêu/OAR với spatial dose, prescription, DVH constraint, coverage issue và so sánh phiên bản. |
| Search aliases | radiotherapy-contour-dose-plan-review, radiotherapy-review, plan-comparison-and-approval |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `radiotherapy-review` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-RDP-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-RDP-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-RDP-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-RDP-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-RDP-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-RDP-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-RDP-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `radiotherapy-contour-dose-plan-review` khi và chỉ khi có evidence cho `AR-RDP-01` đến `AR-RDP-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-RDP-90` đến `AR-RDP-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ radiotherapy-review
├─ planning-study-frame-and-prescription
├─ target-and-organ-at-risk-contour-hierarchy
├─ synchronized-anatomy-and-dose-stage
├─ beam-fraction-and-plan-version
├─ dose-volume-histogram-set
├─ constraint-table
├─ hotspot-coldspot-and-coverage-queue
└─ plan-comparison-and-approval
```

Quan hệ bắt buộc: `radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy ↔ synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set ↔ constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `radiotherapy-review` | Sở hữu trạng thái và quyết định của `radiotherapy-review`; giữ quan hệ với hạ nguồn `planning-study-frame-and-prescription` mà không hấp thụ owner của vùng khác. |
| `planning-study-frame-and-prescription` | Sở hữu trạng thái và quyết định của `planning-study-frame-and-prescription`; giữ quan hệ với thượng nguồn `radiotherapy-review` và hạ nguồn `target-and-organ-at-risk-contour-hierarchy` mà không hấp thụ owner của vùng khác. |
| `target-and-organ-at-risk-contour-hierarchy` | Sở hữu trạng thái và quyết định của `target-and-organ-at-risk-contour-hierarchy`; giữ quan hệ với thượng nguồn `planning-study-frame-and-prescription` và hạ nguồn `synchronized-anatomy-and-dose-stage` mà không hấp thụ owner của vùng khác. |
| `synchronized-anatomy-and-dose-stage` | Sở hữu trạng thái và quyết định của `synchronized-anatomy-and-dose-stage`; giữ quan hệ với thượng nguồn `target-and-organ-at-risk-contour-hierarchy` và hạ nguồn `beam-fraction-and-plan-version` mà không hấp thụ owner của vùng khác. |
| `beam-fraction-and-plan-version` | Sở hữu trạng thái và quyết định của `beam-fraction-and-plan-version`; giữ quan hệ với thượng nguồn `synchronized-anatomy-and-dose-stage` và hạ nguồn `dose-volume-histogram-set` mà không hấp thụ owner của vùng khác. |
| `dose-volume-histogram-set` | Sở hữu trạng thái và quyết định của `dose-volume-histogram-set`; giữ quan hệ với thượng nguồn `beam-fraction-and-plan-version` và hạ nguồn `constraint-table` mà không hấp thụ owner của vùng khác. |
| `constraint-table` | Sở hữu trạng thái và quyết định của `constraint-table`; giữ quan hệ với thượng nguồn `dose-volume-histogram-set` và hạ nguồn `hotspot-coldspot-and-coverage-queue` mà không hấp thụ owner của vùng khác. |
| `hotspot-coldspot-and-coverage-queue` | Sở hữu trạng thái và quyết định của `hotspot-coldspot-and-coverage-queue`; giữ quan hệ với thượng nguồn `constraint-table` và hạ nguồn `plan-comparison-and-approval` mà không hấp thụ owner của vùng khác. |
| `plan-comparison-and-approval` | Sở hữu trạng thái và quyết định của `plan-comparison-and-approval`; giữ quan hệ với thượng nguồn `hotspot-coldspot-and-coverage-queue` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Contour hierarchy, synchronized anatomy/dose stage, DVH set, constraint table, issue queue and plan-version comparison remain linked around a fixed prescription
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `synchronized-anatomy-and-dose-stage` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Anatomy/dose plus the selected structure's DVH/constraints remain primary; hierarchy becomes a searchable structure rail and plan comparison/issues alternate in a secondary pane
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `synchronized-anatomy-and-dose-stage` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify frame/prescription → choose one target or organ → inspect contour with textual slice/coordinate alternative → review that structure's DVH and constraint → resolve hotspot/coldspot → compare plan version → approval gate; no miniaturized multi-panel planning desktop
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `synchronized-anatomy-and-dose-stage` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy → synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set → constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm study loading/mismatch, prescription incomplete/amended, contour present/missing/changed/unapproved, dose loading/stale, beam/fraction mismatch, constraint pass/fail/not-applicable, hotspot or coldspot open/accepted/resolved, DVH unavailable/recomputed, plan current/superseded/comparison pending, approval blocked/approved/rejected and focus restored after spatial issue detail.

## Nghĩa vụ trạng thái

Task-specific states: study loading/mismatch, prescription incomplete/amended, contour present/missing/changed/unapproved, dose loading/stale, beam/fraction mismatch, constraint pass/fail/not-applicable, hotspot or coldspot open/accepted/resolved, DVH unavailable/recomputed, plan current/superseded/comparison pending, approval blocked/approved/rejected and focus restored after spatial issue detail.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-RDP-90`, `AR-RDP-91` hoặc `AR-RDP-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [DICOM current RT Dose IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.18.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [IAEA transition to 3-D conformal and intensity-modulated radiotherapy](https://www.iaea.org/publications/8523/transition-from-2-d-radiotherapy-to-3-d-conformal-and-intensity-modulated-radiotherapy) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "radiotherapy-contour-dose-plan-review",
  "matchedSituationCodes": [
    "AR-RDP-01",
    "AR-RDP-02",
    "AR-RDP-03",
    "AR-RDP-04"
  ],
  "aliases": [
    "radiotherapy-contour-dose-plan-review",
    "radiotherapy-review",
    "plan-comparison-and-approval"
  ],
  "dominantTask": "Review and approve a radiotherapy plan by connecting target and organ-at-risk contours to spatial dose, beam/fraction prescription, dose-volume evidence, coverage constraints, hotspot/coldspot findings and plan-version comparison",
  "regions": [
    "radiotherapy-review",
    "planning-study-frame-and-prescription",
    "target-and-organ-at-risk-contour-hierarchy",
    "synchronized-anatomy-and-dose-stage",
    "beam-fraction-and-plan-version",
    "dose-volume-histogram-set",
    "constraint-table",
    "hotspot-coldspot-and-coverage-queue",
    "plan-comparison-and-approval"
  ],
  "relationships": [
    "radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy ↔ synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set ↔ constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval"
  ],
  "responsive": {
    "wide": "Contour hierarchy, synchronized anatomy/dose stage, DVH set, constraint table, issue queue and plan-version comparison remain linked around a fixed prescription",
    "intermediate": "Anatomy/dose plus the selected structure's DVH/constraints remain primary; hierarchy becomes a searchable structure rail and plan comparison/issues alternate in a secondary pane",
    "compact": "Verify frame/prescription → choose one target or organ → inspect contour with textual slice/coordinate alternative → review that structure's DVH and constraint → resolve hotspot/coldspot → compare plan version → approval gate; no miniaturized multi-panel planning desktop",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy → synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set → constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "synchronized-anatomy-and-dose-stage",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "study loading/mismatch",
    "prescription incomplete/amended",
    "contour present/missing/changed/unapproved",
    "dose loading/stale",
    "beam/fraction mismatch",
    "constraint pass/fail/not-applicable",
    "hotspot or coldspot open/accepted/resolved",
    "DVH unavailable/recomputed",
    "plan current/superseded/comparison pending",
    "approval blocked/approved/rejected and focus restored after spatial issue detail"
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
