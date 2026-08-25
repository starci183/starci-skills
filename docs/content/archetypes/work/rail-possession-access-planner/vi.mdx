# Rail Possession Access Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `rail-possession-access-planner` |
| Family | Work |
| Dominant task | Lập kế hoạch, chính thức tiếp nhận, kiểm soát và bàn giao một railway possession có giới hạn hạ tầng chính xác, chứa các worksite lồng nhau với authority riêng và chỉ cho authority ngoài cùng giải phóng tuyến khi mọi authority cấp dưới đã đóng. |
| Search aliases | `possession`, `access`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Lập kế hoạch, chính thức tiếp nhận, kiểm soát và bàn giao một railway possession có giới hạn hạ tầng chính xác, chứa các worksite lồng nhau với authority riêng và chỉ cho authority ngoài cùng giải phóng tuyến khi mọi authority cấp dưới đã đóng.
- Required region graph luôn là `rail-possession → corridor-service-and-access-window → exact-track-possession-limits ↔ protecting-signal-point-and-block-boundaries → possession-authority-and-take-sequence → nested-worksite-boundary-and-authority-tree → engineering-train-access-and-movement-plan → live-worksite-people-plant-train-and-exception-register → child-worksite-clearance-receipts → protection-removal-and-possession-give-up-authority → service-handback-record`.
- Quan hệ bắt buộc luôn là: outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must define outer possession limits, place protection, take the possession under one authority, open at least two nested worksites under distinct owners, admit an engineering train, block give-up on one missing child receipt, clear each owner in order and record accepted handback without relying on drag.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-10-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-10-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-10-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-10-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-10-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-10-90` | Dominant task thực chất là `railway-movement-authority-control-console`. | Reject. |
| `AR-B13-10-91` | Dominant task thực chất là `rail-disruption-timetable-recovery-workbench`. | Reject. |
| `AR-B13-10-92` | Dominant task thực chất là `calendar-resource-scheduler`. | Reject. |
| `AR-B13-10-93` | Dominant task thực chất là `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-10-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `rail-possession-access-planner` chỉ khi `AR-B13-10-01` đến `AR-B13-10-05` đều có bằng chứng và không có mã `AR-B13-10-90` đến `AR-B13-10-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
rail-possession
└─ corridor-service-and-access-window
   └─ exact-track-possession-limits
      ↔─ protecting-signal-point-and-block-boundaries
         └─ possession-authority-and-take-sequence
            └─ nested-worksite-boundary-and-authority-tree
               └─ engineering-train-access-and-movement-plan
                  └─ live-worksite-people-plant-train-and-exception-register
                     └─ child-worksite-clearance-receipts
                        └─ protection-removal-and-possession-give-up-authority
                           └─ service-handback-record
```

