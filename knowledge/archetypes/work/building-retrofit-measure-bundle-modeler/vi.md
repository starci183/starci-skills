# Building Retrofit Measure Bundle Modeler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `building-retrofit-measure-bundle-modeler` |
| Family | Work |
| Dominant task | Ghép một gói retrofit có tương tác trên baseline tòa nhà đã hiệu chuẩn, định lượng phần kết quả gói khác tổng các biện pháp riêng lẻ và gắn kết quả không cộng tính được chọn với kế hoạch triển khai cùng đo lường–xác minh. |
| Search aliases | `building`, `retrofit`, `measure`, `bundle`, `modeler` |
| Authority | Macro topology dùng chung, trung lập với sản phẩm. |

### Invariants

- Dominant task luôn là: Ghép một gói retrofit có tương tác trên baseline tòa nhà đã hiệu chuẩn, định lượng phần kết quả gói khác tổng các biện pháp riêng lẻ và gắn kết quả không cộng tính được chọn với kế hoạch triển khai cùng đo lường–xác minh.
- Required region graph luôn là `retrofit-modeler → calibrated-building-baseline-and-end-use-ledger → measure-library → compatibility-precedence-and-non-additive-interaction-matrix ↔ candidate-package-composer → isolated-measure-runs-and-combined-package-run → summed-isolated-expectation-versus-package-interaction-residual → energy-cost-carbon-comfort-health-and-safety-results → selected-package-and-phasing → outcome-owner-meter-and-measurement-verification-plan`.
- Quan hệ bắt buộc luôn là: the interaction matrix owns legal combinations, while the package-minus-isolated residual proves that bundle performance is not an additive checklist.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Mọi thay đổi phải giữ acceptance proof này: Template must calibrate a baseline, compose a three-measure package, block one incompatible pair, show at least one synergistic or antagonistic interaction whose package result differs from the isolated sum, rerun after correction and attach named outcome owners, meters and verification periods to the selected package.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-13-01` | Dominant task và authority phù hợp đầy đủ. | Candidate evidence. |
| `AR-B13-13-02` | Toàn bộ required region graph hiện diện theo đúng semantic order. | Required evidence. |
| `AR-B13-13-03` | Wide, intermediate và compact giữ cùng task, selection, state và recovery. | Required evidence. |
| `AR-B13-13-04` | Quan hệ bắt buộc được chứng minh bằng evidence có thể truy vết. | Required relationship evidence. |
| `AR-B13-13-05` | Acceptance focus hoạt động bằng keyboard và có trạng thái fail, sửa, rerun, success. | Required interaction evidence. |
| `AR-B13-13-90` | Dominant task thực chất là `adjacent generic archetype`. | Reject. |
| `AR-B13-13-91` | Dominant task thực chất là `noun-only variation`. | Reject. |
| `AR-B13-13-99` | Candidate chỉ đổi product noun, số lượng, mật độ, màu, component hoặc state. | `duplicate-or-variation`. |

### Selection rule

Chọn `building-retrofit-measure-bundle-modeler` chỉ khi `AR-B13-13-01` đến `AR-B13-13-05` đều có bằng chứng và không có mã `AR-B13-13-90` đến `AR-B13-13-99`. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc. Trả `reject` khi có rejection code.

## Region graph

```text
retrofit-modeler
└─ calibrated-building-baseline-and-end-use-ledger
   └─ measure-library
      └─ compatibility-precedence-and-non-additive-interaction-matrix
         ↔─ candidate-package-composer
            └─ isolated-measure-runs-and-combined-package-run
               └─ summed-isolated-expectation-versus-package-interaction-residual
                  └─ energy-cost-carbon-comfort-health-and-safety-results
                     └─ selected-package-and-phasing
                        └─ outcome-owner-meter-and-measurement-verification-plan
