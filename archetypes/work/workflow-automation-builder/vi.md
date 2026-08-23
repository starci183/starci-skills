# Workflow automation builder

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `workflow-automation-builder` |
| Family | Work |
| Dominant task | Xây và nối workflow executable nhiều step/branch, cấu hình node, validate path, simulate evidence và activate version an toàn. |
| Search aliases | automation graph, workflow branching, cấu hình node, simulation trace |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `automation-builder` owns the complete dominant task and its recovery boundary.
- Xây và nối workflow executable nhiều step/branch, cấu hình node, validate path, simulate evidence và activate version an toàn.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-WAB-01` | Xây và nối workflow executable nhiều step/branch, cấu hình node, validate path, simulate evidence và activate version an toàn. | Bằng chứng positive bắt buộc. |
| `AR-WAB-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-WAB-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-WAB-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-WAB-90` | Task thực tế do palette builder hoặc rule set sở hữu. | Reject. |
| `AR-WAB-91` | Reject block composition không execution, end-user wizard, kanban board và rule set không có step/path orchestration. | Reject. |
| `AR-WAB-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `workflow-automation-builder` khi và chỉ khi `AR-WAB-01` đến `AR-WAB-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-WAB-90` đến `AR-WAB-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
automation-builder
├─ workflow-version-and-status
├─ trigger-and-step-palette
├─ executable-edge-graph
│  ↔ accessible-branch-outline
├─ selected-node-config
├─ path-validation
├─ simulation-inputs
├─ time-ordered-simulation-trace
└─ review-and-activate
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `automation-builder` | Sở hữu một executable workflow version, graph/outline selection, simulation, activation và rollback. |
| `workflow-version-and-status` | Nêu draft/active version, stale base, permission và rollback target. |
| `trigger-and-step-palette` | Cung cấp executable node type và insertion intent mà không sở hữu path order. |
| `executable-edge-graph` | Sở hữu quan hệ node-edge không gian, branch semantics, pan/zoom giới hạn và selected path. |
| `accessible-branch-outline` | Sở hữu branch model có thứ tự tương đương và mọi connect/remove action cho non-canvas navigation. |
| `selected-node-config` | Chỉnh trigger/step input cho selected node chung và sở hữu field error. |
| `path-validation` | Phát hiện path missing/unreachable/cyclic/parallel invalid và gate simulation. |
| `simulation-inputs` | Sở hữu test input đại diện và queued/running state. |
| `time-ordered-simulation-trace` | Record per-step input, output, branch decision, timing order và failure evidence. |
| `review-and-activate` | Chặn activation đến khi path/trace evidence pass; sở hữu conflict và rollback recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Inspect executable graph/outline, node config và simulation trace cùng lúc; graph sở hữu pan/zoom còn trace là run evidence bền vững.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** `executable-edge-graph` sở hữu pan/zoom giới hạn; outline và simulation trace sở hữu cuộn dọc theo stage; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Biến palette thành drawer; luân phiên config/trace thành supporting pane có tên trong khi graph/outline giữ active node, branch và simulated path.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** `executable-edge-graph` sở hữu pan/zoom giới hạn; outline và simulation trace sở hữu cuộn dọc theo stage; page không sở hữu overflow ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Đặt accessible branch outline primary; tuần tự choose node, configure, connect branch, simulate, inspect full trace rồi activate; graph optional.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `executable-edge-graph` sở hữu pan/zoom giới hạn; outline và simulation trace sở hữu cuộn dọc theo stage; page không sở hữu overflow ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `automation-builder → workflow-version-and-status → trigger-and-step-palette → executable-edge-graph → accessible-branch-outline → selected-node-config → path-validation → simulation-inputs → time-ordered-simulation-trace → review-and-activate`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm draft loading/empty, node/edge add/remove/connect, parallel branch, path invalid/unreachable/cyclic, config error, simulation queued/running/pass/fail có per-step trace, version stale, activate pending/conflict, permission và rollback.

## State obligations

Task-specific states: draft loading/empty, node/edge add/remove/connect, parallel branch, path invalid/unreachable/cyclic, config error, simulation queued/running/pass/fail có per-step trace, version stale, activate pending/conflict, permission và rollback.

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

- Executable node/edge sở hữu path semantics, accessible outline có parity đầy đủ và activation phụ thuộc path validation cùng time-ordered simulation evidence.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject block composition không execution, end-user wizard, kanban board và rule set không có step/path orchestration.
- Reject khi palette builder hoặc rule set sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-WAB-90`, `AR-WAB-91` hoặc `AR-WAB-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [GitHub Actions job dependencies](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs) | Executable jobs form prerequisite paths and failures propagate through dependent branches. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Primary và supplementary region liên quan có thể đồng hiện rồi thành navigation destination tạm thời. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `workflow-automation-builder`. |
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
  "archetypeId": "workflow-automation-builder",
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
