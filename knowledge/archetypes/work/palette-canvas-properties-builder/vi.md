# Palette canvas properties builder

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `palette-canvas-properties-builder` |
| Family | Work |
| Dominant task | Lắp cấu trúc có thứ tự hoặc lồng nhau bằng cách chọn reusable block, đặt vào composition và cấu hình selected block. |
| Search aliases | block builder, component palette, structure canvas, property inspector |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `builder` owns the complete dominant task and its recovery boundary.
- Lắp cấu trúc có thứ tự hoặc lồng nhau bằng cách chọn reusable block, đặt vào composition và cấu hình selected block.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PCB-01` | Lắp cấu trúc có thứ tự hoặc lồng nhau bằng cách chọn reusable block, đặt vào composition và cấu hình selected block. | Bằng chứng positive bắt buộc. |
| `AR-PCB-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-PCB-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-PCB-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-PCB-90` | Task thực tế do canvas inspection hoặc workflow automation sở hữu. | Reject. |
| `AR-PCB-91` | Reject inspect một canvas artifact, executable workflow branch, form chỉ có field và file hierarchy editing. | Reject. |
| `AR-PCB-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `palette-canvas-properties-builder` khi và chỉ khi `AR-PCB-01` đến `AR-PCB-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-PCB-90` đến `AR-PCB-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
builder
├─ component-palette
├─ structure-canvas
│  └─ insertion-and-order-controls
├─ selected-block
├─ property-inspector
└─ structure-outline-and-validation
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `builder` | Sở hữu một composed structure, selection, validation, history và save boundary. |
| `component-palette` | Sở hữu discovery reusable block và insertion intent, không sở hữu cấu trúc kết quả. |
| `structure-canvas` | Sở hữu nesting, sibling order, insertion target và composed preview. |
| `insertion-and-order-controls` | Cung cấp add, move, indent, outdent và reorder tương đương drag. |
| `selected-block` | Đồng bộ structural node đã chọn qua canvas, outline và inspector. |
| `property-inspector` | Cấu hình property hợp lệ của selected block và sở hữu inline error. |
| `structure-outline-and-validation` | Điều hướng hierarchy, hiện placement invalid và gate save. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Chỉ giữ palette, canvas và property đồng hiện khi cả ba usable; dùng outline cho điều hướng structure thay vì task browsing riêng.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Structure canvas và outline sở hữu điều hướng dọc giới hạn; không cho page-level overflow ngang hoặc region drag-only.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Biến palette thành drawer; giữ canvas và property collapsible; giữ insertion target và selected-block summary visible.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Structure canvas và outline sở hữu điều hướng dọc giới hạn; không cho page-level overflow ngang hoặc region drag-only.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Tuần tự choose block, place/reorder rồi configure; đặt structure outline làm navigator chính và giữ add/move button equivalent.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Structure canvas và outline sở hữu điều hướng dọc giới hạn; không cho page-level overflow ngang hoặc region drag-only.

### Reflow

- DOM order, reading order, and meaningful focus order are `builder → component-palette → structure-canvas → insertion-and-order-controls → selected-block → property-inspector → structure-outline-and-validation`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm palette loading/empty, insertion valid/invalid, selected block, property validation, item nested/reordered, duplicate/remove, unsaved, save pending/conflict, undo và redo.

## State obligations

Task-specific states: palette loading/empty, insertion valid/invalid, selected block, property validation, item nested/reordered, duplicate/remove, unsaved, save pending/conflict, undo và redo.

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

- Reusable palette insert block, structure owner order/nest chúng và inspector cấu hình selected block.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject inspect một canvas artifact, executable workflow branch, form chỉ có field và file hierarchy editing.
- Reject khi canvas inspection hoặc workflow automation sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PCB-90`, `AR-PCB-91` hoặc `AR-PCB-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Webflow Designer element hierarchy](https://developers.webflow.com/designer/reference/creating-retrieving-elements) | Reusable elements can be inserted before, after, inside, or around a selected hierarchy node with explicit placement context. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor control hiện state có label, validation và contextual action. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `palette-canvas-properties-builder`. |
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
  "archetypeId": "palette-canvas-properties-builder",
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
