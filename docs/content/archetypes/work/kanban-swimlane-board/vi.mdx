# Kanban swimlane board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `kanban-swimlane-board` |
| Family | Work |
| Dominant task | Chuyển work item qua các state có thứ tự trong khi giữ WIP policy và context grouping swimlane tùy chọn. |
| Search aliases | kanban, lane state, swimlane work board, chuyển WIP |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `work-board` owns the complete dominant task and its recovery boundary.
- Chuyển work item qua các state có thứ tự trong khi giữ WIP policy và context grouping swimlane tùy chọn.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-KSB-01` | Chuyển work item qua các state có thứ tự trong khi giữ WIP policy và context grouping swimlane tùy chọn. | Bằng chứng positive bắt buộc. |
| `AR-KSB-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-KSB-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-KSB-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-KSB-90` | Task thực tế do resource scheduling hoặc workflow automation graph sở hữu. | Reject. |
| `AR-KSB-91` | Reject phân bổ theo time, card catalog, batch table và workflow node-edge executable. | Reject. |
| `AR-KSB-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `kanban-swimlane-board` khi và chỉ khi `AR-KSB-01` đến `AR-KSB-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-KSB-90` đến `AR-KSB-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
work-board
├─ board-scope-and-filters
├─ ordered-state-lanes
│  ├─ optional-swimlanes
│  └─ work-item-cards
├─ wip-and-policy-feedback
└─ selected-item-inspector
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `work-board` | Sở hữu một mô hình workflow state có thứ tự và move history. |
| `board-scope-and-filters` | Thu hẹp work visible mà không đổi lane semantics hoặc hidden WIP count. |
| `ordered-state-lanes` | Sở hữu workflow order, destination identity và WIP cấp lane. |
| `optional-swimlanes` | Nhóm cùng ordered lane theo một chiều ổn định thứ hai. |
| `work-item-cards` | Biểu diễn work identity có thể chuyển, state và move action rõ ràng. |
| `wip-and-policy-feedback` | Giải thích limit, move bị reject và recovery cho phép ngoài tín hiệu màu. |
| `selected-item-inspector` | Hiện context item đã chọn mà không sở hữu workflow state order. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Hiện nhiều ordered lane trong một board giới hạn với heading/WIP liên kết; inspector overlay hoặc dùng support space mà không reorder lane.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `ordered-state-lanes` sở hữu overflow ngang giới hạn ở wide/intermediate; paging lane compact loại bỏ page overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Hiện hai hoặc ba lane trong scroller giới hạn hoặc paging lane rõ; giữ swimlane identity liên tục và item inspector tạm thời.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `ordered-state-lanes` sở hữu overflow ngang giới hạn ở wide/intermediate; paging lane compact loại bỏ page overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Hiện một lane đã chọn với item xếp dọc và lane selector; move qua destination chooser rõ thay horizontal drag.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `ordered-state-lanes` sở hữu overflow ngang giới hạn ở wide/intermediate; paging lane compact loại bỏ page overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `work-board → board-scope-and-filters → ordered-state-lanes → optional-swimlanes → work-item-cards → wip-and-policy-feedback → selected-item-inspector`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm đang tải board/lane, lane rỗng, filter applied, item selected, move pending/success/rejected, vượt WIP, item stale, permission, lane unavailable và undo.

## State obligations

Task-specific states: đang tải board/lane, lane rỗng, filter applied, item selected, move pending/success/rejected, vượt WIP, item stale, permission, lane unavailable và undo.

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

- Vị trí lane là workflow state, swimlane tùy chọn giữ grouping và WIP policy có thể accept/reject move.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject phân bổ theo time, card catalog, batch table và workflow node-edge executable.
- Reject khi resource scheduling hoặc workflow automation graph sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-KSB-90`, `AR-KSB-91` hoặc `AR-KSB-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Atlassian Kanban WIP limits](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/) | Columns map workflow states and constraints can make a destination unavailable. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Modal surface đưa focus vào, giữ focus, đóng predictably và restore trigger. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `kanban-swimlane-board`. |
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
  "archetypeId": "kanban-swimlane-board",
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
