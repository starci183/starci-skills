# Query builder workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `query-builder-workbench` |
| Family | Work |
| Dominant task | Xây structured query từ field, operator, value và grouped Boolean clause, execute rồi sửa theo result hoặc error evidence. |
| Search aliases | visual query builder, clause group, schema filter, result preview |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `query-workbench` owns the complete dominant task and its recovery boundary.
- Xây structured query từ field, operator, value và grouped Boolean clause, execute rồi sửa theo result hoặc error evidence.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-QBW-01` | Xây structured query từ field, operator, value và grouped Boolean clause, execute rồi sửa theo result hoặc error evidence. | Bằng chứng positive bắt buộc. |
| `AR-QBW-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-QBW-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-QBW-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-QBW-90` | Task thực tế do simple filter hoặc rule builder sở hữu. | Reject. |
| `AR-QBW-91` | Reject simple search/filter form, rule builder có effect, raw SQL/code editor và analytics ẩn query construction. | Reject. |
| `AR-QBW-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `query-builder-workbench` khi và chỉ khi `AR-QBW-01` đến `AR-QBW-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-QBW-90` đến `AR-QBW-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
query-workbench
├─ data-scope-and-schema
├─ clause-builder
│  └─ group-and-boolean-structure
├─ query-summary-or-text
├─ validation-and-execution-controls
└─ result-preview
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `query-workbench` | Sở hữu một data scope, structured query draft, execution và revision loop. |
| `data-scope-and-schema` | Giới hạn field, type, operator, freshness và permission cho mọi clause. |
| `clause-builder` | Sở hữu intent field-operator-value chỉnh được, order và per-clause validation. |
| `group-and-boolean-structure` | Sở hữu nesting AND/OR, group boundary và clause membership. |
| `query-summary-or-text` | Cung cấp một readout đồng bộ của structured query, không là second editor mất đồng bộ. |
| `validation-and-execution-controls` | Sở hữu validation, pending protection, cancel/timeout và error summary focusable. |
| `result-preview` | Sở hữu execution evidence zero/success/error và link về query state. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ clause structure và result preview đồng hiện; đặt schema hỗ trợ; giữ query summary đồng bộ.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Clause group và preview table có thể scroll trong owner; page và query summary không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Biến schema thành drawer; stack/resize builder và preview theo subtask hiện tại; giữ execution status và data scope visible.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Clause group và preview table có thể scroll trong owner; page và query summary không sở hữu overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Build từng group; hiện query summary trước Run; đưa preview thành stage sau và Back restore đúng clause/focus state.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Clause group và preview table có thể scroll trong owner; page và query summary không sở hữu overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `query-workbench → data-scope-and-schema → clause-builder → group-and-boolean-structure → query-summary-or-text → validation-and-execution-controls → result-preview`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm schema loading, query rỗng, clause add/remove/reorder, operator/value invalid, nested group, validation, run pending/success/error/timeout, zero result, schema stale và saved-query conflict.

## State obligations

Task-specific states: schema loading, query rỗng, clause add/remove/reorder, operator/value invalid, nested group, validation, run pending/success/error/timeout, zero result, schema stale và saved-query conflict.

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

- Clause chỉnh được và Boolean group là nguồn query intent, còn execution preview cung cấp evidence để revise.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject simple search/filter form, rule builder có effect, raw SQL/code editor và analytics ẩn query construction.
- Reject khi simple filter hoặc rule builder sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-QBW-90`, `AR-QBW-91` hoặc `AR-QBW-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [MongoDB Compass query builder](https://www.mongodb.com/docs/compass/schema/) | Fields and values can construct compound filters whose execution changes a result set. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon filtering pattern](https://carbondesignsystem.com/patterns/filtering/) | Filter hiện tiêu chí active và result change trong cùng dataset context. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Modal surface đưa focus vào, giữ focus, đóng predictably và restore trigger. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `query-builder-workbench`. |
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
  "archetypeId": "query-builder-workbench",
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
