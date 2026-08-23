# Reservoir Release Rule Curve Coordinator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `reservoir-release-rule-curve-coordinator` |
| Family | Work |
| Dominant task | Tạo và phê duyệt lịch xả hồ bằng cách hòa giải dự báo dòng vào, dung tích và guide-curve zone với các luật vận hành ưu tiên, năng lực cửa xả và giới hạn tại điểm kiểm soát hạ lưu. |
| Search aliases | `reservoir`, `release`, `curve`, `coordinator` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Tạo và phê duyệt lịch xả hồ bằng cách hòa giải dự báo dòng vào, dung tích và guide-curve zone với các luật vận hành ưu tiên, năng lực cửa xả và giới hạn tại điểm kiểm soát hạ lưu.
- Required region graph luôn là `reservoir-coordinator → reservoir-plan-and-time-horizon → inflow-forecast-ensemble → storage-elevation-guide-curve-and-zone ↔ prioritized-release-rule-stack → allowable-release-envelope → downstream-control-point-routing → candidate-release-schedule → rule-conflict-and-impact-comparison → authorized-operation-and-deviation-record`.
- Quan hệ bắt buộc luôn là: each timestep's release is constrained by a narrowing allowable envelope and downstream routed effects.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must move a forecast into a flood zone, show two conflicting limits narrowing the release envelope, route the candidate downstream, reject an exceedance, authorize the corrected schedule and preserve the deviation lineage.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-08-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-08-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-08-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-08-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-08-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-08-90` | Dominant task thực chất là `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-08-91` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-08-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `reservoir-release-rule-curve-coordinator` chỉ khi `AR-B13-08-01` đến `AR-B13-08-05` đều có bằng chứng và không có mã `AR-B13-08-90` đến `AR-B13-08-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
reservoir-coordinator
└─ reservoir-plan-and-time-horizon
   └─ inflow-forecast-ensemble
      └─ storage-elevation-guide-curve-and-zone
         ↔─ prioritized-release-rule-stack
            └─ allowable-release-envelope
               └─ downstream-control-point-routing
                  └─ candidate-release-schedule
                     └─ rule-conflict-and-impact-comparison
                        └─ authorized-operation-and-deviation-record
