# Batch table operations

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `batch-table-operations` |
| Family | Work |
| Dominant task | Quét các hàng có cấu trúc, tạo tập lựa chọn và commit giao dịch theo tập mà tính đủ điều kiện, hệ quả và kết quả từng phần phụ thuộc vào tập đó trong khi quan hệ cột vẫn được giữ. |
| Search aliases | giao dịch hàng loạt, hàng đã chọn, điều kiện theo tập, sổ kết quả từng phần |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `batch-workbench` owns the complete dominant task and its recovery boundary.
- Quét các hàng có cấu trúc, tạo tập lựa chọn và commit giao dịch theo tập mà tính đủ điều kiện, hệ quả và kết quả từng phần phụ thuộc vào tập đó trong khi quan hệ cột vẫn được giữ.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-BTO-01` | Quét các hàng có cấu trúc, tạo tập lựa chọn và commit giao dịch theo tập mà tính đủ điều kiện, hệ quả và kết quả từng phần phụ thuộc vào tập đó trong khi quan hệ cột vẫn được giữ. | Bằng chứng positive bắt buộc. |
| `AR-BTO-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-BTO-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-BTO-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-BTO-90` | Task thực tế do chỉnh spreadsheet grid hoặc xử lý operational collection sở hữu. | Reject. |
| `AR-BTO-91` | Reject chỉnh cell/range, formula, card browse-first, list không có bằng chứng quan hệ và queue vận hành có vòng lặp inspect từng record thay vì một giao dịch theo tập. | Reject. |
| `AR-BTO-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `batch-table-operations` khi và chỉ khi `AR-BTO-01` đến `AR-BTO-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-BTO-90` đến `AR-BTO-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
batch-workbench
├─ dataset-context
├─ table-toolbar
├─ relational-table
│  └─ selection-set
├─ batch-eligibility-and-consequence
├─ batch-action-mode
├─ batch-outcome-ledger
└─ pagination-or-expansion
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `batch-workbench` | Giới hạn một giao dịch tập dữ liệu và sở hữu tính liên tục qua lọc, chọn, commit và khôi phục. |
| `dataset-context` | Nêu phạm vi và độ mới; mọi vùng phía sau đọc cùng định danh tập dữ liệu. |
| `table-toolbar` | Thay đổi góc nhìn quan hệ và báo tiêu chí đang áp dụng nhưng không sở hữu commit hàng loạt. |
| `relational-table` | Sở hữu quét giữ quan hệ cột, sắp xếp, disclosure và định danh hàng. |
| `selection-set` | Sở hữu membership, phạm vi chọn tất cả và tập chính xác đưa sang kiểm tra điều kiện. |
| `batch-eligibility-and-consequence` | Giải thích thành viên đủ điều kiện/bị chặn và hệ quả trước commit. |
| `batch-action-mode` | Sở hữu xác nhận, chống gửi lặp khi pending và hủy giao dịch theo tập. |
| `batch-outcome-ledger` | Ánh xạ từng hàng đã gửi sang thành công, lỗi hoặc retry mà không biến thành chi tiết record. |
| `pagination-or-expansion` | Mở rộng cùng tập dữ liệu trong khi giữ phạm vi chọn và focus phân trang. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Dành phần lớn chiều rộng cho bảng quan hệ; giữ toolbar, header, selection, eligibility và batch mode gắn cùng owner bảng; không nhốt hàng dày trong rail card hẹp.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `relational-table` sở hữu overflow ngang khi so sánh cột là invariant; outcome ledger có thể cuộn dọc; trang không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Giữ cột định danh và quyết định; ẩn theo ưu tiên hoặc đưa cột hỗ trợ vào disclosure hàng; giữ số lượng chọn, eligibility, hệ quả và action trong một batch context.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `relational-table` sở hữu overflow ngang khi so sánh cột là invariant; outcome ledger có thể cuộn dọc; trang không sở hữu overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Chỉ tuyến tính hóa hàng khi so sánh cột không còn là invariant; nếu không, giữ một table scroller có giới hạn với định danh và cue overflow rõ, rồi mở eligibility và outcome thành stage có tên.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `relational-table` sở hữu overflow ngang khi so sánh cột là invariant; outcome ledger có thể cuộn dọc; trang không sở hữu overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `batch-workbench → dataset-context → table-toolbar → relational-table → selection-set → batch-eligibility-and-consequence → batch-action-mode → batch-outcome-ledger → pagination-or-expansion`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm đang tải dataset, rỗng thật, filter không khớp, lỗi/retry dataset, disclosure hàng, chọn none/single/multi/all, eligibility bị chặn, action thiếu quyền, batch pending, thành công một phần, retry hàng, hàng stale và focus phân trang.

## State obligations

Task-specific states: đang tải dataset, rỗng thật, filter không khớp, lỗi/retry dataset, disclosure hàng, chọn none/single/multi/all, eligibility bị chặn, action thiếu quyền, batch pending, thành công một phần, retry hàng, hàng stale và focus phân trang.

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

- Các cột ổn định tạo bằng chứng quan hệ và tập lựa chọn quyết định một giao dịch, eligibility và kết quả từng hàng.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject chỉnh cell/range, formula, card browse-first, list không có bằng chứng quan hệ và queue vận hành có vòng lặp inspect từng record thay vì một giao dịch theo tập.
- Reject khi chỉnh spreadsheet grid hoặc xử lý operational collection sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-BTO-90`, `AR-BTO-91` hoặc `AR-BTO-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon filtering pattern](https://carbondesignsystem.com/patterns/filtering/) | Filter hiện tiêu chí active và result change trong cùng dataset context. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information và function sống qua chiều rộng hẹp mà không page-level scroll hai trục. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `batch-table-operations`. |
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
  "archetypeId": "batch-table-operations",
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
