# Workbench nghĩa vụ chứng minh hình thức

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `formal-proof-obligation-workbench` |
| Family | Work |
| Dominant task | Giải các nghĩa vụ chứng minh hình thức bằng tactic đồng thời theo dõi giả thuyết, target, subgoal sinh ra và verdict có thể được kernel kiểm tra. |
| Search aliases | `proof obligation stack`, `tactic state transition`, `kernel verdict`, `subgoal navigator` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Giải các nghĩa vụ chứng minh hình thức bằng tactic đồng thời theo dõi giả thuyết, target, subgoal sinh ra và verdict có thể được kernel kiểm tra.
- Required region graph luôn là `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PO-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-PO-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-PO-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-PO-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-PO-05` | Template must apply a tactic, expose the exact before/after proof states, navigate generated subgoals, announce failure without stealing focus and end only on a kernel verdict. | Required evidence. |
| `AR-PO-90` | code playground | Từ chối. |
| `AR-PO-91` | document editor | Từ chối. |
| `AR-PO-92` | tree navigator | Từ chối. |
| `AR-PO-93` | generic workflow | Từ chối. |

### Quy tắc chọn

Chỉ chọn `formal-proof-obligation-workbench` khi `AR-PO-01` đến `AR-PO-05` đều có evidence và không có mã `AR-PO-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
proof-workbench
   `-- theorem-outline
      `-- obligation-stack
         `-- selected-local-context-and-target
            `-- tactic-editor
               `-- proof-state-transition-ledger
                  `-- successor-subgoals
                     `-- kernel-verdict
```

Biểu thức relationship đã khai báo: `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `proof-workbench` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `theorem-outline` | Sở hữu evidence, action, state và recovery của theorem outline. | Theo sau `proof-workbench` trong semantic order và dùng đúng selected context của vùng đó. |
| `obligation-stack` | Sở hữu evidence, action, state và recovery của obligation stack. | Theo sau `theorem-outline` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-local-context-and-target` | Sở hữu evidence, action, state và recovery của selected local context and target. | Đồng bộ hai chiều với `obligation-stack` trong cùng selected context. |
| `tactic-editor` | Sở hữu evidence, action, state và recovery của tactic editor. | Đồng bộ hai chiều với `selected-local-context-and-target` trong cùng selected context. |
| `proof-state-transition-ledger` | Sở hữu evidence, action, state và recovery của proof state transition ledger. | Theo sau `tactic-editor` trong semantic order và dùng đúng selected context của vùng đó. |
| `successor-subgoals` | Sở hữu evidence, action, state và recovery của successor subgoals. | Theo sau `proof-state-transition-ledger` trong semantic order và dùng đúng selected context của vùng đó. |
| `kernel-verdict` | Sở hữu evidence, action, state và recovery của kernel verdict. | Theo sau `successor-subgoals` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Theorem outline, current context/goal, tactic editor and transition/subgoal evidence remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `proof-state-transition-ledger` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Outline becomes a proof-path breadcrumb; goal and editor keep a split while transition history becomes a drawer.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `proof-state-transition-ledger` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Pending obligation → hypotheses → target → tactic input → resulting subgoals/verdict; the proof tree becomes current path plus pending branch count.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `proof-state-transition-ledger` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target → tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`.
- Text zoom, translation dài và control phóng to kích hoạt cùng named topology change.
- CSS không reorder visual content lệch khỏi keyboard hoặc assistive-technology order.
- Label và identifier dài được wrap; detail ẩn có accessible reveal rõ ràng.
- Nội dung thường không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ selected entity, version, filter, pending state, validation result và recovery point.
- Dynamic update dùng một contextual status message mà không di chuyển focus.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel, rồi trả focus về đúng trigger.
- Drag, drawing, fader, spatial hoặc point movement có parity bằng button, numeric hoặc list.
- Color, position, geometry và motion luôn có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi đầu / loading | `theorem-outline` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `obligation-stack` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `selected-local-context-and-target` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `tactic-editor` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `successor-subgoals` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `kernel-verdict` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `kernel-verdict` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `theorem-outline` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `kernel-verdict` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `proof-workbench` | Giữ selected entity, query, state và recovery khi topology đổi. |
| theorem loading | `theorem-outline` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| obligation pending/active/closed | `obligation-stack` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| tactic parsing/running/error | `selected-local-context-and-target` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| no progress | `tactic-editor` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| subgoals generated | `proof-state-transition-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| context changed | `successor-subgoals` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| kernel accepted/rejected and proof stale after edit. | `kernel-verdict` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must apply a tactic, expose the exact before/after proof states, navigate generated subgoals, announce failure without stealing focus and end only on a kernel verdict.

### Từ chối

- Từ chối code playground; đây là evidence `AR-PO-90` và phải route sang archetype khác.
- Từ chối document editor; đây là evidence `AR-PO-91` và phải route sang archetype khác.
- Từ chối tree navigator; đây là evidence `AR-PO-92` và phải route sang archetype khác.
- Từ chối generic workflow; đây là evidence `AR-PO-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-PO-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

## Bàn giao

- **Grammar handoff:** Bind product-specific owner, label, permission, truthful state meaning và permitted action vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Hai handoff không được xóa required region, thay dominant task hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis của task relationship, responsive transformation, interaction và accessibility obligation. Nó không đặt tên StarCi owner, chọn exact geometry, tạo product fact hoặc cấp quyền copy source interface.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [Lean — Tactic Proofs](https://lean-lang.org/doc/reference/latest/Tactic-Proofs/) | Hỗ trợ tactics, goals, generated proof states, and closure. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Isabelle — Documentation](https://isabelle.in.tum.de/documentation.html) | Hỗ trợ formal proof documents and checked results. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announcing tactic outcomes without focus theft. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "formal-proof-obligation-workbench",
  "situationCodes": [
    "<matched AR-PO-* codes>"
  ],
  "searchAliases": [
    "proof obligation stack",
    "tactic state transition",
    "kernel verdict",
    "subgoal navigator"
  ],
  "dominantTask": "Discharge formal proof obligations with tactics while tracking hypotheses, targets, generated subgoals and kernel-checkable verdicts.",
  "regions": [
    "proof-workbench",
    "theorem-outline",
    "obligation-stack",
    "selected-local-context-and-target",
    "tactic-editor",
    "proof-state-transition-ledger",
    "successor-subgoals",
    "kernel-verdict"
  ],
  "regionRelationships": [
    "proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target → tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "theorem loading",
    "obligation pending/active/closed",
    "tactic parsing/running/error",
    "no progress",
    "subgoals generated",
    "context changed",
    "kernel accepted/rejected and proof stale after edit."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