```

- Required relationship: each timestep's release is constrained by a narrowing allowable envelope and downstream routed effects.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `reservoir-coordinator` | Sở hữu bằng chứng, state và action cho reservoir coordinator mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `reservoir-plan-and-time-horizon` | Sở hữu bằng chứng, state và action cho reservoir plan and time horizon mà không mượn product semantics. | Theo sau `reservoir-coordinator` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `inflow-forecast-ensemble` | Sở hữu bằng chứng, state và action cho inflow forecast ensemble mà không mượn product semantics. | Theo sau `reservoir-plan-and-time-horizon` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `storage-elevation-guide-curve-and-zone` | Sở hữu bằng chứng, state và action cho storage elevation guide curve and zone mà không mượn product semantics. | Theo sau `inflow-forecast-ensemble` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `prioritized-release-rule-stack` | Sở hữu bằng chứng, state và action cho prioritized release rule stack mà không mượn product semantics. | Đồng bộ hai chiều với `storage-elevation-guide-curve-and-zone` trong cùng selection context. |
| `allowable-release-envelope` | Sở hữu bằng chứng, state và action cho allowable release envelope mà không mượn product semantics. | Theo sau `prioritized-release-rule-stack` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `downstream-control-point-routing` | Sở hữu bằng chứng, state và action cho downstream control point routing mà không mượn product semantics. | Theo sau `allowable-release-envelope` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `candidate-release-schedule` | Sở hữu bằng chứng, state và action cho candidate release schedule mà không mượn product semantics. | Theo sau `downstream-control-point-routing` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `rule-conflict-and-impact-comparison` | Sở hữu bằng chứng, state và action cho rule conflict and impact comparison mà không mượn product semantics. | Theo sau `candidate-release-schedule` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `authorized-operation-and-deviation-record` | Sở hữu bằng chứng, state và action cho authorized operation and deviation record mà không mượn product semantics. | Theo sau `rule-conflict-and-impact-comparison` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Forecast/storage curve, rule stack, release envelope, downstream hydrographs and schedule remain visible together.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** Candidate schedule, binding rules and downstream effects remain primary; ensemble members, complete rule stack and deviation history move to drawers.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Timestep → operating zone → allowable range → binding rule → proposed release → downstream result → authorize or record exception; the whole horizon becomes a navigable period sequence.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `reservoir-coordinator → reservoir-plan-and-time-horizon → inflow-forecast-ensemble → storage-elevation-guide-curve-and-zone ↔ prioritized-release-rule-stack → allowable-release-envelope → downstream-control-point-routing → candidate-release-schedule → rule-conflict-and-impact-comparison → authorized-operation-and-deviation-record`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must move a forecast into a flood zone, show two conflicting limits narrowing the release envelope, route the candidate downstream, reject an exceedance, authorize the corrected schedule and preserve the deviation lineage.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `reservoir-plan-and-time-horizon` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `inflow-forecast-ensemble` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `storage-elevation-guide-curve-and-zone` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `prioritized-release-rule-stack` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `allowable-release-envelope` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `rule-conflict-and-impact-comparison` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `authorized-operation-and-deviation-record` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `reservoir-plan-and-time-horizon` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `authorized-operation-and-deviation-record` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `reservoir-coordinator` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: forecast loading/current/stale/divergent, storage observation provisional/confirmed, zone normal/flood/conservation/emergency, rule active/inactive/conflicting/superseded, outlet available/limited, routing pending/failed, schedule draft/infeasible/feasible, deviation requested/approved/rejected and release issued/amended.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Tạo và phê duyệt lịch xả hồ bằng cách hòa giải dự báo dòng vào, dung tích và guide-curve zone với các luật vận hành ưu tiên, năng lực cửa xả và giới hạn tại điểm kiểm soát hạ lưu.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `scenario-sensitivity-modeler`, `process-mass-balance-analyzer`, timeline monitor or permit approval; a guide curve, ordered operating zones, prioritized narrowing release limits, downstream routing and an issued time-indexed operation are mandatory.
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
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [USACE reservoir-operation basics](https://www.hec.usace.army.mil/confluence/ResSimDocs/rsum/reservoir-operations/reservoir-operations-the-basics) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [USACE release decision rules](https://www.hec.usace.army.mil/confluence/cwmsdocs/rsum/reservoir-operations-the-rules-58631745.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [USACE rule-based operations guide](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsguides/modeling-reservoirs-in-hec-hms/rule-based-reservoir-operations-quick-start-guide) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "reservoir-release-rule-curve-coordinator",
  "situationCodes": [
    "<matched AR-B13-08-* codes>"
  ],
  "searchAliases": [
    "reservoir",
    "release",
    "curve",
    "coordinator"
  ],
  "dominantTask": "Create and authorize a reservoir release schedule by reconciling forecast inflow, storage and guide-curve zones with prioritized operating rules, outlet capacity and downstream control-point limits.",
  "regions": [
    "reservoir-coordinator",
    "reservoir-plan-and-time-horizon",
    "inflow-forecast-ensemble",
    "storage-elevation-guide-curve-and-zone",
    "prioritized-release-rule-stack",
    "allowable-release-envelope",
    "downstream-control-point-routing",
    "candidate-release-schedule",
    "rule-conflict-and-impact-comparison",
    "authorized-operation-and-deviation-record"
  ],
  "relationships": [
    "each timestep's release is constrained by a narrowing allowable envelope and downstream routed effects."
  ],
  "responsive": {
    "wide": "Forecast/storage curve, rule stack, release envelope, downstream hydrographs and schedule remain visible together.",
    "intermediate": "Candidate schedule, binding rules and downstream effects remain primary; ensemble members, complete rule stack and deviation history move to drawers.",
    "compact": "Timestep → operating zone → allowable range → binding rule → proposed release → downstream result → authorize or record exception; the whole horizon becomes a navigable period sequence.",
    "reflow": [
      "reservoir-coordinator",
      "reservoir-plan-and-time-horizon",
      "inflow-forecast-ensemble",
      "storage-elevation-guide-curve-and-zone",
      "prioritized-release-rule-stack",
      "allowable-release-envelope",
      "downstream-control-point-routing",
      "candidate-release-schedule",
      "rule-conflict-and-impact-comparison",
      "authorized-operation-and-deviation-record"
    ]
  },
  "stateObligations": "forecast loading/current/stale/divergent, storage observation provisional/confirmed, zone normal/flood/conservation/emergency, rule active/inactive/conflicting/superseded, outlet available/limited, routing pending/failed, schedule draft/infeasible/feasible, deviation requested/approved/rejected and release issued/amended.",
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
