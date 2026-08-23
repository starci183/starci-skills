# Prescribed Fire Ignition Window Control Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `prescribed-fire-ignition-window-control-planner` |
| Family | Flow |
| Dominant task | Cho phép và kiểm soát việc đốt theo giai đoạn trong một burn unit bằng cửa sổ prescription có giới hạn thời gian, chỉ đưa các ignition block đủ điều kiện và đủ holding coverage đi tiếp, rồi dừng trước khi điều kiện hoặc nguồn lực ra khỏi cửa sổ. |
| Search aliases | `prescribed`, `ignition`, `window`, `control`, `planner` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Cho phép và kiểm soát việc đốt theo giai đoạn trong một burn unit bằng cửa sổ prescription có giới hạn thời gian, chỉ đưa các ignition block đủ điều kiện và đủ holding coverage đi tiếp, rồi dừng trước khi điều kiện hoặc nguồn lực ra khỏi cửa sổ.
- Required region graph luôn là `prescribed-fire-control → approved-burn-unit-plan-objectives-and-authority → control-line-and-ignition-block-adjacency-topology ↔ time-indexed-weather-fuel-moisture-and-smoke-prescription-window → sensitive-receptor-and-dispersion-constraint-set → holding-contingency-and-escape-resource-coverage → eligible-block-order-and-ignition-method → go-no-go-and-test-fire-gate → active-block-observation-and-window-consumption → continue-pause-mop-up-or-wildfire-conversion → post-burn-objective-smoke-and-action-record`.
- Quan hệ bắt buộc luôn là: spatial block eligibility and the remaining safe time window jointly own every ignition decision.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must open a fictional ignition window, block one ignition block for missing holding coverage, pass a documented test fire, consume the window as two adjacent blocks ignite, pause when a smoke or weather threshold is crossed and expose mop-up, contingency and wildfire-conversion recovery without losing the approved plan snapshot.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-05-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-05-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-05-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-05-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-05-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-05-90` | Dominant task thực chất là `stage-gated-process-record`. | Reject. |
| `AR-B13-05-91` | Dominant task thực chất là `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-05-92` | Dominant task thực chất là `live-operations-command-center`. | Reject. |
| `AR-B13-05-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `prescribed-fire-ignition-window-control-planner` chỉ khi `AR-B13-05-01` đến `AR-B13-05-05` đều có bằng chứng và không có mã `AR-B13-05-90` đến `AR-B13-05-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
prescribed-fire-control
└─ approved-burn-unit-plan-objectives-and-authority
   └─ control-line-and-ignition-block-adjacency-topology
      ↔─ time-indexed-weather-fuel-moisture-and-smoke-prescription-window
         └─ sensitive-receptor-and-dispersion-constraint-set
            └─ holding-contingency-and-escape-resource-coverage
               └─ eligible-block-order-and-ignition-method
                  └─ go-no-go-and-test-fire-gate
                     └─ active-block-observation-and-window-consumption
                        └─ continue-pause-mop-up-or-wildfire-conversion
                           └─ post-burn-objective-smoke-and-action-record
```

