# Grid Outage Restoration Switching Board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `grid-outage-restoration-switching-board` |
| Family | Flow |
| Dominant task | Khôi phục hệ thống điện mất nguồn bằng cách chọn nguồn black-start, mở rộng các đường cranking đã kiểm chứng thành những đảo điện rõ ràng và chỉ thực hiện bước đóng cắt vượt qua mọi veto về clearance và nối đất. |
| Search aliases | `outage`, `restoration`, `switching`, `board` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Khôi phục hệ thống điện mất nguồn bằng cách chọn nguồn black-start, mở rộng các đường cranking đã kiểm chứng thành những đảo điện rõ ràng và chỉ thực hiện bước đóng cắt vượt qua mọi veto về clearance và nối đất.
- Required region graph luôn là `restoration-board → outage-boundary-and-control-authority → deenergized-network-topology → black-start-source-and-cranking-load-register → source-to-cranking-load-path-graph → candidate-energized-island-boundaries → ordered-switching-plan ↔ clearance-tag-ground-and-work-party-veto-register → current-step-command → telemetry-and-field-verification → derived-energized-island-topology → critical-load-restoration-and-as-operated-log`.
- Quan hệ bắt buộc luôn là: a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must start one black-start source, extend a cranking path into an island, block a tempting switch through an active clearance impact cone, clear and authorize the corrected step, prove voltage/frequency plus field state and update the island boundary only after verification.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-02-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-02-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-02-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-02-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-02-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-02-90` | Dominant task thực chất là `live-operations-command-center`. | Reject. |
| `AR-B13-02-91` | Dominant task thực chất là `dependency-topology-monitor`. | Reject. |
| `AR-B13-02-92` | Dominant task thực chất là `guided-setup-checklist`. | Reject. |
| `AR-B13-02-93` | Dominant task thực chất là `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-02-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `grid-outage-restoration-switching-board` chỉ khi `AR-B13-02-01` đến `AR-B13-02-05` đều có bằng chứng và không có mã `AR-B13-02-90` đến `AR-B13-02-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
restoration-board
└─ outage-boundary-and-control-authority
   └─ deenergized-network-topology
      └─ black-start-source-and-cranking-load-register
         └─ source-to-cranking-load-path-graph
            └─ candidate-energized-island-boundaries
               └─ ordered-switching-plan
                  ↔─ clearance-tag-ground-and-work-party-veto-register
                     └─ current-step-command
                        └─ telemetry-and-field-verification
                           └─ derived-energized-island-topology
                              └─ critical-load-restoration-and-as-operated-log
```

