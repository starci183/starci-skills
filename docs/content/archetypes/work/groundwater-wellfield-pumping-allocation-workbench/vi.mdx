# Groundwater Wellfield Pumping Allocation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `groundwater-wellfield-pumping-allocation-workbench` |
| Family | Work |
| Dominant task | Phân bổ bơm theo giếng và thời kỳ bằng mô hình tầng chứa nước liên kết có đáp ứng trễ chồng chập, quy mọi tác động tại receptor có tên về các cặp giếng–thời gian đóng góp và sửa lịch vận hành khi monitoring trigger kích hoạt. |
| Search aliases | `groundwater`, `wellfield`, `pumping`, `allocation`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Phân bổ bơm theo giếng và thời kỳ bằng mô hình tầng chứa nước liên kết có đáp ứng trễ chồng chập, quy mọi tác động tại receptor có tên về các cặp giếng–thời gian đóng góp và sửa lịch vận hành khi monitoring trigger kích hoạt.
- Required region graph luôn là `wellfield-allocation → model-version-horizon-recharge-and-boundary-condition-set → coupled-aquifer-layer-and-connection-topology → production-well-by-period-rate-schedule ↔ well-period-to-layer-response-kernels-and-time-lag → superposed-head-drawdown-and-interference-state → named-stream-spring-observation-subsidence-and-quality-receptor-series → receptor-threshold-violation-contribution-matrix-by-well-and-period → revised-schedule-and-coupled-model-rerun → receptor-specific-monitoring-trigger-and-amendment-rules → approved-operation-plan`.
- Quan hệ bắt buộc luôn là: feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must schedule at least three wells across multiple periods and two connected aquifers, expose a delayed superposed breach at one named receptor, attribute it by well×pumping period, adjust one earlier rate, rerun later receptor effects and activate a receptor-specific monitoring-triggered amendment without overwriting the approved baseline.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-20-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-20-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-20-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-20-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-20-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-20-90` | Dominant task thực chất là `constrained-quota-allocation-editor`. | Reject. |
| `AR-B13-20-91` | Dominant task thực chất là `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-20-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `groundwater-wellfield-pumping-allocation-workbench` chỉ khi `AR-B13-20-01` đến `AR-B13-20-05` đều có bằng chứng và không có mã `AR-B13-20-90` đến `AR-B13-20-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
wellfield-allocation
└─ model-version-horizon-recharge-and-boundary-condition-set
   └─ coupled-aquifer-layer-and-connection-topology
      └─ production-well-by-period-rate-schedule
         ↔─ well-period-to-layer-response-kernels-and-time-lag
            └─ superposed-head-drawdown-and-interference-state
               └─ named-stream-spring-observation-subsidence-and-quality-receptor-series
                  └─ receptor-threshold-violation-contribution-matrix-by-well-and-period
                     └─ revised-schedule-and-coupled-model-rerun
                        └─ receptor-specific-monitoring-trigger-and-amendment-rules
                           └─ approved-operation-plan
```

