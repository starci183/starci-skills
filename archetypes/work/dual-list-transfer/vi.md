# Dual list transfer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dual-list-transfer` |
| Family | Work |
| Dominant task | Chuyển item giữa hai peer set available và selected trong khi giữ filter độc lập, membership state, eligibility, order và commit recovery. |
| Search aliases | transfer list, available selected, membership chooser, pick list |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `transfer-workbench` owns the complete dominant task and its recovery boundary.
- Chuyển item giữa hai peer set available và selected trong khi giữ filter độc lập, membership state, eligibility, order và commit recovery.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-DLT-01` | Chuyển item giữa hai peer set available và selected trong khi giữ filter độc lập, membership state, eligibility, order và commit recovery. | Bằng chứng positive bắt buộc. |
| `AR-DLT-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-DLT-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-DLT-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-DLT-90` | Task thực tế do one-list multiselect hoặc batch operation sở hữu. | Reject. |
| `AR-DLT-91` | Reject one-list multiselect, batch table action, permission matrix, shopping cart và drag-only sorting trong một collection. | Reject. |
| `AR-DLT-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `dual-list-transfer` khi và chỉ khi `AR-DLT-01` đến `AR-DLT-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-DLT-90` đến `AR-DLT-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
transfer-workbench
├─ transfer-scope-and-summary
├─ source-and-destination-filters
├─ available-collection
├─ transfer-controls
├─ selected-collection
└─ validation-and-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `transfer-workbench` | Sở hữu một membership transition, context của cả hai collection, draft order và commit boundary. |
| `transfer-scope-and-summary` | Nêu source scope, destination purpose, count độc lập, limit và unsaved state. |
| `source-and-destination-filters` | Sở hữu query độc lập và no-match state mà không đổi membership. |
| `available-collection` | Sở hữu source membership, eligibility, selection và Add action. |
| `transfer-controls` | Diễn đạt hướng add/remove bằng text, cung cấp keyboard action và không phụ thuộc arrow đơn độc. |
| `selected-collection` | Sở hữu destination membership, order, limit, selection và Remove action. |
| `validation-and-commit` | Kiểm tra ineligible, duplicate, stale và limit state; sở hữu pending, partial failure, retry và success. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ hai peer collection đồng hiện với count/search độc lập cùng Add/Remove control rõ; hiện direction/order bằng text.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Mỗi collection sở hữu overflow dọc list giới hạn; không cho page overflow ngang hoặc transfer axis drag-only.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Chỉ giữ hai pane khi label/action fit; nếu không ưu tiên active side và giữ destination count/summary persistent.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Mỗi collection sở hữu overflow dọc list giới hạn; không cho page overflow ngang hoặc transfer axis drag-only.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng stage Available và Selected có tên; hiện Add/Remove local trên từng item; review selected membership trước commit; Back giữ cả hai filter và scroll position.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Mỗi collection sở hữu overflow dọc list giới hạn; không cho page overflow ngang hoặc transfer axis drag-only.

### Reflow

- DOM order, reading order, and meaningful focus order are `transfer-workbench → transfer-scope-and-summary → source-and-destination-filters → available-collection → transfer-controls → selected-collection → validation-and-commit`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm available/selected loading, empty và error độc lập; item selected; add/remove pending; duplicate/ineligible; destination limit; order change; filter no-match; membership stale; commit pending/partial failure; retry và success.

## State obligations

Task-specific states: available/selected loading, empty và error độc lập; item selected; add/remove pending; duplicate/ineligible; destination limit; order change; filter no-match; membership stale; commit pending/partial failure; retry và success.

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

- Hai peer collection giữ context độc lập và membership transition hai chiều rõ trước một validated commit.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject one-list multiselect, batch table action, permission matrix, shopping cart và drag-only sorting trong một collection.
- Reject khi one-list multiselect hoặc batch operation sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-DLT-90`, `AR-DLT-91` hoặc `AR-DLT-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [PatternFly dual list selector](https://www.patternfly.org/components/dual-list-selector/) | Peer lists retain membership, selection, and explicit transfer direction. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `dual-list-transfer`. |
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
  "archetypeId": "dual-list-transfer",
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
