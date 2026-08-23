# Stormwater Catchment Control Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `stormwater-catchment-control-planner` |
| Family | Work |
| Dominant task | Đặt và định cỡ các biện pháp kiểm soát nước mưa phân tán, định tuyến lại từng can thiệp theo đúng đường thoát nước hạ lưu và chứng minh hydrograph trước/sau tại mọi node và outfall có tên dưới các design storm đã chọn. |
| Search aliases | `stormwater`, `catchment`, `control`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Đặt và định cỡ các biện pháp kiểm soát nước mưa phân tán, định tuyến lại từng can thiệp theo đúng đường thoát nước hạ lưu và chứng minh hydrograph trước/sau tại mọi node và outfall có tên dưới các design storm đã chọn.
- Required region graph luôn là `catchment-control-planner → study-area-and-design-storm → subcatchment-runoff-source-set ↔ directed-drainage-conveyance-topology → failing-node-and-outfall-hydrograph-register → candidate-control-site-type-and-parameters → intervention-to-named-downstream-node-path → rerouted-node-by-node-flow-and-pollutant-hydrographs → portfolio-capacity-quality-and-site-constraint-verdict → selected-plan-and-model-export`.
- Quan hệ bắt buộc luôn là: each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must select a surcharged named node, trace contributing subcatchments, place one control, show its rerouted path through at least two downstream nodes to a named outfall, compare each hydrograph's peak/volume/pollutant delta and reject a portfolio that merely moves the violation downstream.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-09-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-09-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-09-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-09-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-09-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-09-90` | Dominant task thực chất là `geospatial-raster-layer-analysis-workbench`. | Reject. |
| `AR-B13-09-91` | Dominant task thực chất là `map-led-situation-monitor`. | Reject. |
| `AR-B13-09-92` | Dominant task thực chất là `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-09-93` | Dominant task thực chất là `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-09-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `stormwater-catchment-control-planner` chỉ khi `AR-B13-09-01` đến `AR-B13-09-05` đều có bằng chứng và không có mã `AR-B13-09-90` đến `AR-B13-09-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
catchment-control-planner
└─ study-area-and-design-storm
   └─ subcatchment-runoff-source-set
      ↔─ directed-drainage-conveyance-topology
         └─ failing-node-and-outfall-hydrograph-register
            └─ candidate-control-site-type-and-parameters
               └─ intervention-to-named-downstream-node-path
                  └─ rerouted-node-by-node-flow-and-pollutant-hydrographs
                     └─ portfolio-capacity-quality-and-site-constraint-verdict
                        └─ selected-plan-and-model-export
