# Document outline editor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `document-outline-editor` |
| Family | Work |
| Dominant task | Author document long-form có cấu trúc trong khi điều hướng outline, format text flow và resolve comment neo vào vị trí text. |
| Search aliases | editor long-form, outline document, comment anchored, structured authoring |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `document-editor` owns the complete dominant task and its recovery boundary.
- Author document long-form có cấu trúc trong khi điều hướng outline, format text flow và resolve comment neo vào vị trí text.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-DOE-01` | Author document long-form có cấu trúc trong khi điều hướng outline, format text flow và resolve comment neo vào vị trí text. | Bằng chứng positive bắt buộc. |
| `AR-DOE-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-DOE-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-DOE-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-DOE-90` | Task thực tế do reading annotation hoặc block building sở hữu. | Reject. |
| `AR-DOE-91` | Reject manuscript read-only, spatial canvas, code editor và block builder nơi reusable component sở hữu structure. | Reject. |
| `AR-DOE-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `document-outline-editor` khi và chỉ khi `AR-DOE-01` đến `AR-DOE-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-DOE-90` đến `AR-DOE-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
document-editor
├─ document-status-and-actions
├─ hierarchical-outline
├─ flow-editor
│  └─ formatting-controls
├─ anchored-comments
└─ revision-or-save-feedback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `document-editor` | Sở hữu một structured text flow, selection, comment anchor và revision state. |
| `document-status-and-actions` | Nêu title, permission, offline/online state, save status và document-level action. |
| `hierarchical-outline` | Điều hướng heading hierarchy và quay về đúng text anchor. |
| `flow-editor` | Sở hữu text insertion chính, selection, semantic structure và readable measure. |
| `formatting-controls` | Tác động current editor selection mà không thành second editor mất đồng bộ. |
| `anchored-comments` | Sở hữu comment, reply, resolve state và return đúng text anchor. |
| `revision-or-save-feedback` | Sở hữu autosave pending/error, offline draft, stale revision, conflict và recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Chỉ giữ outline, editor measure tối ưu và anchored comment đồng hiện khi mỗi vùng usable; formatting tác động editor selection.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Text editor và comment list cuộn dọc trong active stage; không cho overflow ngang ở page hoặc toolbar.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Giữ một support rail persistent và đưa outline hoặc comment vào drawer theo subtask hiện tại; không squeeze editor measure.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Text editor và comment list cuộn dọc trong active stage; không cho overflow ngang ở page hoặc toolbar.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng editor một cột; mở outline và comment thành sheet/screen có tên quay về đúng text anchor; nhóm formatting không để toolbar spill.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Text editor và comment list cuộn dọc trong active stage; không cho overflow ngang ở page hoặc toolbar.

### Reflow

- DOM order, reading order, and meaningful focus order are `document-editor → document-status-and-actions → hierarchical-outline → flow-editor → formatting-controls → anchored-comments → revision-or-save-feedback`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm document loading, first draft rỗng, text selection/formatting, comment open/resolved/orphaned, autosave pending/error, offline/stale revision, external conflict, permission/read-only, undo và redo.

## State obligations

Task-specific states: document loading, first draft rỗng, text selection/formatting, comment open/resolved/orphaned, autosave pending/error, offline/stale revision, external conflict, permission/read-only, undo và redo.

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

- Long-form text flow, outline hierarchy, formatting selection và comment anchored vào text cùng sở hữu authoring loop.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject manuscript read-only, spatial canvas, code editor và block builder nơi reusable component sở hữu structure.
- Reject khi reading annotation hoặc block building sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-DOE-90`, `AR-DOE-91` hoặc `AR-DOE-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Google Docs comments with a screen reader](https://support.google.com/docs/answer/6239410?hl=en) | Comments bind to selected text, expose next/previous navigation, and return focus to content. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor control hiện state có label, validation và contextual action. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | DOM, reading và focus order giữ task meaning qua topology change. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky và temporary surface không được che hoàn toàn control đang focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `document-outline-editor`. |
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
  "archetypeId": "document-outline-editor",
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
