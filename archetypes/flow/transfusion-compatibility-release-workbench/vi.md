# Transfusion compatibility release workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `transfusion-compatibility-release-workbench` |
| Family | Flow |
| Dominant task | Chứng minh tương thích recipient–component từ bằng chứng hiện tại và lịch sử, quản trị ngoại lệ cấp cứu, issue unit và đóng bằng trace receipt. |
| Search aliases | transfusion-compatibility-release-workbench, compatibility-release, transfusion-trace-receipt |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `compatibility-release` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-TCR-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-TCR-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-TCR-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-TCR-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-TCR-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-TCR-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-TCR-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `transfusion-compatibility-release-workbench` khi và chỉ khi có evidence cho `AR-TCR-01` đến `AR-TCR-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-TCR-90` đến `AR-TCR-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ compatibility-release
├─ recipient-current-sample-and-history
├─ abo-rh-antibody-evidence
├─ component-unit-pool
├─ recipient-by-unit-compatibility-matrix
├─ crossmatch-and-reservation-state
├─ exception-and-emergency-release-path
├─ issue-and-handoff
└─ transfusion-trace-receipt
```

Quan hệ bắt buộc: `compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `compatibility-release` | Sở hữu trạng thái và quyết định của `compatibility-release`; giữ quan hệ với hạ nguồn `recipient-current-sample-and-history` mà không hấp thụ owner của vùng khác. |
| `recipient-current-sample-and-history` | Sở hữu trạng thái và quyết định của `recipient-current-sample-and-history`; giữ quan hệ với thượng nguồn `compatibility-release` và hạ nguồn `abo-rh-antibody-evidence` mà không hấp thụ owner của vùng khác. |
| `abo-rh-antibody-evidence` | Sở hữu trạng thái và quyết định của `abo-rh-antibody-evidence`; giữ quan hệ với thượng nguồn `recipient-current-sample-and-history` và hạ nguồn `component-unit-pool` mà không hấp thụ owner của vùng khác. |
| `component-unit-pool` | Sở hữu trạng thái và quyết định của `component-unit-pool`; giữ quan hệ với thượng nguồn `abo-rh-antibody-evidence` và hạ nguồn `recipient-by-unit-compatibility-matrix` mà không hấp thụ owner của vùng khác. |
| `recipient-by-unit-compatibility-matrix` | Sở hữu trạng thái và quyết định của `recipient-by-unit-compatibility-matrix`; giữ quan hệ với thượng nguồn `component-unit-pool` và hạ nguồn `crossmatch-and-reservation-state` mà không hấp thụ owner của vùng khác. |
| `crossmatch-and-reservation-state` | Sở hữu trạng thái và quyết định của `crossmatch-and-reservation-state`; giữ quan hệ với thượng nguồn `recipient-by-unit-compatibility-matrix` và hạ nguồn `exception-and-emergency-release-path` mà không hấp thụ owner của vùng khác. |
| `exception-and-emergency-release-path` | Sở hữu trạng thái và quyết định của `exception-and-emergency-release-path`; giữ quan hệ với thượng nguồn `crossmatch-and-reservation-state` và hạ nguồn `issue-and-handoff` mà không hấp thụ owner của vùng khác. |
| `issue-and-handoff` | Sở hữu trạng thái và quyết định của `issue-and-handoff`; giữ quan hệ với thượng nguồn `exception-and-emergency-release-path` và hạ nguồn `transfusion-trace-receipt` mà không hấp thụ owner của vùng khác. |
| `transfusion-trace-receipt` | Sở hữu trạng thái và quyết định của `transfusion-trace-receipt`; giữ quan hệ với thượng nguồn `issue-and-handoff` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Recipient/sample history, candidate units, compatibility matrix, selected-unit proof and issue/exception rail remain simultaneous; incompatible evidence cannot be hidden by selection
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `recipient-by-unit-compatibility-matrix` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Recipient evidence and selected-unit compatibility remain primary; the candidate pool becomes a filtered drawer and trace history moves behind an explicit receipt route
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `recipient-by-unit-compatibility-matrix` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify recipient/sample → review antibodies/history → select one candidate unit → inspect compatibility and crossmatch proof → reserve → normal or emergency authorization → issue/handoff → confirm trace receipt; pool-wide comparison becomes a bounded table, with one unit decision primary
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `recipient-by-unit-compatibility-matrix` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm recipient identity verified/mismatch, sample current/expired/unavailable, history clear/conflicting, antibody screen negative/positive/pending, unit available/held/reserved/unavailable, compatible/incompatible/indeterminate, crossmatch pending/pass/fail, emergency justification draft/authorized/rejected, issue pending/completed/recalled, handoff acknowledged/missing and trace conflict/amendment.

## Nghĩa vụ trạng thái

Task-specific states: recipient identity verified/mismatch, sample current/expired/unavailable, history clear/conflicting, antibody screen negative/positive/pending, unit available/held/reserved/unavailable, compatible/incompatible/indeterminate, crossmatch pending/pass/fail, emergency justification draft/authorized/rejected, issue pending/completed/recalled, handoff acknowledged/missing and trace conflict/amendment.

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

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-TCR-90`, `AR-TCR-91` hoặc `AR-TCR-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

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
| [FDA current good manufacturing practice for blood and blood components](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-F/part-606) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [FDA biological product deviation reporting guidance](https://www.fda.gov/media/70694/download) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [ISBT 128 traceability guidance](https://www.isbtweb.org/resource/tb-004-isbt-128-and-traceability-v1-1-0-pdf.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WAI-ARIA APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard grid semantics. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "transfusion-compatibility-release-workbench",
  "matchedSituationCodes": [
    "AR-TCR-01",
    "AR-TCR-02",
    "AR-TCR-03",
    "AR-TCR-04"
  ],
  "aliases": [
    "transfusion-compatibility-release-workbench",
    "compatibility-release",
    "transfusion-trace-receipt"
  ],
  "dominantTask": "Prove recipient-to-component compatibility from current and historical evidence, select and reserve a suitable unit, execute a governed emergency exception when needed, and issue the component with an end-to-end trace receipt",
  "regions": [
    "compatibility-release",
    "recipient-current-sample-and-history",
    "abo-rh-antibody-evidence",
    "component-unit-pool",
    "recipient-by-unit-compatibility-matrix",
    "crossmatch-and-reservation-state",
    "exception-and-emergency-release-path",
    "issue-and-handoff",
    "transfusion-trace-receipt"
  ],
  "relationships": [
    "compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt"
  ],
  "responsive": {
    "wide": "Recipient/sample history, candidate units, compatibility matrix, selected-unit proof and issue/exception rail remain simultaneous; incompatible evidence cannot be hidden by selection",
    "intermediate": "Recipient evidence and selected-unit compatibility remain primary; the candidate pool becomes a filtered drawer and trace history moves behind an explicit receipt route",
    "compact": "Verify recipient/sample → review antibodies/history → select one candidate unit → inspect compatibility and crossmatch proof → reserve → normal or emergency authorization → issue/handoff → confirm trace receipt; pool-wide comparison becomes a bounded table, with one unit decision primary",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "recipient-by-unit-compatibility-matrix",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "recipient identity verified/mismatch",
    "sample current/expired/unavailable",
    "history clear/conflicting",
    "antibody screen negative/positive/pending",
    "unit available/held/reserved/unavailable",
    "compatible/incompatible/indeterminate",
    "crossmatch pending/pass/fail",
    "emergency justification draft/authorized/rejected",
    "issue pending/completed/recalled",
    "handoff acknowledged/missing and trace conflict/amendment"
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
