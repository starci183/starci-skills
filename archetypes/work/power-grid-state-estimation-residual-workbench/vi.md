# Power Grid State Estimation Residual Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `power-grid-state-estimation-residual-workbench` |
| Family | Work |
| Dominant task | Tạo và định chuẩn một trạng thái lưới điện bằng cách hòa giải topology đóng cắt với telemetry có trọng số qua phân tích observability, truy residual chuẩn hóa đến bad data hoặc lỗi mô hình và chứng minh tác động của mỗi sửa đổi bằng rerun. |
| Search aliases | `power`, `state`, `estimation`, `residual`, `workbench` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Tạo và định chuẩn một trạng thái lưới điện bằng cách hòa giải topology đóng cắt với telemetry có trọng số qua phân tích observability, truy residual chuẩn hóa đến bad data hoặc lỗi mô hình và chứng minh tác động của mỗi sửa đổi bằng rerun.
- Required region graph luôn là `grid-state-estimation → estimator-run-network-model-and-time-version → breaker-switch-topology-processor → electrical-island-and-measurement-adjacency-graph ↔ telemetry-value-quality-weight-and-age-register → observability-and-critical-measurement-analysis → estimated-bus-voltage-angle-and-branch-flow-state → measured-versus-predicted-normalized-residual-ledger → bad-data-or-topology-error-hypothesis → suppress-correct-or-model-change-trial → rerun-and-residual-propagation-comparison → accepted-state-and-telemetry-model-work-queue`.
- Quan hệ bắt buộc luôn là: the shared estimate predicts every measurement, while a correction is credible only when its residual effect propagates coherently through the connected electrical neighborhood.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must process a fictional switch topology, expose one unobservable island or critical-measurement loss, rank normalized residuals, compare a bad-telemetry hypothesis with a switch-status hypothesis, run a reversible correction and accept the state only after convergence, observability and connected-neighborhood residuals improve.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-06-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-06-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-06-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-06-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-06-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-06-90` | Dominant task thực chất là `reconciliation-diff-workbench`. | Reject. |
| `AR-B13-06-91` | Dominant task thực chất là `dependency-topology-monitor`. | Reject. |
| `AR-B13-06-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `power-grid-state-estimation-residual-workbench` chỉ khi `AR-B13-06-01` đến `AR-B13-06-05` đều có bằng chứng và không có mã `AR-B13-06-90` đến `AR-B13-06-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
grid-state-estimation
└─ estimator-run-network-model-and-time-version
   └─ breaker-switch-topology-processor
      └─ electrical-island-and-measurement-adjacency-graph
         ↔─ telemetry-value-quality-weight-and-age-register
            └─ observability-and-critical-measurement-analysis
               └─ estimated-bus-voltage-angle-and-branch-flow-state
                  └─ measured-versus-predicted-normalized-residual-ledger
                     └─ bad-data-or-topology-error-hypothesis
                        └─ suppress-correct-or-model-change-trial
                           └─ rerun-and-residual-propagation-comparison
                              └─ accepted-state-and-telemetry-model-work-queue
```