- Required relationship: outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `rail-possession` | Sở hữu bằng chứng, state và action cho rail possession mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `corridor-service-and-access-window` | Sở hữu bằng chứng, state và action cho corridor service and access window mà không mượn product semantics. | Theo sau `rail-possession` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `exact-track-possession-limits` | Sở hữu bằng chứng, state và action cho exact track possession limits mà không mượn product semantics. | Theo sau `corridor-service-and-access-window` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `protecting-signal-point-and-block-boundaries` | Sở hữu bằng chứng, state và action cho protecting signal point and block boundaries mà không mượn product semantics. | Đồng bộ hai chiều với `exact-track-possession-limits` trong cùng selection context. |
| `possession-authority-and-take-sequence` | Sở hữu bằng chứng, state và action cho possession authority and take sequence mà không mượn product semantics. | Theo sau `protecting-signal-point-and-block-boundaries` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `nested-worksite-boundary-and-authority-tree` | Sở hữu bằng chứng, state và action cho nested worksite boundary and authority tree mà không mượn product semantics. | Theo sau `possession-authority-and-take-sequence` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `engineering-train-access-and-movement-plan` | Sở hữu bằng chứng, state và action cho engineering train access and movement plan mà không mượn product semantics. | Theo sau `nested-worksite-boundary-and-authority-tree` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `live-worksite-people-plant-train-and-exception-register` | Sở hữu bằng chứng, state và action cho live worksite people plant train and exception register mà không mượn product semantics. | Theo sau `engineering-train-access-and-movement-plan` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `child-worksite-clearance-receipts` | Sở hữu bằng chứng, state và action cho child worksite clearance receipts mà không mượn product semantics. | Theo sau `live-worksite-people-plant-train-and-exception-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `protection-removal-and-possession-give-up-authority` | Sở hữu bằng chứng, state và action cho protection removal and possession give up authority mà không mượn product semantics. | Theo sau `child-worksite-clearance-receipts` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `service-handback-record` | Sở hữu bằng chứng, state và action cho service handback record mà không mượn product semantics. | Theo sau `protection-removal-and-possession-give-up-authority` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Exact track limits, protection, authority hierarchy, nested worksites/trains and current take-or-give step remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The possession boundary and active worksite authority remain primary; sibling worksites, full topology, notices and handback history move to synchronized routes while the containment hierarchy stays visible.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Possession identity/window → exact outer limits and protection → take authority → choose nested worksite → worksite owner/people/plant/train status → child-clearance receipt → remaining child blockers → remove protection → give-up authority → handback; the topology transforms into an authority-containment path rather than stacked worksite cards.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `rail-possession → corridor-service-and-access-window → exact-track-possession-limits ↔ protecting-signal-point-and-block-boundaries → possession-authority-and-take-sequence → nested-worksite-boundary-and-authority-tree → engineering-train-access-and-movement-plan → live-worksite-people-plant-train-and-exception-register → child-worksite-clearance-receipts → protection-removal-and-possession-give-up-authority → service-handback-record`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must define outer possession limits, place protection, take the possession under one authority, open at least two nested worksites under distinct owners, admit an engineering train, block give-up on one missing child receipt, clear each owner in order and record accepted handback without relying on drag.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `corridor-service-and-access-window` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `exact-track-possession-limits` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `protecting-signal-point-and-block-boundaries` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `possession-authority-and-take-sequence` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `nested-worksite-boundary-and-authority-tree` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `protection-removal-and-possession-give-up-authority` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `service-handback-record` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `corridor-service-and-access-window` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `service-handback-record` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `rail-possession` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: access window draft/confirmed/curtailed, outer limits valid/conflicting, protection planned/placed/verified/removed, possession authority unreachable/confirmed/transferred, possession requested/granted/refused, worksite authority unassigned/accepted/transferred, worksite not-open/open/suspended/clear, engineering train outside/inside/stabled/clear, overrun predicted/active, child receipt missing/accepted, give-up blocked/accepted and service restored.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Lập kế hoạch, chính thức tiếp nhận, kiểm soát và bàn giao một railway possession có giới hạn hạ tầng chính xác, chứa các worksite lồng nhau với authority riêng và chỉ cho authority ngoài cùng giải phóng tuyến khi mọi authority cấp dưới đã đóng.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `railway-movement-authority-control-console`, `rail-disruption-timetable-recovery-workbench`, `calendar-resource-scheduler` or `permit-to-work-isolation-control-room`; exact possession limits, outer take/give authority, nested worksite authorities, engineering-train access and child-clearance-vetoed handback are mandatory.
- Reject candidate chỉ khác product noun, count, density, color, component hoặc state dưới verdict `duplicate-or-variation`.

### Boundary verdict

Trả `accept` chỉ khi dominant task, complete region graph, mandatory owner relationship và compact interaction parity đều đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa resolve.

## Handoff

- **Grammar handoff:** Gắn product-specific owner, label, permission, action và truthful state meaning vào các region đã khai báo.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition point.
- Không handoff nào được xóa required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

External research chỉ là advisory evidence, không phải product truth. Nó hỗ trợ task relationship, adaptive behavior và accessibility obligation; nó không đặt tên StarCi owner, không chọn exact geometry và không cấp quyền copy source interface. Các nguồn là trang chính thức hiện hành được kiểm chứng trong batch này.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [RSSB GERT8000-T3 Issue 13](https://www.rssb.co.uk/standards-catalogue/CatalogueItem/gert8000-t3-iss-13) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Network Rail Operational Rules](https://www.networkrail.co.uk/industry-and-commercial/information-for-operators/operational-rules/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "rail-possession-access-planner",
  "situationCodes": [
    "<matched AR-B13-10-* codes>"
  ],
  "searchAliases": [
    "possession",
    "access",
    "planner"
  ],
  "dominantTask": "Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line.",
  "regions": [
    "rail-possession",
    "corridor-service-and-access-window",
    "exact-track-possession-limits",
    "protecting-signal-point-and-block-boundaries",
    "possession-authority-and-take-sequence",
    "nested-worksite-boundary-and-authority-tree",
    "engineering-train-access-and-movement-plan",
    "live-worksite-people-plant-train-and-exception-register",
    "child-worksite-clearance-receipts",
    "protection-removal-and-possession-give-up-authority",
    "service-handback-record"
  ],
  "relationships": [
    "outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes."
  ],
  "responsive": {
    "wide": "Exact track limits, protection, authority hierarchy, nested worksites/trains and current take-or-give step remain simultaneously visible.",
    "intermediate": "The possession boundary and active worksite authority remain primary; sibling worksites, full topology, notices and handback history move to synchronized routes while the containment hierarchy stays visible.",
    "compact": "Possession identity/window → exact outer limits and protection → take authority → choose nested worksite → worksite owner/people/plant/train status → child-clearance receipt → remaining child blockers → remove protection → give-up authority → handback; the topology transforms into an authority-containment path rather than stacked worksite cards.",
    "reflow": [
      "rail-possession",
      "corridor-service-and-access-window",
      "exact-track-possession-limits",
      "protecting-signal-point-and-block-boundaries",
      "possession-authority-and-take-sequence",
      "nested-worksite-boundary-and-authority-tree",
      "engineering-train-access-and-movement-plan",
      "live-worksite-people-plant-train-and-exception-register",
      "child-worksite-clearance-receipts",
      "protection-removal-and-possession-give-up-authority",
      "service-handback-record"
    ]
  },
  "stateObligations": "access window draft/confirmed/curtailed, outer limits valid/conflicting, protection planned/placed/verified/removed, possession authority unreachable/confirmed/transferred, possession requested/granted/refused, worksite authority unassigned/accepted/transferred, worksite not-open/open/suspended/clear, engineering train outside/inside/stabled/clear, overrun predicted/active, child receipt missing/accepted, give-up blocked/accepted and service restored.",
  "boundaryVerdict": "accept | reject | needs-evidence | duplicate-or-variation",
  "grammarHandoff": "Bind product-specific owners, labels, permissions, actions, and truthful states.",
  "principlesHandoff": "Resolve exact geometry, measure, spacing, alignment, overflow, and relationship-driven transitions.",
  "confidence": "high | medium | low",
  "evidenceClasses": [
    "dominant-task",
    "region-graph",
    "responsive-parity",
    "state-family",
    "boundary",
    "official-research"
  ]
}
```
