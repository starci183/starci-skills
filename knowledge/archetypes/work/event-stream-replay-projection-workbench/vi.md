# Event stream replay projection workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `event-stream-replay-projection-workbench` |
| Family | Work |
| Dominant task | Replay immutable event stream từ snapshot hoặc cursor đã chọn, so sánh derived projection state và tìm invariant divergence đầu tiên. |
| Search aliases | `event replay debugger`, `projection divergence`, `event sourcing replay` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Replay immutable event stream từ snapshot hoặc cursor đã chọn, so sánh derived projection state và tìm invariant divergence đầu tiên.
- The replay cursor, derived projections, and invariant results remain peer owners for the first divergence.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ERP-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-ERP-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-ERP-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-ERP-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-ERP-90` | Dominant task thực tế thuộc audit timeline. | Reject. |
| `AR-ERP-91` | Dominant task thực tế thuộc streaming log viewer. | Reject. |
| `AR-ERP-92` | Dominant task thực tế thuộc job-run detail. | Reject. |
| `AR-ERP-93` | Dominant task thực tế thuộc notebook reproducibility audit. | Reject. |

### Selection rule

Chọn `event-stream-replay-projection-workbench` khi và chỉ khi `AR-ERP-01` đến `AR-ERP-04` đều được evidence và không có code `AR-ERP-90` đến `AR-ERP-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `replay-workbench` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `stream-snapshot-and-code-version` | Sở hữu evidence hoặc action của Stream Snapshot And Code Version; giữ relationship đã khai báo với current selection. |
| `ordered-event-stream` | Sở hữu evidence hoặc action của Ordered Event Stream; giữ relationship đã khai báo với current selection. |
| `replay-cursor-and-controls` | Sở hữu evidence hoặc action của Replay Cursor And Controls; giữ relationship đã khai báo với current selection. |
| `materialized-projection-set` | Sở hữu evidence hoặc action của Materialized Projection Set; giữ relationship đã khai báo với current selection. |
| `invariant-check-results` | Sở hữu evidence hoặc action của Invariant Check Results; giữ relationship đã khai báo với current selection. |
| `first-divergence-point` | Sở hữu evidence hoặc action của First Divergence Point; giữ relationship đã khai báo với current selection. |
| `selected-event-payload` | Sở hữu evidence hoặc action của Selected Event Payload; giữ relationship đã khai báo với current selection. |
| `sandbox-outcome` | Sở hữu evidence hoặc action của Sandbox Outcome; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Event stream, projections, and invariant evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `ordered-event-stream` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** Stream and replay stay primary; projections alternate while the cursor persists.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `ordered-event-stream` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Replay summary → first divergence → selected event → projection before and after → invariant result.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `ordered-event-stream` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome`.
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

Task-specific states: snapshot absent, snapshot stale, replay idle, replay running, replay paused, replay failed, replay complete, event unsupported, projection loading, projection diverged, invariant pass, invariant fail, cursor moved, sandbox reset.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `stream-snapshot-and-code-version` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `ordered-event-stream` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `ordered-event-stream` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `selected-event-payload` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `sandbox-outcome` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `sandbox-outcome` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `sandbox-outcome` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `stream-snapshot-and-code-version` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `sandbox-outcome` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `replay-workbench` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Replay immutable event stream từ snapshot hoặc cursor đã chọn, so sánh derived projection state và tìm invariant divergence đầu tiên.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject audit timeline; đây là `AR-ERP-90` evidence và phải route tới adjacent archetype.
- Reject streaming log viewer; đây là `AR-ERP-91` evidence và phải route tới adjacent archetype.
- Reject job-run detail; đây là `AR-ERP-92` evidence và phải route tới adjacent archetype.
- Reject notebook reproducibility audit; đây là `AR-ERP-93` evidence và phải route tới adjacent archetype.

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
| [Microsoft Azure — Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) | Append-only streams, replay, snapshots, and materialized projections. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [AWS — Event sourcing pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing-pattern.html) | Ordered events and reconstructed state. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "event-stream-replay-projection-workbench",
  "situationCodes": ["<matched AR-ERP-* codes>"],
  "searchAliases": ["event replay debugger","projection divergence","event sourcing replay"],
  "dominantTask": "Replay immutable event stream từ snapshot hoặc cursor đã chọn, so sánh derived projection state và tìm invariant divergence đầu tiên.",
  "regions": ["replay-workbench","stream-snapshot-and-code-version","ordered-event-stream","replay-cursor-and-controls","materialized-projection-set","invariant-check-results","first-divergence-point","selected-event-payload","sandbox-outcome"],
  "regionRelationships": ["The replay cursor, derived projections, and invariant results remain peer owners for the first divergence."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "replay-workbench -> stream-snapshot-and-code-version -> ordered-event-stream -> replay-cursor-and-controls -> materialized-projection-set -> invariant-check-results -> first-divergence-point -> selected-event-payload -> sandbox-outcome",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "ordered-event-stream",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["snapshot absent","snapshot stale","replay idle","replay running","replay paused","replay failed","replay complete","event unsupported","projection loading","projection diverged","invariant pass","invariant fail","cursor moved","sandbox reset"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

