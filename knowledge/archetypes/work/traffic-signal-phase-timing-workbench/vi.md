# Traffic signal phase timing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `traffic-signal-phase-timing-workbench` |
| Family | Work |
| Dominant task | Author và validate một traffic-signal plan bằng cách sequence movement tương thích, tune phase timing và ngăn vehicle-pedestrian conflict. |
| Search aliases | `signal timing workbench`, `ring barrier planner`, `phase split editor` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Author và validate một traffic-signal plan bằng cách sequence movement tương thích, tune phase timing và ngăn vehicle-pedestrian conflict.
- Cyclic ring and barrier phase ownership plus movement conflict and clearance constraints determine validity.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-TSP-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-TSP-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-TSP-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-TSP-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-TSP-90` | Dominant task thực tế thuộc calendar scheduler. | Reject. |
| `AR-TSP-91` | Dominant task thực tế thuộc workflow node graph. | Reject. |
| `AR-TSP-92` | Dominant task thực tế thuộc traffic dashboard. | Reject. |
| `AR-TSP-93` | Dominant task thực tế thuộc generic timeline. | Reject. |

### Selection rule

Chọn `traffic-signal-phase-timing-workbench` khi và chỉ khi `AR-TSP-01` đến `AR-TSP-04` đều được evidence và không có code `AR-TSP-90` đến `AR-TSP-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `signal-timing-workbench` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `intersection-movement-model` | Sở hữu evidence hoặc action của Intersection Movement Model; giữ relationship đã khai báo với current selection. |
| `movement-conflict-matrix` | Sở hữu evidence hoặc action của Movement Conflict Matrix; giữ relationship đã khai báo với current selection. |
| `ring-barrier-phase-plan` | Sở hữu evidence hoặc action của Ring Barrier Phase Plan; giữ relationship đã khai báo với current selection. |
| `detector-and-demand-inputs` | Sở hữu evidence hoặc action của Detector And Demand Inputs; giữ relationship đã khai báo với current selection. |
| `split-offset-and-clearance-editor` | Sở hữu evidence hoặc action của Split Offset And Clearance Editor; giữ relationship đã khai báo với current selection. |
| `progression-and-queue-simulation` | Sở hữu evidence hoặc action của Progression And Queue Simulation; giữ relationship đã khai báo với current selection. |
| `safety-validation` | Sở hữu evidence hoặc action của Safety Validation; giữ relationship đã khai báo với current selection. |
| `staged-controller-plan-and-rollback` | Sở hữu evidence hoặc action của Staged Controller Plan And Rollback; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Movement model, both rings and barriers, timing editor, simulation, and validation remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `ring-barrier-phase-plan` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The ring and barrier plan and selected-phase editor own the page; movement, detector, and validation evidence alternate without losing phase selection.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `ring-barrier-phase-plan` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Intersection and movement → conflict evidence → ordered phase groups and barriers → timing and clearance → simulate → validate → stage.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `ring-barrier-phase-plan` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback`.
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

Task-specific states: plan loading, version conflict, movement permitted, movement protected, movement conflicting, detector active, detector failed, phase enabled, phase omitted, split valid, split overallocated, pedestrian clearance sufficient, pedestrian clearance insufficient, barrier synchronized, barrier broken, simulation pending, simulation unstable, simulation pass, deployment staged, deployment failed, rollback available.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `intersection-movement-model` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `movement-conflict-matrix` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `movement-conflict-matrix` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `safety-validation` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `staged-controller-plan-and-rollback` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `staged-controller-plan-and-rollback` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `staged-controller-plan-and-rollback` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `intersection-movement-model` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `staged-controller-plan-and-rollback` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `signal-timing-workbench` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Author và validate một traffic-signal plan bằng cách sequence movement tương thích, tune phase timing và ngăn vehicle-pedestrian conflict.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject calendar scheduler; đây là `AR-TSP-90` evidence và phải route tới adjacent archetype.
- Reject workflow node graph; đây là `AR-TSP-91` evidence và phải route tới adjacent archetype.
- Reject traffic dashboard; đây là `AR-TSP-92` evidence và phải route tới adjacent archetype.
- Reject generic timeline; đây là `AR-TSP-93` evidence và phải route tới adjacent archetype.

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
| [FHWA — Traffic Signal Timing and Operations](https://ops.fhwa.dot.gov/arterial_mgmt/tst_ops.htm) | Movement demand, multimodal timing, and operational validation. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [NTCIP — Published standards](https://www.ntcip.org/document-numbers-and-status/) | Current NTCIP 1202 actuated signal controller standard identity. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "traffic-signal-phase-timing-workbench",
  "situationCodes": ["<matched AR-TSP-* codes>"],
  "searchAliases": ["signal timing workbench","ring barrier planner","phase split editor"],
  "dominantTask": "Author và validate một traffic-signal plan bằng cách sequence movement tương thích, tune phase timing và ngăn vehicle-pedestrian conflict.",
  "regions": ["signal-timing-workbench","intersection-movement-model","movement-conflict-matrix","ring-barrier-phase-plan","detector-and-demand-inputs","split-offset-and-clearance-editor","progression-and-queue-simulation","safety-validation","staged-controller-plan-and-rollback"],
  "regionRelationships": ["Cyclic ring and barrier phase ownership plus movement conflict and clearance constraints determine validity."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "ring-barrier-phase-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["plan loading","version conflict","movement permitted","movement protected","movement conflicting","detector active","detector failed","phase enabled","phase omitted","split valid","split overallocated","pedestrian clearance sufficient","pedestrian clearance insufficient","barrier synchronized","barrier broken","simulation pending","simulation unstable","simulation pass","deployment staged","deployment failed","rollback available"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

