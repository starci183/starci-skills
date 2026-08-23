# Dock yard door dispatch board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dock-yard-door-dispatch-board` |
| Family | Work |
| Dominant task | Coordinate arrival, yard position, dock-door time và trailer move qua spatial và temporal constraint. |
| Search aliases | `yard dispatch board`, `dock door scheduler`, `trailer move control` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Coordinate arrival, yard position, dock-door time và trailer move qua spatial và temporal constraint.
- Each trailer changes physical location state while consuming one compatible door interval.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DYD-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-DYD-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-DYD-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-DYD-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-DYD-90` | Dominant task thực tế thuộc calendar scheduler. | Reject. |
| `AR-DYD-91` | Dominant task thực tế thuộc fleet routing. | Reject. |
| `AR-DYD-92` | Dominant task thực tế thuộc map monitor. | Reject. |
| `AR-DYD-93` | Dominant task thực tế thuộc status timeline. | Reject. |

### Selection rule

Chọn `dock-yard-door-dispatch-board` khi và chỉ khi `AR-DYD-01` đến `AR-DYD-04` đều được evidence và không có code `AR-DYD-90` đến `AR-DYD-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `yard-dispatch` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `appointment-arrival-queue` | Sở hữu evidence hoặc action của Appointment Arrival Queue; giữ relationship đã khai báo với current selection. |
| `yard-spatial-stage` | Sở hữu evidence hoặc action của Yard Spatial Stage; giữ relationship đã khai báo với current selection. |
| `door-time-grid` | Sở hữu evidence hoặc action của Door Time Grid; giữ relationship đã khai báo với current selection. |
| `trailer-move-queue` | Sở hữu evidence hoặc action của Trailer Move Queue; giữ relationship đã khai báo với current selection. |
| `selected-load-constraints` | Sở hữu evidence hoặc action của Selected Load Constraints; giữ relationship đã khai báo với current selection. |
| `assign-move-complete` | Sở hữu evidence hoặc action của Assign Move Complete; giữ relationship đã khai báo với current selection. |
| `delay-exception-log` | Sở hữu evidence hoặc action của Delay Exception Log; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Yard stage, door timeline, and arrival and move queues remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `door-time-grid` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The timeline or yard view becomes primary with a synchronized state drawer.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `door-time-grid` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Arrival → trailer state and location → eligible doors → move or complete → exception; map and schedule are alternate parity views.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `door-time-grid` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log`.
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

Task-specific states: arrival expected, arrival early, arrival late, trailer at gate, trailer in yard, trailer at door, trailer departed, door free, door occupied, door blocked, move queued, move active, move failed, constraint conflict, delay exception, completion receipt.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `appointment-arrival-queue` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `yard-spatial-stage` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `yard-spatial-stage` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `assign-move-complete` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `delay-exception-log` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `delay-exception-log` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `delay-exception-log` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `appointment-arrival-queue` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `delay-exception-log` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `yard-dispatch` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Coordinate arrival, yard position, dock-door time và trailer move qua spatial và temporal constraint.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject calendar scheduler; đây là `AR-DYD-90` evidence và phải route tới adjacent archetype.
- Reject fleet routing; đây là `AR-DYD-91` evidence và phải route tới adjacent archetype.
- Reject map monitor; đây là `AR-DYD-92` evidence và phải route tới adjacent archetype.
- Reject status timeline; đây là `AR-DYD-93` evidence và phải route tới adjacent archetype.

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
| [SAP — Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf) | Yard location, door assignment, appointment, and trailer move operations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SAP Fiori for Web — Layouts and floorplans](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Full-screen and multi-region page relationships for enterprise work. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Esri ArcGIS — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Synchronized spatial and non-spatial task regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "dock-yard-door-dispatch-board",
  "situationCodes": ["<matched AR-DYD-* codes>"],
  "searchAliases": ["yard dispatch board","dock door scheduler","trailer move control"],
  "dominantTask": "Coordinate arrival, yard position, dock-door time và trailer move qua spatial và temporal constraint.",
  "regions": ["yard-dispatch","appointment-arrival-queue","yard-spatial-stage","door-time-grid","trailer-move-queue","selected-load-constraints","assign-move-complete","delay-exception-log"],
  "regionRelationships": ["Each trailer changes physical location state while consuming one compatible door interval."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "door-time-grid",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["arrival expected","arrival early","arrival late","trailer at gate","trailer in yard","trailer at door","trailer departed","door free","door occupied","door blocked","move queued","move active","move failed","constraint conflict","delay exception","completion receipt"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

