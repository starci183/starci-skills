# Fleet route dispatch planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `fleet-route-dispatch-planner` |
| Family | Work |
| Dominant task | Assign vehicle và job, đánh giá multi-route feasibility và dispatch change dưới capacity, time-window và current-position constraint. |
| Search aliases | `fleet dispatch planner`, `vehicle job assignment`, `multi-route optimization` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Assign vehicle và job, đánh giá multi-route feasibility và dispatch change dưới capacity, time-window và current-position constraint.
- Many vehicle routes and mutable job assignments remain independent owners synchronized by selected vehicle and job.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FRD-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-FRD-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-FRD-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-FRD-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-FRD-90` | Dominant task thực tế thuộc itinerary exploration. | Reject. |
| `AR-FRD-91` | Dominant task thực tế thuộc map situation monitor. | Reject. |
| `AR-FRD-92` | Dominant task thực tế thuộc one-resource scheduler. | Reject. |
| `AR-FRD-93` | Dominant task thực tế thuộc route comparison. | Reject. |

### Selection rule

Chọn `fleet-route-dispatch-planner` khi và chỉ khi `AR-FRD-01` đến `AR-FRD-04` đều được evidence và không có code `AR-FRD-90` đến `AR-FRD-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dispatch-planner` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `fleet-job-queues` | Sở hữu evidence hoặc action của Fleet Job Queues; giữ relationship đã khai báo với current selection. |
| `geographic-route-stage` | Sở hữu evidence hoặc action của Geographic Route Stage; giữ relationship đã khai báo với current selection. |
| `route-stop-ledgers` | Sở hữu evidence hoặc action của Route Stop Ledgers; giữ relationship đã khai báo với current selection. |
| `selected-vehicle-job-constraints` | Sở hữu evidence hoặc action của Selected Vehicle Job Constraints; giữ relationship đã khai báo với current selection. |
| `optimization-alternatives` | Sở hữu evidence hoặc action của Optimization Alternatives; giữ relationship đã khai báo với current selection. |
| `manual-overrides` | Sở hữu evidence hoặc action của Manual Overrides; giữ relationship đã khai báo với current selection. |
| `dispatch-status` | Sở hữu evidence hoặc action của Dispatch Status; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Map, multi-route ledger, and selected constraints remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `geographic-route-stage` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The route ledger or map becomes primary by task while the other is a synchronized drawer.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `geographic-route-stage` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Vehicle and route list → ordered stops → constraint or override → dispatch; the map is an alternate full-screen view.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `geographic-route-stage` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status`.
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

Task-specific states: vehicle available, vehicle offline, vehicle full, job unassigned, job assigned, job late, route feasible, route infeasible, optimization running, override conflict, dispatch pending, dispatch sent, dispatch failed, driver acknowledged, location stale.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `fleet-job-queues` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `geographic-route-stage` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `geographic-route-stage` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `manual-overrides` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `dispatch-status` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `dispatch-status` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `dispatch-status` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `fleet-job-queues` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `dispatch-status` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `dispatch-planner` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Assign vehicle và job, đánh giá multi-route feasibility và dispatch change dưới capacity, time-window và current-position constraint.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject itinerary exploration; đây là `AR-FRD-90` evidence và phải route tới adjacent archetype.
- Reject map situation monitor; đây là `AR-FRD-91` evidence và phải route tới adjacent archetype.
- Reject one-resource scheduler; đây là `AR-FRD-92` evidence và phải route tới adjacent archetype.
- Reject route comparison; đây là `AR-FRD-93` evidence và phải route tới adjacent archetype.

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
| [Google — Route Optimization API](https://developers.google.com/maps/documentation/route-optimization) | Assigning tasks and routes to fleets under supplied objectives and constraints. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SAP — Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf) | Operational vehicle and location coordination. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Esri ArcGIS — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Synchronized spatial and non-spatial task regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "fleet-route-dispatch-planner",
  "situationCodes": ["<matched AR-FRD-* codes>"],
  "searchAliases": ["fleet dispatch planner","vehicle job assignment","multi-route optimization"],
  "dominantTask": "Assign vehicle và job, đánh giá multi-route feasibility và dispatch change dưới capacity, time-window và current-position constraint.",
  "regions": ["dispatch-planner","fleet-job-queues","geographic-route-stage","route-stop-ledgers","selected-vehicle-job-constraints","optimization-alternatives","manual-overrides","dispatch-status"],
  "regionRelationships": ["Many vehicle routes and mutable job assignments remain independent owners synchronized by selected vehicle and job."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "geographic-route-stage",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["vehicle available","vehicle offline","vehicle full","job unassigned","job assigned","job late","route feasible","route infeasible","optimization running","override conflict","dispatch pending","dispatch sent","dispatch failed","driver acknowledged","location stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