- Required relationship: the shared estimate predicts every measurement, while a correction is credible only when its residual effect propagates coherently through the connected electrical neighborhood.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `grid-state-estimation` | Sở hữu bằng chứng, state và action cho grid state estimation mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `estimator-run-network-model-and-time-version` | Sở hữu bằng chứng, state và action cho estimator run network model and time version mà không mượn product semantics. | Theo sau `grid-state-estimation` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `breaker-switch-topology-processor` | Sở hữu bằng chứng, state và action cho breaker switch topology processor mà không mượn product semantics. | Theo sau `estimator-run-network-model-and-time-version` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `electrical-island-and-measurement-adjacency-graph` | Sở hữu bằng chứng, state và action cho electrical island and measurement adjacency graph mà không mượn product semantics. | Theo sau `breaker-switch-topology-processor` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `telemetry-value-quality-weight-and-age-register` | Sở hữu bằng chứng, state và action cho telemetry value quality weight and age register mà không mượn product semantics. | Đồng bộ hai chiều với `electrical-island-and-measurement-adjacency-graph` trong cùng selection context. |
| `observability-and-critical-measurement-analysis` | Sở hữu bằng chứng, state và action cho observability and critical measurement analysis mà không mượn product semantics. | Theo sau `telemetry-value-quality-weight-and-age-register` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `estimated-bus-voltage-angle-and-branch-flow-state` | Sở hữu bằng chứng, state và action cho estimated bus voltage angle and branch flow state mà không mượn product semantics. | Theo sau `observability-and-critical-measurement-analysis` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `measured-versus-predicted-normalized-residual-ledger` | Sở hữu bằng chứng, state và action cho measured versus predicted normalized residual ledger mà không mượn product semantics. | Theo sau `estimated-bus-voltage-angle-and-branch-flow-state` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `bad-data-or-topology-error-hypothesis` | Sở hữu bằng chứng, state và action cho bad data or topology error hypothesis mà không mượn product semantics. | Theo sau `measured-versus-predicted-normalized-residual-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `suppress-correct-or-model-change-trial` | Sở hữu bằng chứng, state và action cho suppress correct or model change trial mà không mượn product semantics. | Theo sau `bad-data-or-topology-error-hypothesis` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `rerun-and-residual-propagation-comparison` | Sở hữu bằng chứng, state và action cho rerun and residual propagation comparison mà không mượn product semantics. | Theo sau `suppress-correct-or-model-change-trial` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `accepted-state-and-telemetry-model-work-queue` | Sở hữu bằng chứng, state và action cho accepted state and telemetry model work queue mà không mượn product semantics. | Theo sau `rerun-and-residual-propagation-comparison` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Processed topology, measurement adjacency, observability result, estimated state, residual ranking, active hypothesis and before/after rerun remain simultaneously inspectable.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The selected island or residual and its connected measurement/model neighborhood remain primary; full topology, complete telemetry roster and prior trials move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Estimator run and island → observability gap or worst normalized residual → connected measurements and switch statuses → measured-versus-predicted evidence → bad-datum or topology hypothesis → reversible trial → rerun and neighborhood residual propagation → accept state or open work item; the network transforms into an adjacency path plus ranked residual route.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `grid-state-estimation → estimator-run-network-model-and-time-version → breaker-switch-topology-processor → electrical-island-and-measurement-adjacency-graph ↔ telemetry-value-quality-weight-and-age-register → observability-and-critical-measurement-analysis → estimated-bus-voltage-angle-and-branch-flow-state → measured-versus-predicted-normalized-residual-ledger → bad-data-or-topology-error-hypothesis → suppress-correct-or-model-change-trial → rerun-and-residual-propagation-comparison → accepted-state-and-telemetry-model-work-queue`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must process a fictional switch topology, expose one unobservable island or critical-measurement loss, rank normalized residuals, compare a bad-telemetry hypothesis with a switch-status hypothesis, run a reversible correction and accept the state only after convergence, observability and connected-neighborhood residuals improve.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `estimator-run-network-model-and-time-version` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `breaker-switch-topology-processor` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `electrical-island-and-measurement-adjacency-graph` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `telemetry-value-quality-weight-and-age-register` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `observability-and-critical-measurement-analysis` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `rerun-and-residual-propagation-comparison` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `accepted-state-and-telemetry-model-work-queue` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `estimator-run-network-model-and-time-version` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `accepted-state-and-telemetry-model-work-queue` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `grid-state-estimation` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: model loading/current/stale, topology processed/inconsistent, telemetry current/stale/missing/suspect/excluded, island observable/unobservable/weakly observable, estimator queued/converged/nonconvergent, residual within/warning/outlier, critical measurement present/lost, hypothesis untested/supported/rejected, correction draft/applied/rolled-back, rerun improved/regressed and state provisional/accepted/rejected.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Tạo và định chuẩn một trạng thái lưới điện bằng cách hòa giải topology đóng cắt với telemetry có trọng số qua phân tích observability, truy residual chuẩn hóa đến bad data hoặc lỗi mô hình và chứng minh tác động của mỗi sửa đổi bằng rerun.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `reconciliation-diff-workbench`, `dependency-topology-monitor`, anomaly dashboard or generic data-quality table; electrical observability, weighted measurements, a solved voltage/angle state, measured-versus-predicted normalized residuals, bad-data-versus-topology hypotheses and causal rerun propagation are mandatory.
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
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WAI-ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NERC — External Model Data Causing State Estimator to Not Converge](https://www.nerc.com/globalassets/programs/event-analysis/lessons-learned/ll20180602_external_model_data_causing_state_estimator_to_not_converge.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [PJM transmission manuals](https://www.pjm.com/library/manuals) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ERCOT NPRR979 state-estimator and telemetry standards](https://www.ercot.com/mktrules/issues/NPRR979) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "power-grid-state-estimation-residual-workbench",
  "situationCodes": [
    "<matched AR-B13-06-* codes>"
  ],
  "searchAliases": [
    "power",
    "state",
    "estimation",
    "residual",
    "workbench"
  ],
  "dominantTask": "Produce and qualify one electrical network state by reconciling switch topology and weighted telemetry through observability analysis, then tracing normalized measurement residuals to bad data or model errors and proving the effect of each correction by rerun.",
  "regions": [
    "grid-state-estimation",
    "estimator-run-network-model-and-time-version",
    "breaker-switch-topology-processor",
    "electrical-island-and-measurement-adjacency-graph",
    "telemetry-value-quality-weight-and-age-register",
    "observability-and-critical-measurement-analysis",
    "estimated-bus-voltage-angle-and-branch-flow-state",
    "measured-versus-predicted-normalized-residual-ledger",
    "bad-data-or-topology-error-hypothesis",
    "suppress-correct-or-model-change-trial",
    "rerun-and-residual-propagation-comparison",
    "accepted-state-and-telemetry-model-work-queue"
  ],
  "relationships": [
    "the shared estimate predicts every measurement, while a correction is credible only when its residual effect propagates coherently through the connected electrical neighborhood."
  ],
  "responsive": {
    "wide": "Processed topology, measurement adjacency, observability result, estimated state, residual ranking, active hypothesis and before/after rerun remain simultaneously inspectable.",
    "intermediate": "The selected island or residual and its connected measurement/model neighborhood remain primary; full topology, complete telemetry roster and prior trials move to synchronized routes.",
    "compact": "Estimator run and island → observability gap or worst normalized residual → connected measurements and switch statuses → measured-versus-predicted evidence → bad-datum or topology hypothesis → reversible trial → rerun and neighborhood residual propagation → accept state or open work item; the network transforms into an adjacency path plus ranked residual route.",
    "reflow": [
      "grid-state-estimation",
      "estimator-run-network-model-and-time-version",
      "breaker-switch-topology-processor",
      "electrical-island-and-measurement-adjacency-graph",
      "telemetry-value-quality-weight-and-age-register",
      "observability-and-critical-measurement-analysis",
      "estimated-bus-voltage-angle-and-branch-flow-state",
      "measured-versus-predicted-normalized-residual-ledger",
      "bad-data-or-topology-error-hypothesis",
      "suppress-correct-or-model-change-trial",
      "rerun-and-residual-propagation-comparison",
      "accepted-state-and-telemetry-model-work-queue"
    ]
  },
  "stateObligations": "model loading/current/stale, topology processed/inconsistent, telemetry current/stale/missing/suspect/excluded, island observable/unobservable/weakly observable, estimator queued/converged/nonconvergent, residual within/warning/outlier, critical measurement present/lost, hypothesis untested/supported/rejected, correction draft/applied/rolled-back, rerun improved/regressed and state provisional/accepted/rejected.",
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