- Required relationship: a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `restoration-board` | Sở hữu bằng chứng, state và action cho restoration board mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `outage-boundary-and-control-authority` | Sở hữu bằng chứng, state và action cho outage boundary and control authority mà không mượn product semantics. | Theo sau `restoration-board` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `deenergized-network-topology` | Sở hữu bằng chứng, state và action cho deenergized network topology mà không mượn product semantics. | Theo sau `outage-boundary-and-control-authority` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `black-start-source-and-cranking-load-register` | Sở hữu bằng chứng, state và action cho black start source and cranking load register mà không mượn product semantics. | Theo sau `deenergized-network-topology` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `source-to-cranking-load-path-graph` | Sở hữu bằng chứng, state và action cho source to cranking load path graph mà không mượn product semantics. | Theo sau `black-start-source-and-cranking-load-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `candidate-energized-island-boundaries` | Sở hữu bằng chứng, state và action cho candidate energized island boundaries mà không mượn product semantics. | Theo sau `source-to-cranking-load-path-graph` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `ordered-switching-plan` | Sở hữu bằng chứng, state và action cho ordered switching plan mà không mượn product semantics. | Theo sau `candidate-energized-island-boundaries` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `clearance-tag-ground-and-work-party-veto-register` | Sở hữu bằng chứng, state và action cho clearance tag ground and work party veto register mà không mượn product semantics. | Đồng bộ hai chiều với `ordered-switching-plan` trong cùng selection context. |
| `current-step-command` | Sở hữu bằng chứng, state và action cho current step command mà không mượn product semantics. | Theo sau `clearance-tag-ground-and-work-party-veto-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `telemetry-and-field-verification` | Sở hữu bằng chứng, state và action cho telemetry and field verification mà không mượn product semantics. | Theo sau `current-step-command` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `derived-energized-island-topology` | Sở hữu bằng chứng, state và action cho derived energized island topology mà không mượn product semantics. | Theo sau `telemetry-and-field-verification` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `critical-load-restoration-and-as-operated-log` | Sở hữu bằng chứng, state và action cho critical load restoration and as operated log mà không mượn product semantics. | Theo sau `derived-energized-island-topology` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** De-energized/current island topology, selected cranking path, switching plan, clearance-veto register, active command and electrical verification remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The active island boundary, current cranking path and next step remain primary; alternate sources, other islands, full clearance evidence and as-operated history become synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Black-start source → next cranking-path segment → target island boundary or cranking load → clearance/ground impact cone → issue or hold → voltage/frequency/field proof → derived island topology → next path segment; the network transforms into one executable path spine plus an island switcher, not a stack of topology cards.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `restoration-board → outage-boundary-and-control-authority → deenergized-network-topology → black-start-source-and-cranking-load-register → source-to-cranking-load-path-graph → candidate-energized-island-boundaries → ordered-switching-plan ↔ clearance-tag-ground-and-work-party-veto-register → current-step-command → telemetry-and-field-verification → derived-energized-island-topology → critical-load-restoration-and-as-operated-log`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must start one black-start source, extend a cranking path into an island, block a tempting switch through an active clearance impact cone, clear and authorize the corrected step, prove voltage/frequency plus field state and update the island boundary only after verification.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `outage-boundary-and-control-authority` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `deenergized-network-topology` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `black-start-source-and-cranking-load-register` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `source-to-cranking-load-path-graph` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `candidate-energized-island-boundaries` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `derived-energized-island-topology` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `critical-load-restoration-and-as-operated-log` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `outage-boundary-and-control-authority` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `critical-load-restoration-and-as-operated-log` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `restoration-board` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: topology unknown/deenergized/partially energized/restored, black-start source unavailable/starting/stable, cranking path blocked/open/energized, island proposed/forming/stable/unstable/joinable, clearance active/released/conflicting, switching step planned/vetoed/authorized/issued/failed/verified, telemetry stale/disagreeing, unexpected energization, rollback/hold and restoration transfer complete.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Khôi phục hệ thống điện mất nguồn bằng cách chọn nguồn black-start, mở rộng các đường cranking đã kiểm chứng thành những đảo điện rõ ràng và chỉ thực hiện bước đóng cắt vượt qua mọi veto về clearance và nối đất.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `live-operations-command-center`, `dependency-topology-monitor`, `guided-setup-checklist` or `permit-to-work-isolation-control-room`; black-start sources, source-to-cranking-load paths, explicit island boundaries, clearance-veto topology, stepwise electrical verification and derived energized islands are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC EOP-005-3](https://www.nerc.com/globalassets/standards/reliability-runtime/standards/eop/eop-005-3.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OSHA 1910.269](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.269) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PJM Manual 36 — System Restoration](https://learn.pjm.com/-/media/DotCom/documents/manuals/m36.ashx) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "grid-outage-restoration-switching-board",
  "situationCodes": [
    "<matched AR-B13-02-* codes>"
  ],
  "searchAliases": [
    "outage",
    "restoration",
    "switching",
    "board"
  ],
  "dominantTask": "Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes.",
  "regions": [
    "restoration-board",
    "outage-boundary-and-control-authority",
    "deenergized-network-topology",
    "black-start-source-and-cranking-load-register",
    "source-to-cranking-load-path-graph",
    "candidate-energized-island-boundaries",
    "ordered-switching-plan",
    "clearance-tag-ground-and-work-party-veto-register",
    "current-step-command",
    "telemetry-and-field-verification",
    "derived-energized-island-topology",
    "critical-load-restoration-and-as-operated-log"
  ],
  "relationships": [
    "a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance."
  ],
  "responsive": {
    "wide": "De-energized/current island topology, selected cranking path, switching plan, clearance-veto register, active command and electrical verification remain simultaneously visible.",
    "intermediate": "The active island boundary, current cranking path and next step remain primary; alternate sources, other islands, full clearance evidence and as-operated history become synchronized routes.",
    "compact": "Black-start source → next cranking-path segment → target island boundary or cranking load → clearance/ground impact cone → issue or hold → voltage/frequency/field proof → derived island topology → next path segment; the network transforms into one executable path spine plus an island switcher, not a stack of topology cards.",
    "reflow": [
      "restoration-board",
      "outage-boundary-and-control-authority",
      "deenergized-network-topology",
      "black-start-source-and-cranking-load-register",
      "source-to-cranking-load-path-graph",
      "candidate-energized-island-boundaries",
      "ordered-switching-plan",
      "clearance-tag-ground-and-work-party-veto-register",
      "current-step-command",
      "telemetry-and-field-verification",
      "derived-energized-island-topology",
      "critical-load-restoration-and-as-operated-log"
    ]
  },
  "stateObligations": "topology unknown/deenergized/partially energized/restored, black-start source unavailable/starting/stable, cranking path blocked/open/energized, island proposed/forming/stable/unstable/joinable, clearance active/released/conflicting, switching step planned/vetoed/authorized/issued/failed/verified, telemetry stale/disagreeing, unexpected energization, rollback/hold and restoration transfer complete.",
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