```

- Required relationship: the interaction matrix owns legal combinations, while the package-minus-isolated residual proves that bundle performance is not an additive checklist.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `retrofit-modeler` | Sở hữu bằng chứng, state và action cho retrofit modeler mà không mượn product semantics. | Là gốc của graph và giữ state của dominant task. |
| `calibrated-building-baseline-and-end-use-ledger` | Sở hữu bằng chứng, state và action cho calibrated building baseline and end use ledger mà không mượn product semantics. | Theo sau `retrofit-modeler` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `measure-library` | Sở hữu bằng chứng, state và action cho measure library mà không mượn product semantics. | Theo sau `calibrated-building-baseline-and-end-use-ledger` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `compatibility-precedence-and-non-additive-interaction-matrix` | Sở hữu bằng chứng, state và action cho compatibility precedence and non additive interaction matrix mà không mượn product semantics. | Theo sau `measure-library` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `candidate-package-composer` | Sở hữu bằng chứng, state và action cho candidate package composer mà không mượn product semantics. | Đồng bộ hai chiều với `compatibility-precedence-and-non-additive-interaction-matrix` trong cùng selection context. |
| `isolated-measure-runs-and-combined-package-run` | Sở hữu bằng chứng, state và action cho isolated measure runs and combined package run mà không mượn product semantics. | Theo sau `candidate-package-composer` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `summed-isolated-expectation-versus-package-interaction-residual` | Sở hữu bằng chứng, state và action cho summed isolated expectation versus package interaction residual mà không mượn product semantics. | Theo sau `isolated-measure-runs-and-combined-package-run` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `energy-cost-carbon-comfort-health-and-safety-results` | Sở hữu bằng chứng, state và action cho energy cost carbon comfort health and safety results mà không mượn product semantics. | Theo sau `summed-isolated-expectation-versus-package-interaction-residual` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `selected-package-and-phasing` | Sở hữu bằng chứng, state và action cho selected package and phasing mà không mượn product semantics. | Theo sau `energy-cost-carbon-comfort-health-and-safety-results` trong semantic order và nhận đúng context đã được kiểm chứng. |
| `outcome-owner-meter-and-measurement-verification-plan` | Sở hữu bằng chứng, state và action cho outcome owner meter and measurement verification plan mà không mượn product semantics. | Theo sau `selected-package-and-phasing` trong semantic order và nhận đúng context đã được kiểm chứng. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các owner đồng thời không còn giữ được label đọc được, liên kết vùng chính xác và action đầy đủ.
- **Topology response:** Calibrated baseline, package composer, interaction matrix, isolated-versus-package residual, multidimensional results and M&V ownership remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner đồng thời vẫn sử dụng được.
- **Sticky boundary:** Chỉ action đang hoạt động được persist; bề mặt này phải chừa chỗ và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ vùng evidence dạng bảng, graph, timeline hoặc matrix được chỉ định mới có bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persist ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc khó thao tác.
- **Topology response:** The active package, selected interaction cell and package residual remain primary; measure library, calibration evidence, other outcome dimensions and verification history move to synchronized routes.
- **Navigation replacement:** Named route đưa vùng đã dời trở lại với selection và state không đổi.
- **Sticky boundary:** Action chỉ persist khi target và status của nó vẫn nhìn thấy; ở chiều cao ngắn action trở về flow.
- **Overflow owner:** Bounded evidence region giữ overflow; prose và controls phải reflow.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task đồng thời không thể giữ evidence dễ đọc và control 44×44 CSS px.
- **Topology response:** Retrofit objective → calibrated baseline gap → add measure → inspect pairwise dependency/conflict/interaction → run isolated and package cases → explain non-additive residual → compare constraints → select package → assign M&V owner/meter; the library transforms into scoped search rather than stacked cards.
- **Navigation replacement:** Previous, Next và named step controls khôi phục đúng selection, state và scroll context.
- **Sticky boundary:** Step control chừa không gian nội dung, không che focus và yield ở chiều cao ngắn.
- **Overflow owner:** Chỉ evidence table/graph cần thiết được phép bounded overflow; mọi nội dung khác dùng page scrolling.

### Reflow

- Semantic và DOM order là `retrofit-modeler → calibrated-building-baseline-and-end-use-ledger → measure-library → compatibility-precedence-and-non-additive-interaction-matrix ↔ candidate-package-composer → isolated-measure-runs-and-combined-package-run → summed-isolated-expectation-versus-package-interaction-residual → energy-cost-carbon-comfort-health-and-safety-results → selected-package-and-phasing → outcome-owner-meter-and-measurement-verification-plan`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change dựa trên quan hệ.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Label dài phải wrap và mọi vùng ẩn có named accessible reveal path.
- Nội dung thông thường không tạo page-level horizontal scroll.

### Interaction parity

- Mọi selection, evidence, action, retry và recovery ở wide đều truy cập được ở intermediate và compact.
- Topology change giữ nguyên selected item, causal path, data state và receipt pending/completed.
- Dynamic update announce một contextual status mà không cướp focus.
- Color, position, geometry và visual mark luôn có text hoặc tabular equivalent.
- Acceptance path phải giữ nguyên: Template must calibrate a baseline, compose a three-measure package, block one incompatible pair, show at least one synergistic or antagonistic interaction whose package result differs from the isolated sum, rerun after correction and attach named outcome owners, meters and verification periods to the selected package.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `calibrated-building-baseline-and-end-use-ledger` | Nêu owner đang chờ và giữ semantic position. |
| Ready | `measure-library` | Mở toàn bộ dominant task và synchronized evidence. |
| Empty / not applicable | `compatibility-precedence-and-non-additive-interaction-matrix` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `candidate-package-composer` | Giữ context hợp lệ và retry cục bộ mà không reset selection. |
| Permission / unavailable | `isolated-measure-runs-and-combined-package-run` | Không ngụ ý evidence ẩn là không tồn tại; cung cấp safe alternate route. |
| Pending | `selected-package-and-phasing` | Ngăn action trùng và announce progress mà không chuyển focus. |
| Success | `outcome-owner-meter-and-measurement-verification-plan` | Hiển thị receipt, giữ context và đưa next valid action. |
| Stale / conflict | `calibrated-building-baseline-and-end-use-ledger` | Giữ last safe value và yêu cầu explicit recovery. |
| Focus transition | `outcome-owner-meter-and-measurement-verification-plan` | Chỉ chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `retrofit-modeler` | Giữ selection, state và recovery khi topology đổi. |

Applicable state family: baseline incomplete/calibrating/calibrated/stale, measure available/inapplicable/dependent/conflicting, interaction unknown/additive/synergistic/antagonistic, package draft/invalid/ready, isolated or package run queued/running/failed, residual unexplained/explained, comfort or safety constraint breached, cost estimate provisional, package selected/superseded and M&V owner/metric missing/approved.

## Boundaries

### Accept

- Accept khi dominant task đúng là: Ghép một gói retrofit có tương tác trên baseline tòa nhà đã hiệu chuẩn, định lượng phần kết quả gói khác tổng các biện pháp riêng lẻ và gắn kết quả không cộng tính được chọn với kế hoạch triển khai cùng đo lường–xác minh.
- Accept khi complete region graph và mandatory relationship cùng có bằng chứng.
- Accept khi compact giữ exact task evidence, action và recovery.

### Reject

- Reject cho `scenario-sensitivity-modeler`, calculation estimate flow, comparison matrix or generic sustainability dashboard; a calibrated baseline, explicit non-additive interaction matrix, isolated-versus-package residual, package-level simulation and owned measurement-and-verification plan are mandatory.
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
| [DOE Advanced Energy Retrofit Guides](https://www.energy.gov/cmei/buildings/advanced-energy-retrofit-guides) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE building energy modeling](https://www.energy.gov/cmei/buildings/about-building-energy-modeling) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DOE zero-energy design tools](https://www.energy.gov/cmei/buildings/zero-energy-building-design-tools) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

Tập nguồn đại diện ít nhất ba tổ chức chính thức độc lập và bao gồm W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "building-retrofit-measure-bundle-modeler",
  "situationCodes": [
    "<matched AR-B13-13-* codes>"
  ],
  "searchAliases": [
    "building",
    "retrofit",
    "measure",
    "bundle",
    "modeler"
  ],
  "dominantTask": "Compose an interacting retrofit package against a calibrated building baseline, quantify where package results differ from the sum of isolated measures and bind the selected non-additive outcome to an implementation and measurement-and-verification plan.",
  "regions": [
    "retrofit-modeler",
    "calibrated-building-baseline-and-end-use-ledger",
    "measure-library",
    "compatibility-precedence-and-non-additive-interaction-matrix",
    "candidate-package-composer",
    "isolated-measure-runs-and-combined-package-run",
    "summed-isolated-expectation-versus-package-interaction-residual",
    "energy-cost-carbon-comfort-health-and-safety-results",
    "selected-package-and-phasing",
    "outcome-owner-meter-and-measurement-verification-plan"
  ],
  "relationships": [
    "the interaction matrix owns legal combinations, while the package-minus-isolated residual proves that bundle performance is not an additive checklist."
  ],
  "responsive": {
    "wide": "Calibrated baseline, package composer, interaction matrix, isolated-versus-package residual, multidimensional results and M&V ownership remain simultaneously visible.",
    "intermediate": "The active package, selected interaction cell and package residual remain primary; measure library, calibration evidence, other outcome dimensions and verification history move to synchronized routes.",
    "compact": "Retrofit objective → calibrated baseline gap → add measure → inspect pairwise dependency/conflict/interaction → run isolated and package cases → explain non-additive residual → compare constraints → select package → assign M&V owner/meter; the library transforms into scoped search rather than stacked cards.",
    "reflow": [
      "retrofit-modeler",
      "calibrated-building-baseline-and-end-use-ledger",
      "measure-library",
      "compatibility-precedence-and-non-additive-interaction-matrix",
      "candidate-package-composer",
      "isolated-measure-runs-and-combined-package-run",
      "summed-isolated-expectation-versus-package-interaction-residual",
      "energy-cost-carbon-comfort-health-and-safety-results",
      "selected-package-and-phasing",
      "outcome-owner-meter-and-measurement-verification-plan"
    ]
  },
  "stateObligations": "baseline incomplete/calibrating/calibrated/stale, measure available/inapplicable/dependent/conflicting, interaction unknown/additive/synergistic/antagonistic, package draft/invalid/ready, isolated or package run queued/running/failed, residual unexplained/explained, comfort or safety constraint breached, cost estimate provisional, package selected/superseded and M&V owner/metric missing/approved.",
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