- Required relationship: spatial block eligibility and the remaining safe time window jointly own every ignition decision.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `prescribed-fire-control` | Sở hữu bằng chứng, state và action cho prescribed fire control mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `approved-burn-unit-plan-objectives-and-authority` | Sở hữu bằng chứng, state và action cho approved burn unit plan objectives and authority mà không mượn product semantics. | Theo sau `prescribed-fire-control` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `control-line-and-ignition-block-adjacency-topology` | Sở hữu bằng chứng, state và action cho control line and ignition block adjacency topology mà không mượn product semantics. | Theo sau `approved-burn-unit-plan-objectives-and-authority` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` | Sở hữu bằng chứng, state và action cho time indexed weather fuel moisture and smoke prescription window mà không mượn product semantics. | Đồng bộ hai chiều với `control-line-and-ignition-block-adjacency-topology` trong cùng selection context. |
| `sensitive-receptor-and-dispersion-constraint-set` | Sở hữu bằng chứng, state và action cho sensitive receptor and dispersion constraint set mà không mượn product semantics. | Theo sau `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `holding-contingency-and-escape-resource-coverage` | Sở hữu bằng chứng, state và action cho holding contingency and escape resource coverage mà không mượn product semantics. | Theo sau `sensitive-receptor-and-dispersion-constraint-set` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `eligible-block-order-and-ignition-method` | Sở hữu bằng chứng, state và action cho eligible block order and ignition method mà không mượn product semantics. | Theo sau `holding-contingency-and-escape-resource-coverage` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `go-no-go-and-test-fire-gate` | Sở hữu bằng chứng, state và action cho go no go and test fire gate mà không mượn product semantics. | Theo sau `eligible-block-order-and-ignition-method` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `active-block-observation-and-window-consumption` | Sở hữu bằng chứng, state và action cho active block observation and window consumption mà không mượn product semantics. | Theo sau `go-no-go-and-test-fire-gate` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `continue-pause-mop-up-or-wildfire-conversion` | Sở hữu bằng chứng, state và action cho continue pause mop up or wildfire conversion mà không mượn product semantics. | Theo sau `active-block-observation-and-window-consumption` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `post-burn-objective-smoke-and-action-record` | Sở hữu bằng chứng, state và action cho post burn objective smoke and action record mà không mượn product semantics. | Theo sau `continue-pause-mop-up-or-wildfire-conversion` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Burn-unit topology, forecast/observed prescription window, smoke receptors, block order, resource coverage and current go/no-go gate remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The active block, its adjacent control lines, remaining window and holding coverage remain primary; other blocks, forecast members, receptor detail and the complete action record move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Burn day and authority → current prescription window → next eligible ignition block and adjacent control lines → smoke receptors and holding resources → go/no-go/test fire → ignite or pause → observed window consumption → next block, mop-up or conversion; the map transforms into an ordered block-adjacency spine with explicit escape and holding facts.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `prescribed-fire-control → approved-burn-unit-plan-objectives-and-authority → control-line-and-ignition-block-adjacency-topology ↔ time-indexed-weather-fuel-moisture-and-smoke-prescription-window → sensitive-receptor-and-dispersion-constraint-set → holding-contingency-and-escape-resource-coverage → eligible-block-order-and-ignition-method → go-no-go-and-test-fire-gate → active-block-observation-and-window-consumption → continue-pause-mop-up-or-wildfire-conversion → post-burn-objective-smoke-and-action-record`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must open a fictional ignition window, block one ignition block for missing holding coverage, pass a documented test fire, consume the window as two adjacent blocks ignite, pause when a smoke or weather threshold is crossed and expose mop-up, contingency and wildfire-conversion recovery without losing the approved plan snapshot.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `approved-burn-unit-plan-objectives-and-authority` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `control-line-and-ignition-block-adjacency-topology` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `sensitive-receptor-and-dispersion-constraint-set` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `holding-contingency-and-escape-resource-coverage` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `continue-pause-mop-up-or-wildfire-conversion` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `post-burn-objective-smoke-and-action-record` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `approved-burn-unit-plan-objectives-and-authority` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `post-burn-objective-smoke-and-action-record` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `prescribed-fire-control` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: plan draft/approved/expired, unit ready/not-ready, forecast missing/current/divergent, prescription window closed/open/narrowing/exceeded, fuel moisture within/outside range, smoke receptor clear/at-risk/impacted, resource unassigned/ready/diverted, block locked/eligible/igniting/complete, test fire pending/pass/fail, ignition continue/paused/terminated, contingency activated, wildfire conversion ordered and post-burn review open/complete.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Cho phép và kiểm soát việc đốt theo giai đoạn trong một burn unit bằng cửa sổ prescription có giới hạn thời gian, chỉ đưa các ignition block đủ điều kiện và đủ holding coverage đi tiếp, rồi dừng trước khi điều kiện hoặc nguồn lực ra khỏi cửa sổ.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `stage-gated-process-record`, `permit-to-work-isolation-control-room`, `live-operations-command-center`, generic weather planning or incident dispatch; an approved burn-unit block topology, time-consuming prescription window, smoke receptors, block-specific holding/contingency coverage, test-fire gate and explicit pause-or-conversion path are mandatory.
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
| [NWCG Standards for Prescribed Fire Planning and Implementation](https://www.nwcg.gov/publications/pms484) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [National Weather Service Fire Weather](https://www.weather.gov/fire/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA prescribed-burning and air-quality guidance](https://www.epa.gov/agriculture/agriculture-and-air-quality) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "prescribed-fire-ignition-window-control-planner",
  "situationCodes": [
    "<matched AR-B13-05-* codes>"
  ],
  "searchAliases": [
    "prescribed",
    "ignition",
    "window",
    "control",
    "planner"
  ],
  "dominantTask": "Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window.",
  "regions": [
    "prescribed-fire-control",
    "approved-burn-unit-plan-objectives-and-authority",
    "control-line-and-ignition-block-adjacency-topology",
    "time-indexed-weather-fuel-moisture-and-smoke-prescription-window",
    "sensitive-receptor-and-dispersion-constraint-set",
    "holding-contingency-and-escape-resource-coverage",
    "eligible-block-order-and-ignition-method",
    "go-no-go-and-test-fire-gate",
    "active-block-observation-and-window-consumption",
    "continue-pause-mop-up-or-wildfire-conversion",
    "post-burn-objective-smoke-and-action-record"
  ],
  "relationships": [
    "spatial block eligibility and the remaining safe time window jointly own every ignition decision."
  ],
  "responsive": {
    "wide": "Burn-unit topology, forecast/observed prescription window, smoke receptors, block order, resource coverage and current go/no-go gate remain simultaneously visible.",
    "intermediate": "The active block, its adjacent control lines, remaining window and holding coverage remain primary; other blocks, forecast members, receptor detail and the complete action record move to synchronized routes.",
    "compact": "Burn day and authority → current prescription window → next eligible ignition block and adjacent control lines → smoke receptors and holding resources → go/no-go/test fire → ignite or pause → observed window consumption → next block, mop-up or conversion; the map transforms into an ordered block-adjacency spine with explicit escape and holding facts.",
    "reflow": [
      "prescribed-fire-control",
      "approved-burn-unit-plan-objectives-and-authority",
      "control-line-and-ignition-block-adjacency-topology",
      "time-indexed-weather-fuel-moisture-and-smoke-prescription-window",
      "sensitive-receptor-and-dispersion-constraint-set",
      "holding-contingency-and-escape-resource-coverage",
      "eligible-block-order-and-ignition-method",
      "go-no-go-and-test-fire-gate",
      "active-block-observation-and-window-consumption",
      "continue-pause-mop-up-or-wildfire-conversion",
      "post-burn-objective-smoke-and-action-record"
    ]
  },
  "stateObligations": "plan draft/approved/expired, unit ready/not-ready, forecast missing/current/divergent, prescription window closed/open/narrowing/exceeded, fuel moisture within/outside range, smoke receptor clear/at-risk/impacted, resource unassigned/ready/diverted, block locked/eligible/igniting/complete, test fire pending/pass/fail, ignition continue/paused/terminated, contingency activated, wildfire conversion ordered and post-burn review open/complete.",
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