- Required relationship: feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `wellfield-allocation` | Sở hữu bằng chứng, state và action cho wellfield allocation mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `model-version-horizon-recharge-and-boundary-condition-set` | Sở hữu bằng chứng, state và action cho model version horizon recharge and boundary condition set mà không mượn product semantics. | Theo sau `wellfield-allocation` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `coupled-aquifer-layer-and-connection-topology` | Sở hữu bằng chứng, state và action cho coupled aquifer layer and connection topology mà không mượn product semantics. | Theo sau `model-version-horizon-recharge-and-boundary-condition-set` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `production-well-by-period-rate-schedule` | Sở hữu bằng chứng, state và action cho production well by period rate schedule mà không mượn product semantics. | Theo sau `coupled-aquifer-layer-and-connection-topology` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `well-period-to-layer-response-kernels-and-time-lag` | Sở hữu bằng chứng, state và action cho well period to layer response kernels and time lag mà không mượn product semantics. | Đồng bộ hai chiều với `production-well-by-period-rate-schedule` trong cùng selection context. |
| `superposed-head-drawdown-and-interference-state` | Sở hữu bằng chứng, state và action cho superposed head drawdown and interference state mà không mượn product semantics. | Theo sau `well-period-to-layer-response-kernels-and-time-lag` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `named-stream-spring-observation-subsidence-and-quality-receptor-series` | Sở hữu bằng chứng, state và action cho named stream spring observation subsidence and quality receptor series mà không mượn product semantics. | Theo sau `superposed-head-drawdown-and-interference-state` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `receptor-threshold-violation-contribution-matrix-by-well-and-period` | Sở hữu bằng chứng, state và action cho receptor threshold violation contribution matrix by well and period mà không mượn product semantics. | Theo sau `named-stream-spring-observation-subsidence-and-quality-receptor-series` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `revised-schedule-and-coupled-model-rerun` | Sở hữu bằng chứng, state và action cho revised schedule and coupled model rerun mà không mượn product semantics. | Theo sau `receptor-threshold-violation-contribution-matrix-by-well-and-period` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `receptor-specific-monitoring-trigger-and-amendment-rules` | Sở hữu bằng chứng, state và action cho receptor specific monitoring trigger and amendment rules mà không mượn product semantics. | Theo sau `revised-schedule-and-coupled-model-rerun` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `approved-operation-plan` | Sở hữu bằng chứng, state và action cho approved operation plan mà không mượn product semantics. | Theo sau `receptor-specific-monitoring-trigger-and-amendment-rules` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Coupled-aquifer topology, well-period schedule, superposed response, named receptor series, contribution matrix and trigger-bound revision remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected receptor breach and its contributing well-period paths remain primary; full aquifer context, other receptors and monitoring history move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Named receptor and threshold period → delayed contribution ranking by well×pumping period → coupled-aquifer path → rate/time adjustment → rerun receptor series → trigger/amendment rule → approve; maps transform into receptor-to-well causal paths with exact lagged values.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `wellfield-allocation → model-version-horizon-recharge-and-boundary-condition-set → coupled-aquifer-layer-and-connection-topology → production-well-by-period-rate-schedule ↔ well-period-to-layer-response-kernels-and-time-lag → superposed-head-drawdown-and-interference-state → named-stream-spring-observation-subsidence-and-quality-receptor-series → receptor-threshold-violation-contribution-matrix-by-well-and-period → revised-schedule-and-coupled-model-rerun → receptor-specific-monitoring-trigger-and-amendment-rules → approved-operation-plan`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must schedule at least three wells across multiple periods and two connected aquifers, expose a delayed superposed breach at one named receptor, attribute it by well×pumping period, adjust one earlier rate, rerun later receptor effects and activate a receptor-specific monitoring-triggered amendment without overwriting the approved baseline.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `model-version-horizon-recharge-and-boundary-condition-set` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `coupled-aquifer-layer-and-connection-topology` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `production-well-by-period-rate-schedule` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `well-period-to-layer-response-kernels-and-time-lag` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `superposed-head-drawdown-and-interference-state` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `receptor-specific-monitoring-trigger-and-amendment-rules` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `approved-operation-plan` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `model-version-horizon-recharge-and-boundary-condition-set` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `approved-operation-plan` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `wellfield-allocation` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: model calibrated/provisional/stale, aquifer connection active/uncertain, recharge normal/drought/revised, observation missing/current/outlier, well available/limited/offline, schedule draft/running, response separate/interfering/delayed, receptor threshold safe/approaching/exceeded, attribution complete/ambiguous, solve nonconvergent/feasible, operation approved/amended and monitoring trigger normal/fired/acknowledged/closed.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Phân bổ bơm theo giếng và thời kỳ bằng mô hình tầng chứa nước liên kết có đáp ứng trễ chồng chập, quy mọi tác động tại receptor có tên về các cặp giếng–thời gian đóng góp và sửa lịch vận hành khi monitoring trigger kích hoạt.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `constrained-quota-allocation-editor`, `scenario-sensitivity-modeler`, calendar scheduler or raster analysis; coupled aquifers, time-varying well-period superposition, delayed named-receptor attribution and trigger-bound operating amendments are mandatory.
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
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [USGS MODFLOW 6](https://www.usgs.gov/software/modflow-6-usgs-modular-hydrologic-model) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [California DWR Groundwater Sustainability Plans](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Groundwater-Sustainability-Plans) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [California DWR best-management guidance](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Best-Management-Practices-and-Guidance-Documents) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA source-water protection](https://www.epa.gov/sourcewaterprotection/basic-information-about-source-water-protection) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "groundwater-wellfield-pumping-allocation-workbench",
  "situationCodes": [
    "<matched AR-B13-20-* codes>"
  ],
  "searchAliases": [
    "groundwater",
    "wellfield",
    "pumping",
    "allocation",
    "workbench"
  ],
  "dominantTask": "Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire.",
  "regions": [
    "wellfield-allocation",
    "model-version-horizon-recharge-and-boundary-condition-set",
    "coupled-aquifer-layer-and-connection-topology",
    "production-well-by-period-rate-schedule",
    "well-period-to-layer-response-kernels-and-time-lag",
    "superposed-head-drawdown-and-interference-state",
    "named-stream-spring-observation-subsidence-and-quality-receptor-series",
    "receptor-threshold-violation-contribution-matrix-by-well-and-period",
    "revised-schedule-and-coupled-model-rerun",
    "receptor-specific-monitoring-trigger-and-amendment-rules",
    "approved-operation-plan"
  ],
  "relationships": [
    "feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota."
  ],
  "responsive": {
    "wide": "Coupled-aquifer topology, well-period schedule, superposed response, named receptor series, contribution matrix and trigger-bound revision remain simultaneously visible.",
    "intermediate": "The selected receptor breach and its contributing well-period paths remain primary; full aquifer context, other receptors and monitoring history move to synchronized routes.",
    "compact": "Named receptor and threshold period → delayed contribution ranking by well×pumping period → coupled-aquifer path → rate/time adjustment → rerun receptor series → trigger/amendment rule → approve; maps transform into receptor-to-well causal paths with exact lagged values.",
    "reflow": [
      "wellfield-allocation",
      "model-version-horizon-recharge-and-boundary-condition-set",
      "coupled-aquifer-layer-and-connection-topology",
      "production-well-by-period-rate-schedule",
      "well-period-to-layer-response-kernels-and-time-lag",
      "superposed-head-drawdown-and-interference-state",
      "named-stream-spring-observation-subsidence-and-quality-receptor-series",
      "receptor-threshold-violation-contribution-matrix-by-well-and-period",
      "revised-schedule-and-coupled-model-rerun",
      "receptor-specific-monitoring-trigger-and-amendment-rules",
      "approved-operation-plan"
    ]
  },
  "stateObligations": "model calibrated/provisional/stale, aquifer connection active/uncertain, recharge normal/drought/revised, observation missing/current/outlier, well available/limited/offline, schedule draft/running, response separate/interfering/delayed, receptor threshold safe/approaching/exceeded, attribution complete/ambiguous, solve nonconvergent/feasible, operation approved/amended and monitoring trigger normal/fired/acknowledged/closed.",
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
