# Canvas inspector studio

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `canvas-inspector-studio` |
| Family | Work |
| Dominant task | Thao tác trực tiếp spatial artifact và chỉnh contextual property của current selection với object-list accessible tương đương. |
| Search aliases | spatial canvas, object inspector, property selection, object list accessible |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `studio` owns the complete dominant task and its recovery boundary.
- Thao tác trực tiếp spatial artifact và chỉnh contextual property của current selection với object-list accessible tương đương.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-CIS-01` | Thao tác trực tiếp spatial artifact và chỉnh contextual property của current selection với object-list accessible tương đương. | Bằng chứng positive bắt buộc. |
| `AR-CIS-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-CIS-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-CIS-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-CIS-90` | Task thực tế do palette builder hoặc workflow graph editor sở hữu. | Reject. |
| `AR-CIS-91` | Reject assembly từ palette, authoring text flow, inspect graph/map read-only và executable workflow graph. | Reject. |
| `AR-CIS-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `canvas-inspector-studio` khi và chỉ khi `AR-CIS-01` đến `AR-CIS-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-CIS-90` đến `AR-CIS-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
studio
├─ document-and-history-controls
├─ spatial-canvas
│  └─ canvas-tools
├─ current-selection
├─ contextual-inspector
└─ accessible-object-list
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `studio` | Sở hữu một spatial document, selection model, transform history và save boundary. |
| `document-and-history-controls` | Sở hữu document identity, dirty/save state, undo, redo và conflict recovery. |
| `spatial-canvas` | Sở hữu direct manipulation, pan/zoom giới hạn, quan hệ không gian và visual selection. |
| `canvas-tools` | Chọn manipulation mode và cung cấp non-gesture equivalent. |
| `current-selection` | Đồng bộ selected object identity qua canvas, list và inspector. |
| `contextual-inspector` | Chỉ chỉnh property hợp lệ cho current selection và sở hữu validation. |
| `accessible-object-list` | Cung cấp selection và action có thứ tự tương đương hit testing chỉ trên canvas. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Đặt canvas primary; giữ inspector persistent khi có selection; giữ tool gọn và giới hạn pan/zoom trong canvas.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `spatial-canvas` sở hữu overflow pan/zoom có giới hạn; object list và inspector cuộn dọc không có page-level overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Collapse inspector hoặc làm temporary; condense essential tool có label; giữ canvas usable và selected-object summary.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `spatial-canvas` sở hữu overflow pan/zoom có giới hạn; object list và inspector cuộn dọc không có page-level overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Mặc định object list hoặc focused-object stage khi canvas quá nhỏ; cho canvas full-screen tùy chọn và inspector thành sheet; giữ mọi non-gesture action.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `spatial-canvas` sở hữu overflow pan/zoom có giới hạn; object list và inspector cuộn dọc không có page-level overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `studio → document-and-history-controls → spatial-canvas → canvas-tools → current-selection → contextual-inspector → accessible-object-list`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm document loading, no/single/multi selection, tool active, zoom/pan, unsaved/pending save, property invalid, object locked, external conflict, undo và redo.

## State obligations

Task-specific states: document loading, no/single/multi selection, tool active, zoom/pan, unsaved/pending save, property invalid, object locked, external conflict, undo và redo.

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

- Spatial artifact được direct manipulate và một selection chung điều khiển contextual inspector cùng accessible object list.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject assembly từ palette, authoring text flow, inspect graph/map read-only và executable workflow graph.
- Reject khi palette builder hoặc workflow graph editor sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-CIS-90`, `AR-CIS-91` hoặc `AR-CIS-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Adobe Illustrator properties panel](https://helpx.adobe.com/in/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html) | Contextual controls change with current selection while document controls remain distinct. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor control hiện state có label, validation và contextual action. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading và focus order giữ task meaning qua topology change. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `canvas-inspector-studio`. |
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
  "archetypeId": "canvas-inspector-studio",
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
