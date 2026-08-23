# Pivot drilldown analytics

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `pivot-drilldown-analytics` |
| Family | Work |
| Dominant task | Đặt câu hỏi trên aggregate measure, đổi dimension/filter, phối hợp selection qua các view và drill từ signal xuống supporting record. |
| Search aliases | phân tích pivot, cross-filter chart, drill segment, record phân tích |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `analytics-workbench` owns the complete dominant task and its recovery boundary.
- Đặt câu hỏi trên aggregate measure, đổi dimension/filter, phối hợp selection qua các view và drill từ signal xuống supporting record.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-PDA-01` | Đặt câu hỏi trên aggregate measure, đổi dimension/filter, phối hợp selection qua các view và drill từ signal xuống supporting record. | Bằng chứng positive bắt buộc. |
| `AR-PDA-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-PDA-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-PDA-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-PDA-90` | Task thực tế do overview dashboard hoặc batch table sở hữu. | Reject. |
| `AR-PDA-91` | Reject KPI dashboard thụ động, report cố định, raw table operation và chart collection không có coordinated selection/drill path. | Reject. |
| `AR-PDA-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `pivot-drilldown-analytics` khi và chỉ khi `AR-PDA-01` đến `AR-PDA-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-PDA-90` đến `AR-PDA-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
analytics-workbench
├─ metric-and-scope-context
├─ shared-filter-and-pivot-controls
├─ primary-visual-analysis
├─ coordinated-secondary-views
├─ selected-segment-detail
└─ drilldown-records
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `analytics-workbench` | Sở hữu một câu hỏi phân tích và query state dùng chung cho mọi view. |
| `metric-and-scope-context` | Nêu measure, population, period, độ mới và phạm vi redaction. |
| `shared-filter-and-pivot-controls` | Đổi dimension và filter một lần cho mọi coordinated view. |
| `primary-visual-analysis` | Sở hữu aggregate signal chính và điểm vào selection. |
| `coordinated-secondary-views` | Giải thích cùng selected segment bằng measure hoặc partition khác. |
| `selected-segment-detail` | Nêu selected mark, value, tác động filter và drill path ngoài tín hiệu màu. |
| `drilldown-records` | Sở hữu record evidence cho aggregate hiện tại mà không reset query state. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Ưu tiên primary analysis visual; chỉ hiện secondary view và record giải thích cùng selection, không tạo grid metric card không liên quan.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Plot phân tích reflow; chỉ `drilldown-records` có thể sở hữu overflow ngang giới hạn cho bằng chứng quan hệ.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Giữ primary view và một support view; đưa view khác vào tab/disclosure có tên trong khi filter, pivot, selection và drill path vẫn liên tục.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Plot phân tích reflow; chỉ `drilldown-records` có thể sở hữu overflow ngang giới hạn cho bằng chứng quan hệ.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Hiện một analytical view mỗi stage; giữ pivot/filter summary và selected segment; mở drill record thành stage/sheet sau thay vì thu nhỏ chart.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Plot phân tích reflow; chỉ `drilldown-records` có thể sở hữu overflow ngang giới hạn cho bằng chứng quan hệ.

### Reflow

- DOM order, reading order, and meaningful focus order are `analytics-workbench → metric-and-scope-context → shared-filter-and-pivot-controls → primary-visual-analysis → coordinated-secondary-views → selected-segment-detail → drilldown-records`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm initial/loading, no data, lỗi một phần series, đang chỉnh pivot, filter applied, selected mark, drill loading, snapshot stale, record bị redact do quyền, export pending và result change được announce.

## State obligations

Task-specific states: initial/loading, no data, lỗi một phần series, đang chỉnh pivot, filter applied, selected mark, drill loading, snapshot stale, record bị redact do quyền, export pending và result change được announce.

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

- Các aggregate view chia sẻ một query và selected segment, còn drilldown record cung cấp evidence cho aggregate đó.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject KPI dashboard thụ động, report cố định, raw table operation và chart collection không có coordinated selection/drill path.
- Reject khi overview dashboard hoặc batch table sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PDA-90`, `AR-PDA-91` hoặc `AR-PDA-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Tableau drill-down and hierarchies](https://help.tableau.com/current/pro/desktop/en-us/qs_hierarchies.htm) | Hierarchies support moving between aggregate levels while preserving analytical context. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information và function sống qua chiều rộng hẹp mà không page-level scroll hai trục. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `pivot-drilldown-analytics`. |
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
  "archetypeId": "pivot-drilldown-analytics",
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
