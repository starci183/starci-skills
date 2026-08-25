# Spreadsheet grid editor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spreadsheet-grid-editor` |
| Family | Work |
| Dominant task | Chỉnh giá trị và công thức theo tọa độ cell, range, row, column và sheet trong mô hình hai chiều. |
| Search aliases | bảng tính, lưới công thức, chỉnh range, cell workbook |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `spreadsheet` owns the complete dominant task and its recovery boundary.
- Chỉnh giá trị và công thức theo tọa độ cell, range, row, column và sheet trong mô hình hai chiều.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-SGE-01` | Chỉnh giá trị và công thức theo tọa độ cell, range, row, column và sheet trong mô hình hai chiều. | Bằng chứng positive bắt buộc. |
| `AR-SGE-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-SGE-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-SGE-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-SGE-90` | Task thực tế do batch table operations hoặc form theo hàng sở hữu. | Reject. |
| `AR-SGE-91` | Reject quét record, form độc lập theo hàng và bảng edit không có semantics tọa độ, range hoặc formula. | Reject. |
| `AR-SGE-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `spreadsheet-grid-editor` khi và chỉ khi `AR-SGE-01` đến `AR-SGE-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-SGE-90` đến `AR-SGE-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
spreadsheet
├─ workbook-and-sheet-navigation
├─ formula-input
├─ editable-cell-grid
│  ├─ row-column-headers
│  └─ active-cell-or-range
└─ grid-actions
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `spreadsheet` | Sở hữu một mô hình chỉnh workbook hai chiều và lịch sử tính lại. |
| `workbook-and-sheet-navigation` | Đổi sheet trong khi giữ tọa độ active, dirty state và focus quay lại. |
| `formula-input` | Chỉnh giá trị hoặc formula của cell được định địa chỉ và sở hữu phản hồi parse. |
| `editable-cell-grid` | Sở hữu điều hướng hai trục, overflow giới hạn, vào edit và chọn range. |
| `row-column-headers` | Cung cấp ngữ cảnh tọa độ liên tục cho cell và range. |
| `active-cell-or-range` | Nêu địa chỉ và phạm vi ngoài tín hiệu màu, đồng thời sống qua compact focus mode. |
| `grid-actions` | Sở hữu commit, cancel, paste/import, undo, redo và trạng thái tính lại. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Bao quanh một grid hai trục có giới hạn bằng sheet context, formula input, frozen header và active address rõ; phân biệt navigation/edit mode không chỉ bằng màu.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Chỉ `editable-cell-grid` sở hữu overflow công việc ngang và dọc; formula input wrap và trang không cuộn ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Giảm cell nhìn thấy mà không tuyến tính hóa tọa độ; đưa lệnh hỗ trợ vào overflow có nhãn trong khi header, active address, formula state và commit/cancel vẫn hiện.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Chỉ `editable-cell-grid` sở hữu overflow công việc ngang và dọc; formula input wrap và trang không cuộn ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng stage chỉnh cell-focused kết hợp grid navigator có giới hạn; cung cấp cell trước/sau, ngữ cảnh row/column, commit và cancel thay vì thu nhỏ cả workbook.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Chỉ `editable-cell-grid` sở hữu overflow công việc ngang và dọc; formula input wrap và trang không cuộn ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `spreadsheet → workbook-and-sheet-navigation → formula-input → editable-cell-grid → row-column-headers → active-cell-or-range → grid-actions`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm đang tải workbook/sheet, active cell, active range, navigation mode, edit/commit/cancel, lỗi parse formula, paste pending, protected cell, concurrent conflict, undo/redo và recalculation.

## State obligations

Task-specific states: đang tải workbook/sheet, active cell, active range, navigation mode, edit/commit/cancel, lỗi parse formula, paste pending, protected cell, concurrent conflict, undo/redo và recalculation.

| State family | Required behavior |
|---|---|
| Initial / loading | Nêu loading scope, reserve primary region và chỉ block region lỗi. |
| Ready | Hiện current object, selection/cursor, owner relationship và valid action bằng text+semantics. |
| Empty / not-applicable | Phân biệt true empty, filter no-match và non-applicable, kèm next action phù hợp. |
| Error / retry | Nêu failed scope, giữ input/work state và cung cấp retry/correction target có focus. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và giữ context để hiểu. |
| Pending | Ngăn duplicate, giữ context, expose Cancel khi an toàn và announce progress không steal focus. |
| Success | Xác nhận exact changed scope, cập nhật summary liên quan và giữ Undo/next step khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite âm thầm và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus heading mới; status-only update không move focus; modal return trigger. |
| Responsive presentation | Wide giữ simultaneity cần thiết; intermediate tạm hóa support thấp nhất; compact dùng primary stage nhưng giữ action/state/recovery. |

## Boundaries

### Accept

- Tọa độ, range, formula, header và điều hướng hai trục cùng quyết định mô hình edit.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject quét record, form độc lập theo hàng và bảng edit không có semantics tọa độ, range hoặc formula.
- Reject khi batch table operations hoặc form theo hàng sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-SGE-90`, `AR-SGE-91` hoặc `AR-SGE-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner cho region/state mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction thể hiện visual character trong các owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Nguồn hỗ trợ | Nguồn không chứng minh |
|---|---|---|
| [Microsoft Excel keyboard shortcuts](https://support.microsoft.com/en-US/Accessibility/excel/keyboard-shortcuts-in-excel) | Cell navigation, range selection, formula editing, commit, and cancel have keyboard equivalents. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading và focus order giữ task meaning qua topology change. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `spreadsheet-grid-editor`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "spreadsheet-grid-editor",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
