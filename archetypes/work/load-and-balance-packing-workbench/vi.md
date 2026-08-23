# Load and balance packing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `load-and-balance-packing-workbench` |
| Family | Work |
| Dominant task | Đặt cargo vào compartment hoặc container trong khi thỏa weight, center-of-gravity, compatibility, securing và unload-order constraint. |
| Search aliases | `cargo load planner`, `weight and balance`, `compartment packing` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Đặt cargo vào compartment hoặc container trong khi thỏa weight, center-of-gravity, compatibility, securing và unload-order constraint.
- Placement geometry and the global weight and center-of-gravity envelope jointly own plan validity.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-LBP-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-LBP-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-LBP-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-LBP-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-LBP-90` | Dominant task thực tế thuộc seat reservation. | Reject. |
| `AR-LBP-91` | Dominant task thực tế thuộc quota allocation. | Reject. |
| `AR-LBP-92` | Dominant task thực tế thuộc dual-list transfer. | Reject. |
| `AR-LBP-93` | Dominant task thực tế thuộc generic canvas. | Reject. |

### Selection rule

Chọn `load-and-balance-packing-workbench` khi và chỉ khi `AR-LBP-01` đến `AR-LBP-04` đều được evidence và không có code `AR-LBP-90` đến `AR-LBP-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `load-workbench` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `cargo-pool` | Sở hữu evidence hoặc action của Cargo Pool; giữ relationship đã khai báo với current selection. |
| `compartment-spatial-plan` | Sở hữu evidence hoặc action của Compartment Spatial Plan; giữ relationship đã khai báo với current selection. |
| `placement-manifest` | Sở hữu evidence hoặc action của Placement Manifest; giữ relationship đã khai báo với current selection. |
| `weight-balance-envelope` | Sở hữu evidence hoặc action của Weight Balance Envelope; giữ relationship đã khai báo với current selection. |
| `compatibility-securing-checks` | Sở hữu evidence hoặc action của Compatibility Securing Checks; giữ relationship đã khai báo với current selection. |
| `unload-sequence` | Sở hữu evidence hoặc action của Unload Sequence; giữ relationship đã khai báo với current selection. |
| `approval` | Sở hữu evidence hoặc action của Approval; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Cargo pool, spatial plan, and live balance and constraint rail remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `compartment-spatial-plan` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** Cargo becomes a drawer while the plan and balance evidence remain primary.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `compartment-spatial-plan` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Compartment → candidate cargo → placement controls → balance and constraint result → manifest and unload review; buttons replace drag.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `compartment-spatial-plan` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval`.
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

Task-specific states: cargo unplaced, cargo placed, compartment open, compartment full, weight within envelope, weight outside envelope, CG within envelope, CG outside envelope, incompatibility, securing missing, unload blocked, plan dirty, approval pending, approval failure, approval success.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `cargo-pool` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `compartment-spatial-plan` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `compartment-spatial-plan` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `unload-sequence` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `approval` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `approval` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `approval` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `cargo-pool` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `approval` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `load-workbench` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Đặt cargo vào compartment hoặc container trong khi thỏa weight, center-of-gravity, compatibility, securing và unload-order constraint.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject seat reservation; đây là `AR-LBP-90` evidence và phải route tới adjacent archetype.
- Reject quota allocation; đây là `AR-LBP-91` evidence và phải route tới adjacent archetype.
- Reject dual-list transfer; đây là `AR-LBP-92` evidence và phải route tới adjacent archetype.
- Reject generic canvas; đây là `AR-LBP-93` evidence và phải route tới adjacent archetype.

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
| [FAA — Weight and Balance Handbook](https://www.faa.gov/sites/faa.gov/files/2023-09/Weight_Balance_Handbook.pdf) | Weight, moment, and center-of-gravity envelope calculations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IATA — Unit Load Devices](https://www.iata.org/en/programs/cargo/cargo-operations/unit-load-devices/) | Cargo restraint, handling, and load-device safety. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "load-and-balance-packing-workbench",
  "situationCodes": ["<matched AR-LBP-* codes>"],
  "searchAliases": ["cargo load planner","weight and balance","compartment packing"],
  "dominantTask": "Đặt cargo vào compartment hoặc container trong khi thỏa weight, center-of-gravity, compatibility, securing và unload-order constraint.",
  "regions": ["load-workbench","cargo-pool","compartment-spatial-plan","placement-manifest","weight-balance-envelope","compatibility-securing-checks","unload-sequence","approval"],
  "regionRelationships": ["Placement geometry and the global weight and center-of-gravity envelope jointly own plan validity."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "load-workbench -> cargo-pool -> compartment-spatial-plan -> placement-manifest -> weight-balance-envelope -> compatibility-securing-checks -> unload-sequence -> approval",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "compartment-spatial-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["cargo unplaced","cargo placed","compartment open","compartment full","weight within envelope","weight outside envelope","CG within envelope","CG outside envelope","incompatibility","securing missing","unload blocked","plan dirty","approval pending","approval failure","approval success"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

