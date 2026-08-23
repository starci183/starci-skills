# Warehouse pick wave planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `warehouse-pick-wave-planner` |
| Family | Work |
| Dominant task | Group warehouse task đủ điều kiện thành wave bị giới hạn bởi capacity, time và zone, sequence chúng và release work có thể execute. |
| Search aliases | `pick wave planner`, `warehouse wave release`, `task wave sequencing` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Group warehouse task đủ điều kiện thành wave bị giới hạn bởi capacity, time và zone, sequence chúng và release work có thể execute.
- Wave membership, task sequence, and capacity collectively define one releasable wave.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-WPW-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-WPW-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-WPW-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-WPW-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-WPW-90` | Dominant task thực tế thuộc batch table actions. | Reject. |
| `AR-WPW-91` | Dominant task thực tế thuộc dual-list transfer. | Reject. |
| `AR-WPW-92` | Dominant task thực tế thuộc kanban. | Reject. |
| `AR-WPW-93` | Dominant task thực tế thuộc calendar scheduler. | Reject. |

### Selection rule

Chọn `warehouse-pick-wave-planner` khi và chỉ khi `AR-WPW-01` đến `AR-WPW-04` đều được evidence và không có code `AR-WPW-90` đến `AR-WPW-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
wave-planner -> eligible-order-task-pool -> wave-capacity-window -> zone-route-grouping -> selected-wave-task-ledger -> labor-equipment-check -> exceptions -> release-monitor
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `wave-planner` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `eligible-order-task-pool` | Sở hữu evidence hoặc action của Eligible Order Task Pool; giữ relationship đã khai báo với current selection. |
| `wave-capacity-window` | Sở hữu evidence hoặc action của Wave Capacity Window; giữ relationship đã khai báo với current selection. |
| `zone-route-grouping` | Sở hữu evidence hoặc action của Zone Route Grouping; giữ relationship đã khai báo với current selection. |
| `selected-wave-task-ledger` | Sở hữu evidence hoặc action của Selected Wave Task Ledger; giữ relationship đã khai báo với current selection. |
| `labor-equipment-check` | Sở hữu evidence hoặc action của Labor Equipment Check; giữ relationship đã khai báo với current selection. |
| `exceptions` | Sở hữu evidence hoặc action của Exceptions; giữ relationship đã khai báo với current selection. |
| `release-monitor` | Sở hữu evidence hoặc action của Release Monitor; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Eligible pool, wave board, and capacity and exception evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `selected-wave-task-ledger` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The pool becomes a filterable drawer while the selected wave remains primary.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `selected-wave-task-ledger` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Wave selector → capacity summary → task membership and order → exceptions → release; buttons replace drag.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `selected-wave-task-ledger` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `wave-planner -> eligible-order-task-pool -> wave-capacity-window -> zone-route-grouping -> selected-wave-task-ledger -> labor-equipment-check -> exceptions -> release-monitor`.
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

Task-specific states: task eligible, task held, wave draft, wave full, wave over capacity, route grouping valid, route grouping conflict, labor ready, labor missing, equipment ready, equipment missing, exception open, release locked, release pending, release success, release failure, task changed.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `eligible-order-task-pool` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `wave-capacity-window` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `wave-capacity-window` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `exceptions` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `release-monitor` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `release-monitor` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `release-monitor` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `eligible-order-task-pool` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `release-monitor` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `wave-planner` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Group warehouse task đủ điều kiện thành wave bị giới hạn bởi capacity, time và zone, sequence chúng và release work có thể execute.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject batch table actions; đây là `AR-WPW-90` evidence và phải route tới adjacent archetype.
- Reject dual-list transfer; đây là `AR-WPW-91` evidence và phải route tới adjacent archetype.
- Reject kanban; đây là `AR-WPW-92` evidence và phải route tới adjacent archetype.
- Reject calendar scheduler; đây là `AR-WPW-93` evidence và phải route tới adjacent archetype.

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
| [SAP — Wave management](https://help.sap.com/docs/SAP_EXTENDED_WAREHOUSE_MANAGEMENT/3d97bec9bf1649099384bb8167df3cf2/6dc8cb53ad377114e10000000a174cb4.html) | Wave creation, warehouse task grouping, and release lifecycle. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Google — Route Optimization API](https://developers.google.com/maps/documentation/route-optimization) | Sequencing work under capacity and route constraints. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SAP Fiori for Web — Layouts and floorplans](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Full-screen and multi-region page relationships for enterprise work. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "warehouse-pick-wave-planner",
  "situationCodes": ["<matched AR-WPW-* codes>"],
  "searchAliases": ["pick wave planner","warehouse wave release","task wave sequencing"],
  "dominantTask": "Group warehouse task đủ điều kiện thành wave bị giới hạn bởi capacity, time và zone, sequence chúng và release work có thể execute.",
  "regions": ["wave-planner","eligible-order-task-pool","wave-capacity-window","zone-route-grouping","selected-wave-task-ledger","labor-equipment-check","exceptions","release-monitor"],
  "regionRelationships": ["Wave membership, task sequence, and capacity collectively define one releasable wave."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "wave-planner -> eligible-order-task-pool -> wave-capacity-window -> zone-route-grouping -> selected-wave-task-ledger -> labor-equipment-check -> exceptions -> release-monitor",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "selected-wave-task-ledger",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["task eligible","task held","wave draft","wave full","wave over capacity","route grouping valid","route grouping conflict","labor ready","labor missing","equipment ready","equipment missing","exception open","release locked","release pending","release success","release failure","task changed"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