```

- Required relationship: each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `catchment-control-planner` | Sở hữu bằng chứng, state và action cho catchment control planner mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `study-area-and-design-storm` | Sở hữu bằng chứng, state và action cho study area and design storm mà không mượn product semantics. | Theo sau `catchment-control-planner` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `subcatchment-runoff-source-set` | Sở hữu bằng chứng, state và action cho subcatchment runoff source set mà không mượn product semantics. | Theo sau `study-area-and-design-storm` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `directed-drainage-conveyance-topology` | Sở hữu bằng chứng, state và action cho directed drainage conveyance topology mà không mượn product semantics. | Đồng bộ hai chiều với `subcatchment-runoff-source-set` trong cùng selection context. |
| `failing-node-and-outfall-hydrograph-register` | Sở hữu bằng chứng, state và action cho failing node and outfall hydrograph register mà không mượn product semantics. | Theo sau `directed-drainage-conveyance-topology` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `candidate-control-site-type-and-parameters` | Sở hữu bằng chứng, state và action cho candidate control site type and parameters mà không mượn product semantics. | Theo sau `failing-node-and-outfall-hydrograph-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `intervention-to-named-downstream-node-path` | Sở hữu bằng chứng, state và action cho intervention to named downstream node path mà không mượn product semantics. | Theo sau `candidate-control-site-type-and-parameters` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `rerouted-node-by-node-flow-and-pollutant-hydrographs` | Sở hữu bằng chứng, state và action cho rerouted node by node flow and pollutant hydrographs mà không mượn product semantics. | Theo sau `intervention-to-named-downstream-node-path` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `portfolio-capacity-quality-and-site-constraint-verdict` | Sở hữu bằng chứng, state và action cho portfolio capacity quality and site constraint verdict mà không mượn product semantics. | Theo sau `rerouted-node-by-node-flow-and-pollutant-hydrographs` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `selected-plan-and-model-export` | Sở hữu bằng chứng, state và action cho selected plan and model export mà không mượn product semantics. | Theo sau `portfolio-capacity-quality-and-site-constraint-verdict` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Catchment topology, selected intervention route, named downstream hydrographs, portfolio controls and before/after verdict remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected control and its named downstream node path remain primary; other catchments, alternate interventions and unrelated hydrographs move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Design storm → failing named node/outfall → contributing subcatchments → feasible intervention → exact downstream node sequence → before/after hydrograph at each affected receptor → portfolio verdict; the map transforms into a topological route whose nodes open their paired hydrographs.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `catchment-control-planner → study-area-and-design-storm → subcatchment-runoff-source-set ↔ directed-drainage-conveyance-topology → failing-node-and-outfall-hydrograph-register → candidate-control-site-type-and-parameters → intervention-to-named-downstream-node-path → rerouted-node-by-node-flow-and-pollutant-hydrographs → portfolio-capacity-quality-and-site-constraint-verdict → selected-plan-and-model-export`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must select a surcharged named node, trace contributing subcatchments, place one control, show its rerouted path through at least two downstream nodes to a named outfall, compare each hydrograph's peak/volume/pollutant delta and reject a portfolio that merely moves the violation downstream.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `study-area-and-design-storm` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `subcatchment-runoff-source-set` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `directed-drainage-conveyance-topology` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `failing-node-and-outfall-hydrograph-register` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `candidate-control-site-type-and-parameters` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `portfolio-capacity-quality-and-site-constraint-verdict` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `selected-plan-and-model-export` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `study-area-and-design-storm` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `selected-plan-and-model-export` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `catchment-control-planner` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: rainfall input missing/current/future-adjusted, model loading/nonconvergent, node normal/surcharged/flooding, downstream route complete/broken, hydrograph baseline/current/stale, outfall within/exceeding target, site feasible/constrained, control draft/undersized/valid, portfolio simulation queued/running, pollutant criterion unknown/pass/fail and plan selected/superseded.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Đặt và định cỡ các biện pháp kiểm soát nước mưa phân tán, định tuyến lại từng can thiệp theo đúng đường thoát nước hạ lưu và chứng minh hydrograph trước/sau tại mọi node và outfall có tên dưới các design storm đã chọn.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `geospatial-raster-layer-analysis-workbench`, `map-led-situation-monitor`, `scenario-sensitivity-modeler` or `process-mass-balance-analyzer`; rainfall-runoff routing, intervention-to-named-downstream-node topology and receptor-specific rerun hydrographs under named storms are mandatory.
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
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA Storm Water Management Model](https://www.epa.gov/water-research/storm-water-management-model-swmm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FEMA nature-based solutions guidance](https://www.fema.gov/emergency-managers/risk-management/climate-resilience/nature-based-solutions) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NOAA precipitation-frequency data server](https://hdsc.nws.noaa.gov/pfds/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "stormwater-catchment-control-planner",
  "situationCodes": [
    "<matched AR-B13-09-* codes>"
  ],
  "searchAliases": [
    "stormwater",
    "catchment",
    "control",
    "planner"
  ],
  "dominantTask": "Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms.",
  "regions": [
    "catchment-control-planner",
    "study-area-and-design-storm",
    "subcatchment-runoff-source-set",
    "directed-drainage-conveyance-topology",
    "failing-node-and-outfall-hydrograph-register",
    "candidate-control-site-type-and-parameters",
    "intervention-to-named-downstream-node-path",
    "rerouted-node-by-node-flow-and-pollutant-hydrographs",
    "portfolio-capacity-quality-and-site-constraint-verdict",
    "selected-plan-and-model-export"
  ],
  "relationships": [
    "each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score."
  ],
  "responsive": {
    "wide": "Catchment topology, selected intervention route, named downstream hydrographs, portfolio controls and before/after verdict remain simultaneously visible.",
    "intermediate": "The selected control and its named downstream node path remain primary; other catchments, alternate interventions and unrelated hydrographs move to synchronized routes.",
    "compact": "Design storm → failing named node/outfall → contributing subcatchments → feasible intervention → exact downstream node sequence → before/after hydrograph at each affected receptor → portfolio verdict; the map transforms into a topological route whose nodes open their paired hydrographs.",
    "reflow": [
      "catchment-control-planner",
      "study-area-and-design-storm",
      "subcatchment-runoff-source-set",
      "directed-drainage-conveyance-topology",
      "failing-node-and-outfall-hydrograph-register",
      "candidate-control-site-type-and-parameters",
      "intervention-to-named-downstream-node-path",
      "rerouted-node-by-node-flow-and-pollutant-hydrographs",
      "portfolio-capacity-quality-and-site-constraint-verdict",
      "selected-plan-and-model-export"
    ]
  },
  "stateObligations": "rainfall input missing/current/future-adjusted, model loading/nonconvergent, node normal/surcharged/flooding, downstream route complete/broken, hydrograph baseline/current/stale, outfall within/exceeding target, site feasible/constrained, control draft/undersized/valid, portfolio simulation queued/running, pollutant criterion unknown/pass/fail and plan selected/superseded.",
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
