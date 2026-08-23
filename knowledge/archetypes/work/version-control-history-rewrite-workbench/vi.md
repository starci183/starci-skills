# Version control history rewrite workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `version-control-history-rewrite-workbench` |
| Family | Work |
| Dominant task | Transform ordered commit DAG an toàn, resolve rewrite conflict và preview graph kết quả trước khi update ref. |
| Search aliases | `interactive rebase workbench`, `commit DAG rewrite`, `history rewrite preview` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Transform ordered commit DAG an toàn, resolve rewrite conflict và preview graph kết quả trước khi update ref.
- Commit order and the before and after DAGs jointly own the rewrite transaction and recovery boundary.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-HRW-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-HRW-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-HRW-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-HRW-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-HRW-90` | Dominant task thực tế thuộc generic diff reconciliation. | Reject. |
| `AR-HRW-91` | Dominant task thực tế thuộc document outline. | Reject. |
| `AR-HRW-92` | Dominant task thực tế thuộc workflow automation. | Reject. |
| `AR-HRW-93` | Dominant task thực tế thuộc audit timeline. | Reject. |

### Selection rule

Chọn `version-control-history-rewrite-workbench` khi và chỉ khi `AR-HRW-01` đến `AR-HRW-04` đều được evidence và không có code `AR-HRW-90` đến `AR-HRW-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
history-rewrite -> branch-base-and-upstream-context -> before-commit-dag -> ordered-rewrite-todo -> selected-commit-operation -> conflict-resolution -> after-dag-preview -> downstream-public-impact -> apply-and-reflog-recovery
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `history-rewrite` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `branch-base-and-upstream-context` | Sở hữu evidence hoặc action của Branch Base And Upstream Context; giữ relationship đã khai báo với current selection. |
| `before-commit-dag` | Sở hữu evidence hoặc action của Before Commit Dag; giữ relationship đã khai báo với current selection. |
| `ordered-rewrite-todo` | Sở hữu evidence hoặc action của Ordered Rewrite Todo; giữ relationship đã khai báo với current selection. |
| `selected-commit-operation` | Sở hữu evidence hoặc action của Selected Commit Operation; giữ relationship đã khai báo với current selection. |
| `conflict-resolution` | Sở hữu evidence hoặc action của Conflict Resolution; giữ relationship đã khai báo với current selection. |
| `after-dag-preview` | Sở hữu evidence hoặc action của After Dag Preview; giữ relationship đã khai báo với current selection. |
| `downstream-public-impact` | Sở hữu evidence hoặc action của Downstream Public Impact; giữ relationship đã khai báo với current selection. |
| `apply-and-reflog-recovery` | Sở hữu evidence hoặc action của Apply And Reflog Recovery; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** The before DAG, rewrite todo or conflict, and after preview remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `before-commit-dag` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** Todo and conflict work stay primary; before and after graphs alternate with selected commit preserved.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `before-commit-dag` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Commit → operation → conflict when present → resulting order → public-impact review → apply; reorder has button parity.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `before-commit-dag` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `history-rewrite -> branch-base-and-upstream-context -> before-commit-dag -> ordered-rewrite-todo -> selected-commit-operation -> conflict-resolution -> after-dag-preview -> downstream-public-impact -> apply-and-reflog-recovery`.
- Long label, bản dịch, zoom và enlarged controls kích hoạt cùng named topology change.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi wide selection, edit, action, explanation, retry và recovery đều reachable ở intermediate và compact.
- Topology change giữ exact selected object, cursor/order, data state, pending result và error context.
- Pointer action có keyboard và single-pointer non-drag equivalent khi movement liên quan.
- Dynamic update announce một contextual status mà không steal focus; color không phải tín hiệu duy nhất.
- Modal đưa focus vào, contain focus, hỗ trợ Escape/Cancel và return đúng trigger.

## State obligations

Task-specific states: history loading, pick, reword, squash, drop, reorder, conflict open, conflict resolved, preview stale, published impact warning, apply pending, apply failure, apply success, abort, reflog recovery.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `branch-base-and-upstream-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `before-commit-dag` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `before-commit-dag` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `downstream-public-impact` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `apply-and-reflog-recovery` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `apply-and-reflog-recovery` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `apply-and-reflog-recovery` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `branch-base-and-upstream-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `apply-and-reflog-recovery` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `history-rewrite` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Transform ordered commit DAG an toàn, resolve rewrite conflict và preview graph kết quả trước khi update ref.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject generic diff reconciliation; đây là `AR-HRW-90` evidence và phải route tới adjacent archetype.
- Reject document outline; đây là `AR-HRW-91` evidence và phải route tới adjacent archetype.
- Reject workflow automation; đây là `AR-HRW-92` evidence và phải route tới adjacent archetype.
- Reject audit timeline; đây là `AR-HRW-93` evidence và phải route tới adjacent archetype.

### Boundary verdict

Trả `accept` chỉ khi dominant task, complete graph và compact parity cùng hold. Khác biệt chỉ ở noun, density, color, component, card count hoặc state là `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owner, label, permitted action và truthful state meaning vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition point.
- Không handoff nào được xóa required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis task relationship, adaptive behavior và accessibility obligation; không chọn StarCi owner, exact geometry hay cho phép copy source UI.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Git — Interactive rebase](https://git-scm.com/docs/git-rebase) | Ordered rebase todo, conflict, continue, abort, and rewritten commits. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [GitHub Docs — About rebase](https://docs.github.com/en/get-started/using-git/about-git-rebase) | Downstream effects of rewriting published history. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "version-control-history-rewrite-workbench",
  "situationCodes": ["<matched AR-HRW-* codes>"],
  "searchAliases": ["interactive rebase workbench","commit DAG rewrite","history rewrite preview"],
  "dominantTask": "Transform ordered commit DAG an toàn, resolve rewrite conflict và preview graph kết quả trước khi update ref.",
  "regions": ["history-rewrite","branch-base-and-upstream-context","before-commit-dag","ordered-rewrite-todo","selected-commit-operation","conflict-resolution","after-dag-preview","downstream-public-impact","apply-and-reflog-recovery"],
  "regionRelationships": ["Commit order and the before and after DAGs jointly own the rewrite transaction and recovery boundary."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "history-rewrite -> branch-base-and-upstream-context -> before-commit-dag -> ordered-rewrite-todo -> selected-commit-operation -> conflict-resolution -> after-dag-preview -> downstream-public-impact -> apply-and-reflog-recovery",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "before-commit-dag",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["history loading","pick","reword","squash","drop","reorder","conflict open","conflict resolved","preview stale","published impact warning","apply pending","apply failure","apply success","abort","reflog recovery"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

