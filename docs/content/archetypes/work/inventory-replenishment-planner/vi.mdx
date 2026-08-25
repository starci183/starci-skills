# Inventory replenishment planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `inventory-replenishment-planner` |
| Family | Work |
| Dominant task | Chuyển demand, stock, lead-time và policy evidence thành order hoặc transfer recommendation có thể execute cho từng item-location. |
| Search aliases | `replenishment recommendation`, `item-location planner`, `stock transfer planner` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Chuyển demand, stock, lead-time và policy evidence thành order hoặc transfer recommendation có thể execute cho từng item-location.
- The recommendation calculation and projected stock and service outcome jointly own the order or transfer decision.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-IRP-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-IRP-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-IRP-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-IRP-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-IRP-90` | Dominant task thực tế thuộc capacity overview. | Reject. |
| `AR-IRP-91` | Dominant task thực tế thuộc scenario sensitivity. | Reject. |
| `AR-IRP-92` | Dominant task thực tế thuộc quota allocation. | Reject. |
| `AR-IRP-93` | Dominant task thực tế thuộc spreadsheet. | Reject. |

### Selection rule

Chọn `inventory-replenishment-planner` khi và chỉ khi `AR-IRP-01` đến `AR-IRP-04` đều được evidence và không có code `AR-IRP-90` đến `AR-IRP-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `replenishment-planner` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `network-policy` | Sở hữu evidence hoặc action của Network Policy; giữ relationship đã khai báo với current selection. |
| `item-location-exception-queue` | Sở hữu evidence hoặc action của Item Location Exception Queue; giữ relationship đã khai báo với current selection. |
| `demand-supply-timeline` | Sở hữu evidence hoặc action của Demand Supply Timeline; giữ relationship đã khai báo với current selection. |
| `recommendation-calculation` | Sở hữu evidence hoặc action của Recommendation Calculation; giữ relationship đã khai báo với current selection. |
| `order-transfer-decision` | Sở hữu evidence hoặc action của Order Transfer Decision; giữ relationship đã khai báo với current selection. |
| `projected-stock-service` | Sở hữu evidence hoặc action của Projected Stock Service; giữ relationship đã khai báo với current selection. |
| `release` | Sở hữu evidence hoặc action của Release; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** The exception queue, demand-supply timeline, decision, and projected outcome remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `demand-supply-timeline` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The selected item-location stays primary while the exception queue becomes a drawer.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `demand-supply-timeline` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Exception list → evidence timeline → recommendation explanation → editable decision → projected outcome → release.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `demand-supply-timeline` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release`.
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

Task-specific states: stock loading, stock stale, shortage, excess, demand spike, lead time unknown, recommendation calculating, recommendation blocked, MOQ conflict, decision accepted, decision overridden, projection below target, release.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `network-policy` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `item-location-exception-queue` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `item-location-exception-queue` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `projected-stock-service` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `release` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `release` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `release` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `network-policy` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `release` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `replenishment-planner` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Chuyển demand, stock, lead-time và policy evidence thành order hoặc transfer recommendation có thể execute cho từng item-location.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject capacity overview; đây là `AR-IRP-90` evidence và phải route tới adjacent archetype.
- Reject scenario sensitivity; đây là `AR-IRP-91` evidence và phải route tới adjacent archetype.
- Reject quota allocation; đây là `AR-IRP-92` evidence và phải route tới adjacent archetype.
- Reject spreadsheet; đây là `AR-IRP-93` evidence và phải route tới adjacent archetype.

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
| [SAP — Replenishment](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9905622a5c1f49ba84e9076fc83a9c2c/2c9fc7536e8e2a4be10000000a174cb4.html) | Item-level replenishment inputs and executable supply actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Oracle Retail Inventory Planning](https://docs.oracle.com/en/industries/retail/retail-inventory-planning-optimization-cloud/26.1.201.0/ipoio/G53785_02.pdf) | Inventory planning, demand, and replenishment recommendations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [SAP Fiori for Web — Layouts and floorplans](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Full-screen and multi-region page relationships for enterprise work. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "inventory-replenishment-planner",
  "situationCodes": ["<matched AR-IRP-* codes>"],
  "searchAliases": ["replenishment recommendation","item-location planner","stock transfer planner"],
  "dominantTask": "Chuyển demand, stock, lead-time và policy evidence thành order hoặc transfer recommendation có thể execute cho từng item-location.",
  "regions": ["replenishment-planner","network-policy","item-location-exception-queue","demand-supply-timeline","recommendation-calculation","order-transfer-decision","projected-stock-service","release"],
  "regionRelationships": ["The recommendation calculation and projected stock and service outcome jointly own the order or transfer decision."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "demand-supply-timeline",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["stock loading","stock stale","shortage","excess","demand spike","lead time unknown","recommendation calculating","recommendation blocked","MOQ conflict","decision accepted","decision overridden","projection below target","release"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

